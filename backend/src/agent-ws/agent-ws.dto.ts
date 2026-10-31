import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class AgentCommandDto {
  @IsString()
  @IsIn(['run_connector'])
  action: string;

  @IsString()
  @IsNotEmpty()
  connector: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
