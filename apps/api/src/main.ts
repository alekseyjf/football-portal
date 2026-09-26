import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureHttpApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttpApp(app);

  await app.listen(process.env.PORT ?? 4000);
  console.log('🚀 API running on http://localhost:4000/api/v1');
}
void bootstrap();
