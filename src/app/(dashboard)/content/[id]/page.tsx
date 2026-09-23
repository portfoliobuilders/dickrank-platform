import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentCard } from "@/components/content/ContentCard";
import { LikeButton } from "@/components/content/LikeButton";
import { ProtectedImage } from "@/components/content/ProtectedImage";
import { ReportButton } from "@/components/content/ReportButton";
import { VideoPlayer } from "@/components/content/VideoPlayer";
import { getContent } from "@/lib/content";
import { ServiceError } from "@/lib/errors";
import { getViewer } from "@/lib/session";
import { contentIdSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Post · DickRank" };

export default async function ContentPage({ params }: { params: { id: string } }) {
  const id = contentIdSchema.safeParse(params.id);
  if (!id.success) notFound();

  const viewer = await getViewer();
  if (!viewer.profile?.ageVerified) redirect("/verify-age");

  try {
    const { content, related } = await getContent(viewer.supabase, viewer.profile, id.data);
    const creatorName = content.creator.displayName || content.creator.username;

    return (
      <article className="space-y-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <div>
            {content.locked ? (
              <div className="relative overflow-hidden rounded-2xl bg-zinc-900">
                {content.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={content.thumbnailUrl} alt="" className="aspect-video w-full scale-110 object-cover blur-2xl" />
                ) : (
                  <div className="aspect-video w-full bg-zinc-800" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 p-6 text-center">
                  <p className="text-lg font-medium">Premium post</p>
                  <Link href={`/creator/${content.creator.username}`} className="rounded-full bg-rose-500 px-4 py-2 text-sm">
                    Subscribe to {creatorName}
                  </Link>
                </div>
              </div>
            ) : content.mediaType === "video" && content.mediaUrl ? (
              <VideoPlayer
                src={content.mediaUrl}
                poster={content.thumbnailUrl}
                userId={viewer.profile.id}
                qualities={content.qualities}
              />
            ) : content.mediaUrl ? (
              <ProtectedImage src={content.mediaUrl} alt={content.title} />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl bg-zinc-900 text-zinc-400">
                Media unavailable
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold">{content.title}</h1>
              <p className="mt-1 text-sm text-zinc-400">
                <Link href={`/creator/${content.creator.username}`} className="text-zinc-200 hover:underline">
                  {creatorName}
                </Link>
                {content.creator.isVerified ? <span className="ml-2 text-sky-300">Verified</span> : null}
                <span className="mx-2">·</span>
                {content.viewCount} views
              </p>
            </div>
            {content.description ? <p className="whitespace-pre-wrap text-zinc-300">{content.description}</p> : null}
            {content.category ? <p className="text-sm text-zinc-500">Category · {content.category}</p> : null}
            {content.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {content.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-200">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <LikeButton contentId={content.id} initialLiked={content.liked} initialCount={content.likeCount} />
              <ReportButton contentId={content.id} />
            </div>
          </div>
        </div>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Related</h2>
          {related.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map((item) => (
                <ContentCard key={item.id} content={item} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No related posts yet.</p>
          )}
        </section>
      </article>
    );
  } catch (error) {
    if (error instanceof ServiceError && error.status === 403) redirect("/verify-age");
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
}
