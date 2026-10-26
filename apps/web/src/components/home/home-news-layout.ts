import type { NewsCardLayout } from '@/components/news/NewsCard';

/**
 * Сітка новин головної (D55) — і для скелетона: телефон — одна колонка, від 640 px — дві (головна новина на всю
 * ширину), від 1024 px — три: головна займає дві колонки й три ряди, три новини — у колонці поруч, ще три — рядом під
 * ними.
 */
export const HOME_NEWS_GRID_CLASS = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';
export const HOME_LEAD_ITEM_CLASS = 'sm:col-span-2 lg:row-span-3';

/** Новин у колонці поруч із головною (від 1024 px) — вони завжди рядки з мініатюрою. */
const BESIDE_LEAD_COUNT = 3;

/** Вигляд картки за місцем у списку під головною новиною: поруч з нею — рядок, нижче — рядок лише до 1024 px. */
export function homeNewsCardLayout(index: number): NewsCardLayout {
  return index < BESIDE_LEAD_COUNT ? 'row' : 'rowBelowDesktop';
}
