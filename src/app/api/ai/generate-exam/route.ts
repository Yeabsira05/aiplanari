import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { courseName, modules, examFiles } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });

    const client = new OpenAI({ apiKey });

    const moduleList = (modules as { name: string; items: string[] }[])
      .map(m => `• ${m.name}: ${m.items.slice(0, 6).join(", ")}`)
      .join("\n");

    const examHint = (examFiles as string[])?.length
      ? `\nOld exam/test materials found in course files: ${(examFiles as string[]).join(", ")}. Model the difficulty and style on these past exams.`
      : "";

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Create a comprehensive mock final exam for the course "${courseName}". Generate 15 multiple-choice questions that span all major topics. Include a mix of recall, understanding, and application questions. Vary difficulty (roughly 30% easy, 50% medium, 20% hard). Return JSON with a "questions" array. Each item: question (string), options (array of exactly 4 strings), correct (0-3 index), explanation (1-2 sentences), topic (short topic/module label).`,
        },
        {
          role: "user",
          content: `Course modules and their content:\n${moduleList}${examHint}`,
        },
      ],
      max_tokens: 3500,
    });

    const data = JSON.parse(completion.choices[0].message.content ?? "{}");
    return NextResponse.json({ questions: data.questions ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate exam" }, { status: 500 });
  }
}
