import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { envConfig } from '../config/env.config';
import type { AppEnv } from '../config/env.schema';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(@Inject(envConfig.KEY) env: AppEnv) {
    super({ adapter: new PrismaPg(env.DATABASE_URL) });
  }

  async onModuleInit() {
    await this.$connect();
    Logger.log('✅ Database connected', PrismaService.name);
  }
}
