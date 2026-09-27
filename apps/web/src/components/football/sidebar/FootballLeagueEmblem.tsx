import Image from 'next/image';

type Props = {
  emblemUrl: string | null;
  /** Без емблеми — код турніру (`PL`) */
  fallbackText: string;
};

/**
 * Емблема турніру на світлій плашці: емблеми провайдера (PL, CL, WC) темні й на чорному фоні
 * зникають. `unoptimized` — PNG 200×200 по 3–15 КБ з CDN провайдера, без проксі через Next
 * (домен провайдера не прив'язаний до `images.remotePatterns`).
 */
export function FootballLeagueEmblem({ emblemUrl, fallbackText }: Props) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white p-0.5 text-[9px] font-bold text-neutral-900"
    >
      {emblemUrl ? (
        <Image
          src={emblemUrl}
          alt=""
          width={24}
          height={24}
          unoptimized
          className="h-6 w-6 object-contain"
        />
      ) : (
        fallbackText.slice(0, 3)
      )}
    </span>
  );
}
