import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDeviceDto {
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

  @IsOptional()
  @IsInt()
  subnetId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ip?: string;

  @IsOptional()
  @IsString()
  mac?: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsInt()
  subnetId?: number | null;

  @IsOptional()
  @IsString()
  notes?: string;
}
