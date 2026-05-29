import { ImageResponse } from "next/og";
import { IS_PROD } from "@/lib/appName";
import { brandLogoSvgString } from "@/lib/brandLogo";

// Ikona iOS pod WERSJONOWANĄ ścieżką: /apple-touch-icon/<wersja>.
// iOS cache'uje apple-touch-icon po samej ścieżce (ignoruje ?query), więc zmiana
// wyglądu wymaga NOWEJ ścieżki — inaczej iPhone serwuje starą ikonę z cache.
// Wersję trzyma ICON_VERSION (appName.ts); link wstawia layout.tsx.
export function GET() {
  const svg = brandLogoSvgString(IS_PROD);
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(<img width={180} height={180} src={src} />, { width: 180, height: 180 });
}
