import { ApiProperty } from '@nestjs/swagger';

/**
 * Тіло помилки — формат Nest, однаковий для всіх ендпоінтів. Клієнт розрізняє помилки за статусом
 * і кодом у `message` (`POST_NOT_FOUND`, `ACCOUNT_LOCKED`); коди кожного ендпоінта — в описі його відповідей.
 */
export class ApiErrorDto {
  statusCode!: number;

  /** Код помилки або текст; невалідні тіло чи параметри (400) — масив повідомлень валідації */
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  /** Назва статусу HTTP (`Not Found`); є не в кожній відповіді */
  error?: string;
}
