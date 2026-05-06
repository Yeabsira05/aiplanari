import { NextResponse } from "next/server";

const BASE = process.env.CANVAS_BASE_URL!;

export async function POST(request: Request) {
  try {
    const { token, courseId, assignmentId } = await request.json();
    if (!token || !courseId || !assignmentId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const headers = { Authorization: `Bearer ${token}` };

    const [assignRes, subRes] = await Promise.all([
      fetch(`${BASE}/api/v1/courses/${courseId}/assignments/${assignmentId}`, { headers }),
      fetch(`${BASE}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`, { headers }),
    ]);

    if (!assignRes.ok) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const assignment = await assignRes.json();
    const submission = subRes.ok ? await subRes.json() : null;

    const alreadySubmitted =
      submission &&
      submission.workflow_state &&
      submission.workflow_state !== "unsubmitted";

    return NextResponse.json({
      submissionTypes: assignment.submission_types ?? [],
      alreadySubmitted,
      submittedAt: submission?.submitted_at ?? null,
      submissionType: submission?.submission_type ?? null,
    });
  } catch (err) {
    console.error("[assignment-details]", err);
    return NextResponse.json({ error: "Failed to fetch assignment details" }, { status: 500 });
  }
}
