import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConnectorService } from './connector.service';

@Injectable()
export class ConnectorScheduler {
  constructor(private readonly connectorService: ConnectorService) {}

  @Cron('*/30 * * * * *')
  async tick(): Promise<void> {
    await this.connectorService.tick();
  }
}
