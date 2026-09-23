import Link from "next/link";
import { AUDIT_ACTION_OPTIONS, listAuditLogs, parseUserAgent } from "@/lib/audit";
import { formatHashedIp } from "@/lib/crypto";
import { auditQuerySchema, endOfUtcDay, startOfUtcDay } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function AuditPage({ searchParams }: { searchParams?: Search }) {
  const parsed = auditQuerySchema.safeParse({
    q: searchParams?.q || undefined,
    action: searchParams?.action || undefined,
    userId: searchParams?.userId || undefined,
    from: searchParams?.from || undefined,
    to: searchParams?.to || undefined,
    page: searchParams?.page || undefined,
  });
  const query = parsed.success ? parsed.data : undefined;
  const result = await listAuditLogs({
    q: query?.q,
    action: query?.action,
    userId: query?.userId,
    from: query?.from ? startOfUtcDay(query.from) : undefined,
    to: query?.to ? endOfUtcDay(query.to) : undefined,
    page: query?.page ?? 1,
    pageSize: 25,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const exportParams = new URLSearchParams();
  if (searchParams?.q) exportParams.set("q", searchParams.q);
  if (searchParams?.action) exportParams.set("action", searchParams.action);
  if (searchParams?.userId) exportParams.set("userId", searchParams.userId);
  if (searchParams?.from) exportParams.set("from", searchParams.from);
  if (searchParams?.to) exportParams.set("to", searchParams.to);
  exportParams.set("format", "csv");

  return (
    <main className="wrap">
      <h1>Audit log</h1>
      <p className="muted">
        IP addresses are stored as a one-way hash. The table shows a shortened hash, not the original address.
      </p>
      <form className="filters" action="/audit" method="get">
        <div>
          <label htmlFor="q">Search resource or user id</label>
          <input id="q" name="q" defaultValue={searchParams?.q ?? ""} />
        </div>
        <div>
          <label htmlFor="userId">User id</label>
          <input id="userId" name="userId" defaultValue={searchParams?.userId ?? ""} />
        </div>
        <div>
          <label htmlFor="action">Action</label>
          <select id="action" name="action" defaultValue={searchParams?.action ?? ""}>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from">From</label>
          <input id="from" name="from" type="date" defaultValue={searchParams?.from ?? ""} />
        </div>
        <div>
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="date" defaultValue={searchParams?.to ?? ""} />
        </div>
        <button type="submit">Filter</button>
      </form>
      <p>
        <a href={`/api/audit?${exportParams.toString()}`}>Download CSV</a>
      </p>
      <div className="table-wrap card">
        <table>
          <caption className="muted">
            {result.total} matching events. Page {result.page} of {pageCount}.
          </caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Resource</th>
              <th scope="col">User</th>
              <th scope="col">Hashed IP</th>
              <th scope="col">Client</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={6}>No audit events match these filters.</td>
              </tr>
            ) : (
              result.rows.map((row) => {
                const client = parseUserAgent(row.userAgent);
                return (
                  <tr key={row.id}>
                    <td>{row.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</td>
                    <td>{row.action}</td>
                    <td>{row.resource}</td>
                    <td>
                      <code>{row.userId ?? "—"}</code>
                    </td>
                    <td>
                      <code title={row.ipAddressHash}>{formatHashedIp(row.ipAddressHash)}</code>
                    </td>
                    <td title={row.userAgent ?? ""}>{client.label}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p>
        {result.page > 1 ? <Link href={pageHref(searchParams, result.page - 1)}>Previous</Link> : <span className="muted">Previous</span>}
        {" · "}
        {result.page < pageCount ? <Link href={pageHref(searchParams, result.page + 1)}>Next</Link> : <span className="muted">Next</span>}
      </p>
    </main>
  );
}

function pageHref(search: Search | undefined, page: number): string {
  const params = new URLSearchParams();
  if (search?.q) params.set("q", search.q);
  if (search?.action) params.set("action", search.action);
  if (search?.userId) params.set("userId", search.userId);
  if (search?.from) params.set("from", search.from);
  if (search?.to) params.set("to", search.to);
  params.set("page", String(page));
  return `/audit?${params.toString()}`;
}
