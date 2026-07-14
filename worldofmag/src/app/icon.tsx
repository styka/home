import { ImageResponse } from "next/og";
import { IS_PROD } from "@/lib/appName";
import { brandLogoSvgString } from "@/lib/brandLogo";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon — znak marki na przezroczystym tle (kolor zależny od środowiska).
export default function Icon() {
  const svg = brandLogoSvgString(IS_PROD);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(<img width={size.width} height={size.height} src={src} alt="" />, { ...size });
}
