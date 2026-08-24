"use client";

import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { ViewEmpty } from "@/components/ui/view";
import { NewsTimeline } from "./NewsTimeline";
import { SekcjaTematu } from "./sekcjeTematow";
import type { StreamTimelineTopicDTO } from "../actions/news";

/**
 * 083: linia czasu WSZYSTKICH tematów w tym samym układzie sekcji co wiadomości.
 *
 * Zgłoszenie właściciela: „widok osi czasu nie działa poprawnie, jak są wybrane wszystkie tematy, a
 * powinien i powinno być widać, który wpis do którego tematu należy". Do 082 przełącznik osi czasu
 * czytał linię POJEDYNCZEGO tematu, więc przy pozycji zbiorczej nie miał czego pokazać.
 *
 * Przynależność wpisu do tematu niesie PRZYKLEJONY NAGŁÓWEK SEKCJI, a nie etykietka przy każdym
 * wierszu: nagłówek widać przez cały czas przewijania, a etykietka przy stu wpisach byłaby sto razy
 * powtórzoną tą samą informacją.
 */
export function NewsTimelineStream({
  topics,
  loading,
  filtrAktywny,
  czytanyTemat,
  zarejestruj,
  wszystkieUkryte = false,
  akcjeTematu,
}: {
  /** Tematy JUŻ przefiltrowane przez pasek nawigacji. */
  topics: StreamTimelineTopicDTO[];
  loading: boolean;
  filtrAktywny: boolean;
  czytanyTemat: string | null;
  zarejestruj: (id: string, el: HTMLElement | null) => void;
  /** 085 (AC-16): lista jest pusta, bo ODSIALIŚMY puste tematy — a nie dlatego, że ich nie ma. */
  wszystkieUkryte?: boolean;
  akcjeTematu?: (topicId: string) => ReactNode;
}) {
  const t = useTranslations("modules.news.NewsTimelineStream");

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  // 085 (AC-16): ta sama zasada, co w strumieniu wiadomości — „nie masz tematów" i „wszystkie są
  // dziś puste" to dwa różne komunikaty.
  if (topics.length === 0) {
    return wszystkieUkryte ? (
      <ViewEmpty
        icon={<CalendarClock size={20} />}
        title={t("wszystkieTematyPuste")}
        description={t("wszystkieTematyPusteOpis")}
      />
    ) : (
      <ViewEmpty title={t("dodajPierwszyTemat")} />
    );
  }

  const razem = topics.reduce((n, x) => n + x.entries.length, 0);

  return (
    <div>
      <div className="mb-3 text-xs text-[var(--text-muted)]">
        {razem === 0
          ? filtrAktywny
            ? t("brakFaktowDlaFiltra")
            : t("brakFaktowWcale")
          : `Faktów na osi: ${razem} w ${topics.filter((x) => x.entries.length > 0).length} tematach`}
      </div>

      <div className="space-y-6">
        {topics.map((topic) => (
          <SekcjaTematu
            key={topic.id}
            id={topic.id}
            tytul={topic.title}
            licznik={topic.entries.length}
            czytana={topic.id === czytanyTemat}
            zarejestruj={zarejestruj}
            akcje={akcjeTematu?.(topic.id)}
          >
            <div className="mt-3">
              {/* Temat bez faktów ZOSTAJE na liście — znikająca sekcja wygląda jak usterka. */}
              <NewsTimeline entries={topic.entries} />
            </div>
          </SekcjaTematu>
        ))}
      </div>
    </div>
  );
}
