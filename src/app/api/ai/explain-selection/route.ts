import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { text, title, courseName } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a study assistant helping a student understand material from "${title}" in the course "${courseName}". The student has highlighted a section of a PDF. Explain it clearly, identify key terms, and pose a practice question. Return JSON with exactly these keys: explanation (string, 2-3 sentences), terms (array of objects with "term" and "definition", max 3 items, use empty array if none), question (string, one concise practice question).`,
        },
        {
          role: "user",
          content: `Explain this highlighted text: "${text.slice(0, 1000)}"`,
        },
      ],
      max_tokens: 600,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Empty response");

    const data = JSON.parse(content);
    return NextResponse.json({
      explanation: data.explanation ?? "",
      terms: Array.isArray(data.terms) ? data.terms : [],
      question: data.question ?? "",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to explain selection" }, { status: 500 });
  }
}
