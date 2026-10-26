import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

function renderMarkdown(source: string): string {
  return renderToStaticMarkup(<MarkdownContent source={source} />);
}

describe('MarkdownContent (D25)', () => {
  it('сирий HTML відкидає: ні тегів, ні обробників подій, ні коду скрипта', () => {
    const html = renderMarkdown(
      [
        '<script>alert(1)</script>',
        '',
        'Текст <img src="x" onerror="alert(2)"> і <iframe src="https://evil.example"></iframe> далі',
        '',
        '<div onclick="alert(3)">Блок</div>',
      ].join('\n'),
    );

    expect(html).not.toMatch(/<script|<iframe|<img|onerror|onclick|alert/i);
    expect(html).toContain('Текст');
  });

  it('посилання з `javascript:` не потрапляє в розмітку — лишається текст', () => {
    const html = renderMarkdown('[Натисни](javascript:alert(1)) і [ще](JaVaScRiPt:alert(2))');

    expect(html).not.toMatch(/javascript:|<a /i);
    expect(html).toContain('Натисни');
  });

  it('зображення — лише https: http, відносна адреса й адреса без протоколу не показуються', () => {
    const html = renderMarkdown(
      [
        '![HTTP](http://example.com/a.jpg)',
        '![Відносна](/images/a.jpg)',
        '![Без протоколу](//example.com/a.jpg)',
        'Посеред тексту ![HTTP](http://example.com/b.jpg) теж.',
      ].join('\n\n'),
    );

    expect(html).not.toMatch(/<img|<figure|example\.com|\/images\//);
  });

  it('зображення окремим абзацом — фото з підписом із title, не всередині абзацу', () => {
    const html = renderMarkdown(
      'Перед фото.\n\n![Гравці святкують гол](https://example.com/goal.jpg "Фото: Getty Images")',
    );

    expect(html).toContain(
      '<figure><img src="https://example.com/goal.jpg" alt="Гравці святкують гол" loading="lazy"/>' +
        '<figcaption>Фото: Getty Images</figcaption></figure>',
    );
    expect(html).not.toMatch(/<p>\s*<figure/);
  });

  it('зображення посеред тексту лишається в абзаці, без figure', () => {
    const html = renderMarkdown('Логотип ![Емблема](https://example.com/crest.png) у тексті');

    expect(html).toMatch(/<p>Логотип <img src="https:\/\/example\.com\/crest\.png"[^>]*\/> у тексті<\/p>/);
    expect(html).not.toContain('<figure');
  });

  it('`#` — h2, `#####` і `######` — h4: h1 сторінки — заголовок новини', () => {
    const html = renderMarkdown('# Розділ\n\n#### Підрозділ\n\n##### Дрібно\n\n###### Ще дрібніше');

    expect(html).not.toMatch(/<h1|<h5|<h6/);
    expect(html).toContain('<h2>Розділ</h2>');
    expect(html).toContain('<h4>Підрозділ</h4>');
    expect(html).toContain('<h4>Дрібно</h4>');
    expect(html).toContain('<h4>Ще дрібніше</h4>');
  });

  it('зовнішнє посилання — нова вкладка з noopener без noreferrer; наша сторінка — та сама вкладка', () => {
    const html = renderMarkdown('[BBC Sport](https://www.bbc.com/sport) і [звіт](/uk/matches/12345)');

    expect(html).toContain(
      '<a href="https://www.bbc.com/sport" target="_blank" rel="noopener">BBC Sport</a>',
    );
    expect(html).toContain('<a href="/uk/matches/12345">звіт</a>');
  });

  it('на сайті (siteUrl) посилання на свій хост — та сама вкладка, і з www чи без; інший хост — нова', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        source={[
          '[новина](https://www.footballportal.com/uk/news/derby-12)',
          '[таблиця](//footballportal.com/uk/matches)',
          '[двійник](https://footballportal.com.evil.example/uk)',
          '[піддомен](https://shop.footballportal.com/)',
        ].join(' ')}
        siteUrl="https://footballportal.com"
      />,
    );

    expect(html).toContain('<a href="https://www.footballportal.com/uk/news/derby-12">новина</a>');
    expect(html).toContain('<a href="//footballportal.com/uk/matches">таблиця</a>');
    expect(html).toContain(
      '<a href="https://footballportal.com.evil.example/uk" target="_blank" rel="noopener">двійник</a>',
    );
    expect(html).toContain('<a href="https://shop.footballportal.com/" target="_blank" rel="noopener">піддомен</a>');
  });

  it('нова вкладка — з прихованим підписом мовою сторінки; своє посилання — без підпису', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        source="[BBC Sport](https://www.bbc.com/sport) і [звіт](/uk/matches/12345)"
        newTabLabel={{ text: '(відкривається в новій вкладці)', lang: 'uk' }}
      />,
    );

    expect(html).toContain(
      '<a href="https://www.bbc.com/sport" target="_blank" rel="noopener">BBC Sport' +
        '<span class="sr-only" lang="uk"> (відкривається в новій вкладці)</span></a>',
    );
    expect(html).toContain('<a href="/uk/matches/12345">звіт</a>');
  });

  it('з linkBaseUrl (перегляд в адмінці) наша сторінка — на сайті в новій вкладці, небезпечна адреса — як без нього', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        source="[звіт](/uk/matches/12345), [BBC](https://www.bbc.com/sport) і [скрипт](javascript:alert(1))"
        linkBaseUrl="http://localhost:3000"
      />,
    );

    expect(html).toContain(
      '<a href="http://localhost:3000/uk/matches/12345" target="_blank" rel="noopener">звіт</a>',
    );
    expect(html).toContain('<a href="https://www.bbc.com/sport" target="_blank" rel="noopener">BBC</a>');
    expect(html).not.toMatch(/javascript:|localhost:3000\/"/);
  });

  it('таблиця з правил редакції (GFM) — у власній прокрутці', () => {
    const html = renderMarkdown('| Команда | Удари |\n|---|---|\n| Арсенал | 15 |');

    expect(html).toMatch(/<div class="overflow-x-auto"><table>.*<td>Арсенал<\/td>.*<\/table><\/div>/s);
  });
});
