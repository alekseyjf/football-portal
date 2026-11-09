import {
  basicAuthChallenge,
  basicAuthGate,
  isBasicAuthorized,
} from '@football-portal/validation/site-gateway';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Тест-сервер закритий спільним паролем (M1.11.6, 👤 У21): Basic Auth на сторінках адмінки й шлюзі до API —
 * Password Protection Vercel лише на Pro (D58). `APP_ENV` ≠ `test` — без пароля (вхід адміна однаково потрібен);
 * невалідні змінні тесту — не пускає нікого. Працює в Node: змінні читає під час запиту, а не збірки.
 */
export default function proxy(request: NextRequest): Response {
  const gate = basicAuthGate(process.env);
  if (!gate.isRequired) return NextResponse.next();
  const authorization = request.headers.get('authorization');
  return isBasicAuthorized(authorization, gate.credentials)
    ? NextResponse.next()
    : basicAuthChallenge();
}

/** Усе, крім статики й оптимізатора картинок Next, іконки й `robots.txt` (його мають прочитати й без пароля). */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt).*)'],
};
