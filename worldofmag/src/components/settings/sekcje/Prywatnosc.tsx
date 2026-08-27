import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PrivacySettings } from "@/components/settings/PrivacySettings";

/** 109: sekcja „Prywatność i dane" (RODO). Treść przeniesiona 1:1. */
export async function Prywatnosc() {
  const t = await getTranslations("app.settings.page");

  return (
    <div>
      <PrivacySettings />
      <Link
        href="/legal"
        style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: "var(--accent-blue)", textDecoration: "none" }}
      >
        {t("dokumentyPrawnePolitykaPrywatnosci")}
      </Link>
    </div>
  );
}
