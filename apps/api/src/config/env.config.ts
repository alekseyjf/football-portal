import { registerAs } from '@nestjs/config';
import { parseEnv } from './env.schema';

/**
 * Перевірені змінні середовища — провайдер `ConfigModule` (`app.module.ts`). Фабрика виконується
 * при старті застосунку: з поганим конфігом API не стартує (Rule 13).
 * Сервіс бере значення так: `@Inject(envConfig.KEY) env: AppEnv`; `process.env` поза цим файлом
 * забороняє ESLint.
 */
export const envConfig = registerAs('env', () => parseEnv(process.env));
