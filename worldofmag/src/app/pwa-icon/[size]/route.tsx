import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brandIcon";

// Ikony PWA (manifest) generowane z tego samego znaku co favicon — kolor zależny od środowiska.
export function GET(_req: Request, { params }: { params: { size: string } }) {
  const px = params.size === "512" ? 512 : 192;
  return new ImageResponse(<BrandMark px={px} />, { width: px, height: px });
}
