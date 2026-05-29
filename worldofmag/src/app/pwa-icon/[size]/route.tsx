import { ImageResponse } from "next/og";
import { IS_PROD } from "@/lib/appName";
import { brandLogoSvgString } from "@/lib/brandLogo";

// Ikony PWA (manifest) — znak marki na przezroczystym tle, kolor zależny od środowiska.
export function GET(_req: Request, { params }: { params: { size: string } }) {
  const px = params.size === "512" ? 512 : 192;
  const svg = brandLogoSvgString(IS_PROD);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(<img width={px} height={px} src={src} />, { width: px, height: px });
}
