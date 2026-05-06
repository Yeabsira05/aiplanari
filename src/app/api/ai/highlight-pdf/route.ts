import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { text, courseName, title } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are analyzing a study document to identify the most important terms and phrases a student should pay attention to.

Return JSON with a "highlights" array. Each item:
- phrase: the exact term or phrase as it appears in the text (1–4 words, case-sensitive)
- importance: "high" (critical — core definitions, key formulas, must-know terms) or "medium" (important supporting concepts)

Rules:
- Phrases must appear VERBATIM in the provided text
- Keep each phrase SHORT (1–4 words) so it fits within a single text element
- Prefer specific technical terms over generic words
- Return 20–30 items total, roughly 40% high / 60% medium
- Do NOT highlight common words, articles, or phrases that appear everywhere`,
        },
        {
          role: "user",
          content: `Course: ${courseName}\nDocument: ${title}\n\nText:\n${text}`,
        },
      ],
      max_tokens: 800,
    });

    const data = JSON.parse(completion.choices[0].message.content ?? "{}");
    return NextResponse.json({ highlights: data.highlights ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate highlights" }, { status: 500 });
  }
}
