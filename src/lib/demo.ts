export function isDemoMode() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEMO_CONTENT === "true" &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}
