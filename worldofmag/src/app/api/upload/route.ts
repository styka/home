import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

async function getGoogleAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(key.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${payload}.${sig}`,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function uploadToGoogleDrive(
  token: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folderId: string
): Promise<string> {
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify({ name: filename, parents: [folderId] })], {
      type: "application/json",
    })
  );
  form.append("file", new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
  );

  if (!res.ok) throw new Error(`Drive upload error: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

async function makeFilePublic(token: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

export async function POST(request: NextRequest) {
  const { dataUrl, filename, mimeType } = await request.json();

  if (!dataUrl || !filename) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (keyJson && folderId) {
    try {
      const key: ServiceAccountKey = JSON.parse(keyJson);
      const token = await getGoogleAccessToken(key);

      const base64Data = dataUrl.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");

      const fileId = await uploadToGoogleDrive(token, buffer, filename, mimeType, folderId);
      await makeFilePublic(token, fileId);

      const isImage = mimeType.startsWith("image/");
      const url = isImage
        ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`
        : `https://drive.google.com/uc?id=${fileId}&export=download`;

      return NextResponse.json({ url, driveFileId: fileId });
    } catch (err) {
      console.error("Google Drive upload failed:", err);
    }
  }

  // Fallback: store compressed data URL in DB (no Drive configured)
  return NextResponse.json({ url: dataUrl, driveFileId: null });
}
