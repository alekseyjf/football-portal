import type { PostDetail } from '@/lib/api/types';
import {
  NO_NEWS_FEED_FILTERS,
  newsFeedHref,
  type NewsFeedFilters,
} from './news-feed-filters';

/** Тема новини внизу статті — турнір, клуб чи тег — і стрічка, куди веде посилання. */
export type PostTopicLink = {
  /** Унікальний серед тем однієї новини: вид + slug */
  key: string;
  name: string;
  href: string;
};

type TopicsSource = Pick<PostDetail, 'competitions' | 'clubs' | 'tags'>;

function topicLink(
  kind: 'competition' | 'club' | 'tag',
  topic: { slug: string; name: string },
  filter: Partial<NewsFeedFilters>,
): PostTopicLink {
  return {
    key: `${kind}:${topic.slug}`,
    name: topic.name,
    href: newsFeedHref({ ...NO_NEWS_FEED_FILTERS, ...filter }),
  };
}

/**
 * Усі теми новини (M1.6.2), кожна — посилання у стрічку `/news` лише з цим фільтром (D52): турніри — у порядку
 * редакції, далі клуби — за назвою (обидва так віддає API), далі теги — за назвою мовою сторінки, як у рубриці картки.
 */
export function postTopicLinks(
  post: TopicsSource,
  collator: Intl.Collator,
): PostTopicLink[] {
  const tagsByName = [...post.tags].sort((leftTag, rightTag) =>
    collator.compare(leftTag.name, rightTag.name),
  );
  return [
    ...post.competitions.map((competition) =>
      topicLink('competition', competition, { competition: competition.slug }),
    ),
    ...post.clubs.map((club) => topicLink('club', club, { clubs: [club.slug] })),
    ...tagsByName.map((tag) => topicLink('tag', tag, { tags: [tag.slug] })),
  ];
}
