import { Global, Module } from '@nestjs/common';
import { EventsController, SSE_KEEPALIVE_MS } from './events.controller';
import { EventsService } from './events.service';

@Global()
@Module({
  controllers: [EventsController],
  providers: [EventsService, { provide: SSE_KEEPALIVE_MS, useValue: 15_000 }],
  exports: [EventsService],
})
export class EventsModule {}
