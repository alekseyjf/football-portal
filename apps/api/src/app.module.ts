import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
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
