/**
 * Seed schema v5 (football-plan-intermediate.md, Фаза 1).
 *
 * Що створює:
 *   1. Мови: en (default), ua
 *   2. Адмінів і пости з prisma/seed-data/content.json (експорт Фази 0);
 *      якщо файлу немає — одного адміна з SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 *   3. 9 турнірів як Competition + CompetitionExternalRef (FOOTBALL_DATA)
 *
 * Ідемпотентний: повторний запуск створює лише відсутнє і НЕ перезаписує
 * існуючі рядки (editorial-поля могли змінити в адмінці).
 * Усе пишеться в одній транзакції — або весь seed, або нічого.
 *
 * Запуск: pnpm --filter @football-portal/api db:seed  (= prisma db seed)
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CompetitionType,
  DataProvider,
  PostStatus,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const CONTENT_PATH = resolve(__dirname, 'seed-data/content.json');
const SUPPORTED_CONTENT_FORMAT_VERSION = 1;
const PASSWORD_HASH_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const TRANSACTION_TIMEOUT_MS = 60_000;

interface LanguageSeed {
  code: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
}

const LANGUAGES: LanguageSeed[] = [
  { code: 'en', name: 'English', isDefault: true, sortOrder: 1 },
  { code: 'ua', name: 'Українська', isDefault: false, sortOrder: 2 },
];

interface CompetitionSeed {
  slug: string;
  name: string;
  externalId: string;
  type: CompetitionType;
  sortOrder: number;
}

/** externalId — id змагання у football-data.org. Назви потім оновлює синк. */
const COMPETITIONS: CompetitionSeed[] = [
  {
    slug: 'PL',
    name: 'Premier League',
    externalId: '2021',
    type: CompetitionType.LEAGUE,
    sortOrder: 1,
  },
  {
    slug: 'PD',
    name: 'Primera Division',
    externalId: '2014',
    type: CompetitionType.LEAGUE,
    sortOrder: 2,
  },
  {
    slug: 'SA',
    name: 'Serie A',
    externalId: '2019',
    type: CompetitionType.LEAGUE,
    sortOrder: 3,
  },
  {
    slug: 'BL1',
    name: 'Bundesliga',
    externalId: '2002',
    type: CompetitionType.LEAGUE,
    sortOrder: 4,
  },
  {
    slug: 'FL1',
    name: 'Ligue 1',
    externalId: '2015',
    type: CompetitionType.LEAGUE,
    sortOrder: 5,
  },
  {
    slug: 'PPL',
    name: 'Primeira Liga',
    externalId: '2017',
    type: CompetitionType.LEAGUE,
    sortOrder: 6,
  },
  {
    slug: 'CL',
    name: 'UEFA Champions League',
    externalId: '2001',
    type: CompetitionType.CUP,
    sortOrder: 10,
  },
  {
    slug: 'WC',
    name: 'FIFA World Cup',
    externalId: '2000',
    type: CompetitionType.CUP,
    sortOrder: 20,
  },
  {
    slug: 'EC',
    name: 'European Championship',
    externalId: '2018',
    type: CompetitionType.CUP,
    sortOrder: 21,
  },
];

// ─── Формат content.json (експорт Фази 0; скрипт експорту видалено у Фазі 1) ───

