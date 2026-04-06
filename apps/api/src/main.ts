import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true, // Обов'язково для cookies
  });

  app.use(cookieParser());

  // Глобальна валідація — всі DTO автоматично валідуються
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.setGlobalPrefix('api/v1');
  
  await app.listen(process.env.PORT ?? 4000);
  console.log('🚀 API running on http://localhost:4000/api/v1');
}
bootstrap();
