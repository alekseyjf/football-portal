import { createHash } from 'node:crypto';

/**
 * JSON зі стабільним порядком ключів: однакові дані → однаковий рядок незалежно від того,
 * в якому порядку їх зібрали. `Date` → ISO, ключі з `undefined` пропускаються (як у `JSON.stringify`).
 */
function toStableJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => toStableJson(item ?? null)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const fields = Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .sort(([leftKey], [rightKey]) => (leftKey < rightKey ? -1 : 1))
      .map(
        ([fieldKey, fieldValue]) =>
          `${JSON.stringify(fieldKey)}:${toStableJson(fieldValue)}`,
      );
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Хеш нормалізованих полів, які синк пише в БД (P5-6): однаковий хеш — запис пропускається.
 * Не від сирого JSON провайдера: `lastUpdated`, odds, referees не мають тригерити запис.
 */
export function payloadHashOf(payload: unknown): string {
  return createHash('sha256').update(toStableJson(payload)).digest('hex');
}
