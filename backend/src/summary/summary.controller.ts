import { Controller, Get } from '@nestjs/common';
import { SummaryResponse, SummaryService } from './summary.service';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  get(): Promise<SummaryResponse> {
    return this.summaryService.get();
  }
}