interface ExportedAdmin {
  email: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

interface ExportedTag {
  slug: string;
  name: string;
}

interface ExportedPostTranslation {
  languageCode: string;
  title: string;
  excerpt: string;
  content: string;
}

interface ExportedPost {
  slug: string;
  authorEmail: string;
  published: boolean;
  coverImageUrl: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  translations: ExportedPostTranslation[];
  tagSlugs: string[];
}

interface ContentExport {
  formatVersion: number;
  admins: ExportedAdmin[];
  tags: ExportedTag[];
  posts: ExportedPost[];
}

interface SeedSummary {
  languages: number;
  admins: number;
  tags: number;
  posts: number;
  competitions: number;
}

function createPrismaClient(): PrismaClient {
  // Як у prisma.config.ts: пряме з'єднання, якщо є (Supabase pooler + транзакції)
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DIRECT_URL / DATABASE_URL is not set');
  }
  return new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function readContentExport(): ContentExport | null {
  if (!existsSync(CONTENT_PATH)) {
    return null;
  }
  const contentExport = JSON.parse(
    readFileSync(CONTENT_PATH, 'utf8'),
  ) as ContentExport;
  if (contentExport.formatVersion !== SUPPORTED_CONTENT_FORMAT_VERSION) {
    throw new Error(
      `content.json formatVersion ${contentExport.formatVersion} is not supported ` +
        `(expected ${SUPPORTED_CONTENT_FORMAT_VERSION})`,
    );
  }
  return contentExport;
}

/** Перевіряємо зв'язки до запису в БД — щоб не впасти посеред транзакції. */
function assertContentConsistent(contentExport: ContentExport): void {
  const languageCodes = new Set(LANGUAGES.map((language) => language.code));
  const defaultLanguageCode = LANGUAGES.find(
    (language) => language.isDefault,
  )!.code;
  const adminEmails = new Set(
    contentExport.admins.map((admin) => normalizeEmail(admin.email)),
  );
  const tagSlugs = new Set(contentExport.tags.map((tag) => tag.slug));
  const problems: string[] = [];

  if (contentExport.admins.length === 0) {
    problems.push('no admins in content.json');
  }

  for (const post of contentExport.posts) {
    if (!adminEmails.has(normalizeEmail(post.authorEmail))) {
      problems.push(
        `post "${post.slug}": author ${post.authorEmail} is not in admins`,
      );
    }
    const postLanguageCodes = post.translations.map(
      (translation) => translation.languageCode,
    );
    if (!postLanguageCodes.includes(defaultLanguageCode)) {
      problems.push(
        `post "${post.slug}": missing "${defaultLanguageCode}" translation`,
      );
    }
    for (const languageCode of postLanguageCodes) {
      if (!languageCodes.has(languageCode)) {
        problems.push(
          `post "${post.slug}": unknown language "${languageCode}"`,
        );
      }
    }
    for (const tagSlug of post.tagSlugs) {
      if (!tagSlugs.has(tagSlug)) {
        problems.push(`post "${post.slug}": unknown tag "${tagSlug}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `content.json is not seedable:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

/** Fallback без content.json: адмін з env. */
async function buildAdminFromEnv(): Promise<ExportedAdmin> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      `${CONTENT_PATH} not found and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set`,
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  return {
    email,
    displayName: process.env.SEED_ADMIN_NAME ?? 'Admin',
    passwordHash: await bcrypt.hash(password, PASSWORD_HASH_ROUNDS),
    role: Role.ADMIN,
    avatarUrl: null,
    bio: null,
    createdAt: new Date().toISOString(),
  };
}

async function seedLanguages(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  for (const language of LANGUAGES) {
    await transaction.language.upsert({
      where: { code: language.code },
      create: language,
      update: {},
    });
  }
}

async function seedCompetitions(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  for (const competitionSeed of COMPETITIONS) {
    const competition = await transaction.competition.upsert({
      where: { slug: competitionSeed.slug },
      create: {
        slug: competitionSeed.slug,
        name: competitionSeed.name,
        type: competitionSeed.type,
        sortOrder: competitionSeed.sortOrder,
        isActive: true,
      },
      update: {},
      select: { id: true },
    });
    await transaction.competitionExternalRef.upsert({
      where: {
        provider_externalId: {
          provider: DataProvider.FOOTBALL_DATA,
          externalId: competitionSeed.externalId,
        },
      },
      create: {
        provider: DataProvider.FOOTBALL_DATA,
        externalId: competitionSeed.externalId,
        competitionId: competition.id,
      },
      update: {},
    });
  }
}

/** Повертає email → userId для прив'язки авторів постів. */
async function seedAdmins(
  transaction: Prisma.TransactionClient,
  admins: ExportedAdmin[],
): Promise<Map<string, string>> {
  const userIdByEmail = new Map<string, string>();
  for (const admin of admins) {
    const email = normalizeEmail(admin.email);
    const user = await transaction.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: admin.passwordHash,
        role: admin.role,
        createdAt: new Date(admin.createdAt),
        profile: {
          create: {
            displayName: admin.displayName,
            avatarUrl: admin.avatarUrl,
            bio: admin.bio,
          },
        },
      },
      update: {},
      select: { id: true },
    });
    userIdByEmail.set(email, user.id);
  }
  return userIdByEmail;
}

async function seedTags(
  transaction: Prisma.TransactionClient,
  tags: ExportedTag[],
): Promise<void> {
  const defaultLanguageCode = LANGUAGES.find(
    (language) => language.isDefault,
  )!.code;
  for (const tag of tags) {
    await transaction.tag.upsert({
      where: { slug: tag.slug },
      create: {
        slug: tag.slug,
        translations: {
          create: { languageCode: defaultLanguageCode, name: tag.name },
        },
      },
      update: {},
    });
  }
}

async function seedPosts(
  transaction: Prisma.TransactionClient,
  posts: ExportedPost[],
  userIdByEmail: Map<string, string>,
): Promise<void> {
  for (const post of posts) {
    const createdAt = new Date(post.createdAt);
    await transaction.post.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        // v4 published → v5 status; дата публікації = дата створення
        status: post.published ? PostStatus.PUBLISHED : PostStatus.DRAFT,
        publishedAt: post.published ? createdAt : null,
        coverImageUrl: post.coverImageUrl,
        videoUrl: post.videoUrl,
        sourceUrl: post.sourceUrl,
        authorId: userIdByEmail.get(normalizeEmail(post.authorEmail))!,
        createdAt,
        updatedAt: new Date(post.updatedAt),
        deletedAt: post.deletedAt ? new Date(post.deletedAt) : null,
        translations: {
          create: post.translations.map((translation) => ({
            languageCode: translation.languageCode,
            title: translation.title,
            excerpt: translation.excerpt,
            content: translation.content,
          })),
        },
        tags: {
          create: post.tagSlugs.map((tagSlug) => ({
            tag: { connect: { slug: tagSlug } },
          })),
        },
      },
      update: {},
    });
  }
}

async function main(): Promise<void> {
  const contentExport = readContentExport();
  if (contentExport) {
    assertContentConsistent(contentExport);
  } else {
    console.warn(
      `⚠️  ${CONTENT_PATH} not found — seeding admin from SEED_ADMIN_* env, no posts`,
    );
  }
  const admins = contentExport?.admins ?? [await buildAdminFromEnv()];
  const tags = contentExport?.tags ?? [];
  const posts = contentExport?.posts ?? [];

  const prisma = createPrismaClient();
  try {
    await prisma.$transaction(
      async (transaction) => {
        await seedLanguages(transaction);
        await seedCompetitions(transaction);
        const userIdByEmail = await seedAdmins(transaction, admins);
        await seedTags(transaction, tags);
        await seedPosts(transaction, posts, userIdByEmail);
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );

    const summary: SeedSummary = {
      languages: await prisma.language.count(),
      admins: await prisma.user.count({ where: { role: Role.ADMIN } }),
      tags: await prisma.tag.count(),
      posts: await prisma.post.count(),
      competitions: await prisma.competition.count(),
    };
    console.log('✅ Seed complete (rows in DB):', summary);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    '❌ Seed failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
