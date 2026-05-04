export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileUrl = searchParams.get("url") || "";
  const token = searchParams.get("token") || "";

  if (!fileUrl) {
    return new Response("Missing url", { status: 400 });
  }

  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const upstream = await fetch(decodeURIComponent(fileUrl), {
      headers,
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new Response("Failed to fetch file", { status: upstream.status });
    }

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        // Force inline so the browser renders instead of downloading
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Proxy error", { status: 500 });
  }
}
