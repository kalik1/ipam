import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { totalHosts } from '../lib/cidr';
import { subnetGatewayIps } from '../lib/subnet-response';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';

export interface TopologyDevice {
  id: number;
  ip: string;
  hostname: string;
  status: Device['status'];
  lastSeen: Date;
}

export interface TopologySubnet {
  id: number;
  cidr: string;
  name: string;
  gateways: string[];
  used: number;
  total: number;
  percent: number;
  devices: TopologyDevice[];
}

export interface TopologyVlan {
  id: number | null;
  vlanId: number | null;
  name: string;
  description: string;
  subnets: TopologySubnet[];
}

export interface Topology {
  vlans: TopologyVlan[];
}

@Injectable()
export class TopologyService {
  constructor(
    @InjectRepository(Vlan) private readonly vlanRepo: Repository<Vlan>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
  ) {}

  async getTopology(): Promise<Topology> {
    const [vlans, subnets, devices] = await Promise.all([
      this.vlanRepo.find({ order: { vlanId: 'ASC' } }),
      this.subnetRepo.find({
        order: { id: 'ASC' },
        relations: { gateways: true },
      }),
      this.deviceRepo.find({ order: { ip: 'ASC' } }),
    ]);

    const devicesBySubnet = new Map<number, Device[]>();
    for (const device of devices) {
      if (device.subnetId === null) continue;
      const list = devicesBySubnet.get(device.subnetId) ?? [];
      list.push(device);
      devicesBySubnet.set(device.subnetId, list);
    }

    const subnetsByVlan = new Map<number, Subnet[]>();
    const unassignedSubnets: Subnet[] = [];
    for (const subnet of subnets) {
      if (subnet.vlanId === null) {
        unassignedSubnets.push(subnet);
      } else {
        const list = subnetsByVlan.get(subnet.vlanId) ?? [];
        list.push(subnet);
        subnetsByVlan.set(subnet.vlanId, list);
      }
    }

    const toTopologySubnet = (subnet: Subnet): TopologySubnet => {
      const used = devicesBySubnet.get(subnet.id)?.length ?? 0;
      const total = totalHosts(subnet.cidr, subnet.includeFirstLast);
      return {
        id: subnet.id,
        cidr: subnet.cidr,
        name: subnet.name,
        gateways: subnetGatewayIps(subnet),
        used,
        total,
        percent: total === 0 ? 0 : Math.round((used / total) * 1000) / 10,
        devices: (devicesBySubnet.get(subnet.id) ?? []).map((device) => ({
          id: device.id,
          ip: device.ip,
          hostname: device.hostname,
          status: device.status,
          lastSeen: device.lastSeen,
        })),
      };
    };

    const vlansWithSubnets: TopologyVlan[] = vlans.map((vlan) => ({
      id: vlan.id,
      vlanId: vlan.vlanId,
      name: vlan.name,
      description: vlan.description,
      subnets: (subnetsByVlan.get(vlan.id) ?? []).map(toTopologySubnet),
    }));

    if (unassignedSubnets.length > 0) {
      vlansWithSubnets.push({
        id: null,
        vlanId: null,
        name: 'Unassigned',
        description: '',
        subnets: unassignedSubnets.map(toTopologySubnet),
      });
    }

    return { vlans: vlansWithSubnets };
  }
}
