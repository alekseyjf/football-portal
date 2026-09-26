import { Injectable } from '@nestjs/common';
import type { Prisma, RateLimitAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RateLimitRepository {
  constructor(private prisma: PrismaService) {}

  async recordEvent(
    userId: string,
    action: RateLimitAction,
    occurredAt: Date,
  ): Promise<void> {
    await this.prisma.rateLimitEvent.create({
      data: { userId, action, createdAt: occurredAt },
      select: { id: true },
    });
  }

  countSince(
    userId: string,
    action: RateLimitAction,
    since: Date,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return db.rateLimitEvent.count({
      where: { userId, action, createdAt: { gte: since } },
    });
  }

  /** Для cooldown: коли користувач востаннє виконував дію. */
  async findLastEventAt(
    userId: string,
    action: RateLimitAction,
  ): Promise<Date | null> {
    const lastEvent = await this.prisma.rateLimitEvent.findFirst({
      where: { userId, action },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return lastEvent?.createdAt ?? null;
  }

  /** Для cron: події старші за `createdBefore`. */
  async deleteOlderThan(createdBefore: Date): Promise<number> {
    const deleted = await this.prisma.rateLimitEvent.deleteMany({
      where: { createdAt: { lt: createdBefore } },
    });
    return deleted.count;
  }
}
