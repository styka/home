"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { SpisUstawien } from "@/components/settings/SpisUstawien";
import { znajdzSekcje } from "@/lib/ustawienia/sekcje";

/**
 * 109: RAMA POJEDYNCZEJ SEKCJI USTAWIEŃ.
 *
 * Do 109 Ustawienia rysowały własny `<h1>` z ręcznymi stylami — czyli dokładnie ten wyjątek, przed
 * którym broni C-33. Teraz idą przez `ModuleView`: nagłówek, okruszek i stany brzegowe rysuje rama.
 *
 * `layout="fill"` jest tu wymogiem, nie ozdobą: lista sekcji i treść mają przewijać się OSOBNO,
 * inaczej długa sekcja (np. Aktywność) przewijałaby razem z sobą listę i po chwili nie byłoby z
 * czego wybrać następnej sekcji.
 *
 * Na telefonie listy bocznej nie ma (`hidden md:flex`) — nigdy dwa panele naraz (C-31). Powrót do
 * spisu daje okruszek, który rama pokazuje na obu szerokościach.
 */
export function RamaSekcji({ sekcjaId, children }: { sekcjaId: string; children: ReactNode }) {
  const t = useTranslations("components.settings.RamaSekcji");
  const tSpis = useTranslations("components.settings.SpisUstawien");
  const sekcja = znajdzSekcje(sekcjaId);

  // Trasa waliduje segment i woła `notFound()` wcześniej, więc tu zostaje wyłącznie zabezpieczenie
  // typu — bez niego `sekcja!` tłumiłoby prawdziwy błąd, gdyby ktoś użył ramy z innym id.
  if (!sekcja) return null;

  return (
    <ModuleView
      state="ready"
      layout="fill"
      icon={<sekcja.Ikona size={22} />}
      title={tSpis(sekcja.kluczNazwy)}
      subtitle={tSpis(sekcja.kluczOpisu)}
      breadcrumb={
        <Link
          href="/settings"
          aria-label={t("wrocDoSpisu")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          <ArrowLeft size={15} /> {t("okruszek")}
        </Link>
      }
    >
      <div className="flex min-h-0 flex-1 gap-6">
        <aside className="hidden md:flex" style={{ width: 220, flexShrink: 0, minHeight: 0 }}>
          <SpisUstawien wariant="lista" aktywna={sekcja.id} />
        </aside>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            // C-31: na telefonie ekran domyka dolny pasek kciuka i obszar gestów systemu —
            // bez tego ostatni element sekcji chowa się pod kreską do przełączania aplikacji.
            paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          }}
        >
          {children}
        </div>
      </div>
    </ModuleView>
  );
}
