import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { Deadline } from "@/lib/types";

function daysLeft(dueDate: string) {
  const today = new Date();
  const deadline = new Date(dueDate);
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function generateFallbackPlan(deadlines: Deadline[]) {
  const sorted = [...deadlines]
    .sort((a, b) => daysLeft(a.dueDate) - daysLeft(b.dueDate))
    .slice(0, 5);

  return sorted
    .map((deadline, index) => {
      const left = daysLeft(deadline.dueDate);
      const priority = left <= 2 ? "High" : left <= 7 ? "Medium" : "Low";
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
    const { deadlines, openaiKey } = await request.json();

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ error: "No deadlines provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || openaiKey;

    if (!apiKey) {
      return NextResponse.json({ plan: generateFallbackPlan(deadlines) });
    }

    const client = new OpenAI({ apiKey });

    const today = new Date().toISOString().split("T")[0];
    const assignmentsText = deadlines
      .slice(0, 10)
      .map(
        (d: Deadline, i: number) =>
          `${i + 1}. "${d.title}" (${d.course}) — due ${d.dueDate}, type: ${d.type}${d.urgencyScore ? `, AI priority: ${d.urgencyScore}/10` : ""}`
      )
      .join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `You are a student study planner. Create a clear, actionable study plan for these upcoming deadlines.

Today: ${today}

Deadlines (sorted by priority):
${assignmentsText}

Write a practical day-by-day study plan. Be specific and encouraging. Format it clearly with numbered items and bullet points.`,
        },
      ],
    });

    const plan = response.choices[0].message.content || generateFallbackPlan(deadlines);

    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate study plan" },
      { status: 500 }
    );
  }
}
