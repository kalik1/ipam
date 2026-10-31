import { Controller, Inject, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { EventsService } from './events.service';

export const SSE_KEEPALIVE_MS = 'SSE_KEEPALIVE_MS';

@Controller()
export class EventsController {
  constructor(
    private readonly events: EventsService,
    @Inject(SSE_KEEPALIVE_MS) private readonly keepaliveMs: number,
  ) {}

  @Sse('events')
  stream(): Observable<MessageEvent> {
    const events = this.events
      .stream()
      .pipe(map((event) => ({ type: event.type, data: event.data })));
    const keepalives = interval(this.keepaliveMs).pipe(
      map(() => ({ comment: 'keepalive' })),
    );
    return merge(events, keepalives);
  }
}
