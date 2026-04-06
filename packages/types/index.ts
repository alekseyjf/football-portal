// User
export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  createdAt: Date;
}

// Post
export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  published: boolean;
  authorId: string;
  author?: Pick<User, 'id' | 'name' | 'avatar'>;
  createdAt: Date;
}

// Comment
export interface Comment {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  author?: Pick<User, 'id' | 'name' | 'avatar'>;
  createdAt: Date;
}

// League
export interface League {
  id: string;
  name: string;
  slug: string;
  country: string;
  season: string;
}

// Club
export interface Club {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  leagueId: string;
}

// Match
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED';

export interface Match {
  id: string;
  homeClubId: string;
  awayClubId: string;
  homeClub?: Club;
  awayClub?: Club;
  homeScore?: number;
  awayScore?: number;
  date: Date;
  leagueId: string;
  status: MatchStatus;
}

// League Table Row
export interface LeagueTableRow {
  position: number;
  club: Club;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}