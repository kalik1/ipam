import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class DhcpPoolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  startIp: string;

  @IsString()
  @IsNotEmpty()
  endIp: string;
}

export class CreateSubnetDto {
  @IsString()
  @IsNotEmpty()
  cidr: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gateways?: string[];

  @IsOptional()
  @IsBoolean()
  includeFirstLast?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DhcpPoolDto)
  dhcpPools?: DhcpPoolDto[];

  @IsOptional()
  @IsInt()
  vlanId?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainName?: string;

  @IsOptional()
  @IsString()
  dnsServers?: string;

  @IsOptional()
  @IsString()
  ntpServers?: string;
}

export class UpdateSubnetDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cidr?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gateways?: string[];

  @IsOptional()
  @IsBoolean()
  includeFirstLast?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DhcpPoolDto)
  dhcpPools?: DhcpPoolDto[];

  @IsOptional()
  @IsInt()
  vlanId?: number | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainName?: string;

  @IsOptional()
  @IsString()
  dnsServers?: string;

  @IsOptional()
  @IsString()
  ntpServers?: string;
}

export class CreateDhcpPoolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  startIp: string;

  @IsString()
  @IsNotEmpty()
  endIp: string;
}

export class UpdateDhcpPoolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  startIp?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  endIp?: string;
}
