import { ImageResponse } from "next/og";
import { IS_PROD } from "@/lib/appName";
import { brandLogoSvgString } from "@/lib/brandLogo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Ikona iOS (ekran domowy) — znak marki na przezroczystym tle (kolor zależny od środowiska).
export default function AppleIcon() {
  const svg = brandLogoSvgString(IS_PROD);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(<img width={size.width} height={size.height} src={src} />, { ...size });
}
