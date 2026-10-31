import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateConnectorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsObject()
  config: Record<string, unknown>;
}

export class UpdateConnectorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class AssignConnectorDto {
  @IsInt()
  connectorId: number;

  @IsString()
  @IsNotEmpty()
  schedule: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  schedule?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class MoveAssignmentDto {
  @IsString()
  @IsNotEmpty()
  toAgent: string;
}
