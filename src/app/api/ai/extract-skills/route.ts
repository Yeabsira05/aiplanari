import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const { courseName, modules, openaiKey } = await request.json();

    if (!openaiKey) return NextResponse.json({ error: "OpenAI key required" }, { status: 400 });

    const client = new OpenAI({ apiKey: openaiKey });

    const moduleList = (modules as { name: string; items: string[] }[])
      .map(m => `• ${m.name}: ${m.items.slice(0, 6).join(", ")}`)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are analyzing a university course called "${courseName}" to identify the core skills a student must master to pass. Based on the course modules, extract 8–12 specific, learnable skills.

Each skill must be a concrete concept or technique (not a vague topic). Think like a student asking "what exactly do I need to be able to DO to pass this class?"

Return JSON with a "skills" array. Each item:
- id: lowercase-hyphenated slug (e.g. "eigenvalue-decomposition")
- name: short, specific skill name (e.g. "Eigenvalue Decomposition")
- description: one sentence — what can the student DO once they learn this skill
- importance: "high" (core/likely on exam), "medium" (important but secondary), or "low" (supplementary)
- estimatedMinutes: realistic solo study time 15–90`,
        },
        {
          role: "user",
          content: `Course modules:\n${moduleList}`,
        },
      ],
      max_tokens: 1000,
    });

    const data = JSON.parse(completion.choices[0].message.content ?? "{}");
    return NextResponse.json({ skills: data.skills ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to extract skills" }, { status: 500 });
  }
}
