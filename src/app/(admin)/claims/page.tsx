import { DmcaStatus } from "@prisma/client";
import { claimantContact, listDmcaClaims } from "@/lib/dmca";

export const dynamic = "force-dynamic";

const TABS: Array<{ status: DmcaStatus; label: string }> = [
  { status: "PENDING_REVIEW", label: "Pending" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
  { status: "COUNTER_NOTIFIED", label: "Counter-notices" },
  { status: "RESTORED", label: "Restored" },
];

function preview(url: string, mediaKind: string | null) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const path = parsed.pathname.toLowerCase();
  const kind = mediaKind ?? "";
  if (kind === "image" || /\.(png|jpe?g|gif|webp)$/.test(path)) {
    return { type: "image" as const, url: parsed.toString() };
  }
  if (kind === "video" || /\.(mp4|webm)$/.test(path)) {
    return { type: "video" as const, url: parsed.toString() };
  }
  return { type: "link" as const, url: parsed.toString() };
}

export default async function DmcaAdminPage({
  searchParams,
}: {
  searchParams?: { status?: string; updated?: string; error?: string };
}) {
  const selected = TABS.some((tab) => tab.status === searchParams?.status)
    ? (searchParams?.status as DmcaStatus)
    : "PENDING_REVIEW";
  const claims = await listDmcaClaims(selected);

  return (
    <main className="wrap">
      <h1>Copyright claims</h1>
      <p className="muted">Age-verified staff only. Contact details are decrypted for review and are not written to the audit log.</p>
      {searchParams?.updated ? <p className="banner">Claim updated.</p> : null}
      {searchParams?.error ? <p className="banner error">That action could not be completed.</p> : null}
      <div className="tabs">
        {TABS.map((tab) => (
          <a key={tab.status} href={`/claims?status=${tab.status}`} aria-current={tab.status === selected ? "page" : undefined}>
            {tab.label}
          </a>
        ))}
      </div>
      {claims.length === 0 ? <p>No claims in this tab.</p> : null}
      {claims.map((claim) => {
        const media = claim.content ? preview(claim.content.url, claim.content.mediaKind) : preview(claim.contentUrl, null);
        let contact = "Unavailable";
        try {
          contact = claimantContact(claim.contactInfoEncrypted);
        } catch {
          contact = "Could not read contact info";
        }
        return (
          <article className="card" key={claim.id}>
            <h2>{claim.status}</h2>
            <p>
              <strong>Claim:</strong> <code>{claim.id}</code>
            </p>
            <p>
              <strong>Filed:</strong> {claim.createdAt.toISOString().slice(0, 10)}
            </p>
            <p>
              <strong>Content:</strong> {claim.contentUrl}
            </p>
            <p>
              <strong>Owner:</strong> <code>{claim.contentOwnerId ?? "Not matched"}</code>
            </p>
            <p>
              <strong>Claimant contact:</strong> {contact}
            </p>
            <p>{claim.description}</p>
            {claim.counterStatement ? (
              <p>
                <strong>Counter-notice:</strong> {claim.counterStatement}
              </p>
            ) : null}
            {claim.restoreAt ? <p>Restore after {claim.restoreAt.toISOString().slice(0, 10)} unless a lawsuit is on file.</p> : null}
            {media?.type === "image" ? (
              // Admin preview only. The surrounding layout already requires an age-verified admin.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="preview" alt="Content preview" src={media.url} referrerPolicy="no-referrer" />
            ) : null}
            {media?.type === "video" ? (
              <video className="preview" controls preload="none" src={media.url} />
            ) : null}
            {media?.type === "link" ? (
              <p>
                <a href={media.url} rel="noreferrer">
                  Open content
                </a>
              </p>
            ) : null}
            <form action="/api/dmca/review" method="post">
              <input type="hidden" name="claimId" value={claim.id} />
              <button type="submit" name="decision" value="approve">
                Approve Takedown
              </button>
              <button type="submit" className="ghost" name="decision" value="reject">
                Reject Claim
              </button>
              <button type="submit" className="ghost" name="decision" value="lawsuit">
                Mark lawsuit filed
              </button>
            </form>
          </article>
        );
      })}
    </main>
  );
}
