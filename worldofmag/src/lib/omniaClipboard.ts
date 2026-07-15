// Wspólna logika „skopiuj prompt dla Claude Code" — używana przez przyciski na
// listach zadań. Prompt + JSON zadań trafia do schowka i jest gotowy do wklejenia
// w Claude Code. Trzymane w lib (a nie w komponencie), bo korzysta z tego więcej
// niż jeden przycisk i chcemy jeden, spójny tekst promptu.

export const OMNIA_LLM_PROMPT = `Jesteś Claude Code z dostępem do kodu aplikacji WorldOfMag (Omnia). Poniżej dostajesz listę zadań zgłoszonych przez administratora Omnii (tytuł + opis) w bloku JSON.

## Co masz zrobić

Zrealizuj te zadania przez **spec-driven pipeline** Omnii — czyli uruchom komendę \`/specify\`, przekazując jej te zadania jako zakres funkcji do zbudowania. Nie zaczynaj od pisania kodu „na już": najpierw powstaje specyfikacja (co i po co), a pipeline sam przetoczy się przez plan → zadania → implementację → weryfikację → recenzję aż do merge do \`develop\`.

Konkretnie:
1. **Wywołaj \`/specify\`** z opisem obejmującym wszystkie poniższe zadania (ich tytuły i opisy). Jeśli zadania tworzą jedną spójną funkcję — potraktuj je jako jeden feature; jeśli są rozłączne — pogrupuj sensownie albo zrób spec pierwszego spójnego zestawu, a resztę zaznacz jako „poza zakresem". Nie gub żadnego zadania.
2. Jeśli pipeline zada pytania — zrobi to **tylko raz**, na starcie. Odpowiedz (albo pozwól przyjąć rekomendowane domyślne) i dalej **nie ingeruj** — etapy przechodzą automatycznie.
3. Trzymaj się konstytucji i konwencji repo (opisane w \`.claude/spec-pipeline/\` oraz \`CLAUDE.md\`): praca w \`worldofmag/\`, migracje jako ręczne pliki (bez enumów Prisma), Server Actions z \`revalidatePath\`, motyw przez zmienne CSS, teksty po polsku, żadnego builda/migracji przeciw prod DB.

Pełny opis pipeline'u: \`.claude/spec-pipeline/README.md\` (i w aplikacji: \`/admin/spec-pipeline\`).

---

## Zadania do realizacji (wejście dla \`/specify\`)`;

// Sentinel wyrzucany przez producenta tekstu, gdy nie ma żadnych zadań do skopiowania.
export const OMNIA_CLIPBOARD_EMPTY = "EMPTY";

/** Składa pełny tekst „prompt + JSON zadań" gotowy do wklejenia w Claude Code. */
export function buildOmniaPrompt(tasks: { title: string; description: string | null }[]): string {
  const json = JSON.stringify(
    tasks.map((t) => ({ tytuł: t.title, opis: t.description ?? "" })),
    null,
    2
  );
  return `${OMNIA_LLM_PROMPT}\n\n\`\`\`json\n${json}\n\`\`\``;
}

// Kopiowanie z tekstem dostarczanym leniwie (asynchronicznie).
// Mobile (iOS Safari): writeText wywołany PO `await` traci aktywację użytkownika
// (transient activation) → NotAllowedError. Dlatego najpierw próbujemy
// `clipboard.write` z ClipboardItem, któremu wolno podać Promise<Blob> — zapis
// startuje synchronicznie w obrębie gestu, a przeglądarka dokleja tekst gdy będzie
// gotowy, nie tracąc aktywacji. Desktop/Android: fallback na writeText, a dla
// najstarszych przeglądarek — textarea + execCommand.
export async function copyLazy(producer: () => Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        "text/plain": producer().then((t) => new Blob([t], { type: "text/plain" })),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch (e) {
      // „Pusto" propagujemy bez prób fallbacku; resztę traktujemy jak brak wsparcia
      // Promise w ClipboardItem (starszy Chrome) i schodzimy niżej.
      if (e instanceof Error && e.message === OMNIA_CLIPBOARD_EMPTY) throw e;
    }
  }

  const text = await producer();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}
