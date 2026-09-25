/**
 * Фаза 0 (football-plan-intermediate.md): експорт контенту перед переходом на schema v5.
 *
 * Лише читання: одна транзакція READ ONLY + REPEATABLE READ (узгоджений знімок).
 * Зберігає адмінів і пости з перекладами й тегами → prisma/seed-data/content.json.
 * Коментарі, лайки та звичайні користувачі свідомо НЕ експортуються.
 *
 * Формат вже в термінах v5 (passwordHash, displayName, coverImageUrl, languageCode);
 * зв'язки — через email / slug, бо id у v5 генеруються заново в seed.ts.
 *
 * Працює проти схеми v4 — після Фази 1 скрипт застаріє (JSON лишається для seed).
 *
 * Запуск: pnpm --filter @football-portal/api db:export-content
 */
import 'dotenv/config';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';

const OUTPUT_PATH = resolve(__dirname, '../prisma/seed-data/content.json');
const CONTENT_FORMAT_VERSION = 1;
const REQUIRED_LANGUAGE_CODE = 'en';

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
  exportedAt: string;
  sourceSchema: 'v4';
  admins: ExportedAdmin[];
  tags: ExportedTag[];
  posts: ExportedPost[];
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
}

async function readContentSnapshot(
  prisma: PrismaClient,
): Promise<ContentExport> {
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');

      const adminUsers = await transaction.user.findMany({
        where: { role: Role.ADMIN },
        orderBy: { createdAt: 'asc' },
        select: {
          email: true,
          name: true,
          password: true,
          role: true,
          avatar: true,
          bio: true,
          createdAt: true,
        },
      });

      const tagRecords = await transaction.tag.findMany({
        orderBy: { slug: 'asc' },
        select: { slug: true, name: true },
      });

      const postRecords = await transaction.post.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          slug: true,
          published: true,
          coverImage: true,
          videoUrl: true,
          sourceUrl: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          author: { select: { email: true } },
          translations: {
            orderBy: { language: 'asc' },
            select: {
              language: true,
              title: true,
              excerpt: true,
              content: true,
            },
          },
          tags: { select: { tag: { select: { slug: true } } } },
        },
      });

      return {
        formatVersion: CONTENT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        sourceSchema: 'v4',
        admins: adminUsers.map((adminUser) => ({
          email: adminUser.email.toLowerCase().trim(),
          displayName: adminUser.name,
          passwordHash: adminUser.password,
          role: adminUser.role,
          avatarUrl: adminUser.avatar,
          bio: adminUser.bio,
          createdAt: adminUser.createdAt.toISOString(),
        })),
        tags: tagRecords,
        posts: postRecords.map((postRecord) => ({
          slug: postRecord.slug,
          authorEmail: postRecord.author.email.toLowerCase().trim(),
          published: postRecord.published,
          coverImageUrl: postRecord.coverImage,
          videoUrl: postRecord.videoUrl,
          sourceUrl: postRecord.sourceUrl,
          createdAt: postRecord.createdAt.toISOString(),
          updatedAt: postRecord.updatedAt.toISOString(),
          deletedAt: postRecord.deletedAt?.toISOString() ?? null,
          translations: postRecord.translations.map((translation) => ({
            languageCode: translation.language,
            title: translation.title,
            excerpt: translation.excerpt,
            content: translation.content,
          })),
          tagSlugs: postRecord.tags.map((postTag) => postTag.tag.slug),
        })),
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}

/** Seed v5 не зможе відновити пост без автора-адміна або без EN-перекладу — падаємо одразу. */
function assertSeedable(contentExport: ContentExport): void {
  if (contentExport.admins.length === 0) {
    throw new Error('No ADMIN users found — nothing to seed as post author');
  }

  const adminEmails = new Set(contentExport.admins.map((admin) => admin.email));
  const problems: string[] = [];

  for (const post of contentExport.posts) {
    if (!adminEmails.has(post.authorEmail)) {
      problems.push(`post "${post.slug}": author is not an exported ADMIN`);
    }
    const hasRequiredTranslation = post.translations.some(
      (translation) => translation.languageCode === REQUIRED_LANGUAGE_CODE,
    );
    if (!hasRequiredTranslation) {
      problems.push(
        `post "${post.slug}": missing "${REQUIRED_LANGUAGE_CODE}" translation`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Export is not seedable:\n  - ${problems.join('\n  - ')}`);
  }
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    const contentExport = await readContentSnapshot(prisma);
    assertSeedable(contentExport);

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      `${JSON.stringify(contentExport, null, 2)}\n`,
      { mode: 0o600 },
    );
    await chmod(OUTPUT_PATH, 0o600);

    const translationCount = contentExport.posts.reduce(
      (total, post) => total + post.translations.length,
      0,
    );
    console.log(`✅ Exported to ${OUTPUT_PATH}`);
    console.log(
      `   admins: ${contentExport.admins.length}, posts: ${contentExport.posts.length}, ` +
        `translations: ${translationCount}, tags: ${contentExport.tags.length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    '❌ Content export failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
