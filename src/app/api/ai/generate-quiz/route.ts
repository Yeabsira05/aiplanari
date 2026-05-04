import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { courseName, moduleName, content, openaiKey } = await request.json();

    if (!openaiKey) return NextResponse.json({ error: "OpenAI key required" }, { status: 400 });

    const client = new OpenAI({ apiKey: openaiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Generate a 5-question multiple-choice quiz for a student studying "${moduleName}" in the course "${courseName}". Each question must have exactly 4 answer options. Mix conceptual and applied questions. Return JSON with a "questions" array where each item has: question (string), options (array of exactly 4 strings), correct (0-3, zero-based index of the correct option), explanation (1-2 sentences explaining the correct answer).`,
        },
        {
          role: "user",
          content: content?.trim()
            ? `Base questions on this module content:\n${content.slice(0, 3000)}`
            : `Create questions about: ${moduleName}`,
        },
      ],
      max_tokens: 1500,
    });

    const data = JSON.parse(completion.choices[0].message.content ?? "{}");
    return NextResponse.json({ questions: data.questions ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
