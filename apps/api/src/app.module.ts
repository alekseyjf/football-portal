import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { envConfig } from './config/env.config';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PostModule } from './posts/post.module';
import { CommentModule } from './comments/comment.module';
import { FootballModule } from './football/football.module';
import { LikeModule } from './likes/like.module';
import { SecurityModule } from './security/security.module';
import { RequestThrottlingModule } from './security/throttling/request-throttling.module';
import { UserManagementModule } from './users/management/user-management.module';

@Module({
  imports: [
    // `.env` читає `main.ts` (dotenv): e2e-застосунок не підхопить із нього dev-БД випадково
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [envConfig],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RequestThrottlingModule,
    AuthModule,
    SecurityModule,
    UserManagementModule,
    PostModule,
    CommentModule,
    FootballModule,
    LikeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
