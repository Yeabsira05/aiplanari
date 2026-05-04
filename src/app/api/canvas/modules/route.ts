import { NextResponse } from "next/server";
import { fetchAllPages } from "@/lib/canvas-fetch";

type CanvasModule = {
  id: number;
  name: string;
  position: number;
  workflow_state: string;
};

type CanvasModuleItem = {
  id: number;
  title: string;
  type: string;
  html_url?: string;
  url?: string;
  position: number;
};

export async function POST(request: Request) {
  try {
    const { token, courseId } = await request.json();

    if (!token || !courseId) {
      return NextResponse.json({ error: "Missing token or courseId" }, { status: 400 });
    }

    const base = `https://reykjavik.instructure.com/api/v1/courses/${courseId}`;

    const modules = await fetchAllPages<CanvasModule>(
      `${base}/modules?per_page=50`,
      token
    );

    const activeModules = modules.filter((m) => m.workflow_state !== "deleted");

    const modulesWithItems = await Promise.allSettled(
      activeModules.slice(0, 30).map(async (mod) => {
        const items = await fetchAllPages<CanvasModuleItem>(
          `${base}/modules/${mod.id}/items?per_page=50`,
          token
        );

        return {
          id: mod.id,
          name: mod.name,
          position: mod.position,
          items: items
            .filter((i) => i.type !== "SubHeader")
            .map((i) => ({
              id: i.id,
              title: i.title,
              type: i.type,
              htmlUrl: i.html_url || null,  // web link
              apiUrl: i.url || null,         // Canvas API URL for fetching content
            })),
        };
      })
    );

    const result = modulesWithItems
      .filter(
        (r): r is PromiseFulfilledResult<{
          id: number;
          name: string;
          position: number;
          items: { id: number; title: string; type: string; htmlUrl: string | null; apiUrl: string | null }[];
        }> => r.status === "fulfilled"
      )
      .map((r) => r.value);

    return NextResponse.json({ modules: result });
  } catch {
    return NextResponse.json({ error: "Failed to fetch modules" }, { status: 500 });
  }
}
