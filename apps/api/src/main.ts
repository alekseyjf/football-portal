import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_GLOBAL_PREFIX } from './app.constants';
import { AppModule } from './app.module';
import { configureHttpApp } from './app.setup';
import { envConfig } from './config/env.config';
import type { AppEnv } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttpApp(app);

  const port = app.get<AppEnv>(envConfig.KEY).PORT;
  await app.listen(port);
  Logger.log(
    `🚀 API running on http://localhost:${port}/${API_GLOBAL_PREFIX}`,
    'Bootstrap',
  );
}
void bootstrap();
