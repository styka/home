import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { streamFile } from "@/lib/drive/client";

export const runtime = "nodejs";

// Proxies a Drive file's bytes so it can be embedded in <img> without making the
// file public on Drive. Requires an authenticated session (the app is fully
// behind auth — there is no anonymous mode).
export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await streamFile(params.fileId);
  if (!file) {
    return NextResponse.json({ error: "Nie znaleziono pliku" }, { status: 404 });
  }

  return new NextResponse(file.body, {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
