import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * 109: sekcja „Pomoc i przewodniki".
 *
 * 108: przewodniki MIESZKAJĄ pod `/guide`, a nie w ustawieniach — lektura schowana w ustawieniach
 * konta byłaby niewidoczna dla kogoś, kto do ustawień nie zagląda. Tutaj jest wyłącznie wejście.
 */
export async function Pomoc() {
  const t = await getTranslations("app.settings.page");

  return (
    <div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>{t("przewodnikiOpis")}</p>
      <Link
        href="/guide"
        style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}
      >
        {t("otworzPrzewodniki")}
      </Link>
    </div>
  );
}
