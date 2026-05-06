import { NextResponse } from "next/server";

const BASE = process.env.CANVAS_BASE_URL!;

async function uploadFileToCanvas(
  token: string,
  courseId: string,
  assignmentId: string,
  file: File
): Promise<number> {
  // Step 1 — request an upload slot from Canvas
  const slotRes = await fetch(
    `${BASE}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self/files`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ name: file.name, size: String(file.size) }),
    }
  );
  if (!slotRes.ok) throw new Error(`Upload slot request failed: ${slotRes.status}`);
  const slot = await slotRes.json();

  // Step 2 — upload the file to the S3/Canvas upload URL
  const s3Form = new FormData();
  for (const [k, v] of Object.entries(slot.upload_params ?? {})) {
    s3Form.append(k, v as string);
  }
  const bytes = await file.arrayBuffer();
  s3Form.append(slot.file_param ?? "file", new Blob([bytes], { type: file.type }), file.name);

  const uploadRes = await fetch(slot.upload_url, {
    method: "POST",
    body: s3Form,
    redirect: "manual",
  });

  // Step 3 — follow the redirect Canvas returns to confirm the upload
  let fileId: number;
  const location = uploadRes.headers.get("Location");
  if (location) {
    const confirmRes = await fetch(location, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!confirmRes.ok) throw new Error("File confirmation failed");
    const confirmed = await confirmRes.json();
    fileId = confirmed.id;
  } else {
    const uploadData = await uploadRes.json();
    fileId = uploadData.id;
  }

  if (!fileId) throw new Error("Could not get file ID from Canvas");
  return fileId;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = formData.get("token") as string;
    const courseId = formData.get("courseId") as string;
    const assignmentId = formData.get("assignmentId") as string;
    const submissionType = formData.get("submissionType") as string;

    if (!token || !courseId || !assignmentId || !submissionType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    let body: URLSearchParams;

    if (submissionType === "online_upload") {
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      const fileId = await uploadFileToCanvas(token, courseId, assignmentId, file);
      body = new URLSearchParams({
        "submission[submission_type]": "online_upload",
        "submission[file_ids][]": String(fileId),
      });
    } else if (submissionType === "online_text_entry") {
      const text = formData.get("text") as string;
      if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });
      body = new URLSearchParams({
        "submission[submission_type]": "online_text_entry",
        "submission[body]": text.trim(),
      });
    } else if (submissionType === "online_url") {
      const url = formData.get("url") as string;
      if (!url?.trim()) return NextResponse.json({ error: "No URL provided" }, { status: 400 });
      body = new URLSearchParams({
        "submission[submission_type]": "online_url",
        "submission[url]": url.trim(),
      });
    } else {
      return NextResponse.json({ error: `Unsupported submission type: ${submissionType}` }, { status: 400 });
    }

    const submitRes = await fetch(
      `${BASE}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
      { method: "POST", headers: authHeaders, body }
    );

    if (!submitRes.ok) {
      const err = await submitRes.text();
      console.error("[submit] Canvas error:", submitRes.status, err);
      return NextResponse.json({ error: "Submission failed on Canvas" }, { status: submitRes.status });
    }

    const submission = await submitRes.json();
    return NextResponse.json({ success: true, submittedAt: submission.submitted_at });
  } catch (err) {
    console.error("[submit] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
