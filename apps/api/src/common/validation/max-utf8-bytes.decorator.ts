import { utf8ByteLength } from '@football-portal/validation';
import {
  ValidateBy,
  buildMessage,
  type ValidationOptions,
} from 'class-validator';

/**
 * Рядок не довший за `maxBytes` байт UTF-8 (межа bcrypt для пароля).
 * Не `@IsByteLength`: той рахує через `encodeURI`, який кидає виняток на одиночному
 * surrogate (`"\ud800"` у JSON) — запит упав би з 500 замість 400.
 */
export function MaxUtf8Bytes(
  maxBytes: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxUtf8Bytes',
      constraints: [maxBytes],
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && utf8ByteLength(value) <= maxBytes,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be at most $constraint1 bytes in UTF-8`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
