// Wspólna logika „skopiuj prompt dla Claude Code" — używana przez przyciski na
// listach zadań. Prompt + JSON zadań trafia do schowka i jest gotowy do wklejenia
// w Claude Code. Trzymane w lib (a nie w komponencie), bo korzysta z tego więcej
// niż jeden przycisk i chcemy jeden, spójny tekst promptu.

export const OMNIA_LLM_PROMPT = `Jesteś Claude Code — zaawansowanym agentem AI z dostępem do kodu aplikacji WorldOfMag (Omnia), osobistego systemu zarządzania życiem i pracą developera.

Poniżej znajduje się lista zadań zgłoszonych przez administratora projektu Omnia. Zadania mogą dotyczyć: napraw błędów, nowych funkcjonalności, poprawek UX, prac utrzymaniowych i refaktoryzacji.

## Twoje zadanie

Przeanalizuj każde zgłoszenie, zaplanuj i zaimplementuj rozwiązanie, a następnie wygeneruj raport i zapisz go w aplikacji.

### Krok 1 — Analiza i implementacja

Dla każdego zadania:
1. Przeczytaj tytuł i opis — zrozum problem lub wymaganie
2. Znajdź odpowiednie pliki w kodzie (src/, prisma/, public/)
3. Zaplanuj minimalne rozwiązanie (bez nadmiarowych zmian i abstrakcji)
4. Zaimplementuj — przestrzegaj stylu kodu: TypeScript strict, Server Actions, Tailwind CSS, ciemny motyw z CSS variables
5. Sprawdź build: \`cd worldofmag && npm run build\`
6. Commituj z opisowym komunikatem po każdym zadaniu

### Krok 2 — Raport

Po zakończeniu wszystkich zadań utwórz raport techniczny, wywołując Server Action \`createReport\` z \`@/actions/reports.ts\` (lub bezpośrednio przez Prisma w skrypcie Node.js). Parametry:
- **title**: "Omnia — Raport implementacji [dzisiejsza data YYYY-MM-DD]"
- **slug**: "omnia-implementacja-[dzisiejsza data YYYY-MM-DD]"
- **category**: "general"
- **content**: dokument Markdown z sekcjami dla każdego zadania w formacie:

\`\`\`
# Omnia — Raport implementacji [data]

## [Tytuł zadania 1]
**Diagnoza:** co było problemem / co było wymagane
**Rozwiązanie:** co zostało zrobione i dlaczego tak (nie co — to widać w kodzie)
**Zmienione pliki:** lista plików z krótkim opisem zmiany

## [Tytuł zadania 2]
...

## Podsumowanie
Całościowy opis sesji implementacyjnej — ile zadań, główne obszary zmian, uwagi.
\`\`\`

### Wskazówki techniczne

- Główny katalog aplikacji: \`worldofmag/\` (nie dotykaj \`src/\`, \`_old/\`, \`pom.xml\` poza \`worldofmag/\`)
- Alias importów: \`@/*\` → \`./src/*\`
- Stack: Next.js 14 App Router, TypeScript strict, Prisma 5, Tailwind CSS + CSS variables
- Zmiany schematu DB: \`npm run db:push\` (dev SQLite) lub nowa migracja w \`prisma/migrations/\` (prod)
- Ciemny motyw: używaj zmiennych CSS (\`var(--bg-base)\`, \`var(--text-primary)\` itp.) — nie hardcoduj kolorów
- Mutacje danych: zawsze Server Actions z \`revalidatePath()\` na końcu
- Deploy: push do brancha \`develop\` → auto-deploy na środowisko testowe (worldofmag.onrender.com)

---

## Zadania do realizacji`;

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
