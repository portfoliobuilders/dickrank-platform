'use client';

export function MessagePanel({
  allowMessages,
  displayName,
}: {
  allowMessages: boolean;
  displayName: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 p-4">
      <h2 className="text-lg font-semibold">Messages</h2>
      <p className="mt-2 text-sm text-zinc-400">
        {allowMessages
          ? `${displayName} accepts messages. Direct chat opens in a later release.`
          : `${displayName} is not accepting messages.`}
      </p>
    </section>
  );
}
