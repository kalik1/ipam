import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import fs from 'node:fs';
import path from 'node:path';
import { AgentWsModule } from './agent-ws/agent-ws.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { ConnectorModule } from './connectors/connector.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DevicesModule } from './devices/devices.module';
import { ScanModule } from './scan/scan.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SeedModule } from './seed/seed.module';
import { SubnetsModule } from './subnets/subnets.module';
import { SummaryModule } from './summary/summary.module';
import { TopologyModule } from './topology/topology.module';
import { VlansModule } from './vlans/vlans.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = (config.get<string>('DB_TYPE') ?? 'sqlite').toLowerCase();
        if (dbType === 'postgres') {
          return {
            type: 'postgres' as const,
            host: config.get<string>('PG_HOST') ?? 'localhost',
            port: parseInt(config.get<string>('PG_PORT') ?? '5432', 10),
            username: config.get<string>('PG_USER') ?? 'postgres',
            password: config.get<string>('PG_PASS') ?? '',
            database: config.get<string>('PG_DB') ?? 'ipam',
            autoLoadEntities: true,
            synchronize: true,
          };
        }
        const dataDir = path.resolve(__dirname, '..', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        return {
          type: 'better-sqlite3' as const,
          database: path.join(dataDir, 'ipam.sqlite'),
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
        signOptions: { expiresIn: '12h' },
      }),
    }),
    AuthModule,
    AgentWsModule,
    ConnectorModule,
    VlansModule,
    SubnetsModule,
    DevicesModule,
    ApiKeysModule,
    ScanModule,
    SummaryModule,
    TopologyModule,
    SeedModule,
    SchedulerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
