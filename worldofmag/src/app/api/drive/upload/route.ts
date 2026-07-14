import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/drive/client";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Accepts a multipart form upload (field "file", optional "module") and stores
// it on the user's Drive, returning a proxy URL to embed.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const moduleName = (form?.get("module") as string | null)?.trim() || "other";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Dozwolone są tylko obrazy" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Plik za duży (max 10 MB)" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(session.user.id, moduleName, {
      buffer,
      name: file.name || `obraz-${Date.now()}`,
      mime: file.type,
    });
    return NextResponse.json({ url: result.url, driveFileId: result.driveFileId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload nie powiódł się";
    const notConnected = message.includes("not connected");
    return NextResponse.json(
      { error: notConnected ? "Dysk Google nie jest połączony" : message },
      { status: notConnected ? 409 : 502 },
    );
  }
}
