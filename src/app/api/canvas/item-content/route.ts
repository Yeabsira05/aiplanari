import { NextResponse } from "next/server";

async function canvasFetch(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(request: Request) {
  try {
    const { token, type, apiUrl, htmlUrl, title } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    if (type === "Page" && apiUrl) {
      const data = await canvasFetch(apiUrl, token);
      if (data) {
        return NextResponse.json({
          kind: "page",
          title: data.title || title,
          body: data.body || "",
        });
      }
    }

    if (type === "Assignment" && apiUrl) {
      const data = await canvasFetch(apiUrl, token);
      if (data) {
        return NextResponse.json({
          kind: "assignment",
          title: data.name || title,
          description: data.description || "",
          dueAt: data.due_at || null,
          pointsPossible: data.points_possible || null,
        });
      }
    }

    if (type === "File" && apiUrl) {
      const data = await canvasFetch(apiUrl, token);
      if (data) {
        return NextResponse.json({
          kind: "file",
          title: data.display_name || title,
          url: data.url || htmlUrl || "",
          contentType: data["content-type"] || "",
          size: data.size || null,
        });
      }
    }

    if (type === "Quiz" && apiUrl) {
      const data = await canvasFetch(apiUrl, token);
      if (data) {
        return NextResponse.json({
          kind: "quiz",
          title: data.title || title,
          description: data.description || "",
          questionCount: data.question_count || null,
          timeLimit: data.time_limit || null,
          pointsPossible: data.points_possible || null,
          htmlUrl: htmlUrl || data.html_url || null,
        });
      }
    }

    // Fallback: external URL or anything else
    return NextResponse.json({
      kind: "link",
      title,
      url: htmlUrl || apiUrl || "",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
  }
}
