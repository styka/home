-- Raport implementacji 2026-06-03 (naprawa toggla mikrofonu / dyktowania).
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-03',
  'omnia-implementacja-2026-06-03',
  $omnia_mic$# Omnia — Raport implementacji 2026-06-03

## Mikrofon (dyktowanie) nie wyłącza się po zatwierdzeniu / wyjściu z pola

**Diagnoza:** Po kliknięciu mikrofonu i zatwierdzeniu wpisu (zapis notatki, „Anuluj",
Escape) znikała możliwość wyłączenia mikrofonu — trzeba było ponownie wejść w to samo
miejsce, włączyć i wyłączyć dyktowanie, żeby je w końcu uciszyć. Przyczyną było to, że
przycisk mikrofonu w `QuickNoteBar` i `NoteRow` żyje wewnątrz sekcji renderowanej
warunkowo (`expanded` / tryb edycji). Zatwierdzenie/anulowanie zwijało tę sekcję, ale
**nie zatrzymywało obiektu `SpeechRecognition`** — silnik rozpoznawania mowy nadal
nasłuchiwał, a przycisk Stop znikał z DOM. Stan `isRecording` to tylko flaga UI; nie
odzwierciedlał faktycznego stanu działającego silnika. Dodatkowo `SmartTextarea` nie
zatrzymywał dyktowania przy wysłaniu (Ctrl+Enter) ani przy odmontowaniu komponentu.

**Rozwiązanie:** Dyktowanie zatrzymujemy dokładnie tam, gdzie znika UI mikrofonu — w
każdej ścieżce wyjścia oraz na unmount, sterując realnym obiektem rozpoznawania, a nie
samą flagą. Dzięki temu zgodnie z sugestią zgłaszającego mikrofon gaśnie automatycznie
przy „puszczeniu" pola, bez potrzeby ręcznego ponownego włączania go.

- `QuickNoteBar.reset()` (wołane przy zapisie notatki, „Anuluj" i Escape) wywołuje
  teraz `stopVoiceInput()`.
- `NoteRow` zatrzymuje dyktowanie w `handleSave()` oraz w efekcie reagującym na zejście
  `isEditing` na `false` (łapie „Anuluj"/Escape przez `onStopEdit`). Recognizer z
  `startVoiceEdit` jest teraz zapisywany w `recognitionRef`, więc cleanup go obejmuje.
- `SmartTextarea` przy Ctrl+Enter najpierw zatrzymuje aktywne dyktowanie i wraca do
  stanu `idle`, dopiero potem woła `onSubmit`.
- Każdy z trzech komponentów dostał efekt sprzątający na unmount
  (`useEffect(() => () => recognitionRef.current?.stop(), [])`).

`AITaskInput` był już poprawny (zarówno `processText()`, jak i `reset()` wołały
`stopRecording()`), więc nie wymagał zmian.

**Zmienione pliki:**
- `src/components/notes/QuickNoteBar.tsx` — `stopVoiceInput()` w `reset()` + cleanup na unmount.
- `src/components/notes/NoteRow.tsx` — stop w `handleSave()`, efekt na `isEditing`, cleanup na unmount, zapamiętanie recognizera z `startVoiceEdit`.
- `src/components/ui/SmartTextarea.tsx` — stop dyktowania przy Ctrl+Enter + cleanup na unmount.
- `doświadczenia.md` — wpis z lekcją (zasób imperatywny z własnym cyklem życia trzeba jawnie zatrzymać w ścieżkach wyjścia i na unmount).

## Podsumowanie

Sesja obejmowała 1 zgłoszenie — naprawę zachowania mikrofonu (dyktowania) w modułach
Notatki i w komponencie współdzielonym `SmartTextarea`. Główny obszar zmian to warstwa
komponentów klienckich React korzystających z Web Speech API. Wspólny wzorzec błędu:
imperatywny zasób (`SpeechRecognition`) przeżywał warunkowo renderowany przycisk, który
nim sterował. Poprawka jest minimalna i punktowa — zatrzymanie rozpoznawania w każdej
ścieżce zamykającej UI oraz na unmount. `npm run build` przechodzi.
$omnia_mic$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
