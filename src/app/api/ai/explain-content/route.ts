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
    const { title, content, contentType, courseName } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 400 });
    }

    const plain = stripHtml(content || "").slice(0, 4000);
    if (!plain) {
      return NextResponse.json({ error: "No content to analyze" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `You are a study assistant. A student is studying "${title}" from the course "${courseName}".

Content type: ${contentType}
Content:
${plain}

Analyze this content and return a JSON study guide:
{
  "summary": "<2-3 sentence plain-language summary of what this is about>",
  "keyPoints": ["<key concept 1>", "<key concept 2>", "<key concept 3>", "<key concept 4>", "<key concept 5>"],
  "studyQuestions": ["<practice question 1>", "<practice question 2>", "<practice question 3>"],
  "studyTip": "<one specific, actionable study tip for this content>",
  "difficulty": "Easy" | "Medium" | "Hard"
}`,
        },
      ],
    });

    const text = response.choices[0].message.content || "{}";
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to explain content" }, { status: 500 });
  }
}
