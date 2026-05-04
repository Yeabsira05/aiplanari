import { NextResponse } from "next/server";

type CanvasCourse = {
  id: number;
  name: string;
};

type CanvasAssignment = {
  id: number;
  name: string;
  due_at: string | null;
};

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing Canvas token" },
        { status: 400 }
      );
    }

    const canvasBaseUrl = "https://reykjavik.instructure.com";  
    
    const coursesRes = await fetch(`${canvasBaseUrl}/api/v1/courses?per_page=20`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!coursesRes.ok) {
      return NextResponse.json(
        { error: "Could not fetch Canvas courses" },
        { status: 401 }
      );
    }

    const courses: CanvasCourse[] = await coursesRes.json();

    const results = await Promise.all(
      courses.map(async (course) => {
        const assignmentsRes = await fetch(
          `${canvasBaseUrl}/api/v1/courses/${course.id}/assignments?per_page=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!assignmentsRes.ok) return [];

        const assignments: CanvasAssignment[] = await assignmentsRes.json();

        return assignments
          .filter((a) => a.due_at)
          .map((a) => ({
            id: `${course.id}-${a.id}`,
            course: course.name,
            title: a.name,
            dueDate: a.due_at,
            type: "assignment",
          }));
      })
    );

    const allDeadlines = results.flat();

    return NextResponse.json({ deadlines: allDeadlines });
  } catch (error) {
    return NextResponse.json(
      { error: "Something went wrong fetching Canvas data" },
      { status: 500 }
    );
  }
}