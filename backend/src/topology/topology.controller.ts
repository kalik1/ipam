import { Controller, Get } from '@nestjs/common';
import { Topology, TopologyService } from './topology.service';

@Controller('topology')
export class TopologyController {
  constructor(private readonly topologyService: TopologyService) {}

  @Get()
  getTopology(): Promise<Topology> {
    return this.topologyService.getTopology();
  }
}
