import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { courses } = await request.json() as { courses: string[] };
    if (!courses?.length) return NextResponse.json({ resources: [] });

    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .in("course_name", courses)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[resources/list] db error:", error);
      return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
    }

    return NextResponse.json({ resources: data ?? [] });
  } catch (err) {
    console.error("[resources/list] error:", err);
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}
