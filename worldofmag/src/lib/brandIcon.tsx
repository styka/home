import { IS_PROD } from "@/lib/appName";

// Znak marki rysowany dla ImageResponse (Satori). Ten sam kształt na prod i dev,
// inny kolor: prod = żywy indygo→fiolet (premium), dev = neutralna szarość (staging).
// Motyw: pierścień z „orbitującą" kropką — nawiązanie do "Omnia" (wszystko w jednym).
const TILE_GRADIENT = IS_PROD
  ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
  : "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)";

export function BrandMark({ px }: { px: number }) {
  const ring = Math.round(px * 0.54);
  const border = Math.max(2, Math.round(px * 0.1));
  const dot = Math.round(px * 0.2);
  const nudge = Math.round(dot * 0.35);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: Math.round(px * 0.22),
        backgroundImage: TILE_GRADIENT,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: ring,
          height: ring,
          borderRadius: ring,
          border: `${border}px solid #ffffff`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -nudge,
            right: -nudge,
            width: dot,
            height: dot,
            borderRadius: dot,
            background: "#ffffff",
          }}
        />
      </div>
    </div>
  );
}
