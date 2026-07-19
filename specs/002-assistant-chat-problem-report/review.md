# Recenzja: Zgłaszanie problemu z czatem asystenta AI (admin) → zadanie w Omnia

- **Spec/Plan/Verify:** ./spec.md, ./plan.md, ./verify.md (002-assistant-chat-problem-report)
- **Data:** 2026-07-19
- **Recenzent:** Claude Code (etap /review, świeże oko)

## Zakres diffa
`git diff origin/develop` → **2 pliki, +143/-4**:
- `AICommandSheet.tsx` — prop `isAdmin`; helper `buildChatProblemReport`; admin-only ikona `Bug` w
  nagłówku (zamiast zębatki z 001); panel zgłoszenia + handler `submitProblemReport`
  (`ensureOmniaProject`+`createTask`).
- `AppShell.tsx` — `<AICommandSheet isAdmin={isAdmin} />`.

## Ustalenia
Posortowane od najpoważniejszego.

1. *(drobne, naniesione w recenzji)* `AICommandSheet.tsx` — convention/UX. Przycisk sukcesu prowadził
   do `/tasks` (lista projektów), a mamy `reportDone.projectId` projektu „Omnia". **Poprawiono** na
   deep-link `/tasks/${reportDone.projectId}` („Otwórz w zadaniach") — admin ląduje wprost na liście
   zgłoszeń „Omnia". `tsc` po zmianie: exit 0.
2. *(informacyjne, nie defekt)* `submitProblemReport` na błędzie ustawia globalny `error`
   („Nie udało się utworzyć zgłoszenia."), który przy kolejnym otwarciu panelu trafiłby do sekcji
   „Ostatni błąd (backend)" raportu. Skutek kosmetyczny i tylko po nieudanym zapisie; nie blokujące —
   zostawiam bez zmian (minimalizm; to realnie ostatni błąd w oknie).

## Przegląd pod kątem ryzyk (wynik: czysto)
- **Poprawność:** `buildChatProblemReport` obsługuje wszystkie warianty `Turn` (każdy ma `content`);
  narrowing `"log" in t`/`"meta" in t` poprawny; `trunc`/`json` zabezpieczają wielkość i serializację.
  `submitProblemReport` ma guard `!canReport || reportBusy`, `try/catch/finally`, poprawne `await`
  na `ensureOmniaProject`→`createTask`. Brak wyścigów (busy-flag).
- **Guardy / uprawnienia:** ikona i panel za `isAdmin` (spójnie z `FeedbackInspector`). Serwerowo
  `createTask`/`ensureOmniaProject` mają `requireAuth`+`assertProjectAccess`; zadanie powstaje w
  **własnym** projekcie „Omnia" wołającego → brak eskalacji nawet przy obejściu UI (C-21).
- **C-20** ✅ — mutacje przez istniejące Server Actions z `revalidatePath`; brak ręcznej inwalidacji.
- **C-23** ✅ — brak nowej `AIAction` (bezpośrednie tworzenie zadania); `check:actions` = 95 OK.
- **Konwencje:** kolory ze zmiennych CSS (`--accent-purple`/`--text-muted`/`--on-accent`), zero hexów
  (C-30); teksty PL (C-32); praca w `worldofmag/`, alias `@/*` (C-01/C-02); mobile bez rozjazdu (C-31).
- **C-53** ✅ — reuse „Omnia"+`createTask`, brak nowego modelu/migracji/akcji/zależności.
- **Bezpieczeństwo:** treść zadania renderuje markdown Omnii (escapuje `&`/`<` globalnie) → brak XSS;
  logi w blokach kodu; brak kluczy/sekretu w treści (C-41 n/d).
- **Bramki (verify.md + po poprawce):** tsc 0, lint 0, next build „Compiled successfully",
  check:actions/migrations OK.

## Werdykt
**APPROVE Z UWAGAMI** — implementacja poprawna, minimalna, zgodna z konwencjami i konstytucją; 7/7
kryteriów akceptacji spełnione. Jedyna uwaga (nr 2) jest kosmetyczna i świadomie zostawiona. Drobna
poprawka deep-linku naniesiona w recenzji. Domykam: merge `claude/healer-assistant-icon-mzzn5h` →
`develop` + push (STANDING AUTHORIZATION, C-52). Promocja `develop → master` tylko na wyraźne „Tak".
