import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { cidrContains, isValidCidr, isValidIp } from '../lib/cidr';
import { Device } from '../entities/device.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';
import { Gateway } from '../entities/gateway.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { EventsService } from '../events/events.service';
import { deviceCreatedEvent } from '../events/live-event';

export interface ImportVlan {
  vlanId: number;
  name: string;
}

export interface ImportSubnet {
  cidr: string;
  name: string;
  gateway?: string;
  vlanId?: number | null;
  domainName?: string;
  dnsServers?: string[];
  ntpServers?: string[];
}

export interface ImportReservedIp {
  ip: string;
  mac?: string;
  hostname?: string;
}

export interface ImportDhcpRange {
  name: string;
  startIp: string;
  endIp: string;
}

export interface NetworkImportResult {
  vlansCreated: number;
  subnetsCreated: number;
  subnetsLinked: number;
  gatewaysAdded: number;
  devicesLinked: number;
  subnetConfigsAdded: number;
  reservedDevicesAdded: number;
  poolsAdded: number;
}

function joinList(values: string[] | undefined): string {
  if (!values) return '';
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).join(', ');
}

@Injectable()
export class NetworkImportService {
  constructor(
    @InjectRepository(Vlan) private readonly vlanRepo: Repository<Vlan>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(Gateway) private readonly gatewayRepo: Repository<Gateway>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(DhcpPool) private readonly poolRepo: Repository<DhcpPool>,
    private readonly events: EventsService,
  ) {}

