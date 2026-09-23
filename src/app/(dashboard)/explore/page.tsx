import { ContentGrid } from '@/components/content/ContentCard';
import { requirePageUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { PAGE_SIZE } from '@/lib/types';
import { contentListQuerySchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore · DickRank' };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: { category?: string; sort?: string; page?: string; tags?: string };
}) {
  const user = await requirePageUser('/explore');
  const query = contentListQuerySchema.parse({
    category: searchParams.category,
    sort: searchParams.sort,
    page: searchParams.page,
    tags: searchParams.tags,
  });
  const result = await getStore().listContent(
    {
      category: query.category,
      tags: query.tags
        ?.split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      sort: query.sort,
      page: query.page,
      pageSize: PAGE_SIZE,
    },
    user.id,
  );

  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold">Explore</h1>
      <p className="mb-6 text-sm text-zinc-400">Browse published posts by category, tags, newest, or popular.</p>
      <ContentGrid items={result.items} />
    </main>
  );
}
