import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ContentGrid } from '@/components/content/ContentCard';
import { LikeButton } from '@/components/content/LikeButton';
import { MediaDisplay } from '@/components/content/MediaDisplay';
import { ReportButton } from '@/components/content/ReportButton';
import { getSessionUser, requirePageUser } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { formatCount } from '@/lib/format';
import { idParamSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const parsed = idParamSchema.safeParse(params.id);
  if (!parsed.success) return { title: 'Content · DickRank' };
  const user = await getSessionUser();
  if (!user || user.ageVerification !== true) return { title: 'Content · DickRank' };
  const content = await getStore().getContent(parsed.data, user.id, { countView: false });
  return { title: content ? `${content.title} · DickRank` : 'Content · DickRank' };
}

export default async function ContentPage({ params }: { params: { id: string } }) {
  const parsed = idParamSchema.safeParse(params.id);
  if (!parsed.success) notFound();
  const id = parsed.data;
  const session = await getSessionUser();
  if (!session || session.ageVerification !== true) {
    redirect(`/verify-age?next=${encodeURIComponent(`/content/${id}`)}`);
  }
  const user = await requirePageUser(`/content/${id}`);
  const store = getStore();
  const content = await store.getContent(id, user.id, { countView: true });
  if (!content) notFound();
  const related = await store.relatedContent(id, user.id);

  return (
    <main className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <article className="space-y-5">
        <MediaDisplay content={content} userId={user.id} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{content.title}</h1>
              {content.isPremium ? (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-zinc-950">
                  Premium
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              <Link href={`/creator/${content.creator.username}`} className="text-zinc-200 hover:underline">
                {content.creator.displayName || content.creator.username}
              </Link>
              {content.creator.isVerified ? <span className="ml-2 text-sky-300">Verified</span> : null}
              <span className="ml-3">{formatCount(content.viewCount)} views</span>
            </p>
          </div>
          <div className="flex gap-2">
            <LikeButton contentId={content.id} initialLiked={content.likedByMe} initialCount={content.likeCount} />
            <ReportButton contentId={content.id} />
          </div>
        </div>
        {content.description ? <p className="text-zinc-200">{content.description}</p> : null}
        {content.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {content.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-zinc-300">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
      <aside>
        <h2 className="mb-4 text-lg font-semibold">Related</h2>
        <ContentGrid items={related} />
      </aside>
    </main>
  );
}
