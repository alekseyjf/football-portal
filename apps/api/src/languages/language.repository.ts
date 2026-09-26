import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const LANGUAGE_SELECT = {
  code: true,
  isDefault: true,
  isActive: true,
} satisfies Prisma.LanguageSelect;

export type LanguageRow = Prisma.LanguageGetPayload<{
  select: typeof LANGUAGE_SELECT;
}>;

@Injectable()
export class LanguageRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<LanguageRow[]> {
    return this.prisma.language.findMany({
      select: LANGUAGE_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
  }
}
