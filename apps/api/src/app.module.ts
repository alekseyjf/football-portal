import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PostModule } from './posts/post.module';
import { CommentModule } from './comments/comment.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PostModule,
    CommentModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
