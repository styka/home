import { prisma } from "@/platform/db/prisma";
import { enqueue } from "@/platform/jobs/queue";

/**
 * 111 — KIEDY WIEDZA O UŻYTKOWNIKU PRZYRASTA SAMA.
 *
 * Zgłoszenie właściciela: „myślałem, że wiedza o userze będzie rosła nie tylko gdy user wprost
 * odpowie na pytania, ale także z samego wykonywania akcji w aplikacji, a wydaje mi się, że się tu
 * nic takiego nie pojawiło".
 *
 * Nie „wydawało mu się": zadanie `user.facts` było kolejkowane z **dokładnie jednego miejsca**
 * w całej aplikacji — przycisku „Poszukaj hipotez" w ustawieniach. Nic nie uruchamiało go samo,
 * więc wiedza z definicji nie mogła rosnąć z korzystania.
 *
 * **Dlaczego nie `setInterval` wprost.** Bo tyknięcie chodzi w KAŻDEJ instancji `web`, a przemiecenie
 * ma się odbyć raz. Prawo do przebiegu jest więc *odbierane atomowo* — warunkowym `UPDATE` na
 * wierszu w `Config`: dostaje je ta instancja, której zapis się powiódł. Wersja „odczytaj znacznik,
 * porównaj, zapisz" przepuszcza dwie instancje naraz (obie widzą stary znacznik) i obie
 * zakolejkowałyby ten sam komplet zadań. To jest ten sam mechanizm i ten sam powód, co
 * w `platform/retention/harmonogram.ts` (083) — świadomie skopiowany wzorzec, nie nowy pomysł.
 *
 * **Dlaczego samo przemiecenie tylko KOLEJKUJE.** Wnioskowanie woła model i trwa kilkanaście sekund;
 * robienie tego w tyknięciu blokowałoby proces na czas liczby kont razy kilkanaście sekund. Tu
 * powstają wyłącznie zadania — pracę wykonuje worker, który już umie ponawiać i raportować postęp.
 *
 * **Gdzie NIE ma decyzji o koszcie.** Przemiecenie nie sprawdza, czy przybyło materiału — robi to
 * sam handler, przez odcisk, i to jest właściwe miejsce: odcisk liczy się z tych samych zapytań,
 * z których powstaje materiał do promptu. Sprawdzanie go tutaj znaczyłoby liczenie wszystkiego dwa
 * razy. Zadanie bez nowego materiału kończy się przed wywołaniem modelu, więc nic nie kosztuje.
 */

export const WIEDZA_ZNACZNIK_KLUCZ = "user_facts_last_sweep";

/** Jak często w ogóle zaglądamy, czy są konta do przemiecenia. */
const GODZINA_MS = 60 * 60 * 1000;

/** Jak często JEDNO konto może trafić do wnioskowania. */
const DOBA_MS = 24 * 60 * 60 * 1000;

/**
 * Ile kont bierzemy na jedno przemiecenie.
 *
 * Granica jest tu po to, żeby jedno tyknięcie nie zakolejkowało nagle pracy dla wszystkich kont
 * naraz — kolejka jest wspólna z zadaniami, na które ktoś w tej chwili czeka.
 */
const KONT_NA_PRZEBIEG = 20;

/**
 * Próbuje odebrać prawo do przemiecenia. `true` = ta instancja je ma i tylko ona.
 * Wiersza jeszcze nie ma → pierwszy zapis wygrywa dzięki `ON CONFLICT`.
 */
export async function odbierzPrawoDoPrzemiatania(odstepMs = GODZINA_MS): Promise<boolean> {
  const teraz = new Date().toISOString();
  const granica = new Date(Date.now() - odstepMs).toISOString();
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "Config" ("id", "key", "value", "updatedAt")
    VALUES (gen_random_uuid()::text, ${WIEDZA_ZNACZNIK_KLUCZ}, ${teraz}, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = EXCLUDED."value", "updatedAt" = now()
      WHERE "Config"."value" < ${granica}
    RETURNING "key"
  `;
  return rows.length > 0;
}

/**
 * Jedno przemiecenie, jeśli minęła godzina od poprzedniego. Zwraca liczbę zakolejkowanych zadań
 * albo `null`, gdy przebiegu nie było (prawo wziął ktoś inny).
 */
export async function przemiecWiedzeJesliCzas(odstepMs = GODZINA_MS): Promise<number | null> {
  if (!(await odbierzPrawoDoPrzemiatania(odstepMs))) return null;

  const kandydaci = await prisma.assistantPref.findMany({
    take: KONT_NA_PRZEBIEG,
    where: {
      // 111 (AC-9): wyłączony automat znaczy wyłączony. Ręczny przycisk działa niezależnie.
      autoFacts: true,
      OR: [{ factsLastRunAt: null }, { factsLastRunAt: { lt: new Date(Date.now() - DOBA_MS) } }],
    },
    // Najdawniej przemiatane idą pierwsze — inaczej przy większej liczbie kont niż `KONT_NA_PRZEBIEG`
    // te z końca listy nie doczekałyby się nigdy.
    orderBy: { factsLastRunAt: { sort: "asc", nulls: "first" } },
    select: { userId: true },
  });

  let zakolejkowane = 0;
  for (const k of kandydaci) {
    // `dedupeKey` jest tu warunkiem poprawności, nie oszczędnością: wnioskowanie trwa kilkanaście
    // sekund, więc wolno chodzące zadanie dostałoby przy kolejnym tyknięciu drugie zlecenie.
    await enqueue("user.facts", {}, { ownerId: k.userId, dedupeKey: `user.facts:${k.userId}` });
    zakolejkowane++;
  }
  return zakolejkowane;
}
