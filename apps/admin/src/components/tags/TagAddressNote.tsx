import { publicTagPath } from '@football-portal/validation';

/** Адреса сторінки тегу на сайті (D51) і те, що після створення її не змінити. */
export function TagAddressNote({ slug }: { slug: string | null }) {
  return (
    <>
      On the site: <code className="break-all text-gray-300">{publicTagPath('en', slug ?? '…')}</code> (the same with
      /uk/); the tag page itself will appear on the site later.{' '}
      <strong className="font-medium text-amber-300">The address can’t be changed after the tag is created</strong> —
      renaming changes only the names.
    </>
  );
}
