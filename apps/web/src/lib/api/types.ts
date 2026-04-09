export interface PostTranslation {
    language: string;
    title: string;
    excerpt: string;
    content?: string; // є тільки на сторінці поста, не в списку
  }
  
  export interface Post {
    id: string;
    slug: string;
    coverImage?: string;
    videoUrl?: string;
    published: boolean;
    createdAt: string;
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
    translations: PostTranslation[];
    tags?: { tag: { id: string; name: string; slug: string } }[];
  }

  /** Мова контенту для запитів до API (query `lang`). */
  export type ApiContentLanguage = 'en' | 'ua';

  export const DEFAULT_CONTENT_LANG: ApiContentLanguage = 'en';
  
  // Хелпер — отримати переклад з масиву
  export function getTranslation(
    post: Post,
    lang: ApiContentLanguage = DEFAULT_CONTENT_LANG,
  ): PostTranslation {
    return (
      post.translations.find(t => t.language === lang) ??
      post.translations[0] ?? { language: lang, title: '', excerpt: '' }
    );
  }
  
  export interface CommentReply {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
  }
  
  export interface Comment {
    id: string;
    content: string;
    createdAt: string;
    pinnedAt?: string | null;
    parentId?: string | null;
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
    replies?: CommentReply[];
  }
  
  export interface User {
    id: string;
    email: string;
    name: string;
    role: 'USER' | 'ADMIN';
    avatar?: string;
  }
  
  export interface PaginatedPosts {
    data: Post[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }

  /** Відповідь GET /posts/:slug — пост з вкладеними коментарями (RSC може не використовувати comments, якщо тягне коментарі через React Query). */
  export interface PostDetail extends Post {
    comments: Comment[];
  }

  // ─── Football (GET з нашої БД) ───

  export type MatchStatusDto =
    | 'SCHEDULED'
    | 'LIVE'
    | 'FINISHED'
    | 'POSTPONED'
    | 'CANCELLED';

  export interface FootballClub {
    id: string;
    name: string;
    slug: string;
    shortName?: string | null;
    logo?: string | null;
  }

  export interface FootballLeagueMeta {
    id: string;
    name: string;
    slug: string;
    country: string;
    season: string;
    logoUrl?: string | null;
  }

  export interface FootballMatchRow {
    id: string;
    date: string;
    status: MatchStatusDto;
    minute?: number | null;
    matchday?: number | null;
    homeScore?: number | null;
    awayScore?: number | null;
    homeClub: FootballClub;
    awayClub: FootballClub;
  }

  export interface StandingRow {
    position: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    club: FootballClub;
  }

  export interface FixturesRound {
    matchday: number | null;
    matches: FootballMatchRow[];
  }

  export interface LeagueFixturesResponse {
    upcoming: FixturesRound[];
    past: FixturesRound[];
  }

  /** GET /football/leagues/:slug/dashboard — один запит для сайдбару. */
  export interface LeagueDashboardResponse {
    league: FootballLeagueMeta;
    standings: StandingRow[];
    fixtures: LeagueFixturesResponse;
  }

  export interface MatchDetail extends FootballMatchRow {
    league: FootballLeagueMeta;
  }