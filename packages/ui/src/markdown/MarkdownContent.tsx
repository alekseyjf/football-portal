import type { ComponentProps } from 'react';
import Markdown, {
  defaultUrlTransform,
  type Components,
  type ExtraProps,
  type UrlTransform,
} from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Елемент HTML-дерева (hast), який react-markdown передає компонентам у `node`. */
type MarkdownElement = NonNullable<ExtraProps['node']>;

const HTTPS_URL = /^https:\/\//i;
/** Інший сайт: абсолютна адреса http(s) або без протоколу (`//host/…`). */
const EXTERNAL_URL = /^(?:https?:)?\/\//i;

const REMARK_PLUGINS = [remarkGfm];

/**
 * Адреси в тексті — за типовим правилом react-markdown (http(s), mailto, irc(s), xmpp і відносні; `javascript:`,
 * `data:` → порожньо), а зображення — лише https (D25): `http:` на https-сторінці — mixed content, а відносну
 * адресу браузер шукав би на нашому домені.
 */
const urlTransform: UrlTransform = (url, key, node) => {
  const safeUrl = defaultUrlTransform(url);
  if (node.tagName === 'img' && key === 'src' && !HTTPS_URL.test(safeUrl)) return null;
  return safeUrl;
};

/** Відносні посилання — адреси на `baseUrl`: це вже інший сайт, тож вони відкриються в новій вкладці. */
function resolveLinksAgainst(baseUrl: string): UrlTransform {
  return (url, key, node) => {
    const safeUrl = urlTransform(url, key, node);
    if (node.tagName !== 'a' || !safeUrl) return safeUrl;
    try {
      return new URL(safeUrl, baseUrl).href;
    } catch {
      // Адресу, яку браузер не розбере (`https://exa mple.com`), лишаємо як є
      return safeUrl;
    }
  };
}

/** h1 сторінки — заголовок новини, тож `#` у тексті — підзаголовок (D25): намір редактора зберігається. */
function SectionHeading({ children }: ComponentProps<'h1'>) {
  return <h2>{children}</h2>;
}

/** Глибше за h4 підзаголовків немає (D25): `#####` і `######` — теж h4. */
function MinorHeading({ children }: ComponentProps<'h5'>) {
  return <h4>{children}</h4>;
}

/**
 * Зовнішнє посилання — у новій вкладці, щоб читач не втратив новину; `rel="noopener"` без `noreferrer`: сайт
 * бачить переходи від нас, як і джерело новини (D26). Наша сторінка (`/uk/matches/…`) — у тій самій вкладці.
 */
function MarkdownLink({ href, title, children }: ComponentProps<'a'>) {
  // Небезпечну адресу urlTransform уже замінив порожньою — лишається текст без посилання
  if (!href) return <>{children}</>;
  if (!EXTERNAL_URL.test(href)) {
    return (
      <a href={href} title={title}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} title={title} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

/** Зображення посеред тексту; окремим абзацом воно стає `MarkdownFigure`. */
function MarkdownImage({ src, alt, title }: ComponentProps<'img'>) {
  // Без адреси — urlTransform відкинув не-https: зображення не показуємо
  if (!src) return null;
  return <img src={src} alt={alt ?? ''} title={title} loading="lazy" />;
}

/** Зображення абзацу без тексту (між ними — хіба пробіли й переноси); `null` — у абзаці є текст. */
function standaloneImages(paragraph: MarkdownElement): MarkdownElement[] | null {
  const images: MarkdownElement[] = [];
  for (const child of paragraph.children) {
    if (child.type === 'element' && child.tagName === 'img') images.push(child);
    else if (child.type !== 'text' || child.value.trim()) return null;
  }
  return images.length > 0 ? images : null;
}

/** Підпис автора фото — title зображення (`"Фото: Getty Images"`, правила редакції), під фото. */
function MarkdownFigure({ image }: { image: MarkdownElement }) {
  const { src, alt, title } = image.properties;
  if (typeof src !== 'string' || !src) return null;
  return (
    <figure>
      <img src={src} alt={typeof alt === 'string' ? alt : ''} loading="lazy" />
      {typeof title === 'string' && title ? <figcaption>{title}</figcaption> : null}
    </figure>
  );
}

/** Абзац лише із зображень — це фото з підписом, а не абзац: `<figure>` усередині `<p>` — невалідний HTML. */
function MarkdownParagraph({ node, children }: ComponentProps<'p'> & ExtraProps) {
  const images = node ? standaloneImages(node) : null;
  if (!images) return <p>{children}</p>;
  return images.map((image, index) => <MarkdownFigure key={index} image={image} />);
}

/** Широка таблиця прокручується сама, а не вся сторінка (телефон 320 px). */
function MarkdownTable({ children }: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  );
}

const COMPONENTS: Components = {
  h1: SectionHeading,
  h5: MinorHeading,
  h6: MinorHeading,
  a: MarkdownLink,
  img: MarkdownImage,
  p: MarkdownParagraph,
  table: MarkdownTable,
};

interface MarkdownContentProps {
  /** Текст новини в Markdown (`PostTranslation.content`) */
  source: string;
  /**
   * Сайт, на який ведуть відносні посилання тексту (`/uk/matches/…`), — для перегляду поза ним (адмінка): там
   * такі посилання відкриваються на сайті в новій вкладці, а не в самій адмінці, де незбережений текст пропав би
   */
  linkBaseUrl?: string;
}

/**
 * Текст новини (D25) — один рендерер для сайту й перегляду в адмінці: що бачить редактор, те побачить читач.
 * Розмітка — підзаголовки h2–h4, списки, цитати, посилання, жирний і курсив, зображення (лише https), таблиці.
 * Сирий HTML відкидається (`skipHtml`), `dangerouslySetInnerHTML` немає — XSS через текст неможливий.
 * Вигляд — `prose` (`@tailwindcss/typography`); лапки довкола цитати не додаємо: редактор пише їх сам.
 */
export function MarkdownContent({ source, linkBaseUrl }: MarkdownContentProps) {
  return (
    <div className="prose prose-invert max-w-none [&_blockquote]:[quotes:none]">
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        components={COMPONENTS}
        urlTransform={linkBaseUrl ? resolveLinksAgainst(linkBaseUrl) : urlTransform}
        skipHtml
      >
        {source}
      </Markdown>
    </div>
  );
}
