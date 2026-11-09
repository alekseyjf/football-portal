import { STATUS_CODES } from 'node:http';
import type { Response } from 'express';

/**
 * Відмова Express-middleware до роутингу Nest — у тому самому форматі, що й помилки Nest (`ApiErrorDto`): клієнт
 * розбирає код із `message`.
 */
export function rejectRequest(
  res: Response,
  status: number,
  code: string,
): void {
  res.status(status).json({
    statusCode: status,
    message: code,
    error: STATUS_CODES[status],
  });
}