  async importNetwork(
    vlans: ImportVlan[],
    subnets: ImportSubnet[],
    reservedIps: ImportReservedIp[] = [],
    dhcpRanges: ImportDhcpRange[] = [],
  ): Promise<NetworkImportResult> {
    const result: NetworkImportResult = {
      vlansCreated: 0,
      subnetsCreated: 0,
      subnetsLinked: 0,
      gatewaysAdded: 0,
      devicesLinked: 0,
      subnetConfigsAdded: 0,
      reservedDevicesAdded: 0,
      poolsAdded: 0,
    };
    const pkByVlanId = new Map<number, number>();
    for (const entry of vlans) {
      if (!Number.isInteger(entry.vlanId) || entry.vlanId < 0 || entry.vlanId > 4095) {
        continue;
      }
      let existing = await this.vlanRepo.findOne({ where: { vlanId: entry.vlanId } });
      if (!existing) {
        existing = await this.vlanRepo.save(
          this.vlanRepo.create({
            vlanId: entry.vlanId,
            name: entry.name,
            description: '',
          }),
        );
        result.vlansCreated += 1;
      }
      pkByVlanId.set(entry.vlanId, existing.id);
    }
    const pkCache = new Map<number, number | null>(
      [...pkByVlanId.entries()].map(([vlanId, id]) => [vlanId, id] as [number, number]),
    );
    const resolveVlanPk = async (vlanId: number): Promise<number | null> => {
      if (pkCache.has(vlanId)) return pkCache.get(vlanId) ?? null;
      const vlan = await this.vlanRepo.findOne({ where: { vlanId } });
      const pk = vlan ? vlan.id : null;
      pkCache.set(vlanId, pk);
      return pk;
    };
    for (const entry of subnets) {
      if (!isValidCidr(entry.cidr)) continue;
      const targetPk =
        entry.vlanId !== undefined && entry.vlanId !== null
          ? await resolveVlanPk(entry.vlanId)
          : null;
      const existing = await this.subnetRepo.findOne({ where: { cidr: entry.cidr } });
      if (!existing) {
        const saved = await this.subnetRepo.save(
          this.subnetRepo.create({
            cidr: entry.cidr,
            name: entry.name,
            includeFirstLast: false,
            vlanId: targetPk,
            description: '',
            domainName: entry.domainName ?? '',
            dnsServers: joinList(entry.dnsServers),
            ntpServers: joinList(entry.ntpServers),
          }),
        );
        result.subnetsCreated += 1;
        if (entry.domainName || entry.dnsServers?.length || entry.ntpServers?.length) {
          result.subnetConfigsAdded += 1;
        }
        if (entry.gateway && isValidIp(entry.gateway)) {
          await this.gatewayRepo.save(
            this.gatewayRepo.create({ ip: entry.gateway, subnetId: saved.id }),
          );
          result.gatewaysAdded += 1;
        }
        continue;
      }
      let changed = false;
      if (
        entry.vlanId !== undefined &&
        entry.vlanId !== null &&
        targetPk !== null &&
        existing.vlanId === null
      ) {
        existing.vlanId = targetPk;
        changed = true;
      }
      let configAdded = false;
      if (entry.domainName && !existing.domainName) {
        existing.domainName = entry.domainName;
        configAdded = true;
      }
      const dnsServers = joinList(entry.dnsServers);
      if (dnsServers && !existing.dnsServers) {
        existing.dnsServers = dnsServers;
        configAdded = true;
      }
      const ntpServers = joinList(entry.ntpServers);
      if (ntpServers && !existing.ntpServers) {
        existing.ntpServers = ntpServers;
        configAdded = true;
      }
      if (configAdded) result.subnetConfigsAdded += 1;
      if (entry.gateway && isValidIp(entry.gateway)) {
        const gateways = await this.gatewayRepo.find({ where: { subnetId: existing.id } });
        if (!gateways.some((gateway) => gateway.ip === entry.gateway)) {
          await this.gatewayRepo.save(
            this.gatewayRepo.create({ ip: entry.gateway, subnetId: existing.id }),
          );
          result.gatewaysAdded += 1;
        }
      }
      if (changed || configAdded) {
        await this.subnetRepo.save(existing);
        if (changed) result.subnetsLinked += 1;
      }
    }
    const allSubnets = await this.subnetRepo.find();
    for (const entry of reservedIps) {
      if (!isValidIp(entry.ip)) continue;
      const subnetId = this.findSubnetId(allSubnets, entry.ip);
      const existing = await this.deviceRepo.findOne({ where: { ip: entry.ip } });
      if (existing) {
        let changed = false;
        if (entry.mac && existing.mac !== entry.mac) {
          existing.mac = entry.mac;
          changed = true;
        }
        if (entry.hostname && existing.hostname !== entry.hostname) {
          existing.hostname = entry.hostname;
          changed = true;
        }
        if (existing.subnetId === null && subnetId !== null) {
          existing.subnetId = subnetId;
          changed = true;
        }
        if (changed) await this.deviceRepo.save(existing);
      } else {
        const created = await this.deviceRepo.save(
          this.deviceRepo.create({
            ip: entry.ip,
            mac: entry.mac ?? '',
            hostname: entry.hostname ?? '',
            vendor: '',
            subnetId,
            status: 'offline',
            lastSeen: new Date(),
            notes: '',
          }),
        );
        result.reservedDevicesAdded += 1;
        this.events.publish(deviceCreatedEvent(created));
      }
    }
    for (const entry of dhcpRanges) {
      if (!isValidIp(entry.startIp) || !isValidIp(entry.endIp)) continue;
      const subnet = allSubnets.find(
        (candidate) =>
          isValidCidr(candidate.cidr) &&
          cidrContains(candidate.cidr, entry.startIp) &&
          cidrContains(candidate.cidr, entry.endIp),
      );
      if (!subnet) continue;
      const pools = await this.poolRepo.find({ where: { subnetId: subnet.id } });
      const sameRange = pools.find(
        (pool) => pool.startIp === entry.startIp && pool.endIp === entry.endIp,
      );
      if (sameRange) {
        if (entry.name && sameRange.name !== entry.name) {
          sameRange.name = entry.name;
          await this.poolRepo.save(sameRange);
        }
        continue;
      }
      const sameName = entry.name
        ? pools.find((pool) => pool.name === entry.name)
        : undefined;
      if (sameName) {
        sameName.startIp = entry.startIp;
        sameName.endIp = entry.endIp;
        await this.poolRepo.save(sameName);
        continue;
      }
      await this.poolRepo.save(
        this.poolRepo.create({
          name: entry.name,
          startIp: entry.startIp,
          endIp: entry.endIp,
          subnetId: subnet.id,
        }),
      );
      result.poolsAdded += 1;
    }
    const orphans = await this.deviceRepo.find({ where: { subnetId: IsNull() } });
    for (const device of orphans) {
      const match = allSubnets.find(
        (subnet) => isValidCidr(subnet.cidr) && cidrContains(subnet.cidr, device.ip),
      );
      if (match) {
        device.subnetId = match.id;
        await this.deviceRepo.save(device);
        result.devicesLinked += 1;
      }
    }
    return result;
  }

  private findSubnetId(subnets: Subnet[], ip: string): number | null {
    for (const subnet of subnets) {
      if (isValidCidr(subnet.cidr) && cidrContains(subnet.cidr, ip)) {
        return subnet.id;
      }
    }
    return null;
  }
}
