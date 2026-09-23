import { AccountTools } from "@/app/account-tools";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <main className="compliance wrap">
      <h1>Your data</h1>
      <p className="muted">
        Download a copy of your account, or delete it. Financial records stay for 7 years. Audit logs stay for 1 year
        after the account is deleted.
      </p>
      <AccountTools />
    </main>
  );
}
