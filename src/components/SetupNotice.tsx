export function SetupNotice() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      Connect Supabase before using live profiles and content. Add NEXT_PUBLIC_SUPABASE_URL and
      NEXT_PUBLIC_SUPABASE_ANON_KEY, then run the database migration.
    </div>
  );
}
