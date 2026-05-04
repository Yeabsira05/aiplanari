import { NextResponse } from "next/server";

type Deadline = {
  id: string;
  course: string;
  title: string;
  dueDate: string;
  type: "assignment" | "exam";
};

function daysLeft(dueDate: string) {
  const today = new Date();
  const deadline = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  return Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function generateFallbackPlan(deadlines: Deadline[]) {
  const sorted = [...deadlines]
    .sort((a, b) => daysLeft(a.dueDate) - daysLeft(b.dueDate))
    .slice(0, 5);

  return sorted
    .map((deadline, index) => {
      const left = daysLeft(deadline.dueDate);

      const priority =
        left <= 2 ? "High" : left <= 7 ? "Medium" : "Low";

      const steps =
        deadline.type === "exam"
          ? [
              "Review lecture notes and main topics.",
              "Do practice questions or old exam problems.",
              "Make a short summary sheet.",
            ]
          : [
              "Read the assignment instructions carefully.",
              "Break the work into smaller tasks.",
              "Finish and review before submitting.",
            ];

      return `${index + 1}. ${deadline.course} — ${deadline.title}
Priority: ${priority}
Why: ${left <= 0 ? "Due today" : `Due in ${left} days`}

Steps:
- ${steps.join("\n- ")}
`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const { deadlines } = await request.json();

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json(
        { error: "No deadlines provided" },
        { status: 400 }
      );
    }

    const plan = generateFallbackPlan(deadlines);

    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate study plan" },
      { status: 500 }
    );
  }
}