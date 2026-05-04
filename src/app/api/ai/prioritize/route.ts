import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { Deadline } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { deadlines, openaiKey } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY || openaiKey;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }

    if (!deadlines || deadlines.length === 0) {
      return NextResponse.json({ error: "No deadlines provided" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });

    const today = new Date().toISOString().split("T")[0];
    const assignmentsText = deadlines
      .slice(0, 30)
      .map(
        (d: Deadline, i: number) =>
          `${i + 1}. ID: "${d.id}", Title: "${d.title}", Course: "${d.course}", Due: ${d.dueDate || "No date"}, Type: ${d.type}`
      )
      .join("\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `You are a student study planner. Prioritize these assignments by urgency (1-10). Consider due date proximity, assignment type, and academic weight.

Today: ${today}

Assignments:
${assignmentsText}

Return ONLY valid JSON:
{
  "priorities": [
    {
      "id": "<exact assignment id>",
      "urgencyScore": <1-10>,
      "reason": "<brief reason, max 10 words>",
      "studyTip": "<one actionable tip>"
    }
  ],
  "overallStrategy": "<2 sentence study strategy>"
}`,
        },
      ],
    });

    const text = response.choices[0].message.content || "";
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to prioritize assignments" },
      { status: 500 }
    );
  }
}
