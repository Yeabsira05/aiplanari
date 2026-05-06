import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const BUCKET = "resources";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string)?.trim();
    const courseName = (formData.get("courseName") as string)?.trim();
    const type = (formData.get("type") as string) ?? "notes";
    const uploaderName = (formData.get("uploaderName") as string)?.trim() || "Anonymous";
    const description = (formData.get("description") as string)?.trim() || "";

    if (!file || !title || !courseName) {
      return NextResponse.json({ error: "File, title, and course are required" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 20 MB" }, { status: 400 });
    }

    // Ensure bucket exists (no-op if already created)
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const ext = file.name.split(".").pop() ?? "bin";
    const safeCourse = courseName.replace(/[^a-zA-Z0-9]/g, "_");
    const filePath = `${safeCourse}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, Buffer.from(bytes), { contentType: file.type, upsert: false });

    if (storageErr) {
      console.error("[resources/upload] storage error:", storageErr);
      return NextResponse.json({ error: "File upload failed" }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    const { data, error: dbErr } = await supabase
      .from("resources")
      .insert({
        uploader_name: uploaderName,
        course_name: courseName,
        title,
        type,
        file_url: publicUrl,
        file_path: filePath,
        file_size: file.size,
        file_name: file.name,
        description,
      })
      .select()
      .single();

    if (dbErr) {
      console.error("[resources/upload] db error:", dbErr);
      await supabase.storage.from(BUCKET).remove([filePath]);
      return NextResponse.json({ error: `DB error: ${dbErr.message} (code: ${dbErr.code})` }, { status: 500 });
    }

    return NextResponse.json({ resource: data });
  } catch (err) {
    console.error("[resources/upload] error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
