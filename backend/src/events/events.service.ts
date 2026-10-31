import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { LiveEvent } from './live-event';

@Injectable()
export class EventsService {
  private readonly subject = new Subject<LiveEvent>();

  publish(event: LiveEvent): void {
    this.subject.next(event);
  }

  stream(): Observable<LiveEvent> {
    return this.subject.asObservable();
  }
}
