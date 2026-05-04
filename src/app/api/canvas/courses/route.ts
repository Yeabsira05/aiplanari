import { NextResponse } from "next/server";
import { fetchAllPages } from "@/lib/canvas-fetch";

type CanvasCourse = {
  id: number;
  name: string;
  workflow_state?: string;
  access_restricted_by_date?: boolean;
  end_at?: string | null;
};

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Missing Canvas token" }, { status: 400 });
    }

    const canvasBaseUrl = "https://reykjavik.instructure.com";

    const all = await fetchAllPages<CanvasCourse>(
      `${canvasBaseUrl}/api/v1/courses?per_page=50`,
      token
    );

    const now = Date.now();

    const courses = all
      .filter((c) => c.id && c.name && c.workflow_state !== "deleted")
      .map((c) => {
        const endedByDate = c.end_at ? new Date(c.end_at).getTime() < now : false;
        const isCurrent =
          c.workflow_state === "available" &&
          !c.access_restricted_by_date &&
          !endedByDate;
        return { id: c.id, name: c.name, isCurrent };
      })
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}
