import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import { ScanReport } from '../entities/scan-report.entity';
import { ScanReportDto } from './scan.dto';
import { ReportFilter, ScanResult, ScanService } from './scan.service';
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
  list(
    @Query('limit') limit?: string,
    @Query('subnetId') subnetId?: string,
    @Query('since') since?: string,
  ): Promise<ScanReport[]> {
    const filter: ReportFilter = {};
    if (subnetId !== undefined) filter.subnetId = parseSubnetId(subnetId);
    if (since !== undefined) filter.since = parseSince(since);
    return this.scanService.listReports(
      limit === undefined ? undefined : Number(limit),
      filter,
    );
  }
}

function parseSubnetId(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new BadRequestException('subnetId must be an integer');
  }
  return parsed;
}

function parseSince(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('since must be an ISO 8601 date');
  }
  return parsed;
}
