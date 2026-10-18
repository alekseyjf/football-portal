import { ApiPropertyOptional } from '@nestjs/swagger';

/** Чому `live-touch` не запустив синк. */
export const LIVE_TOUCH_SKIP_REASONS = [
  'not_found',
  'not_live',
  'throttled',
  'no_api_key',
] as const;

export type LiveTouchSkipReason = (typeof LIVE_TOUCH_SKIP_REASONS)[number];

/** `POST /football/live-touch` */
export class LiveTouchResultDto {
  /** `true` — LIVE-синк турніру запущено у фоні */
  accepted!: boolean;

  /**
   * Чому не запущено: матчу немає; він не в LIVE-вікні; турнір синкали менше хвилини тому;
   * ключа провайдера немає
   */
  @ApiPropertyOptional({
    enum: LIVE_TOUCH_SKIP_REASONS,
    enumName: 'LiveTouchSkipReason',
  })
  skipped?: LiveTouchSkipReason;
}
