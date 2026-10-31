import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import { ScanReport } from '../entities/scan-report.entity';
import { ScanReportDto } from './scan.dto';
import { ScanResult, ScanService } from './scan.service';
import { Public } from '../auth/public.decorator';

@Controller('scan')
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Public()
  @Post('reports')
  receive(
    @Headers('x-api-key') apiKey: string | undefined,
    @Body() dto: ScanReportDto,
  ): Promise<ScanResult> {
    return this.scanService.receive(apiKey, dto);
  }

  @Get('reports')
  list(@Query('limit') limit?: string): Promise<ScanReport[]> {
    return this.scanService.listReports(
      limit === undefined ? undefined : Number(limit),
    );
  }
}
