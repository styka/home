"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { getRozmowy, otworzRozmowePrywatna, type RozmowaDTO, type RozmowcaDTO } from "../actions/rozmowy";
import { subskrybujSygnal } from "@/platform/events/sygnalKlienta";
import { ListaRozmow } from "./ListaRozmow";
import { WatekRozmowy } from "./WatekRozmowy";

/**
 * 107 — CZAT: lista rozmów i wątek.
 *
 * **Na telefonie widać dokładnie JEDNĄ kolumnę** (C-31: nigdy dwóch paneli na wąskim ekranie).
 * Który to panel, rozstrzyga ADRES (`?r=<id>`), a nie stan komponentu — dzięki temu rozmowa jest
 * odnośnikiem, wraca systemowym „wstecz” i da się ją zapisać w ulubionych. Na komputerze oba
 * panele stoją obok siebie i przewijają się osobno, więc rama dostaje `layout="fill"`.
 */
export function CzatPage({
  poczatkowe,
  rozmowcy,
  wybranaId,
}: {
  poczatkowe: RozmowaDTO[];
  rozmowcy: RozmowcaDTO[];
  wybranaId: string | null;
}) {
  const t = useTranslations("modules.czat.CzatPage");
  const router = useRouter();
  const [rozmowy, setRozmowy] = useState<RozmowaDTO[]>(poczatkowe);

  // Dane z serwera wygrywają: po `router.refresh()` przychodzą świeże propsy i nie chcemy trzymać
  // wcześniejszej kopii tylko dlatego, że raz wylądowała w stanie.
  useEffect(() => { setRozmowy(poczatkowe); }, [poczatkowe]);

  const odswiezListe = useCallback(() => {
    getRozmowy().then(setRozmowy).catch(() => { /* lista zostaje taka, jaka była */ });
  }, []);

  // Sygnał ze strumienia zdarzeń — dotyczy DOWOLNEJ rozmowy, więc odświeżamy całą listę
  // (liczniki nieprzeczytanych i kolejność zmieniają się także w rozmowach, których nie oglądam).
  useEffect(() => subskrybujSygnal((s) => {
    if (s.type === "czat.rozmowa") odswiezListe();
  }), [odswiezListe]);

  const wybierz = useCallback((id: string | null) => {
    router.push(id ? `/czat?r=${id}` : "/czat");
  }, [router]);

  const napiszDo = useCallback(async (userId: string) => {
    const id = await otworzRozmowePrywatna(userId);
    odswiezListe();
    wybierz(id);
  }, [odswiezListe, wybierz]);

  const wybrana = rozmowy.find((r) => r.id === wybranaId) ?? null;

  return (
    <ModuleView
      layout="fill"
      density="compact"
      state="ready"
      icon={<MessageCircle size={16} />}
      iconColor="var(--accent-green)"
      title={t("tytul")}
      href="/czat"
    >
      <div className="flex h-full min-h-0 gap-3">
        {/* Poniżej `md` panele wykluczają się wzajemnie — widać ten, który wskazuje adres. */}
        <div
          className={`${wybranaId ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:w-72 md:flex-shrink-0`}
        >
          <ListaRozmow
            rozmowy={rozmowy}
            rozmowcy={rozmowcy}
            wybranaId={wybranaId}
            onWybierz={wybierz}
            onNapiszDo={napiszDo}
          />
        </div>

        <div className={`${wybranaId ? "flex" : "hidden md:flex"} min-h-0 w-full flex-1 flex-col`}>
          {wybranaId ? (
            <WatekRozmowy
              key={wybranaId}
              rozmowaId={wybranaId}
              etykieta={wybrana?.etykieta ?? ""}
              onWstecz={() => wybierz(null)}
              onZmiana={odswiezListe}
            />
          ) : (
            <div
              className="hidden h-full items-center justify-center md:flex"
              style={{ color: "var(--text-muted)", fontSize: 13 }}
            >
              {t("wybierzRozmowe")}
            </div>
          )}
        </div>
      </div>
    </ModuleView>
  );
}
