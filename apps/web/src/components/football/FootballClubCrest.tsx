import Image from 'next/image';
import type { FootballClub } from '@/lib/api/types';

type Props = {
  club: Pick<FootballClub, 'crestUrl' | 'tla' | 'name'>;
};

/**
 * Емблема клубу 20×20. `unoptimized` — CDN провайдера, як емблеми ліг (P5b-4); без емблеми
 * (клуб, відомий лише з матчу) — абревіатура.
 */
export function FootballClubCrest({ club }: Props) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[8px] font-bold text-neutral-500"
    >
      {club.crestUrl ? (
        <Image
          src={club.crestUrl}
          alt=""
          width={20}
          height={20}
          unoptimized
          className="h-5 w-5 object-contain"
        />
      ) : (
        (club.tla ?? club.name).slice(0, 3)
      )}
    </span>
  );
}
