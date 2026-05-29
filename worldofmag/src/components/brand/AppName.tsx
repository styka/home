import { IS_PROD } from "@/lib/appName";

// Nazwa marki w JSX: zawsze „Omnia", a na dev z indeksem górnym „DEV".
// Bez hooków — działa zarówno w komponentach serwerowych, jak i klienckich.
export function AppName({ supStyle }: { supStyle?: React.CSSProperties }) {
  return (
    <>
      Omnia
      {!IS_PROD && (
        <sup
          style={{
            fontSize: "0.5em",
            fontWeight: 700,
            marginLeft: 2,
            letterSpacing: "0.08em",
            verticalAlign: "super",
            opacity: 0.85,
            ...supStyle,
          }}
        >
          DEV
        </sup>
      )}
    </>
  );
}
