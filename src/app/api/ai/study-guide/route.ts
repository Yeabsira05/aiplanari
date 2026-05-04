import { NextResponse } from "next/server";
import OpenAI from "openai";

type ModuleItem = { id: number; title: string; type: string };
type Module = { id: number; name: string; position: number; items: ModuleItem[] };

export async function POST(request: Request) {
  try {
    const { courseName, modules, openaiKey } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY || openaiKey;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key provided" }, { status: 400 });
    }

    if (!modules || modules.length === 0) {
      return NextResponse.json({ error: "No modules provided" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });

    const moduleSummary = modules
      .slice(0, 20)
      .map((m: Module) => {
        const itemList = m.items.length
          ? m.items.map((i: ModuleItem) => `    - [${i.type}] ${i.title}`).join("\n")
          : "    (no items)";
        return `Module ${m.position}: "${m.name}"\n${itemList}`;
      })
      .join("\n\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `You are an expert study advisor. A student is studying the course "${courseName}".

Here are the course modules and their content:

${moduleSummary}

Analyze each module and return a JSON study guide that helps the student study efficiently.

For each module:
- Give a studyROI score from 1-10 (10 = highest return on study time, e.g. core concepts, exam topics; 1 = low value like intro/admin)
- Write a short "whyImportant" explanation (1-2 sentences)
- Break it into 2-4 "studyComponents" — specific, concrete things to study or do, each with:
  - "name": what to focus on
  - "howToStudy": concrete action (e.g. "Summarize the 3 main algorithms", "Do 5 practice problems", "Rewatch the key derivation")
  - "estimatedMinutes": realistic study time
- Give a "studyTip": one actionable advice for this module

Return JSON:
{
  "modules": [
    {
      "id": <module id as number>,
      "studyROI": <1-10>,
      "roiLabel": "High" | "Medium" | "Low",
      "whyImportant": "...",
      "studyComponents": [
        {
          "name": "...",
          "howToStudy": "...",
          "estimatedMinutes": <number>
        }
      ],
      "studyTip": "..."
    }
  ],
  "overallStrategy": "<2-3 sentence recommended study order and approach>"
}

Sort modules in the response by studyROI descending (highest first).`,
        },
      ],
    });

    const text = response.choices[0].message.content || "";
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to generate study guide" }, { status: 500 });
  }
}
