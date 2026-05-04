export async function fetchAllPages<T>(url: string, token: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) break;

    const data: unknown = await response.json();
    if (!Array.isArray(data)) break;

    results.push(...(data as T[]));

    const link: string | null = response.headers.get("Link");
    const match: RegExpMatchArray | null = link?.match(/<([^>]+)>;\s*rel="next"/) ?? null;
    nextUrl = match ? match[1] : null;
  }

  return results;
}
