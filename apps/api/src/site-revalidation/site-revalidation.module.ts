import { Module } from '@nestjs/common';
import { PostSiteRevalidationListener } from './post-site-revalidation.listener';
import { SITE_REVALIDATOR } from './site-revalidator.port';
import { WebRevalidateWebhook } from './web-webhook/web-revalidate-webhook';

/** Сповіщення сайту про зміни адрес (D57): підписник подій постів + адаптер за токеном `SITE_REVALIDATOR`. */
@Module({
  providers: [
    { provide: SITE_REVALIDATOR, useClass: WebRevalidateWebhook },
    PostSiteRevalidationListener,
  ],
})
export class SiteRevalidationModule {}
