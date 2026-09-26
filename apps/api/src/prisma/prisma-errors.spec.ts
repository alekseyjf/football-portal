import { Prisma } from '@prisma/client';
import {
  isForeignKeyViolation,
  isTransientTransactionError,
  isUniqueViolationOn,
} from './prisma-errors';

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('failed', {
    code,
    clientVersion: 'test',
    meta,
  });
}

/** Форма, яку адаптер кидає напряму (deadlock у звичайному запиті). */
function driverAdapterError(cause: Record<string, unknown>) {
  const error = new Error('driver failed', { cause });
  error.name = 'DriverAdapterError';
  return error;
}

const deadlockCause = { originalCode: '40P01', kind: 'postgres' };

describe('isTransientTransactionError', () => {
  it('deadlock у raw-запиті: P2010 з originalCode 40P01', () => {
    const error = knownError('P2010', {
      driverAdapterError: { cause: deadlockCause },
    });
    expect(isTransientTransactionError(error)).toBe(true);
  });

  it('deadlock у звичайному запиті: голий DriverAdapterError', () => {
    expect(isTransientTransactionError(driverAdapterError(deadlockCause))).toBe(
      true,
    );
  });

  it('serialization failure і P2034', () => {
    expect(
      isTransientTransactionError(
        driverAdapterError({ kind: 'TransactionWriteConflict' }),
      ),
    ).toBe(true);
    expect(isTransientTransactionError(knownError('P2034'))).toBe(true);
  });

  it('інші помилки — ні', () => {
    expect(isTransientTransactionError(knownError('P2002'))).toBe(false);
    expect(isTransientTransactionError(new Error('boom'))).toBe(false);
    expect(isTransientTransactionError(undefined)).toBe(false);
  });
});

describe('isForeignKeyViolation', () => {
  it('P2003 і сирий 23503', () => {
    expect(isForeignKeyViolation(knownError('P2003'))).toBe(true);
    expect(
      isForeignKeyViolation(driverAdapterError({ originalCode: '23503' })),
    ).toBe(true);
    expect(isForeignKeyViolation(driverAdapterError(deadlockCause))).toBe(
      false,
    );
  });
});

describe('isUniqueViolationOn', () => {
  it('лише P2002 потрібної моделі', () => {
    const error = knownError('P2002', { modelName: 'CommentThread' });
    expect(isUniqueViolationOn(error, 'CommentThread')).toBe(true);
    expect(isUniqueViolationOn(error, 'Comment')).toBe(false);
    expect(isUniqueViolationOn(knownError('P2003'), 'CommentThread')).toBe(
      false,
    );
  });
});
