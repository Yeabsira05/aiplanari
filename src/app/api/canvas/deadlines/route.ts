import { NextResponse } from "next/server";
import { fetchAllPages } from "@/lib/canvas-fetch";

type CanvasCourse = {
  id: number;
  name: string;
  workflow_state?: string;
  start_at?: string | null;
  end_at?: string | null;
};

type CanvasAssignment = {
  id: number;
  name: string;
  due_at: string | null;
  html_url: string;
  description: string | null;
  submission_types: string[];
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

    // Spring 2026: Jan 1 – Jun 30
    const semesterStart = new Date("2026-01-01");
    const semesterEnd   = new Date("2026-06-30");

    const courses = allCourses.filter((c) => {
      if (!c.id || !c.name || c.workflow_state === "deleted") return false;
      const start = c.start_at ? new Date(c.start_at) : null;
      const end   = c.end_at   ? new Date(c.end_at)   : null;
      // Course overlaps the semester window
      const startedBeforeEnd = !start || start <= semesterEnd;
      const endedAfterStart  = !end   || end   >= semesterStart;
      return startedBeforeEnd && endedAfterStart;
    });

    const results = await Promise.allSettled(
      courses.map(async (course) => {
        const assignments = await fetchAllPages<CanvasAssignment>(
          `${canvasBaseUrl}/api/v1/courses/${course.id}/assignments?per_page=50&order_by=due_at`,
          token
        );

        return assignments
          .filter((a) => a.due_at && a.name)
          .map((a) => {
            const types = a.submission_types ?? [];
            const t = a.name.toLowerCase();
            // Only flag as exam if Canvas itself marks it as no-submission (in-person exam)
            // or the title unambiguously says so
            const isExam =
              (types.length === 1 && types[0] === "none") ||
              t.includes("lokapróf") ||
              t.includes("loka próf") ||
              t.includes("final exam") ||
              /\bexam\b/.test(t);
            return {
              id: `${course.id}-${a.id}`,
              course: course.name,
              title: a.name,
              dueDate: a.due_at as string,
              type: (isExam ? "exam" : "assignment") as "exam" | "assignment",
              url: a.html_url || undefined,
              description: a.description || undefined,
              submissionTypes: a.submission_types ?? [],
            };
          });
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
