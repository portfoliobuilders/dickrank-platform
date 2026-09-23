export async function removeUserFromSearchIndex(input: {
  userId: string;
  contentIds: string[];
}): Promise<void> {
  const endpoint = process.env.SEARCH_INDEX_URL;
  if (!endpoint) return;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.SEARCH_INDEX_TOKEN
        ? { authorization: `Bearer ${process.env.SEARCH_INDEX_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ operation: "delete_user", ...input }),
  });
  if (!response.ok) {
    throw new Error(`Search index removal failed (${response.status})`);
  }
}
