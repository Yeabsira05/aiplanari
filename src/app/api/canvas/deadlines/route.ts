import { NextResponse } from "next/server";
import { fetchAllPages } from "@/lib/canvas-fetch";

type CanvasCourse = {
  id: number;
  name: string;
  workflow_state?: string;
  access_restricted_by_date?: boolean;
};

type CanvasAssignment = {
  id: number;
  name: string;
  due_at: string | null;
  html_url: string;
  description: string | null;
};

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Missing Canvas token" }, { status: 400 });
    }

    const canvasBaseUrl = "https://reykjavik.instructure.com";

    const allCourses = await fetchAllPages<CanvasCourse>(
      `${canvasBaseUrl}/api/v1/courses?per_page=50`,
      token
    );

    if (!allCourses.length) {
      return NextResponse.json({ error: "Could not fetch Canvas courses" }, { status: 401 });
    }

    const courses = allCourses.filter(
      (c) => c.id && c.name && c.workflow_state !== "deleted" && !c.access_restricted_by_date
    );

    const results = await Promise.allSettled(
      courses.map(async (course) => {
        const assignments = await fetchAllPages<CanvasAssignment>(
          `${canvasBaseUrl}/api/v1/courses/${course.id}/assignments?per_page=50&order_by=due_at`,
          token
        );

        return assignments
          .filter((a) => a.due_at && a.name)
          .map((a) => ({
            id: `${course.id}-${a.id}`,
            course: course.name,
            title: a.name,
            dueDate: a.due_at as string,
            type: "assignment" as const,
            url: a.html_url || undefined,
            description: a.description || undefined,
          }));
      })
    );

    const deadlines = results
      .filter((r): r is PromiseFulfilledResult<typeof r extends PromiseFulfilledResult<infer V> ? V : never> => r.status === "fulfilled")
      .flatMap((r) => r.value);

    return NextResponse.json({ deadlines });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong fetching Canvas data" },
      { status: 500 }
    );
  }
}
