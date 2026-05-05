import { NextResponse } from "next/server";
import OpenAI from "openai";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  try {
    const { title, course, description } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: "No description provided" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const plainText = stripHtml(description).slice(0, 3000);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Summarize this student assignment concisely.

Assignment: ${title}
Course: ${course}
Description: ${plainText}

Return ONLY valid JSON:
{
  "tldr": "<one sentence: what you need to do>",
  "bullets": ["<step 1>", "<step 2>", "<step 3>", "<step 4>"]
}`,
        },
      ],
    });

    const text = response.choices[0].message.content || "";
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to summarize assignment" },
      { status: 500 }
    );
  }
}
