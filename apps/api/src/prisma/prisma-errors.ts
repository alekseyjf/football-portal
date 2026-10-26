import { Prisma } from '@prisma/client';

/**
 * Prisma 7 з driver adapter віддає помилку Postgres у двох формах:
 * `PrismaClientKnownRequestError` (`meta.driverAdapterError.cause`) — для відомих кодів і raw-запитів,
 * або «голий» `DriverAdapterError` (`cause`) — напр. deadlock у звичайному запиті (перевірено на dev-БД).
 */
type DriverErrorCause = {
  originalCode?: unknown;
  originalMessage?: unknown;
  kind?: unknown;
};

function driverErrorCauseOf(error: unknown): DriverErrorCause | undefined {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const adapterError = error.meta?.driverAdapterError as
      | { cause?: DriverErrorCause }
      | undefined;
    return adapterError?.cause;
  }
  if (error instanceof Error && error.name === 'DriverAdapterError') {
    return error.cause as DriverErrorCause | undefined;
  }
  return undefined;
}

function prismaErrorCodeOf(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : undefined;
}

/** Deadlock (`40P01`) і serialization failure (`40001`): транзакцію відкочено, повтор безпечний. */
const TRANSIENT_POSTGRES_CODES = new Set(['40P01', '40001']);

export function isTransientTransactionError(error: unknown): boolean {
  if (prismaErrorCodeOf(error) === 'P2034') return true;
  const cause = driverErrorCauseOf(error);
  return (
    cause?.kind === 'TransactionWriteConflict' ||
    (typeof cause?.originalCode === 'string' &&
      TRANSIENT_POSTGRES_CODES.has(cause.originalCode))
  );
}

/** FK (`23503`): на рядок посилаються (Restrict) або його вже немає. */
export function isForeignKeyViolation(error: unknown): boolean {
  if (prismaErrorCodeOf(error) === 'P2003') return true;
  const cause = driverErrorCauseOf(error);
  return (
    cause?.kind === 'ForeignKeyConstraintViolation' ||
    cause?.originalCode === '23503'
  );
}

/** Рядка для `update` уже немає (`P2025`): напр. його видалили між читанням і записом. */
export function isRecordNotFound(error: unknown): boolean {
  return prismaErrorCodeOf(error) === 'P2025';
}

/** Унікальний ключ моделі `modelName` уже зайнятий (`P2002`). */
export function isUniqueViolationOn(
  error: unknown,
  modelName: string,
): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    error.meta?.modelName === modelName
  );
}

/**
 * Унікальний індекс `indexName` уже зайнятий (`23505`) — і в сирому SQL, і для індексу, якого Prisma не знає
 * (частковий з `constraints.sql`): назву індексу адаптер лишає лише в тексті помилки Postgres.
 */
export function isUniqueViolationOfIndex(
  error: unknown,
  indexName: string,
): boolean {
  const cause = driverErrorCauseOf(error);
  return (
    cause?.originalCode === '23505' &&
    typeof cause.originalMessage === 'string' &&
    cause.originalMessage.includes(`"${indexName}"`)
  );
}
