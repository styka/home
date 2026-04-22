import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const { dataUrl, filename, mimeType, size } = await request.json();

  if (!dataUrl || !filename) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    try {
      const timestamp = Math.round(Date.now() / 1000);
      const folder = "worldofmag/thoughts";
      const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha256").update(toSign).digest("hex");

      const form = new FormData();
      form.append("file", dataUrl);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      form.append("folder", folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        { method: "POST", body: form }
      );

      if (res.ok) {
        const result = await res.json();
        return NextResponse.json({ url: result.secure_url });
      }
      console.error("Cloudinary upload failed:", await res.text());
    } catch (err) {
      console.error("Cloudinary error:", err);
    }
  }

  // Fallback: store data URL directly in DB (images compressed client-side, ~100KB each)
  return NextResponse.json({ url: dataUrl });
}
