import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { makeQueryClient } from '@/lib/query/queryClient';
import { matchDetailQueryOptions } from '@/hooks/useFootball';
import { MatchDetailView } from './MatchDetailView';

type Props = { params: Promise<{ id: string }> };

export default async function MatchPage({ params }: Props) {
  const { id } = await params;
  const queryClient = makeQueryClient();
  try {
    await queryClient.prefetchQuery(matchDetailQueryOptions(id));
  } catch {
    // клієнт зробить refetch
  }

  return (
    <main className="min-h-[60vh]">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MatchDetailView matchId={id} />
      </HydrationBoundary>
    </main>
  );
}
