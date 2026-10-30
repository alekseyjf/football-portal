import 'server-only';
import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';
import { SHARE_CARD_SIZE } from './page-metadata';

/** Що на картці прев'ю: назва сторінки, над нею — рубрика, унизу — назва сайту. */
export type ShareCardContent = {
  siteName: string;
  title: string;
  /** Рубрика новини, турнір матчу, розділ сайту; `null` — без неї */
  label: string | null;
};

/**
 * Шрифт сайту (Geist, OFL — `assets/fonts/Geist-OFL.txt`) з кирилицею; жирний — для заголовка. `new URL(…,
 * import.meta.url)` — збирач копіює файл разом із кодом маршруту, тож шлях не залежить від теки запуску.
 */
let boldFontData: Promise<Buffer> | undefined;

function loadBoldFont(): Promise<Buffer> {
  boldFontData ??= readFile(
    new URL('../../../assets/fonts/Geist-Bold.ttf', import.meta.url),
  );
  return boldFontData;
}

/**
 * Картку соцмережі й месенджери тримають у себе довго, а заголовок новини редакція може виправити: доба, не рік
 * (`immutable` — значення `ImageResponse` за замовчуванням).
 */
const SHARE_CARD_CACHE_CONTROL = 'public, max-age=86400';

/** Довгий заголовок — дрібніше, щоб умістився в чотири рядки. */
const LONG_TITLE_LENGTH = 70;

const COLORS = {
  background: '#030712',
  accent: '#16a34a',
  label: '#4ade80',
  title: '#ffffff',
  siteName: '#d1d5db',
} as const;

/** Згенерована картка прев'ю 1200 × 630 (`next/og`) — для сторінок без обкладинки (M1.8.1). */
export async function shareCardResponse(
  content: ShareCardContent,
): Promise<ImageResponse> {
  const isLongTitle = content.title.length > LONG_TITLE_LENGTH;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        borderTop: `12px solid ${COLORS.accent}`,
        background: COLORS.background,
        fontFamily: 'Geist',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {content.label && (
          <div style={{ display: 'flex', fontSize: 32, color: COLORS.label }}>
            {content.label}
          </div>
        )}
        <div
          style={{
            display: 'block',
            lineClamp: 4,
            fontSize: isLongTitle ? 56 : 72,
            lineHeight: 1.15,
            color: COLORS.title,
          }}
        >
          {content.title}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 30,
          color: COLORS.siteName,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: COLORS.accent,
          }}
        />
        {content.siteName}
      </div>
    </div>,
    {
      ...SHARE_CARD_SIZE,
      fonts: [
        {
          name: 'Geist',
          data: await loadBoldFont(),
          weight: 700,
          style: 'normal',
        },
      ],
      headers: { 'Cache-Control': SHARE_CARD_CACHE_CONTROL },
    },
  );
}

/** Картки немає (новина чи матч не існує, не та адреса) — 404 без тіла. */
export function shareCardNotFound(): Response {
  return new Response(null, { status: 404 });
}
