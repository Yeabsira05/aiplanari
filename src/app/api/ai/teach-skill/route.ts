import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { courseName, skillName } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a private tutor helping a student learn "${skillName}" from the course "${courseName}". Your goal is to make the student genuinely understand this so they can apply it on an exam — not just memorize it.

Write a lesson that feels like a real tutoring session. Be direct and clear. Avoid textbook fluff.

Return JSON with exactly these keys:
- explanation: 2-3 paragraphs. First: what it IS in plain language. Second: why it matters / how it fits in the course. Third: the core idea of HOW to use it.
- example: A fully worked, step-by-step example. Number each step. Show all work. Be concrete (use real numbers, not abstract variables where possible).
- keyInsight: ONE sentence — the single "aha moment" that makes this concept truly click. This is the thing a student wishes their professor had said.
- practiceQuestion: One exam-style problem. Specific enough to solve, similar to what actually appears on tests.
- answer: Complete worked solution. Show every step.`,
        },
        {
          role: "user",
          content: `Teach me: ${skillName}`,
        },
      ],
      max_tokens: 1800,
    });

    const data = JSON.parse(completion.choices[0].message.content ?? "{}");

    function toStr(val: unknown): string {
      if (typeof val === "string") return val;
      if (Array.isArray(val)) return val.join("\n");
      if (val && typeof val === "object") return Object.values(val).join("\n\n");
      return String(val ?? "");
    }

    return NextResponse.json({
      explanation: toStr(data.explanation),
      example: toStr(data.example),
      keyInsight: toStr(data.keyInsight),
      practiceQuestion: toStr(data.practiceQuestion),
      answer: toStr(data.answer),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
  }
}
