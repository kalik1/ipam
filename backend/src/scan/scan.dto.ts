import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScanDeviceDto {
  @IsString()
  @IsNotEmpty()
  ip: string;

  @IsOptional()
  @IsString()
  mac?: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  vendor?: string;
}

export class ScanReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  agent: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanDeviceDto)
  devices: ScanDeviceDto[];
}
