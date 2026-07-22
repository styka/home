# Doświadczenia — Lessons Learned

Plik prowadzony automatycznie przez Claude Code. Każdy wpis to rzeczywisty problem napotkany podczas pracy nad projektem i wyciągnięta z niego lekcja.

---

## 2026-07-22 — Kotwica „od daty wykonania": korekta daty wykonania musi przeliczyć termin następcy
**Problem:** Kotwica cykliczności `COMPLETION` („licz od daty wykonania") liczy termin następnego
wystąpienia w chwili domknięcia i zapisuje go na sztywno na następcy. Po 021/022 datę wykonania da się
poprawić po fakcie — 022 synchronizował `lastCompletedAt` następcy, ale NIE jego `dueDate`. Dla kotwicy
COMPLETION termin następcy zostawał policzony od starej daty i rozjeżdżał się z poprawioną (np. korekta
o 12 dni wstecz → następne zadanie dalej 12 dni za daleko).
**Rozwiązanie:** W `updateTask`, w bloku sync 022, dla `rule.anchor === "COMPLETION"` (jawna niepusta
data + istniejące poprzednie `completedAt`) pobieramy aktywnego (`status != DONE`) bezpośredniego
następcę (`previousTaskId`) i przeliczamy jego `dueDate = computeNextDue(newCompletedAt, rule)` —
ale TYLKO gdy jego termin jest „nietknięty", tj. `successor.dueDate === computeNextDue(oldCompletedAt,
rule)` (heurystyka: równość terminów wyłącza ręczne zmiany i „Następne w tej dacie"). Start następcy
przesuwamy o tę samą różnicę (`newNextDue - oldNextDue`). DUE / zrobiony następca / niecykliczne —
nietknięte.
**Lekcja:** Gdy wartość jest DENORMALIZOWANA i liczona od innego pola przy zdarzeniu (tu: termin
następcy liczony od daty wykonania przy domknięciu), późniejsza edycja pola źródłowego musi przeliczyć
wszystkie zależne wartości, nie tylko część. „Czy użytkownik ruszył wartość ręcznie?" najtaniej
rozpoznać przez równość z tym, co system by policzył — bez dodatkowej flagi w schemacie.

## 2026-07-22 — Cykliczne: bulk „Zrobione" musi rolować przez akcję cykliczną + link wystąpień
**Problem:** Po 020/021 zostały luki w modelu cyklicznym: (a) masowa zmiana statusu na „Zrobione"
(`bulkUpdateTasks`) robiła surowy `prisma.task.update`, więc NIE generowała kolejnego wystąpienia
(klik z listy/szczegóły robiły to przez `completeRecurringTask`); (b) nie było powiązania między
wystąpieniami, więc edycja daty zrobienia domkniętego cyklicznego nie mogła zaktualizować „daty
ostatniego zrobienia" (`lastCompletedAt`) jego następcy.
**Rozwiązanie:** Dodano nullable self-FK `Task.previousTaskId` (relacja `TaskRecurrence`, `onDelete:
SetNull`, migracja 0208) — `completeRecurringTask` ustawia go na nowym wystąpieniu obok
`lastCompletedAt`. `bulkUpdateTasks` przy `→DONE` na zadaniu z `recurring` woła teraz
`completeRecurringTask(id, { completionDate })` zamiast surowego update (usuwa `status` z `data`,
resztę pól/tagów nakłada normalnie). `updateTask` po jawnej edycji `completedAt` robi
`updateMany({ where: { previousTaskId: id }, data: { lastCompletedAt } })` — synchronizuje następcę.
**Lekcja:** Gdy operacja ma spójne „szybką ścieżkę" (`completeRecurringTask`) i „wolną ścieżkę"
(surowy bulk update), bulk NIE może iść skrótem — musi wołać tę samą akcję domenową, inaczej gubi
efekty uboczne (tu: generację następnego wystąpienia). Denormalizowaną wartość (`lastCompletedAt`)
trzymaj spójną przez trwały link (`previousTaskId`) + sync przy edycji, a nie licz jej w locie.

## 2026-07-22 — Edytowalna data wykonania: jawny `completedAt` musi bić derivację ze statusu
**Problem:** Data wykonania (`completedAt`) miała stać się edytowalna (szczegóły + bulk + wybór przy
oznaczaniu). Pułapka: `updateTask` wyprowadza `completedAt` z przejścia statusu (→DONE = teraz), a
`data` budowane było przez `{ ...patch }`. Gdyby `completedAt` weszło razem z patchem, a potem wyliczona
wartość by je nadpisała (albo odwrotnie), edycja daty byłaby ignorowana lub niespójna.
**Rozwiązanie:** W `updateTask` `completedAt` NIE wchodzi już przez `{ ...patch }` — wyłuskujemy je
(`const { completedAt: explicit, ...restPatch } = patch`) i ustawiamy jawnie: `final = explicit !==
undefined ? explicit : derived`. Jawnie podana data (edycja w szczegółach / oznaczanie z datą) ma
PIERWSZEŃSTWO nad wyliczoną ze statusu; brak podanej → zachowanie jak dotąd (→DONE=teraz, →inny=null).
`bulkUpdateTasks` dostał opcjonalny wspólny `completedAt`: przy `status→DONE` `data.completedAt =
scalar.completedAt ?? new Date()`. UI: pole „Ukończone" w `TaskDetail` (type=date, wzór pola „Start")
oraz opcjonalne pole daty w panelu „Status" bulku (stosowane, gdy `s.isTerminal`). Szybkie odhaczanie w
wierszu bez zmian („teraz").
**Lekcja:** Gdy pole jest zarazem WYLICZANE (z innego pola) i EDYTOWALNE, nie wpuszczaj go przez
`{ ...patch }` — wyłuskaj i jawnie ustal priorytet (jawna wartość > wyliczona), inaczej jedno cicho
nadpisze drugie. `resolveStatuses` zwraca `isTerminal` per status — używaj tego zamiast dublować logikę
„czy status zamykający".

## 2026-07-22 — „Sort zrobionych po dacie" nie dawał różnicy — brakowało WIDOCZNEJ daty na wierszu
**Problem:** Przycisk „Sortuj zrobione po dacie wykonania" (druga zgłoszona próba) nadal „nie dawał
różnicy". Poprzednia poprawka (018) tylko rozwijała zwiniętą sekcję. Realna przyczyna: wiersze zadań w
sekcji „Zrobione" NIE pokazywały daty wykonania, więc nawet poprawny reorder „wyglądał tak samo", a
domyślna kolejność bywała zbliżona do kolejności wg daty. Dodatkowo właściciel chciał, by data była
„datą OSTATNIEGO wykonania" — czyli aktywne zadanie cykliczne też powinno pokazywać datę poprzedniego
wykonania (a przy przetaczaniu cyklu powstaje NOWY rekord z `completedAt = null`).
**Rozwiązanie:** (1) Nowa kolumna `Task.lastCompletedAt` (migracja 0207, nullable) — `completeRecurringTask`
ustawia ją na nowym wystąpieniu = data wykonania właśnie zamkniętego. (2) `TaskRow` pokazuje dyskretny
znacznik „✓ <data>" gdy `completedAt ?? lastCompletedAt` istnieje (widoczna data w sekcji „Zrobione" i
data ostatniego wykonania na aktywnych cyklicznych). (3) `CompletedSection` sortuje po tej efektywnej
dacie malejąco i zmienia nagłówek przy aktywnym sorcie („— wg daty wykonania"), zachowując auto-rozwinięcie
z 018. Efekt: klik daje jednoznaczną, widoczną różnicę (kolejność + daty + nagłówek).
**Lekcja:** „Sortowanie nie działa" bywa naprawdę „nie widać PO CZYM sortujemy" — zanim dłubiesz w
logice sortu, pokaż użytkownikowi klucz sortowania (tu: datę) na elemencie; sam reorder bez widocznego
klucza wygląda jak brak zmiany. Gdy „ostatnie wykonanie" ma dotyczyć bytu, który przy zdarzeniu tworzy
NOWY rekord (cykliczne zadania → nowe wystąpienie), potrzebujesz trwałego pola przenoszonego na następcę,
bo `completedAt` nowego rekordu jest puste.

## 2026-07-22 — Przepisanie kompozytora asystenta na układ „Chat with Claude" (dwuwierszowa karta)
**Problem:** Kompozytor asystenta był jednowierszową „pigułką" (`[+] · pole flex-1 · mikrofon · wyślij`)
z uporczywym błędem karetki na iOS (kursor nad polem do pierwszego wpisania) — kolejne punktowe naprawy
nie pomagały, a jedna (VisualViewport) zepsuła płynność przewijania. Właściciel poprosił o przepisanie
od nowa na wzór „Chat with Claude".
**Rozwiązanie:** Nowy układ **dwuwierszowej karty** w `AICommandSheet.tsx`: WIERSZ 1 = pole tekstowe
pełnej szerokości (auto-rozrost przez istniejący `useEffect` na `scrollHeight`), WIERSZ 2 = wiersz akcji
(lewo: aparat `capture="environment"` + galeria; prawo: mikrofon dyktowania + główny przycisk
Stop/Wyślij[`ArrowUp`]/Rozmowa-głosowa). Ikona „Ustawienia asystenta" przeniesiona z menu „+" do
GÓRNEGO paska nagłówka (panel `showPrefs` już był u góry — przeniesiono sam wyzwalacz); menu „+" i stan
`showPlus` usunięte. Kluczowe dla karetki: pole NIE jest przy dolnej krawędzi karty (pod nim statyczny
wiersz akcji), a margines na kreskę iPhone siedzi na ZEWNĘTRZNEJ stopce warunkowo od fokusu — żadnego
`env(safe-area-inset-bottom)` pod fokusowanym polem. Bez dynamicznej zmiany wysokości na scroll
(płynne przewijanie). Zero zmian w agencie/LLM. Właściciel rezygnował z „dodaj plik" (tylko obrazy).
**Lekcja:** Gdy punktowe łatki nie domykają błędu układu, czasem szybciej i czyściej jest przepisać
fragment na sprawdzony wzorzec (tu: dwuwierszowa karta jak w Claude) niż mnożyć obejścia. Trzymaj pole
wejścia z treścią pod spodem (statyczny wiersz akcji), a insety safe-area poza fokusowanym polem —
to strukturalnie eliminuje „kursor nad polem" na iOS. Zachowaj istniejące handlery przy przepisaniu
UI — zmieniaj układ, nie logikę.

## 2026-07-22 — Surowy komunikat dostawcy przeciekał NIE-429 ścieżką + iOS „kursor nad polem" po zdjęciu zoomu
**Problem:** (1) Mimo poprawki 017 (uczciwy PL komunikat przy 429) użytkownik znów zobaczył surowy tekst
dostawcy („Rate limit reached for model …"). Przyczyna: w `agent/route.ts` ładny komunikat robił się
TYLKO dla `status === 429`; gałąź `else` zwracała `providerMsg || "Błąd LLM"`, czyli surową treść. Po
wyczerpaniu łańcucha fallbacku (Z-133) limit potrafi odbić z innym statusem (503/502) → przeciek. Drugi
przeciek: `catch` strumienia SSE wysyłał `e.message` wprost. (2) Kursor w asystencie pojawiał się NAD
polem do pierwszego wpisania. KLUCZOWA diagnoza właściciela: problem pojawił się DOKŁADNIE, gdy
dodaliśmy dolny `paddingBottom: env(safe-area-inset-bottom)` do stopki kompozytora (żeby pole nie było
zasłonięte kreską iPhone). Przy oryginalnym `py-3` (bez safe-area) karetka była POPRAWNA. Czyli offset
karetki bierze się z dodatkowego paddingu POD fokusowanym polem w bottom-sheecie iOS — Safari liczy
scroll-into-view z tym paddingiem i przesuwa karetkę w górę o ~jego wysokość.
**Rozwiązanie:** (1) Na granicy prezentacji NIGDY nie zwracamy surowej treści dostawcy (C-41): limit
rozpoznajemy po statusie 429 LUB po treści (`/rate.?limit|per day|per minute|tpd|tpm|quota/`), reszta →
ogólny uprzejmy PL komunikat; surowe idzie tylko do `console.warn`. `catch` SSE też daje ogólny
komunikat + `console.error`. (2) Margines safe-area dokładamy TYLKO gdy pole NIE ma fokusu
(`composerFocused ? undefined : "max(0.75rem, env(safe-area-inset-bottom))"`, sterowane `onFocus`/
`onBlur`). Przy zamkniętej klawiaturze pole czyści kreskę iPhone; przy pisaniu (klawiatura otwarta,
kreski i tak nie ma) geometria wraca do `py-3` — tej, przy której karetka była poprawna.
**Odrzucona ścieżka:** próba „podnoszenia sheeta nad klawiaturę" przez `window.visualViewport`
(paddingBottom nakładki + dynamiczny `maxHeight`) NIE naprawiła karetki, a dodatkowo brzydko szarpała
scrollem czatu (sheet zmieniał wysokość na każdym evencie `scroll` VisualViewport). Usunięta.
**Lekcja:** Komunikaty błędów mapuj na przyjazne NA KAŻDEJ gałęzi (429 i „reszta"), nie tylko w
happy-casie — inaczej surowy tekst dostawcy przecieka bokiem; rozpoznawaj limit też po TREŚCI, bo status
bywa inny po fallbacku. Przy błędzie karetki „kursor nad polem" na iOS podejrzewaj DOLNY padding/inset
pod fokusowanym polem w kontenerze `position: fixed` — usuń go na czas fokusu, zamiast budować
skomplikowaną logikę VisualViewport. I słuchaj dokładnej obserwacji właściciela „zaczęło się, gdy…" —
to była najkrótsza droga do przyczyny.

## 2026-07-22 — Anty-zoom 16px odsłonił błąd pudełka pola + `calc(pad + safe-area)` zawyża odstęp
**Problem:** Po wymuszeniu 16px na polach (reguła anty-zoom) kompozytor asystenta AI dostał dwa
regresyjne defekty: (1) pole „za wysoko" — stopka miała `paddingBottom: calc(0.75rem +
env(safe-area-inset-bottom))`, czyli DODAWAŁA cały inset do istniejącego `py-3`, przez co na iPhonie
pole unosiło się ~34px za wysoko; (2) kursor pojawiał się NAD polem do pierwszego wpisania — textarea
miała stałą `height: 38` (border-box, padding 9px → 20px na treść), a linia 16×1.4 = 22.4px nie mieści
się w 20px, więc karetka wychodziła nad pole; dopiero auto-rozrost (useEffect na scrollHeight) po
pierwszym wpisaniu ustawiał poprawną wysokość.
**Rozwiązanie:** (1) `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))` — czyści home indicator
bez nadmiarowego odstępu (na desktopie i tak = 0.75rem). (2) Usunięto stałą `height: 38` z textarea;
wysokość liczy wyłącznie auto-rozrost + `minHeight: 40`, więc linia 16px mieści się od pierwszego
renderu (przy okazji znika walka React↔useEffect o `height`).
**Lekcja:** Do odstępu na `safe-area-inset` używaj `max(padding, env(...))`, nie `calc(padding +
env(...))` — suma zawyża. Wymuszając globalnie 16px na polach sprawdź komponenty ze STAŁĄ wysokością
liczoną pod mniejszy font (tu 38px pod 15px) — 16px z lineHeight 1.4 potrzebuje ~40px, inaczej karetka/
tekst wychodzą poza pudełko. Nie ustawiaj `height` inline na polu, którym i tak steruje auto-rozrost.

## 2026-07-22 — Style inline `font-size` omijają globalną regułę anty-zoom iOS + zwinięta grupa maskuje działający sort
**Problem:** (1) Mimo istniejącej reguły `@media (pointer: coarse){ input,select,textarea{ font-size:16px } }`
asystent AI nadal przybliżał (zoom iOS) przy focusie pola. Przyczyna: kompozytor w `AICommandSheet.tsx`
ma font-size ustawiony **inline** (`style={{ fontSize: 15 }}`), a styl inline ma wyższą specyficzność
niż reguła z arkusza bez `!important` — więc efektywny rozmiar to 15px < 16px i Safari przybliżał. To
samo dotyczyło `SmartTextarea` (inline `fontSize:14`). (2) Ikona „Sortuj zrobione po dacie wykonania"
wyglądała na niedziałającą — po kliknięciu żadnej różnicy w widoku. Sort działał poprawnie, ale sekcja
„✓ Zrobione / Anulowane" jest **domyślnie zwinięta** (`defaultOpen={false}`), więc przesortowana lista
była schowana.
**Rozwiązanie:** (1) Dodano `!important` do reguły anty-zoom w `globals.css` (tylko `pointer: coarse`),
żeby wygrywała z inline `fontSize < 16` — globalnie, dla wszystkich pól teraz i w przyszłości, bez
tropienia każdego z osobna. Pinch-zoom nietknięty (brak `maximum-scale`/`user-scalable`). (2)
`CompletedSection` rozwija grupę, gdy sort jest aktywny: `defaultOpen={sortBy === "completedAt"}` +
`key={sortBy}` (remount przy przełączeniu → ponowne zastosowanie `defaultOpen`). Przy okazji: pasek
akcji masowych zadań dostał `overflow-x-auto [&>*]:flex-shrink-0` (mieści się przewijaniem na mobile),
a stopka kompozytora asystenta `paddingBottom: calc(0.75rem + env(safe-area-inset-bottom))`
(nad kreską iOS).
**Lekcja:** Globalna reguła CSS na pole formularza NIE zadziała, jeśli komponent ustawia właściwość
inline — inline bije arkusz bez `!important`. Przy regułach „na wszystkie pola" (anti-zoom, kolory)
zakładaj, że gdzieś jest inline i użyj `!important` w wąsko scope'owanej regule (`pointer: coarse`).
Gdy funkcja „nie daje efektu w widoku", sprawdź, czy wynik nie jest schowany (zwinięta grupa/panel) —
zanim uznasz logikę za zepsutą.

## 2026-07-21 — Groq ma limit DZIENNY (TPD), nie tylko minutowy — degradacja na lżejszy model
**Problem:** Po pacingu (016) asystent dalej padał. Produkcyjny log `/admin/ai-calls` pokazał inny
limit niż zakładaliśmy: `429 … on tokens per day (TPD): Limit 100000, Used ~98300`. To **dzienny** limit
darmowego Groqa na modelu reasoning (llama-3.3-70b): każde wywołanie reasoning kosztuje 6–8k tokenów,
więc ~13–16 interakcji wyczerpuje CAŁY dzień; potem 429 aż do północy UTC. Retry i pacing minutowy tego
NIE ruszą (dziennego okna nie da się przeczekać w kilka sekund). Komunikat „chwilowy limit… spróbuj za
chwilę" był w tym wypadku nieprawdą.
**Rozwiązanie:** (1) Degradacja: do łańcucha `resolveLlmChain("reasoning")` dołożono ostatnie ogniwo —
Groq `llama-3.1-8b-instant` (osobny budżet; w logach działał, gdy 70b padał). `chatComplete` sam próbuje
8b po 429 na 70b, więc asystent zwykle i tak odpowiada (świadoma zgoda właściciela na słabszą odpowiedź).
(2) Uczciwy komunikat: `classifyRateLimitKind` rozpoznaje w treści błędu „per day/TPD" vs „per minute/TPM"
i `rateLimitUserMessage` zwraca polski komunikat — dzienny („po północy UTC / ustaw płatny model w
Admin → LLM") vs minutowy („spróbuj za chwilę"). Nigdy surowy tekst dostawcy (C-41).
**Lekcja:** Zanim uznasz limit dostawcy za „chwilowy", sprawdź w treści błędu, czy to per-minute czy
per-day — to zupełnie inne strategie (przeczekać sekundy vs przełączyć model / poczekać do jutra). Na
darmowym tierze o ciasnym limicie dziennym miej gotowy fallback na lżejszy model z osobnym budżetem;
docelowo płatny model znosi problem. I dawaj użytkownikowi PRAWDĘ o rodzaju limitu.

## 2026-07-21 — Diagnostyka asystenta: nieudane wywołania LLM były NIELOGOWANE + pacing pod TPM Groqa
**Problem:** Zgłoszenie „nadal nie działa" po redukcji promptu. Nie dało się dojść przyczyny, bo
`recordAiCall` logował do `AiCall` **tylko udane** wywołania (kod w `chatComplete` był w gałęzi
`if (res.ok)`), więc 429/5xx nie zostawiały śladu → „brak logów agenta dla rozmowy, która padła".
Dodatkowo nie było wiązania wpisów z rozmową (`conversationId`), więc nie dało się odtworzyć przebiegu
krok po kroku. Osobno: sama redukcja promptu nie gwarantuje, że kilka wywołań tej samej minuty nie
przebije TPM (przy większym modelu / dłuższej historii).
**Rozwiązanie:** (1) `AiCall` rozszerzony o `status`, `errorText`, `conversationId`, `attempts`
(migracja 0206) i logowanie **także** nieudanych wywołań; `conversationId` przepchnięty z klienta przez
route agenta do `chatComplete` (callAgent/routeModules/classifyIntent). (2) Panel `/admin/ai-calls`
(admin) pokazuje surowy log per rozmowa z przyciskiem „Kopiuj". (3) Pacing pod TPM: `lib/llm/tpmLimiter.ts`
— kroczące okno 60 s rezerwuje szacowane tokeny PRZED wysłaniem do Groqa (wykrywanie po `groq.com` w
baseUrl; Anthropic bez pacingu), więc kilka wywołań minuty czeka zamiast dostać 429. „Wolniej, ale
działa" — zgodnie z decyzją właściciela.
**Lekcja:** Log per-wywołanie MUSI obejmować błędy — inaczej najważniejszy przypadek (padło) jest
niewidoczny. Wiąż wpisy z jednostką pracy (rozmowa), żeby dało się odtworzyć przebieg. Przy dostawcy z
ciasnym TPM nie wystarczy retry ani redukcja — dołóż **pacing** (rezerwacja tokenów w oknie), bo retry w
kilka sekund nie przeczeka okna minuty.

## 2026-07-21 — „Przeciążony asystent" na „pokaż zadania otagowane X" — limit TPM był STRUKTURALNY, nie chwilowy
**Problem:** Mimo poprawek ze spec 010 (retry z backoffem + filtr po tagu w `list_tasks`) polecenie „pokaż
zadania otagowane »raj«" nadal kończyło się komunikatem „Asystent jest teraz przeciążony…", choć zadania z
tym tagiem istniały (brak logów agenta = padało już na pierwszym wywołaniu). Przyczyna: 010 założyło, że
limit Groqa (12000 TPM) jest **chwilowy** i wystarczy go „przeczekać" retry. W rzeczywistości pełny katalog
~50 narzędzi odczytu (`READ_TOOLS_PROMPT`, ~2000 tok.) trafiał do KAŻDEGO wywołania modelu — a proste
zapytanie odczytowe odpala **dwa** wywołania (query→answer, ~5–6k tok. każde). Dwa takie wywołania w jednej
minucie przebijały 12000 TPM **za każdym razem** — 8-sekundowy retry nie miał szans, bo okno się nie zwalniało.
**Rozwiązanie:** Odchudzono prompt agenta: `buildReadToolsPrompt(modules)` filtruje katalog narzędzi odczytu
do modułów wybranych przez router (`READ_TOOL_MODULE` + `CORE_READ_TOOLS`), dokładnie tak, jak
`buildActionCatalog` już filtruje akcje. Dla zapytania o zadania prompt spada z ~2000 do ~kilkuset tokenów
narzędzi/wywołanie → dwa wywołania mieszczą się poniżej TPM. `READ_TOOLS_PROMPT` został źródłem prawdy
(builder tylko filtruje jego wiersze — bez transkrypcji, bez ryzyka rozjazdu).
**Lekcja:** Gdy „chwilowy" limit dostawcy odbija **powtarzalnie** i to samo polecenie ginie za każdym razem —
to nie jest chwilowość, tylko **strukturalne** przekroczenie budżetu na wywołanie/minutę; retry tego nie
naprawi. Najpierw policz, ile tokenów i ile wywołań generuje JEDNO polecenie (Groq wlicza `max_tokens` i cały
prompt do TPM), i **redukuj zapotrzebowanie** (filtruj kontekst do potrzebnego zakresu), zamiast dokładać
kolejny retry. Brak logów agenta = pada przed pierwszą myślą → patrz na rozmiar pierwszego wywołania.

## 2026-07-20 — Przeciążona ikona kosza: `Trash2` znaczyła i „usuń", i „otwórz Kosz/odzyskiwanie"
**Problem:** Ta sama ikona `Trash2` była używana w dwóch sprzecznych znaczeniach: **„usuń element"**
(~65 miejsc, wszystkie moduły — spójnie) oraz **„otwórz Kosz `/trash`" (odzyskiwanie)** — w nagłówkach
Zadań i Notatek. W pasku akcji, obok innych ikon-koszy, które usuwają, link do Kosza czytał się jak
„usuń" (na mobile bez tooltipa — całkiem myląco). Dodatkowo Kosz jest globalny, ale osiągalny tylko z 2
z ~20 modułów i znikąd globalnie.
**Rozwiązanie:** Skróty do Kosza w nagłówkach Zadań/Notatek dostały **osobną ikonę `ArchiveRestore`**
(jednoznacznie „przywracanie"), a `Trash2` zostaje **wyłącznie** dla akcji usuwania. Tooltip/aria
doprecyzowane („Kosz — przywróć usunięte"). Strona Kosza była już OK: przywracanie = `RotateCcw`,
opróżnianie/trwałe usunięcie = `Trash2` (prawdziwe delete).
**Lekcja:** Jedna ikona = jedno znaczenie. Kosz jako *lokalizacja* (Bin) i kosz jako *akcja usuń* to
dwie różne rzeczy — nie oznaczaj ich tym samym glifem w tym samym kontekście (pasek akcji). Gdy
weryfikujesz spójność ikonografii, grepnij **wszystkie** użycia glifu i rozdziel „akcja" od
„nawigacja/lokalizacja". Do „odzyskiwania" użyj ikony restore (`ArchiveRestore`/`RotateCcw`), nie kosza.

## 2026-07-20 — Mobile UX: hover-only akcje, niewidoczny feedback transition i ukryty scroll poziomy
**Problem:** Trzy wzorce psuły UX na dotyku: (1) w Wiadomościach (`NewsPage`) akcje tematu Edytuj/Usuń
były `hidden group-hover:block` — na telefonie (brak hover) **nigdy** się nie pokazywały i były za małe
(13px); (2) w `TaskDetail` przycisk „Zapisz" cykliczności wołał `updateTask` przez `useTransition`, ale
jedyny sygnał (`Loader2` w nagłówku) był na mobile niewidoczny — wyglądało, jakby nic się nie stało; (3)
pasek akcji listy zadań (`TasksPage`) miał `overflow-x-auto`, ale bez żadnej wskazówki, że da się go
przewinąć — część ikon była poza kadrem i „nieodkrywalna".
**Rozwiązanie:** (1) `hidden group-hover:block` → widoczne domyślnie + `md:hidden md:group-hover:block`
(hover chowa je tylko na desktopie), ikony 16px, `p-1.5` na cel dotyku; (2) lokalny stan
`recurringSaving/recurringSaved` + `setTimeout` — przycisk pokazuje w miejscu „Zapisywanie…" → „Zapisano"
(zielony, ~1.5 s) → „Zapisz"; (3) wrapper `relative` + stan `actionScroll{left,right}` liczony ze
`scrollWidth/clientWidth/scrollLeft` (`onScroll` + resize) i dekoracyjny fade `linear-gradient(...,
var(--bg-surface), transparent)` na krawędzi (`pointer-events:none`, `aria-hidden`).
**Lekcja:** Na dotyku `group-hover` jest niedostępny — akcje kontekstowe rób widoczne domyślnie i chowaj
dopiero od `md` w górę. Globalny spinner z `useTransition` bywa na mobile niewidoczny — dawaj feedback
**w miejscu akcji** (stan przycisku). Kontener `overflow-x-auto` bez wizualnej wskazówki = ukryte funkcje;
zanikający gradient (kolor = tło paska, `pointer-events:none`) sygnalizuje scroll bez psucia estetyki i
skinowalności.

---

## 2026-07-20 — Łamanie długich URL w markdown: catch-all przez dziedziczony overflow-wrap
**Problem:** Po dodaniu `overflow-wrap:anywhere` tylko do `.md-p/.md-li/.md-td/.md-link` długie linki w
treści wiedzy (module Wiadomości, `KnowledgePanel` → `markdownToHtml` → klasa `markdown-body`) DALEJ
rozpychały sekcję, jeśli URL trafił do **nagłówka** (`.md-h1..h6`) albo **inline-code** (`.md-code`),
których nie objąłem. Łatanie klasa-po-klasie było niekompletne.
**Rozwiązanie:** `overflow-wrap` i `word-break` są **dziedziczone**, więc jedna reguła na kontenerze —
`.markdown-body { overflow-wrap: anywhere; word-break: break-word; min-width: 0; }` — wymusza łamanie we
WSZYSTKICH potomkach naraz (nagłówki, code, cytaty, linki). Bloki kodu (`white-space: pre`) i tak się nie
łamią i scrollują przez `.md-pre` (`overflow-x:auto`) — dziedziczenie ich nie psuje.
**Lekcja:** Gdy chcesz wymusić właściwość TEKSTOWĄ (overflow-wrap, word-break, white-space, color) na
całym poddrzewie — ustaw ją raz na kontenerze i wykorzystaj dziedziczenie, zamiast łatać każdą klasę
elementu z osobna (łatwo pominąć nagłówek/kod). Do łamania URL-i: `overflow-wrap: anywhere` na wrapperze.

## 2026-07-20 — UX dodawania w Omnii: quick-capture (tytuł) + pełny formularz na klik, nie mini-form
**Problem:** Inline mini-formularz „szybkiego dodawania" zadania (tytuł + priorytet + pole daty + „+") gniótł
się na mobile — natywne pole daty (16px anty-zoom) i „+" nie mieściły się w jednym rzędzie.
**Rozwiązanie:** Analiza innych modułów (Health `EventForm`, Flota, Contacts) pokazała spójny wzorzec:
JEDEN pełny formularz inline dla add+edit, otwierany przyciskiem. Tasks ma już taki pełny formularz
(`TaskDetail`, otwierany kliknięciem zadania). Dlatego uprościłem quick-add do jednego czystego rzędu
`[priorytet][tytuł][+]` (szybkie przechwytywanie — mocna strona listy zadań), a WSZYSTKIE pozostałe pola
(termin, projekt, powtarzalność, podzadania) przeniosłem do `TaskDetail`. Efekt: brak gniecenia na mobile,
zachowana szybkość, spójność z resztą aplikacji.
**Lekcja:** Nie upychaj wielu pól w inline pasku dodawania na mobile. Dla list o wysokiej częstości dodawania
(zadania) trzymaj quick-capture = sam tytuł; szczegóły w pełnym formularzu edycji (jeden komponent add=edit),
jak robią to inne moduły. „Mniej pól w pasku, reszta w formularzu" > „wszystko w jednym rzędzie".

## 2026-07-20 — Wykluczenie z modalOpen nie wystarczy: panel z-50 i tak zasłania FAB (z-index)
**Problem:** Po oznaczeniu mobilnego podglądu zadania `data-omnia-overlay` (żeby `modalOpen` się nie
zapalał i FAB asystenta się renderował) ikony asystenta i „zgłoś błąd" DALEJ były niewidoczne na mobile.
Powód: sam fakt renderowania nie wystarcza — panel podglądu jest `fixed inset-0 z-50`, a pływające
przyciski miały `zIndex 41` (asystent) i `39` (feedback), więc panel je **zasłaniał**. Co gorsza,
regresja: wcześniej (gdy panel liczył się jako modal) feedback wskakiwał na `z-10001` i BYŁ widoczny —
po wykluczeniu spadł na 39 i zniknął.
**Rozwiązanie:** Dodałem do `useOverlayState` sygnał `panelOpen` (obecność `[data-omnia-overlay="panel"]`)
i podbijam z-index przycisków TYLKO gdy panel otwarty: FAB `panelOpen?55:41`, feedback
`modalOpen?10001:(panelOpen?54:39)`. Wartości dobrane między panelem (50) a toastami (60), więc przyciski
są nad panelem, ale pod toastami. Marker zmieniłem z „taskdetail" na generyczny „panel".
**Lekcja:** „Odblokowanie renderu" (wykluczenie z detekcji modalu) to połowa sprawy — element i tak musi
mieć **wyższy z-index** niż nakładka, nad którą ma być widoczny. Przy pływających przyciskach trzymaj
świadomą skalę z-index (panel 50 < FAB 55 < toast 60) i podbijaj kontekstowo, nie globalnie (globalne
podbicie wchodziłoby nad menu nawigacyjne, też z-50).

## 2026-07-20 — Przepełnienie długim URL: break-words za słabe w gridzie, trzeba overflow-wrap:anywhere
**Problem:** Mimo `min-w-0` na kolumnie treści i `break-words` na tytule/streszczeniu newsów długie linki
bez spacji dalej rozpychały sekcję (poziomy scroll). `break-words` (`overflow-wrap: break-word`) NIE
zmniejsza rozmiaru min-content elementu, więc w kontenerze grid/flex liczonym od min-content długi token
i tak wymuszał szerokość.
**Rozwiązanie:** Przełączyłem łamanie na `overflow-wrap: anywhere` (Tailwind arbitralnie
`[overflow-wrap:anywhere]`) — to JEDYNY wariant, który wpływa na min-content i pozwala kontenerowi się
zwęzić. Dodatkowo `min-w-0 overflow-hidden` na karcie jako twarda gwarancja (residualny overflow się
przycina, nie rozpycha strony).
**Lekcja:** Do łamania długich URL używaj `overflow-wrap: anywhere`, nie `break-word` — tylko `anywhere`
redukuje min-content, co jest kluczowe w grid/flex. `break-all` odpada (brzydko tnie zwykłe słowa).

## 2026-07-20 — Pływający FAB asystenta znikał także na desktopie przy szczegółach zadania
**Problem:** Ikona asystenta AI (Sparkles FAB) chowała się przy otwartych szczegółach zadania i na
mobile, i na komputerze. Chowanie steruje `useOverlayState`, który wykrywa „modal treściowy" przez
`document.querySelector('[class~="fixed"][class~="inset-0"]:not([data-omnia-overlay])')`. Mobilny panel
szczegółów w `TasksPage.tsx` ma klasy `md:hidden fixed inset-0 z-50` — i choć `md:hidden` ukrywa go na
desktopie wizualnie, **element wciąż jest w DOM**, a `querySelector` matchuje po atrybucie `class`, nie po
`display`. Dlatego FAB znikał również na komputerze.
**Rozwiązanie:** Oznaczyłem wrapper mobilnego panelu `data-omnia-overlay="taskdetail"` — selektor
`:not([data-omnia-overlay])` go pomija, więc `modalOpen` nie zapala się przy szczegółach zadania (FAB
zostaje widoczny na obu platformach). Świadomie zrobiliśmy z panelu szczegółów wyjątek od reguły
„chowaj FAB nad modalem" — to ekran roboczy, nie przelotny dialog.
**Lekcja:** Detekcja stanu UI przez `querySelector` po klasach `fixed inset-0` łapie też elementy ukryte
przez `md:hidden` (bo są w DOM). Przy responsywnych „modalach mobilnych" trzeba je jawnie wykluczać
(`data-omnia-overlay`) albo montować warunkowo, inaczej fałszywie zmieniają stan na desktopie.

## 2026-07-20 — Anty-zoom iOS: reguła CSS musi przebić specyficzność utility Tailwinda
**Problem:** iOS Safari auto-przybliża widok przy focusie pola z `font-size < 16px` (wiele pól używa
`text-sm`/`text-xs`). Naiwna reguła `input { font-size: 16px }` (specyficzność 0,0,0,1) **nie zadziała** —
utility Tailwinda `.text-xs` (0,0,1,0) ją przebija i pole zostaje 14/12px, więc zoom dalej występuje.
**Rozwiązanie:** Reguła w `globals.css` w `@media (pointer: coarse)` z selektorem
`input:not([type="checkbox"]):not([type="radio"]), select, textarea { font-size: 16px }` — `input:not(...)`
ma specyficzność ~0,0,2,1, więc wygrywa z `.text-xs` **bez** `!important`. Celujemy tylko w `pointer:
coarse` (dotyk), desktop zostaje z gęstszym tekstem; **nie** ruszamy `maximum-scale`/`user-scalable`, więc
pinch-zoom (dostępność) zachowany.
**Lekcja:** Nadpisując Tailwindowe utility surowym CSS-em pilnuj specyficzności — użyj selektora
elementowego z `:not(...)`/atrybutami zamiast sięgać po `!important`. Anty-zoom rób przez font-size 16px
na dotyku, nie przez blokowanie skalowania.

---

## 2026-07-20 — „Brak brancha develop" — mylny wniosek z niepełnego lokalnego klonu
**Problem:** Przy domykaniu zadania stwierdziłem, że w repo nie ma brancha `develop`, bo `git branch -a`
pokazywał tylko `master` i branch roboczy. Na tej podstawie pominąłem przepływ przez `develop` i na „Tak"
właściciela poszedłem od razu na `master`. `develop` jednak ISTNIEJE na origin — lokalny klon miał
zawężony refspec (pobrane tylko `master` + branch roboczy), więc `remotes/origin/develop` nie było w
lokalnych refach.
**Rozwiązanie:** Odpytałem zdalne repo wprost: `git ls-remote --heads origin` — pokazało `refs/heads/develop`.
`develop` był przodkiem `master`, więc dociągnąłem go czystym fast-forwardem (`git checkout develop &&
git merge --ff-only master && git push origin develop`). Teraz `develop == master`.
**Lekcja:** NIGDY nie orzekaj „brak brancha X" na podstawie `git branch -a` w klonie sesyjnym — może mieć
niepełny refspec. Prawdę o zdalnych branchach daje `git ls-remote --heads origin` (albo `git fetch origin <branch>`).
Sprawdź to, ZANIM zdecydujesz o pominięciu `develop` czy pushu na `master`.

## 2026-07-20 — Asystent AI przeredagowywał opis zadania wpisany przez użytkownika
**Problem:** Przy tworzeniu zadania z asystenta (także przy zgłoszeniach admina o bugu/zmianie aplikacji)
opis był „lekko redagowany" — zamieniany na formę bezosobową i „poprawiany" gramatycznie. Właściciel chciał,
by opis pozostał DOKŁADNIE taki, jak wpisał user (tytuł generowany z treści jest OK, kontekst zgłoszenia
nadal doklejany).
**Rozwiązanie:** Źródłem redakcji NIE był kod akcji — `executeTasksAction`/`createTask` zapisują
`description` wiernie. Redagował LLM, bo prompt mu na to pozwalał. Poprawiono instrukcje w trzech promptach:
`agent/route.ts` (sekcja `create_task` — „lekka redakcja" → **verbatim**; oraz reguła bulk-add), oraz
`AICommandSheet.tsx` (prompt zgłoszenia admina — opis admina verbatim + doklejony kontekst). Dodatkowo
`lib/ai/fastPath.ts` (skrócona ścieżka `create_task`) dostała klauzulę verbatim dla spójności.
**Lekcja:** Gdy asystent „zmienia" treść wpisaną przez usera, szukaj przyczyny w **promptach systemowych
LLM**, nie w kodzie Server Action (który zwykle zapisuje dane 1:1). Pamiętaj, że tworzenie zadania ma DWIE
ścieżki generujące `description`: pełny agent (`agent/route.ts`) i deterministyczny fast-path
(`fastPath.ts`) — instrukcję trzeba zsynchronizować w obu, inaczej zachowanie zależy od tego, którą ścieżką
poszło polecenie.

## 2026-07-19 — Strona admina nie scrollowała się (AppShell `<main>` = overflow-hidden)
**Problem:** `/admin/ai-coverage` nie dało się przewinąć — długa treść była ucięta. Przyczyna: w
`AppShell` kontener `<main>` jest `flex-1 overflow-hidden flex flex-col`, więc to **strona** musi być
własnym kontenerem przewijania. Moja strona miała root jako zwykły wyśrodkowany `<div>` (maxWidth +
margin auto), bez `overflow`, więc nadmiar treści był chowany bez scrolla.
**Rozwiązanie:** Root strony owinięty w `className="flex-1 overflow-y-auto"` (tak jak istniejące
`SystemHealthPage`/`AuditLogPage`), a wyśrodkowany `maxWidth`-owy kontener wrzucony do środka.
**Lekcja:** W tym projekcie `<main>` w `AppShell` jest `overflow-hidden` — KAŻDA strona treściowa musi
sama zapewnić scroll, dając swojemu korzeniowi `flex-1 overflow-y-auto`. Nie polegaj na scrollu body.
Wzoruj się na istniejących stronach admina, zamiast wymyślać własny layout korzenia.

## 2026-07-19 — Nie każdy model ma ownerId/ownerTeamId — resolver po nazwie może wysypać zapytanie
**Problem:** Dodając akcje AI dla grup projektów i grup notatek użyłem generycznego `resolveByName`
(zakłada `ownerId` + `ownerTeamId`). Ale `ProjectGroup` ma **tylko `ownerId`** (brak zespołu), a
`NoteGroup` jest **globalny** (`getNoteGroups` nie filtruje po właścicielu). Zapytanie `where` z
`ownerTeamId` na modelu bez tej kolumny wywala Prisma w runtime.
**Rozwiązanie:** Rezolwery dopasowane do modelu: dla `ProjectGroup` filtr `{ ownerId: userId, name }`
(bez `ownerOr`), dla `NoteGroup` filtr `{ name }` (globalny). Zawsze sprawdzaj model w `schema.prisma`
(pola własności) ZANIM użyjesz wspólnego `resolveByName`/`ownerOr`.
**Lekcja:** Wzorzec współwłasności `ownerId`/`ownerTeamId` NIE jest uniwersalny — część modeli jest
user-only, część globalna. Przed dołożeniem resolvera po nazwie zajrzyj do schematu; generyczny helper
zakładający zespół rozbije modele bez `ownerTeamId`.

## 2026-07-19 — Pokrycie AI musi obejmować też ODCZYTY (nie tylko mutacje)
**Problem:** Bramka pokrycia (poprzedni wpis) pilnowała tylko akcji ZAPISU. Ale asystent ma umieć
pokazać wszystko, co użytkownik PRZEGLĄDA — a wiele odczytów nie było wystawionych (np. `getWeather` =
prognoza, budżety/cele, kosz, tagi do wyliczenia, pełny przepis). Nowe możliwości pobierania danych też
mogłyby „przeciekać" bez integracji z AI.
**Rozwiązanie:** Rozszerzono `check-ai-coverage.js` i manifest `action-coverage.json` o ODCZYTY
(get*/list*/search* → `kind:"read"`), z tym samym reżimem `ai|pending|excluded` i tą samą bramką
build'u. Raport `docs/ai/pokrycie-akcji.md` rozdziela mutacje i odczyty. Dodano 10 read-tooli
(get_weather, list_budgets, list_goals, list_task_tags, list_note_tags, get_recipe, list_care_agenda,
list_maintenance, list_hot_topics, list_trash) i 6 mutacji (update/delete budżetu i celu, update/unlog
leku). Uwaga techniczna: read-tool NIE może wołać funkcji robiącej wewnętrzne wywołanie LLM
(`describeDay`) — to zagnieżdżony koszt/TPM w pętli agenta; `get_weather` zwraca surowe liczby
(Open-Meteo), a interpretację robi sam agent. Pułapka składniowa: sekwencja `*/` w komentarzu blokowym
JS (np. „list*/search*") przedwcześnie zamyka komentarz — pisz „list.../search...".
**Lekcja:** „AI umie wszystko co użytkownik" = ZAPIS **i** ODCZYT. Jedna bramka pokrycia z rozróżnieniem
rodzaju (mutation/read) trzyma oba wymiary mierzalne (liczniki) i wymusza triage każdej nowej akcji —
także nowego `get*/list*`.

## 2026-07-19 — Brak bramki pokrycia: akcje użytkownika nie były wystawiane dla AI
**Problem:** Asystent nie potrafił wielu rzeczy, które użytkownik robi ręcznie (np. otagować zadania —
`updateTaskTags`), bo możliwości AI utrzymywane są RĘCZNIE w 3 miejscach (katalog w prompt'cie,
egzekutory, whitelist fast-path), a jedyny guard (`check-action-coverage.js`) pilnował tylko spójności
katalog↔egzekutor. NIC nie pilnowało, czy KAŻDA mutująca Server Action jest w ogóle wystawiona dla AI,
więc nowe możliwości użytkownika „przeciekały" bez integracji z asystentem.
**Rozwiązanie:** Dodano bramkę pokrycia: `scripts/check-ai-coverage.js` + manifest
`src/lib/ai/action-coverage.json`, w którym KAŻDA mutująca Server Action (`src/actions/*`) musi mieć
status `ai` (wystawiona) / `pending` (luka do zrobienia) / `excluded` (świadomie nie dla AI, z powodem).
Build PADA, gdy ktoś doda nową mutującą akcję i jej nie sklasyfikuje — więc nowa możliwość użytkownika
nie prześlizgnie się bez decyzji o AI. Skrypt (flaga `--report`) generuje czytelną roadmapę luk w
`docs/ai/pokrycie-akcji.md`. Wpięto w `npm run build` obok pozostałych `check:*`. Domknięto pierwszą
partię luk (12 akcji: tagowanie zadań/notatek, podzadania, kontakty CRM, budżety/cele portfela,
jadłospis→zakupy, przenoszenie pozycji, odarchiwizacja/„zakończ zakupy"). Wzmocniono prompt agenta o
regułę ŁAŃCUCHA AKCJI (jedno polecenie → wiele kroków, także między modułami, referencja po nazwie do
elementów tworzonych w tym samym planie).
**Lekcja:** Gdy zdolności AI są utrzymywane osobno od „prawdy" (Server Actions), potrzebna jest BRAMKA
pokrycia, nie tylko dobre chęci. Wzorzec: enumeruj źródło prawdy (mutujące akcje), wymagaj świadomej
klasyfikacji każdej z nich w manifeście, wywalaj build na nieklasyfikowanej nowej akcji. Dzięki temu
„AI umie wszystko co użytkownik" staje się mierzalnym, egzekwowalnym stanem (licznik ai/pending), a nie
jednorazową obietnicą.

## 2026-07-19 — Limit 429 NIE był przejściowy: „pokaż zadania otagowane X" zapętlał agenta
**Problem:** Po pierwszym fixie (retry + łagodny komunikat) komenda „pokaż zadania otagowane raj"
**zawsze** kończyła się „Asystent przeciążony", nawet po ponawianiu — podczas gdy „jak się masz?"
i „dodaj zadanie" działały. To wykluczyło hipotezę „przejściowy limit". Prawdziwa przyczyna: read-tool
`list_tasks` **nie miał filtra po tagu ani nie zwracał tagów** — agent nie mógł spełnić prośby, więc
**zapętlał się** (do MAX_ITERATIONS=6 iteracji), a każda iteracja to pełne wywołanie modelu
`reasoning` (~4k promptu + rezerwacja `max_tokens` 2800). Kilka takich wywołań w jednej minucie
przekraczało limit Groq 12000 TPM — stąd „Used 8761 + Requested 10243" i STAŁA porażka tej konkretnej
komendy (a nie losowa). Do tego stała rezerwacja `max_tokens=2800` na KAŻDE wywołanie pętli (Groq wlicza
`max_tokens` do TPM) niepotrzebnie zbliżała do limitu przy zapytaniach wieloetapowych (query→answer = 2
wywołania).
**Rozwiązanie:** (1) `src/lib/ai/agentTools.ts` — `list_tasks` dostał argument `tag` (filtr
`tags: { some: { tag: { name: { contains, mode:"insensitive" } } } }`) i zwraca teraz pole `tags`
(nazwy etykiet); opis narzędzia w `READ_TOOLS_PROMPT` zaktualizowany, żeby agent wiedział, że dla
„zadania otagowane X" ma użyć `tag`. Dzięki temu komenda kończy się w 1–2 wywołaniach zamiast pętli.
(2) `src/app/api/llm/home/agent/route.ts` — rezerwacja tokenów odpowiedzi jest teraz mała domyślnie
(`AGENT_MAX_TOKENS=1200`), a duży zapas (`REPORT_MAX_TOKENS=2800`) włączamy TYLKO gdy tekst prośby
wygląda na raport (`/raport|podsumow|zestawieni|streść/i`) — mniejsza presja na TPM przy zwykłych
zapytaniach, bez regresji długich raportów.
**Lekcja:** Gdy 429/limit trafia **jedną konkretną** komendę za każdym razem (a inne działają), to NIE
jest przejściowy limit — to komenda, której agent nie umie spełnić i **pętli** się, spalając TPM.
Najpierw sprawdź, czy read-tool w ogóle POTRAFI odpowiedzieć na pytanie (tu: brak filtra po tagu), i czy
`max_tokens` nie jest rezerwowany hojnie na każde wywołanie (Groq liczy to do TPM). Retry/łagodny
komunikat to tylko siatka bezpieczeństwa — nie zastąpi usunięcia przyczyny pętli.

## 2026-07-19 — Asystent AI zwracał surowy błąd Groq 429 (limit TPM) zamiast odpowiedzi
**Problem:** Zapytanie do asystenta ("pokaż zadania otagowane raj") padało z surowym komunikatem dostawcy
`Rate limit reached for model llama-3.3-70b-versatile … tokens per minute (TPM): Limit 12000, Used 8761,
Requested 10243`. Limit TPM u Groq jest **przejściowy** (okno minuty zwalnia się po chwili), a mimo to
`chatComplete` oddawał surowy błąd użytkownikowi. Istniejący łańcuch fallbacku (Z-133) próbuje tylko
INNEGO modelu — przy jednym skonfigurowanym modelu 429 przechodził wprost do UI, a `AICommandSheet`
wyświetlał go 1:1.
**Rozwiązanie:** (1) W `src/lib/llm/chat.ts` dodano owijacz `fetchWithRetry` używany przez wszystkie 4
funkcje dostawcy (openAi/anthropic × complete/stream): przy błędzie przejściowym (429/5xx/sieć) odczekuje
i ponawia TEN SAM model — respektując nagłówek `Retry-After` (z capem `LLM_RETRY_CAP_MS=8000` na
pojedyncze oczekiwanie i twardym limitem `LLM_MAX_RETRIES=2`), a bez nagłówka używa backoffu
wykładniczego z jitterem. Retry jest ZAGNIEŻDŻONY w pojedynczym wywołaniu modelu, więc łańcuch fallbacku
działa bez zmian (najpierw retry, potem dopiero next model). (2) W `src/app/api/llm/home/agent/route.ts`
(`runAgentLoop` catch) status 429 mapujemy na łagodny polski komunikat zamiast surowego tekstu dostawcy —
jedno miejsce obsługuje tryb zwykły i strumieniowy (SSE), bo oba idą przez `runAgentLoop`; klient bez zmian.
**Lekcja:** Limity szybkości dostawcy LLM (429/TPM) to błąd PRZEJŚCIOWY — najpierw ponów z backoffem
(respektując `Retry-After`, z twardym capem i limitem prób), dopiero potem fallback/komunikat. Retry rób
na poziomie `fetch` (jedno miejsce dla wszystkich dostawców i trybów, też streaming — status sprawdzasz
zanim skonsumujesz body). Nigdy nie pokazuj użytkownikowi surowej treści błędu dostawcy — zawsze własny,
polski komunikat (C-41: brak ryzyka wycieku klucza/szczegółów). Ponawiaj TYLKO statusy przejściowe
(429/≥500), nie 4xx poza 429.

## 2026-07-19 — Dokumentacja myliła środowiska Render (który URL/tier to test, a który prod)
**Problem:** CLAUDE.md podawał `worldofmag.onrender.com` jednocześnie jako „Live URL" i „auto-deploy on `master`" oraz „free tier", podczas gdy sekcja git-workflow traktowała ten sam URL jako środowisko **testowe** (`develop`). Drugi serwis (`omnia-prod.onrender.com`) figurował tylko w allowed origins, bez wskazania, że to produkcja. Tier per-środowisko nie był nigdzie jasno rozpisany — trzeba go było wywnioskować z luźnej uwagi „Render prod nie usypia".
**Rozwiązanie:** Ujednolicono mapowanie w CLAUDE.md (tabela „Environments & tiers") i w runbooku: `develop` → test → `worldofmag.onrender.com` → **free** (usypia po 15 min); `master` → produkcja → `omnia-prod.onrender.com` → **płatny** (nie usypia). Poprawiono też roadmapę (migracja prod na płatny tier = zrobione).
**Lekcja:** Gdy są dwa serwisy Render pod jednym projektem, trzymaj **jedną tabelę** gałąź → URL → tier jako źródło prawdy i nie rozrzucaj tych faktów po „Live URL"/„allowed origins"/uwagach. „Free tier usypia, prod nie" to jedyny twardy sygnał różnicujący tier — zapisz go wprost, nie zostawiaj do wywnioskowania.

## 2026-07-18 — Offline: katalog list widać, ale nie da się wejść w listę (nawigacja SPA = RSC z sieci)
**Problem:** Po naprawie instalacji SW aplikacja wstawała offline i katalog `/shopping` był widoczny, ale
kliknięcie w konkretną listę nic nie dawało. Przyczyna: w App Routerze wejście w `/shopping/[id]` przez
`<Link>` to nawigacja **SPA**, która pobiera payload **RSC** z sieci — offline to pada. Do tego dokument
HTML tej listy zwykle **nie był w cache**, bo online wchodziło się w listę klikając (SPA pobiera tylko RSC,
nie cały dokument), więc nawet twarda nawigacja nie miała czego zserwować (fallback pokazywał znów katalog).
**Rozwiązanie:** (1) **warm-up** w `OfflineSyncManager` dodatkowo `fetch('/shopping/'+id)` dla każdej
aktywnej listy → SW buforuje **dokument HTML** każdej listy (zwykły fetch bez nagłówka RSC = pełny HTML);
(2) w katalogu (`ShoppingHomePage`) linki do list offline renderujemy jako **twardą nawigację `<a>`** zamiast
`<Link>` (helper `CardLink`), więc przeglądarka robi pełne przejście → SW serwuje zbuforowany dokument →
`ShoppingPage` wstaje i przełącznik czyta ze snapshotu; (3) `caches.match(..., { ignoreVary: true })` w
fallbacku SW, bo Next dodaje `Vary: RSC,…` i bez tego match po nawigacji mógłby nie trafić w dokument.
**Lekcja:** Offline w Next App Router **nawigacja SPA nie zadziała** (RSC leci po sieci). Żeby offline wejść
w dynamiczną trasę: (a) **zbuforuj jej dokument HTML** proaktywnie (`fetch(url)` przy okazji warm-upu — samo
odwiedzenie przez SPA online NIE cache'uje dokumentu), i (b) offline nawiguj **twardo** (`<a>`, nie `<Link>`),
żeby SW mógł ten dokument zserwować. Pamiętaj o `ignoreVary` przy match, bo Next varii po nagłówkach RSC.

## 2026-07-18 — Service worker w ogóle się nie instalował (martwe URL-e w `cache.addAll`)
**Problem:** Po dodaniu trybu offline Zakupów okazało się, że aplikacja i tak **nie wstawała offline**.
Przyczyna zastana: `public/sw.js` w `install` robił `cache.addAll(SHELL)`, a `SHELL` zawierał
**nieistniejące** ścieżki `/icons/icon-192.png` i `/icons/apple-touch-icon.png` (realne ikony są pod
`/pwa-icon/*` i `/apple-touch-icon/*`). `cache.addAll` jest **atomowy** — jeden 404 odrzuca całą obietnicę,
więc `event.waitUntil` w `install` padał, a wtedy **service worker w ogóle się nie aktywuje**. Efekt: nic
się nie cache'owało (nawet poprawny `/_next/static`), więc offline nie działało wcale.
**Rozwiązanie:** (1) `SHELL` zawężony do **istniejących** tras `["/", "/shopping"]`; (2) precache zrobiony
**odpornie** — `Promise.allSettled(SHELL.map((u) => cache.add(u)))` zamiast `addAll`, więc pojedynczy
błędny URL nigdy nie wywróci instalacji; (3) dodany fallback nawigacyjny (offline nawigacja bez trafienia
w cache → cached `/shopping`→`/`), by aplikacja zawsze wstała; (4) bump `CACHE` do `worldofmag-v4`.
**Lekcja:** `cache.addAll` to „wszystko albo nic" — **jeden martwy URL w precache = cały SW nie wstaje**.
Do precache używaj `Promise.allSettled` z `cache.add` per-URL i wpisuj tam **tylko** trasy, które na pewno
istnieją. Gdy „offline nie działa", najpierw sprawdź, czy SW w ogóle się **zainstalował/aktywował**
(DevTools → Application → Service Workers), a nie dopiero logikę fetch.

## 2026-07-18 — Zakupy offline: service worker nie cache'ował `/_next/`, a LWW psuł własne kolejne zmiany
**Problem:** Przy dodawaniu trybu offline do Zakupów (feature 009-shopping-offline-sync) wyszły dwie
nieoczywiste pułapki. (1) Istniejący `public/sw.js` w handlerze `fetch` **wychodził wcześnie dla
każdego `/_next/`** (`return;`), więc bez sieci nie ładowały się hashowane bundle JS/CSS — aplikacja
w ogóle **nie wstawała offline**, mimo że strona `/shopping` była w SHELL. (2) Reguła „ostatni zapis
wygrywa" liczona jako `item.updatedAt > op.ts` **gubiła kolejne własne zmiany offline** tej samej
pozycji: pierwszy zaaplikowany `op` podbijał `updatedAt` do `now()` serwera, więc następny `op`
(z wcześniejszym `ts` klienta) był błędnie uznawany za „serwer nowszy" i pomijany — np. sekwencja
NEEDED→IN_CART→DONE lądowała na IN_CART, a offline add→edit tracił edycję.
**Rozwiązanie:** (1) W `sw.js`: `/_next/static/*` (immutable, content-hashed) serwujemy **cache-first**
(i dopisujemy do cache przy pierwszym pobraniu), pozostałe `/_next/` → sieć; żądania RSC (`headers RSC=1`)
i `/api/` nadal pomijane; bump `CACHE` do `worldofmag-v3`. (2) LWW liczymy **tylko przy pierwszym
dotknięciu** danej pozycji w batchu synchronizacji: trzymamy `Map<itemId, "applied"|"conflict">` — nasze
kolejne operacje na tej samej pozycji wygrywają bez porównania z `updatedAt` (bo to my ją przed chwilą
zmieniliśmy), a konflikt z innym klientem wykrywamy tylko względem stanu serwera **sprzed** batcha.
**Lekcja:** Offline-first PWA nie zadziała, jeśli service worker nie cache'uje **statycznych bundli
`/_next/static`** — sam HTML strony to za mało. A przy „last-write-wins" po `updatedAt` pamiętaj, że
**własne, kolejno odtwarzane operacje same podbijają znacznik czasu** — konflikt licz względem stanu
sprzed synchronizacji (pierwsze dotknięcie), inaczej klient „konfliktuje sam ze sobą" i gubi ostatnią zmianę.

## 2026-07-17 — Asystent klasyfikował prośby o ODCZYT jako akcje tworzące (fast-path)
**Problem:** „Podaj mi zadanie, jakie mógłbym zrobić" kończyło się propozycją dodania (pustej) pozycji
do listy zakupów, zamiast przeszukania zadań i podania konkretnej propozycji. Winny był
`fastPath.classifyIntent`: tani klasyfikator (op:"dispatch") czasem błędnie mapował prośbę o
wyszukanie na prostą akcję create (`add_item`/`create_task`), a bywało, że z pustym payloadem
(„dodaj nic"). Dodatkowo fast-path dla `add_item` z założenia budował tylko `rawText` (bez `listName`)
— więc gdy user wskazał listę po nazwie, wskazanie ginęło.
**Rozwiązanie:** trzy deterministyczne strażniki w `fastPath.ts` (bez dodatkowego kosztu LLM):
(1) **strażnik intencji odczytu** — regex kotwiczony na początku wypowiedzi
(`podaj|pokaż|znajdź|ile|jakie|zaproponuj|…`) → od razu `complex` (pełny agent robi query+answer);
(2) **strażnik pustego payloadu** — prosta akcja bez kluczowej treści (`rawText`/`title`/`name`/
`amount`…) → `complex`; (3) **nazwana lista przy `add_item`** (`\blist[aąeęiy]\w*`) → `complex`, żeby
agent wypełnił `listName` (executor `resolveOrCreateList` już go priorytetyzuje). Do tego reguły w
`buildSystemPrompt` agenta: „QUERY-FIRST" (prośby o wyszukanie realizuj filtrowanym query, nigdy akcją
tworzącą; filtruj po stronie narzędzia, nie „mieli" całości) i „SZANUJ WSKAZANY KONTENER".
**Lekcja:** Fast-path (mały model dispatch) NIE jest wiarygodny przy rozróżnianiu „odczyt vs zmiana"
ani przy pustych payloadach — postaw przed nim **tanie, deterministyczne strażniki** (regex intencji +
walidacja payloadu). Nadmiarowe zepchnięcie do `complex` jest bezpieczne (pełny agent i tak poprawnie
obsłuży tworzenie) — koszt to tylko latencja, nie błędne działanie. Gdy szybka ścieżka gubi parametr
(np. `listName`), lepiej oddać ją agentowi niż „po cichu" wykonać niepełną akcję.

---

## 2026-07-16 — iOS Safari: rozpoznawanie mowy nie kończy tury po ciszy (mikrofon otwarty, brak odpowiedzi)
**Problem:** Po naprawie 007 na iPhone dalej: „mówię pierwszą rzecz, a nie przestaje nasłuchiwać i nie
odpowiada". Nasz `createSpeechListener` dostarczał transkrypt dopiero w `onend`, licząc, że
`continuous=false` sam zatrzyma rozpoznawanie po ciszy (jak na Chrome). Na iOS Safari `continuous=false`
**nie domyka niezawodnie** — mikrofon zostaje otwarty, `onend` nie odpala, a bywa też, że `isFinal`
nigdy nie jest ustawione (mamy tylko `interim`). Efekt: wskaźnik utyka na „Słucham…", nic nie leci do
agenta.
**Rozwiązanie:** własne wykrywanie końca tury **timerem ciszy** w `createSpeechListener`: każdy
`onresult` resetuje licznik `SILENCE_MS` (1500 ms); po pauzie sami domykamy turę — `stop()` (zwolnij
mikrofon) + `onFinal(finalText || lastInterim)`. Dodatkowo `NO_SPEECH_MS` (8000 ms) od startu, by nie
trzymać mikrofonu bez końca, gdy nic nie powiedziano. `onend` (Chrome) zostaje jako druga ścieżka —
`delivered`/`aborted` chroni przed podwójnym dostarczeniem. Kluczowe: dostarczamy **final ALBO ostatni
interim**, bo iOS często nie oznacza `isFinal`.
**Lekcja:** Na iOS Safari NIE polegaj na `onend`/`isFinal` do zamknięcia tury rozpoznawania — steruj
**własnym timerem ciszy** i dostarczaj najlepszy dostępny tekst (final || interim). `continuous=false`
na iOS ≠ „auto-stop po ciszy" jak na Chrome.

## 2026-07-16 — Rozmowa głosowa Asystenta milczała/zacinała się na iPhone (iOS Safari, Web Speech)
**Problem:** Tryb rozmowy głosowej (spec 005/006) działał na Chrome, ale na iPhone (Safari/WebKit —
silnik KAŻDEJ przeglądarki na iOS) Asystent **milczał** i pętla **zacinała się** po pierwszej turze,
choć przycisk się pokazywał. Błędnie zakładaliśmy, że hands-free jest wykonalny „tylko na Chrome".
Faktyczne przyczyny to wąskie ograniczenia iOS Safari, których nie obsługiwaliśmy: (a) `speechSynthesis.
speak()` wywołane **poza gestem** użytkownika jest przez WebKit **po cichu wyciszane** — nasza pierwsza
wypowiedź padała dopiero po asynchronicznej odpowiedzi agenta (bez gestu) → cisza; (b) tryb
`continuous` rozpoznawania jest na iOS zawodny, a **natychmiastowy** restart `recognition.start()` po
zakończeniu tury bywa blokowany/rzuca „already started"; (c) głosy syntezy ładują się asynchronicznie
(`voiceschanged`).
**Rozwiązanie:** (1) `primeSpeech()` w `@/lib/tts` — „odblokowanie" syntezy **w geście** włączenia
trybu (cicha wypowiedź `volume=0` + `getVoices()` + `resume()`); wołane z `toggleVoice` (handler
kliknięcia). (2) Rozgrzewka głosów przez `voiceschanged`. (3) `resume()` po każdym `speak()` (iOS/Safari
wpada w stan „paused"). (4) Restart nasłuchu przez `scheduleListen()` = `setTimeout(startListening,
250ms)` — bufor, którego iOS wymaga między turami; **pierwszy** start i barge-in zostają **synchroniczne
w geście** (zgoda na mikrofon na iOS). Wykrywanie wsparcia zostaje **po istnieniu API**, nie po nazwie
przeglądarki (żadnego UA-sniffingu).
**Lekcja:** Web Speech na iOS Safari **jest** dostępne, ale gestozależne: `speak()` trzeba odblokować w
geście (potem gra programowo), a `recognition.start()` — pierwszy w geście, kolejne z małym opóźnieniem
i świeżym egzemplarzem (`continuous=false`). Nie zakładaj „to działa tylko w Chrome" — to zwykle **brak
priming/handlingu iOS**, nie brak platformy. Weryfikacja mowy wymaga **realnego iPhone** (Web Speech nie
działa w headless CI).

## 2026-07-15 — Kolizja `declare global { Window }` dla SpeechRecognition (build TS)
**Problem:** Nowy helper `src/lib/speechRecognition.ts` (tryb rozmowy głosowej Asystenta) miał własny
blok `declare global { interface Window { SpeechRecognition?: ISpeechRecognitionCtor; … } }`. Taki
sam blok deklarują już `SmartTextarea.tsx` i `AITaskInput.tsx`. Dopóki wszystkie trzy `ISpeechRecognition`
były **strukturalnie identyczne**, TypeScript łączył je bez problemu. Mój interfejs dodał metodę
`abort()` → typ `ISpeechRecognitionCtor` przestał być strukturalnie równy tamtym, a globalne złączenie
pola `Window.SpeechRecognition` wysypało build: „Subsequent property declarations must have the same
type" (błąd raportowany w `AITaskInput.tsx`, choć źródłem był nowy plik).
**Rozwiązanie:** Nie augmentować globalnego `Window` w helperze. Konstruktor czytamy lokalnym rzutem:
`const w = window as unknown as { SpeechRecognition?: …; webkitSpeechRecognition?: … }` w funkcji
`getRecognitionCtor()`. Dzięki temu szerszy typ (z `abort()`) żyje lokalnie i nie zderza się z węższymi
deklaracjami w innych plikach.
**Lekcja:** `declare global { interface Window { … } }` **łączy się globalnie po wszystkich plikach**.
Gdy kilka modułów deklaruje to samo pole `window.*` z lokalnym interfejsem, każda **strukturalna**
różnica (dodana metoda/pole) łamie build w losowym z tych plików. Dla API przeglądarki nieobecnych w
`lib.dom` (np. `SpeechRecognition`) czytaj je **lokalnym rzutem `as unknown as {...}`**, nie globalną
augmentacją — zwłaszcza gdy istnieją już inne deklaracje tego samego pola.

## 2026-07-15 — Nagłówek Zadań ucinał akcje na iPhone (overflow-hidden rodzica)
**Problem:** W dziale Zadania na wąskim ekranie (iPhone) prawy pasek akcji nagłówka pakuje 8+ ikon
(kosz, grupowanie, sortowanie, szukaj, powiadomienia, statusy, przełącznik Lista/Kanban/Timeline,
admin „Kopiuj prompt dla Claude Code", akcje projektu). Nagłówek to jeden rząd o stałej wysokości
(`flex items-center justify-between h-12`) bez zawijania, a rodzic ma `overflow-hidden` — więc nadmiar
był **przycinany**, a trailing akcje (m.in. „Kopiuj prompt") wypadały poza kadr i były nieklikalne.
**Rozwiązanie:** Odizolować poziomy scroll do samego kontenera akcji: `min-w-0 overflow-x-auto
[&>*]:flex-shrink-0` na `<div className="flex items-center gap-2">`. `min-w-0` pozwala kontenerowi
ustąpić szerokości, `overflow-x-auto` daje przewijanie (cienki globalny scrollbar 6px), a
`[&>*]:flex-shrink-0` trzyma ikony i pogrupowane przełączniki w intrinsic rozmiarze (rząd się przewija,
nie ściska). Na desktopie klasa jest inertna (treść się mieści) → zero regresu. Wzorzec był już w tym
samym pliku: pasek „wiele projektów" używa `overflow-x-auto`.
**Lekcja:** Gdy pasek akcji o stałej wysokości siedzi w kontenerze z `overflow-hidden`, nadmiar znika
bez śladu (żadnego scrolla). Na mobile rządom akcji dawaj `min-w-0 overflow-x-auto` + `flex-shrink-0`
na dzieciach, zamiast liczyć, że wszystko się zmieści.

## 2026-07-15 — Weryfikacja builda: świeży klon + globalna Prisma 7 kontra schema Prisma 5
**Problem:** Przy lokalnej weryfikacji (`prisma migrate deploy`) leciał błąd P1012: „datasource property
`url`/`directUrl` is no longer supported" — bo `npx prisma` sięgnął po **globalnie** zainstalowaną
Prisma **7.8.0**, a repo pinuje Prisma **5.22** (schema używa składni `url = env(...)` z datasource,
usuniętej w 7). Dodatkowo świeży klon **nie miał `node_modules`** (`npm install` nie był uruchomiony w
sesji), więc lokalnego `node_modules/.bin/prisma` też nie było.
**Rozwiązanie:** Najpierw `npm install`, potem wywoływać **lokalny** binarny Prisma z projektu:
`node_modules/.bin/prisma migrate deploy` / `generate` (v5.22, akceptuje `url` w datasource). Zmienne
`DATABASE_URL`/`DIRECT_URL` **wyeksportować do shella** (migrate/skrypty nie czytają `.env.local`).
Build weryfikować do kroku `node_modules/.bin/next build` (nie pełny `npm run build`, bo ten na końcu
odpala `migrate.js` — patrz C-13).
**Lekcja:** W sandboxie/świeżym klonie nie ufaj `npx prisma` — może trafić na globalną, nowszą wersję
niezgodną ze schematem. Zawsze `npm install` + `node_modules/.bin/prisma`. Postgres lokalny:
`pg_ctlcluster 16 main start`, rola+baza `omnia/omnia_dev`, eksport env do shella.

---

## 2026-07-15 — Filtry działały tylko w jednym z trzech układów tego samego zbioru zadań
**Problem:** W dziale Zadania pasek filtrów (zakładki statusów + tagi) działał wyłącznie w widoku
Lista. W Kanbanie i na Timeline zaznaczenie tagu nic nie robiło, a przełączanie zakładek „nic nie
zmieniało”. Przyczyna: `TasksPage` filtrował status+tagi **wewnątrz** `TaskList`, a do `KanbanBoard`
i `TimelineView` wpuszczał surowe `displayedTasks` (tylko wynik wyszukiwania). Kontrolki były
widoczne, ale martwe.
**Rozwiązanie:** Filtrowanie przeniesione **przed** rozgałęzienie na układy — w `TasksPage`
policzone `kanbanTasks` (filtr tagów; wszystkie kolumny statusów, także terminalne, by kolumna
„Zrobione” się wypełniała — dlatego bez zawężania po zakładce) i `timelineTasks` (zakładka statusu +
tagi), przekazane do widoków. W Kanbanie zakładki statusu ukryte nowym propem `TaskFilters
showStatusTabs=false` (kolumny i tak reprezentują statusy). `KanbanBoard`/`TimelineView` bez zmian.
**Lekcja:** Gdy ten sam zbiór ma kilka układów (lista/kanban/timeline), filtruj **u źródła** (w
kontenerze, przed wyborem widoku), a nie w jednym z widoków — inaczej pozostałe dostają niefiltrowane
dane i kontrolki filtrów kłamią. Uważaj na semantykę „ALL”: lista wyklucza statusy terminalne, ale
Kanban ich potrzebuje (kolumny), więc nie da się bezmyślnie współdzielić jednego zbioru.

---

## 2026-07-14 — Spec-driven pipeline: gdzie żyją komendy/agenty i jak podać przewodnik do panelu admina
**Problem:** Zadanie: zbudować spec-driven pipeline (`/specify /plan /tasks /implement /verify /review`)
dla Claude Code + przewodnik w panelu admina. Dwie pułapki: (1) `/verify` i `/review` **kolidują
nazwami** z wbudowanymi skillami harnessu; (2) deployowany (standalone) serwer Next **nie czyta
dowolnych plików repo** w runtime, a przewodnik-źródło leży w `.claude/spec-pipeline/` w **katalogu
głównym repo**, o poziom wyżej niż `worldofmag/` — więc nie da się go po prostu `fs.readFileSync` ze
strony.
**Rozwiązanie:** Komendy jako `.claude/commands/*.md`, agenty jako `.claude/agents/*.md`, twarde
reguły w `.claude/spec-pipeline/constitution.md` (numerowane `C-NN`, wyciągnięte z `CLAUDE.md`),
artefakty w `specs/<NNN-slug>/`. Kolizję nazw świadomie akceptujemy — w tym repo `/verify` i `/review`
mają być etapami pipeline'u Omnii (komendy projektowe współistnieją z wbudowanymi). Przewodnik do
panelu admina podany **tym samym wzorcem co `/admin/docs`**: skrypt `scripts/copy-spec-pipeline.js`
czyta `../.claude/spec-pipeline/{README,constitution}.md` (ścieżka **`..`** bo build leci z
`worldofmag/`) i piecze do `src/generated/spec-pipeline.ts` (wpięte w `build`, commitowane by `dev`
działał na świeżym klonie); strona `/admin/spec-pipeline` **reużywa `AdminDocsViewer`** (ten sam
kształt `AdminDoc[]`).
**Lekcja:** Cokolwiek w panelu admina ma pokazać plik z repo — nie czytaj FS w runtime, tylko upiecz
go generatorem do `src/generated/*.ts` w kroku `build` (jak `copy-docs`/`copy-audyt`) i reużyj
istniejącego viewera. Pamiętaj o `..` w ścieżce generatora (build startuje w `worldofmag/`, a `.claude`
jest o poziom wyżej). Nowy generator MUSI trafić do `build` w `package.json`, inaczej prod pokaże
starą treść.

## 2026-07-14 — `jsx-a11y/alt-text` fałszywie flaguje ikonę `Image` z lucide-react (nie tylko `<img>`)
**Problem:** Reguła `jsx-a11y/alt-text` zgłaszała „Image elements must have an alt prop" na `<Image size={12} />`, gdzie `Image` to **ikona z `lucide-react`**, a nie element `<img>` ani `next/image`. Reguła patrzy na *nazwę* elementu JSX (`Image`), więc każdy komponent nazwany `Image` dostaje ostrzeżenie — mimo że alt nie ma tu sensu. Osobno: te same pliki miały prawdziwe `<img>` w `ImageResponse` (generatory ikon PWA/OG) bez `alt`.
**Rozwiązanie:** Dla ikony lucide — **alias importu** `import { Image as ImageIcon } from "lucide-react"` + zamiana użyć na `<ImageIcon />` (usuwa fałszywe trafienie u źródła, bez `eslint-disable`). Dla realnych `<img>` w `ImageResponse` — dodać `alt=""` (dekoracyjne). Przy okazji: warningi `react/no-unescaped-entities` (proste `"` zamykające polski cudzysłów) naprawione **chirurgicznie po dokładnym `line:col` z lintera** (codemod podmieniający pojedynczy znak → typograficzny „ / "), a NIE globalnym replace `"`→`"` (globalny trafiłby też w atrybuty JSX i by je zepsuł). Single-char→single-char = kolumny kolejnych trafień w tej samej linii pozostają stabilne.
**Lekcja:** Zanim „naprawisz" a11y-warning, sprawdź czy element to naprawdę `<img>` — reguła jedzie po nazwie, więc komponent/ikona o nazwie `Image` daje fałszywy alarm (alias importu to czysta naprawa). Masowe naprawy tekstu w JSX rób po `line:col` z lintera, nie regexem globalnym — inaczej ruszysz cudzysłowy w atrybutach. (Dodatkowo, znany artefakt środowiska: długi `next build` potrafi ubić lokalny Postgres → testy DB nagle „Can't reach database server"; `pg_ctlcluster 16 main start` i ponów — to nie regres kodu.)

## 2026-07-14 — Limit uczciwości kolejki musi być SPRAWDZANY PO dedupe (inaczej idempotentny re-submit pada na limicie)
**Problem:** Dokładając limit aktywnych zadań na użytkownika (`maxActivePerOwner`, ochrona kolejki przed zapchaniem przez jednego usera przy 100+ userach) pierwsza wersja sprawdzała limit na samym początku `enqueue`, PRZED lookupem po `dedupeKey`. Skutek: gdy user jest przy limicie, a klient ponawia to samo zadanie z tym samym `dedupeKey` (np. re-submit/retry pollingu), enqueue rzucało `QuotaError` zamiast zwrócić istniejące, już zakolejkowane zadanie — czyli legalny idempotentny call był blokowany. Test „dedupe pomija limit" to złapał (owner miał już 2 aktywne, `maxActivePerOwner:1` → rzut mimo trafienia w klucz).
**Rozwiązanie:** Kolejność w `enqueue`: **najpierw** dedupe (jeśli istnieje AKTYWNE zadanie z tym kluczem → zwróć je i wyjdź), **dopiero potem** limit. Trafienie w dedupeKey to „to samo zadanie", więc z definicji nie powiększa kolejki i nie może podlegać limitowi. Limit rzuca typowany `QuotaError` mapowany na HTTP 429 w trasie `/api/jobs`; klient (`runJob`) już propaguje `error` z odpowiedzi, więc UI dostaje czytelny komunikat. Zweryfikowane testem integracyjnym (limit=2 → trzeci rzuca; świeży owner + dedupe przy limicie=1 → zwraca to samo zadanie).
**Lekcja:** Przy dokładaniu bramek (rate-limit / quota / fairness) do ścieżki, która ma też idempotencję, **zawsze najpierw rozstrzygnij idempotencję, potem bramkę**. Bramka liczy „nowe" zadania; dedup-hit nie jest nowym zadaniem. Odwrotna kolejność cicho psuje retry/polling dokładnie w momencie, gdy limit jest najbardziej aktywny (user pod obciążeniem). Test „bramka nie blokuje dedupe" jest tani i wart napisania od razu.

## 2026-07-02 — `instrumentation.ts` jest bundlowany też dla EDGE → import łańcucha z `node:crypto` wywala build (a tsc/testy tego NIE łapią)
**Problem:** Wpiąłem start workera kolejki w `instrumentation.ts` (`await import("@/lib/jobs/worker")` po guardzie `NEXT_RUNTIME==="nodejs"`). `tsc --noEmit` i testy przeszły, ale **deploy na Render padł** na `next build`: „Module not found: Can't resolve 'crypto'" z import-trace `instrumentation.ts → worker → handlers → chat → resolver/secrets/cache`. Powód: Next kompiluje `instrumentation.ts` także dla runtime **EDGE**, a webpack **śledzi nawet dynamiczne importy** przy bundlowaniu (guard `NEXT_RUNTIME` blokuje WYKONANIE, nie BUNDLOWANIE). `secrets.ts`/`cache.ts` używają node-owego `crypto`, którego w edge nie ma → błąd kompilacji. Wcześniejszy import w instrumentation (`observability/report`) nie ciągnął crypto, więc problem pojawił się dopiero po dołożeniu łańcucha LLM.
**Rozwiązanie:** NIE startować workera z `instrumentation.ts`. Start przeniesiony do tras API (`/api/jobs` POST i `/api/jobs/[id]` GET — runtime **Node**) przez idempotentny `startJobWorker()`: pierwszy enqueue/polling odpala workera, `setInterval` żyje dalej w procesie serwera (Render prod nie usypia). Trasy API mogą bez problemu ciągnąć crypto (są Node). Zweryfikowane realnym `./node_modules/.bin/next build` (exit 0) — nie samym `tsc`.
**Lekcja:** Zmiany w `instrumentation.ts`, `middleware.ts` i wszystkim, co może trafić do bundla EDGE, **MUSISZ** weryfikować pełnym `next build`, bo `tsc`/testy nie robią webpackowego bundlowania per-runtime i przepuszczą „Can't resolve 'crypto'/'fs'/…". Guard `NEXT_RUNTIME==="nodejs"` chroni wykonanie, ale nie wycina modułu z edge-bundla — Node-only zależności (crypto/fs/net) trzymaj z DALA od instrumentation; startuj je leniwie z tras/akcji (runtime Node). Wzorzec „lazy start on first API hit" (idempotentny singleton) jest odporniejszy niż instrumentation dla rzeczy ciągnących natywne moduły.

## 2026-07-02 — Kolejka Job: `SKIP LOCKED`, migracja z `migrate diff` chce usunąć „dryfujące" indeksy, i pułapka testów z globalnym `claimNext`
**Problem:** Budując kolejkę zadań w tle (T-17/Z-131) natrafiłem na trzy rzeczy. (1) Generując migrację tabeli `Job` przez `prisma migrate diff --from-url $DB --to-schema-datamodel` dostałem w wyniku NIE tylko `CREATE TABLE "Job"`, ale też `DROP INDEX "Note_*_trgm_idx"` — bo indeksy trigramowe (Z-240) to świadomy dryf spoza `schema.prisma`, więc diff „chce je posprzątać". Ślepe wklejenie migracji skasowałoby FTS notatek. (2) Testy współbieżności kolejki (`Promise.all([claimNext(), claimNext()])`) przechodziły uruchamiane SAME, ale padały w zestawie — bo `node --test` odpala pliki RÓWNOLEGLE, a `claimNext` jest GLOBALNY (bierze dowolne QUEUED), więc test z jednego pliku „podkradał" zadania enqueue'owane przez drugi plik. (3) `UPDATE ... WHERE id=(SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *` to właściwy sposób na atomowe, wieloworkerowe pobranie jednego zadania bez podwójnego wzięcia.
**Rozwiązanie:** (1) Z wyniku `migrate diff` wziąłem TYLKO fragment `CREATE TABLE`/`CREATE INDEX` dla `Job`, świadomie POMIJAJĄC `DROP INDEX` trigramów (z komentarzem w migracji, że to celowe — dryf zaakceptowany). Zweryfikowane: po `migrate deploy` i tabela `Job`, i oba indeksy `*_trgm_idx` istnieją. (2) Scaliłem wszystkie testy kolejki/workera w JEDEN plik (w obrębie pliku `node:test` idzie sekwencyjnie, `concurrency:false`), więc równoległe pliki nie kolidują; żaden inny plik nie enqueue'uje jobów. (3) Claim przez `$queryRawUnsafe` z `SKIP LOCKED`; `attempts++` przy przejęciu (crash-loop nie ponawia w nieskończoność), odzysk „osieroconych" RUNNING po `visibility timeout`.
**Lekcja:** Po `prisma migrate diff` ZAWSZE przejrzyj wynik — przy świadomym dryfie (surowe indeksy/rozszerzenia spoza schematu) diff będzie chciał je DROP-nąć; bierz tylko interesujący Cię fragment. Testy komponentu z GLOBALNYM stanem współdzielonym (kolejka, `claimNext` bez filtra) trzymaj w jednym pliku (sekwencyjnie), bo `node --test` równolegli pliki — inaczej „kradną" sobie rekordy. Wieloworkerowa kolejka na Postgresie = `FOR UPDATE SKIP LOCKED` + inkrement prób przy claimie + visibility-timeout na odzysk po crashu; to skaluje się do N instancji bez zmian (można wynieść workera do osobnej usługi bez ruszania logiki).

## 2026-07-02 — FTS notatek: trigram (pg_trgm) zamiast tsvector — bo tsvector wymusza duplikację logiki dostępu w surowym SQL
**Problem:** Z-240 chciało indeksowanego wyszukiwania notatek zamiast skanującego `ILIKE`. Kuszące było „prawdziwe" FTS (tsvector+GIN+ranking), ale `getNotes` ma nietrywialny `where`: własność (`OR ownerId / ownerTeamId in getAccessibleTeamIds`), filtry grupy/tagów/pinned. tsvector wymagałby zapytania przez `$queryRaw` (Prisma nie filtruje po wygenerowanej kolumnie tsvector), a więc **przepisania logiki DOSTĘPU na surowy SQL** — a to security-sensitive (łatwo o rozjazd z regułą Prisma → wyciek/utrata widoczności). Do tego zmiana z substring (ILIKE) na token/word-match zmienia zachowanie (user wpisujący „mle" nie znajdzie „mleko").
**Rozwiązanie:** Wariant **trigramowy**: `CREATE EXTENSION pg_trgm` + indeksy GIN `gin_trgm_ops` na `title`/`content` (migracja `0201`). `gin_trgm_ops` przyspiesza `col ILIKE '%q%'` (także z wiodącym wildcardem), więc **ZERO zmian zapytania** — filtr zostaje w Prisma z całą logiką dostępu, wyniki identyczne, tylko szybciej przy skali. Ranking trafności zrobiony **app-level** czystą funkcją `noteSearchScore`/`rankNotesBySearch` (tytuł ~3×, całe pole/prefiks/początek słowa > środek, liczba trafień) wpiętą w `getNotes` tylko przy `search`. Weryfikacja użycia indeksu: `SET enable_seqscan=off; EXPLAIN … ILIKE '%q%'` → `Bitmap Index Scan on Note_title_trgm_idx` (na małej tabeli planer sam wybrałby seq scan — dlatego w teście wymuszamy `enable_seqscan=off`).
**Lekcja:** Gdy trzeba „zaindeksować szukanie", a getter ma złożoną autoryzację w `where` — **pg_trgm (ILIKE-accelerated) bije tsvector**, bo nie zmusza do przepisania zapytania (a więc i reguł dostępu) na surowy SQL. tsvector rezerwuj na przypadki, gdzie naprawdę potrzebujesz stemmingu/rankingu po stronie DB i możesz bezpiecznie odtworzyć scoping. Ranking trafności zrób app-level (czysta, testowalna funkcja) zamiast `ts_rank` w rawie. Test „czy indeks działa" pisz z `enable_seqscan=off` (mała tabela = planer i tak seq-scanuje). ŚWIADOMY DRYF: extension + indeksy wyrażeniowe nie mieszczą się w `schema.prisma` → udokumentuj w migracji i NIE odpalaj `migrate dev` na prodzie.

## 2026-07-02 — Zmiana „Terminu" zadania przepadała: `datetime-local` + doklejone `"T12:00:00"` = Invalid Date
**Problem:** W szczególe zadania modyfikacja terminu nic nie robiła. Pole „Termin" to `type="datetime-local"` (wartość np. `"2026-07-02T14:30"`), a handler robił `new Date(v + "T12:00:00")` → `new Date("2026-07-02T14:30T12:00:00")` = **Invalid Date** → `updateTask({dueDate: InvalidDate})` cicho nie zapisywał. Doklejanie południa jest poprawne TYLKO dla pola `type="date"` (samo `"YYYY-MM-DD"`). Dodatkowo wyświetlanie używało `new Date(x).toISOString().slice(0,16)` = **UTC**, więc pole pokazywało złą godzinę (dla usera w UTC+2 przesuniętą), a przy każdej zmianie i tak sklejało niepoprawny string.
**Rozwiązanie:** Wydzielony `src/lib/dateInput.ts`: `toDateTimeLocalValue`/`toDateValue` (format w strefie LOKALNEJ przez `getFullYear/getMonth/...`, NIE `toISOString`) + `parseDateInput(v, {dayOnly?})` (`new Date(v)` dla datetime-local — parsuje jako czas lokalny; `+"T12:00:00"` tylko dla dayOnly). Handlery w `TaskDetail`: termin = `parseDateInput(v)`, start = `parseDateInput(v,{dayOnly:true})`. 7 testów: round-trip instant→pole→instant zachowuje instant, `datetime-local` nie daje Invalid Date, puste→null.
**Lekcja:** `toISOString()` NIE służy do zasilania pól `datetime-local`/`date` — daje UTC (zły czas w polu) i kusi do sklejania. Formatuj/parsuj lokalnie. Kluczowa różnica: `new Date("YYYY-MM-DDTHH:mm")` (bez strefy) parsuje jako **lokalny**, a `new Date("YYYY-MM-DD")` jako **UTC-północ** — dlatego pole „date" (dzień) doklejaj do lokalnego południa, a pole „datetime-local" parsuj wprost. Zawsze zrób round-trip test (wyświetl→zapisz→wyświetl), bo cichy `Invalid Date` nie rzuca wyjątku, tylko „nic się nie dzieje".

## 2026-07-02 — Import przepisu z URL: generyczny 422 maskował „LLM nieskonfigurowany"
**Problem:** Import przepisu (`/api/llm/kitchen/import-url`) zwracał zawsze `422 „Nie udało się rozpoznać przepisu"`, nawet gdy realną przyczyną był brak skonfigurowanego modelu LLM (na środowisku testowym `develop` bez `groq_api_key`). `extractWithLLM` robił `if (!result.ok) return null`, a `chatComplete` na braku konfiguracji zwraca `{ok:false, status:503, message:"LLM nie jest skonfigurowany…"}` — ten sygnał ginął, mapując się na to samo 422 co „strona nie jest przepisem". User nie miał jak się domyślić, że wystarczy ustawić model w Admin → LLM (dokładnie ten sam anty-wzorzec, co dawne „brak nowych" w Wiadomościach).
**Rozwiązanie:** `extractWithLLM` zwraca teraz `{recipe, llmError?:{status,message}}` zamiast gołego `null`; trasa rozróżnia: `llmError.status===503` → „Import z AI niedostępny (model nieskonfigurowany/chwilowy błąd) — ustaw w Admin → LLM", `429` → „wyczerpano budżet AI", inaczej → generyczny 422 „brak danych przepisu w treści" (bo wtedy LLM ODPOWIEDZIAŁ, tylko strona nie jest przepisem — np. Cloudflare/JS-shell z serwerowego fetcha Rendera).
**Lekcja:** Funkcja, od której zależy „czy w ogóle coś się stanie", nie może cicho zwracać `null` na każdej ścieżce — rozróżniaj „usługa niedostępna/niekonfigurowana" (5xx/429 → powiedz userowi CO zrobić) od „brak wyniku" (poprawne, ale pusto). Propaguj `status/message` z warstwy LLM aż do odpowiedzi HTTP. Uwaga na środowiska: `develop`/`master` mają OSOBNĄ konfigurację w `Config` (klucze per-env) — funkcja działająca lokalnie potrafi zwracać 422/503 na deployu tylko dlatego, że tam nie ustawiono `groq_api_key`.

## 2026-06-28 — Egzekwowanie dostępu w ~20 getterach bez ryzyka: konwencja `user.id` (read) vs `userId` (write)
**Problem:** Domknięcie granularnych ról domownika (T-12/Z-194) wymagało wpięcia `getAccessibleTeamIds(userId, moduleId)` w gettery-odczyty kilkunastu modułów team-aware ZAMIAST `getUserTeamIds(userId)`. Naiwny `replace_all getUserTeamIds` zepsułby też gardy zapisów (`assertXAccess`) — wtedy ograniczenie widoczności zmieniłoby też prawo do edycji (inny zakres niż chciany), a do tego część plików miała ten wzorzec rozsiany po 6–20 miejscach (ryzyko ślepej, masowej edycji = dokładnie „large refactor", przed którym ostrzega pętla).
**Rozwiązanie:** Odkryta KONWENCJA repo: gettery-odczyty wołają `getUserTeamIds(user.id)` (z `.id`, bo mają obiekt `user` z `requireAuth`), a prywatne gardy `assertXAccess(id, userId)` wołają `getUserTeamIds(userId)` (parametr). Więc precyzyjny `s/getUserTeamIds\(user\.id\)/getAccessibleTeamIds(user.id, "MODUŁ")/g` per plik trafia WYŁĄCZNIE w odczyty, zostawiając gardy-zapisy nietknięte. Tam gdzie był wspólny helper czytający scope (`ownershipFilter`/`scopeWhere` w flota/portfel/medications) — jeden swap w helperze. Zmiana w 100% wstecznie zgodna (default `moduleAccess=null` → `getAccessibleTeamIds`==`getUserTeamIds`), więc nawet ślepo jest BEZPIECZNA: nowe zachowanie aktywuje się dopiero, gdy rodzic ograniczy dziecko. Po swapie sprawdź, czy `getUserTeamIds` nadal używane (gardy) — jeśli plik miał TYLKO `user.id` (np. `lists.ts`, `portfelReports.ts`), usuń je z importu (strict tsc wywali nieużywany). Test DB na samym prymitywie `getAccessibleTeamIds` (a nie 11 getterach) pokrywa całą warstwę. `tasks` (model projectMembers/entity, NIE `ownerTeamId`+`getUserTeamIds`) i `contacts` (user-only) świadomie poza zakresem.
**Lekcja:** Przed masowym swapem rozdziel ŚCIEŻKI po sygnaturze wywołania (`user.id` vs `userId`) — to często naturalna granica read/write w tym repo i pozwala bezpiecznie `sed`-ować tylko jedną klasę. Feature gated kolumną z bezpiecznym defaultem (null=stare zachowanie) jest „bezpieczny nawet ślepo" — to odblokowuje zrobienie szerokiego egzekwowania bez deployowej weryfikacji. Testuj prymityw (jedna funkcja, której używają wszystkie gettery), nie każdy getter z osobna. I zawsze po zdjęciu ostatniego użycia symbolu — sprzątnij import (strict).

## 2026-06-28 — Usunięcie konta właściciela zespołu: rozwiąż własność PRZED `user.delete()` (FK RESTRICT)
**Problem:** `deleteMyAccount` twardo blokował usunięcie konta, jeśli user był właścicielem jakiegokolwiek zespołu („najpierw przekaż własność"). Decyzja właściciela (T-04/Z-051): zamiast blokady — auto-transfer własności na następcę, a zespół „solo" usuwać. Pułapka: `Team.ownerId` ma FK `onDelete: Restrict`, więc próba `user.delete()` gdy user jest właścicielem ZESPOŁU rzuci błędem FK. Trzeba rozwiązać własność każdego zespołu PRZED skasowaniem usera, w tej samej transakcji.
**Rozwiązanie:** W `purgeUserData` (transakcja) jako PIERWSZY krok `resolveOwnedTeams(tx, userId)`: dla każdego `team.ownerId===userId` — jeśli są inni członkowie, wybierz następcę czystą funkcją `pickTeamSuccessor` (najstarszy stażem ADMIN → fallback najstarszy członek), ustaw mu rolę OWNER i `team.ownerId=następca` (membership odchodzącego i tak kaskaduje przy `user.delete`); jeśli solo — `tx.team.delete()`, co przez `ownerTeam onDelete:Cascade` sprząta WSZYSTKIE zasoby team-owned (listy/notatki/przepisy/…) i członkostwa. Reguła wyboru wydzielona do `src/lib/teams/ownership.ts` (6 testów jednostkowych) + 2 testy DB-gated (transfer zachowuje zasoby i preferuje ADMIN-a nad starszym MEMBER-em; solo kasuje kaskadowo). Zdjęta blokada w `deleteMyAccount`; UI nie wymagało zmian (nie pre-sprawdzało własności).
**Lekcja:** Zanim skasujesz encję z przychodzącym FK `RESTRICT` (tu `Team.ownerId`→User), MUSISZ wcześniej w tej samej transakcji albo przepiąć ten FK (transfer), albo usunąć rekord-rodzica. Sprawdź kierunki `onDelete` zależnych relacji: `ownerTeam` (zasoby) = Cascade → usunięcie zespołu solo czyści zasoby „za darmo"; gdyby był SetNull, zasoby by osierociały i trzeba by je kasować jawnie. Logikę wyboru (następca) trzymaj jako czystą funkcję (testowalną bez DB), a integrację z FK pokryj 1-2 testami DB-gated na realnych kaskadach.

## 2026-06-28 — ESLint jako bramka: osierocone `eslint-disable @typescript-eslint/*` = 9 fałszywych errorów
**Problem:** Włączając ESLint jako bramkę (T-02; w repo NIE było ani configu, ani `eslint`/`eslint-config-next` w zależnościach) `next lint` dał 9 **errorów** „Definition for rule '@typescript-eslint/no-explicit-any' was not found". To NIE realne błędy — w kodzie były komentarze `// eslint-disable-next-line @typescript-eslint/no-explicit-any` (z poprzednich sesji), ale reguła nie była zarejestrowana, więc ESLint traktuje odwołanie do nieznanej reguły jako error. Blokowałyby bramkę mimo zera realnych problemów.
**Rozwiązanie:** W `.eslintrc.json` (extends `next/core-web-vitals`) dołożyć `"plugins": ["@typescript-eslint"]` — sama rejestracja pluginu (jest jako tranzytywna zależność `eslint-config-next`) sprawia, że reguły `@typescript-eslint/*` „istnieją" (domyślnie off), więc dyrektywy disable stają się poprawnymi no-opami. Kosmetykę (`no-unescaped-entities`, `exhaustive-deps`, `no-img-element`, `alt-text`) zdegradować do `warn`, `rules-of-hooks` zostawić `error`. Bramka jawna: krok `next lint --dir src` w `build` + `eslint.ignoreDuringBuilds:true` w `next.config` (żeby `next build` nie lintował drugi raz). Stan: 0 errorów, 64 warningi → zielona; realny błąd (np. hook warunkowy) ją wywala (zweryfikowane sondą wstrzykniętą i usuniętą).
**Lekcja:** „Definition for rule not found" to nie bug w kodzie, tylko brak rejestracji pluginu, którego dotyczą istniejące dyrektywy `eslint-disable`. Włączając ESLint w projekcie z historią takich komentarzy — najpierw zarejestruj `@typescript-eslint` (plugin), inaczej dostaniesz errory z niczego. Bramka = jedno miejsce: jawny `next lint` + `ignoreDuringBuilds:true`, kosmetyka jako `warn` (nie przepisuj 64 pozycji), realne klasy (`rules-of-hooks`) jako `error`. `next lint` z samymi warningami zwraca 0 (nie wywala buildu).

## 2026-06-28 — DnD listy `@dnd-kit/sortable`: przeciągaj za UCHWYT + optymistyczna kolejność jako lista ID
**Problem:** Dodając ręczną kolejność DnD pozycji zakupów (T-03/Z-221) trzeba było pogodzić trzy rzeczy: (1) wiersz jest mocno interaktywny (klik=fokus, dblclick=edycja, toggle statusu, menu „przenieś") — gdyby cały wiersz był `draggable`, dotyk/klik na treści wszczynałby drag; (2) po zapisie kolejności serwer rewaliduje propsy, więc naiwny `useState(items)` migałby (stara kolejność z propsów na chwilę wraca); (3) zmiana statusu/treści pozycji musi nadal docierać do widoku mimo lokalnej, optymistycznej kolejności.
**Rozwiązanie:** (1) `useSortable` z `setActivatorNodeRef` na osobnym UCHWYCIE (`GripVertical`, widoczny na hover/focus, `touch-none`, `onClick stopPropagation`) — przeciąga TYLKO uchwyt, reszta wiersza działa normalnie; `disabled: isEditing`. (2)+(3) Optymistyczny stan to **lista ID** (`orderIds`), a render bierze świeże OBIEKTY z propsów przez `Map(id→item)` — kolejność lokalna, treść z serwera. `useEffect` resyncuje `orderIds` TYLKO przy zmianie składu (add/del: zachowaj istniejące, dopnij nowe na koniec), nie przy każdej zmianie propsów → brak migotania, bo po rewalidacji serwer zwraca tę samą kolejność. Sensory Pointer(distance 6)/Touch(delay 200, tolerance 8 — long-press na mobile, by scroll działał)/Keyboard (a11y). Zapis: `arrayMove` + akcja `reorderItems(listId, category, ids)` ustawiająca `order=index` w transakcji; sort listy `[order ASC, priority DESC, createdAt ASC]` (default 0 = wstecznie zgodne).
**Lekcja:** Sortowalna lista z interaktywnymi wierszami: przeciągaj za dedykowany uchwyt (`setActivatorNodeRef`), nie za cały wiersz. Optymistyczny porządek trzymaj jako listę ID + lookup obiektów z propsów (rozdziel „kolejność" od „treści"), a resync rób tylko przy zmianie SKŁADU, nie przy każdej rewalidacji — inaczej miga. Na mobile `TouchSensor` z `delay` (long-press), żeby zwykły scroll palcem nie chwytał elementów. Kolumnę sortującą daj z bezpiecznym defaultem (0 = stary sort), żeby feature był w 100% wstecznie zgodny dopóki user nic nie przeciągnie.

## 2026-06-28 — Świeży klon: `npm install` pada na pobraniu silników Prisma przez proxy (ECONNRESET)
**Problem:** Na świeżym kontenerze (brak `node_modules`) `npm install` wywalał się `ECONNRESET` — ale NIE na rejestrze npm. Same paczki JS pobierają się OK (`registry.npmjs.org` jest na liście `noProxy` agent-proxy → bezpośrednio). Padał `postinstall` `@prisma/engines` (`scripts/postinstall.js`), który ściąga binarne silniki z `binaries.prisma.sh` — host NIE jest w `noProxy`, więc leci przez MITM-proxy, a Node-owy downloader dostaje reset (`curl` ten sam URL ciągnie bez problemu — 200). Efekt: cały `npm install` robił rollback, `node_modules` zostawało puste → nie dało się odpalić nawet `tsc`.
**Rozwiązanie:** (1) `npm install --ignore-scripts` — pobiera WSZYSTKIE paczki JS (rejestr działa), pomija postinstall (w tym pobieranie silników). (2) Silniki Prisma ściągnąć ręcznie `curl` i podłożyć: `curl -o libquery_engine.so.node.gz "https://binaries.prisma.sh/all_commits/<HASH>/debian-openssl-3.0.x/libquery_engine.so.node.gz"` (HASH = z DEBUG `prisma:fetch-engine:download`), `gunzip`, `mv` na `libquery_engine-debian-openssl-3.0.x.so.node`; analogicznie `schema-engine.gz` (chmod +x). Pliki trzeba podłożyć w DWÓCH miejscach: `node_modules/@prisma/engines/` ORAZ `node_modules/prisma/` (CLI ma osobną kopię — `prisma generate` sprawdza własną ścieżkę). (3) `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` + `npm config set cafile` dla zaufania CA proxy. Gdy silniki są na dysku, `prisma generate`/`migrate deploy` NIE pobierają nic → przechodzą.
**Lekcja:** Rozróżniaj WARSTWY `npm install`: pobranie z rejestru (npm, `noProxy` → działa) vs postinstall ściągające binaria spoza rejestru (Prisma/Playwright/esbuild — przez proxy, bywa ucinane). Gdy `ECONNRESET` w `npm install` — sprawdź w debug-logu, NA CZYM padł (`error path … node_modules/@prisma/engines`), bo to nie rejestr. Obejście: `--ignore-scripts` + ręczne `curl` binariów (host odpowiada na curl) podłożone w obu ścieżkach (`@prisma/engines` i `prisma`). To samo dotyczy każdego pakietu z natywnym download-postinstall.

## 2026-06-28 — Wirtualizacja listy w obrębie scrolla strony: `scrollMargin` + `scrollToIndex` zamiast `scrollIntoView`
**Problem:** Owijając najdłuższą płaską listę (Kontakty) w `@tanstack/react-virtual` (T-11/Z-071) trafiłem na dwie pułapki specyficzne dla tego repo: (1) cała strona to JEDEN kontener przewijania (`pageContainerStyle` = `flex:1; overflowY:auto`), a nad listą siedzą nagłówek + wyszukiwarka w tym samym scrollu — naiwny wirtualizer pozycjonowałby wiersze od góry scrolla, ignorując tę treść; (2) istniejąca nawigacja j/k robiła `rowRefs.get(id).scrollIntoView()` — po wirtualizacji wiersze poza oknem NIE istnieją w DOM, więc ref jest pusty i klawisz „nie dowscrollowuje".
**Rozwiązanie:** (1) `scrollMargin` = offset wrappera listy względem kontenera przewijania, liczony w `useLayoutEffect` (`list.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop`) i przeliczany, gdy nad listą zmienia się treść (dep `adding`/`contacts.length`) + listener `resize`; wiersz pozycjonowany `translateY(vi.start - virtualizer.options.scrollMargin)`. (2) Nawigacja klawiaturą woła `virtualizer.scrollToIndex(idx, {align:"auto"})` zamiast `scrollIntoView`. (3) Wiersze różnej wysokości (tagi/notatki + tryb edycji zamienia wiersz na wyższy formularz) → dynamiczny pomiar `ref={virtualizer.measureElement}` + `data-index`, `estimateSize` tylko jako punkt startowy. Odstęp między wierszami wliczony w pomiar przez `paddingBottom` mierzonego wrappera (nie `gap` flexa, którego absolutne pozycjonowanie nie respektuje).
**Lekcja:** Wirtualizacja działa świetnie dla list „load-all + filtr po stronie klienta" (renderujesz okno, nie cały DOM) — to one są celem, nie listy keyset-paginowane. W tym repo, gdzie `<main>` deleguje scroll do strony, wirtualizer MUSI dostać `scrollMargin` (treść nad listą) i `getScrollElement` = kontener strony, a każda istniejąca nawigacja oparta o `scrollIntoView`/ref przechodzi na `scrollToIndex` (wiersze poza oknem nie są w DOM). Dynamiczne wysokości → `measureElement`+`data-index`, odstępy w `paddingBottom` mierzonego elementu.

## 2026-06-27 — Zalecenia audytu bywają JUŻ spełnione architekturą — weryfikuj przed implementacją
**Problem:** Realizując tracker po kolei trafiłem na Z-134 („tańszy model dla `dispatch`") i Z-135 („monitoring kosztów AI") jako rzekomo „do zrobienia". W rzeczywistości OBA były już spełnione istniejącą architekturą: Z-134 przez warstwę operationType (`lib/llm/resolver.ts` mapuje `dispatch`→`llama-3.1-8b-instant`, `reasoning`→70B; wszystkie trasy dispatch wołają `op:"dispatch"`), Z-135 przez `getUnitEconomics` (`actions/metrics.ts` — koszt AI/MAU z `AiUsage`). Wcześniej analogicznie Z-073/Z-176/Z-031/Z-220 (agent Explore podawał je błędnie jako niezrobione).
**Rozwiązanie:** Przed implementacją KAŻDEGO zalecenia — grep realnego kodu pod mechanizm (np. `grep '"dispatch"'`, `getUnitEconomics`), nie ufać ani trackerowi (bywa nieaktualny), ani świeżemu agentowi (nie krzyżuje z kodem). Jeśli spełnione → oznaczyć ✅ z notą „już spełnione przez X", zero nowego kodu.
**Lekcja:** Tracker/agent to wskazówki, nie wyrocznia. Pętla per-zalecenie zaczyna się od „udowodnij, że NIE jest zrobione" (grep kodu), dopiero potem implementacja. Bonus (diagnostyka EXPLAIN, Z-037): `EXPLAIN (FORMAT JSON)` BEZ `ANALYZE` waliduje plan + nazwy tabel/kolumn bez WYKONANIA zapytania → dummy id wystarcza do sanity-checku SQL nawet na pustej bazie (i jest bezpieczne na prod).

## 2026-06-27 — slugify: polskie „ł" nie rozkłada się w NFD
**Problem:** `slugify` wykonawcy usług (`lib/services/helpers.ts`) robił `normalize("NFD")` + strip combining marks, ale `ł/Ł` (U+0142/0141) to OSOBNE litery, nie „l + znak diakrytyczny" — NFD ich NIE rozkłada. Efekt: po `[^a-z0-9]→-` „Łódź" → „odz", „Wałbrzych" → „wa-brzych" (ł zjadane jako separator). Cicho psuło polskie slugi w publicznych URL-ach `/providers/[slug]`.
**Rozwiązanie:** Po `toLowerCase()` dołożyć jawny `.replace(/ł/g, "l")` PRZED filtrem `[^a-z0-9]`. Testy `serviceHelpers.test` lockują „Łódź"→„lodz" oraz rozkładalne (ą/ę/ó/ś/ż/ź/ć/ń)→bazowe litery. Zero wpływu na istniejące slugi (są zapisane; slugify biegnie tylko przy tworzeniu/zmianie nazwy).
**Lekcja:** NFD rozkłada TYLKO znaki z kanonicznym rozkładem (ó=o+́, ą=a+̨…), ale NIE ł/Ł, đ, ø, ß. Dla polskich/europejskich slugów dołóż jawne mapowanie tych liter przed strip-em diakrytyków. Funkcje normalizacji tekstu testuj na pełnym polskim alfabecie, nie tylko ASCII.

## 2026-06-27 — Jawna polityka onDelete (Z-033/036): naprawa „cichych sierot" własności
**Problem:** Audyt zgłaszał „~108 FK bez jawnego `onDelete`" i sugerował dużą migrację 108 kluczy. W praktyce: (1) liczba NIEAKTUALNA — poprzednie sesje RODO (Z-264/301/370) już dodały polityki, zostało 13 FK bez polityki + 16 błędnych; (2) realny BUG to `onDelete: SetNull` na RELACJACH WŁASNOŚCI (`owner`/`ownerTeam`) 10 modeli (Notes/Recipes/Cookbooks/MealPlans/LanguageDecks/HealthEvents/MedicationSchedules/Habits + ShoppingList/TaskProject bez polityki) — usunięcie konta zostawiało rekord-sierotę (ownerId=NULL, niewidoczny, niezgodny z RODO), gdy ~20 innych modeli własności miało już Cascade. Pułapka grepa: `@relation(fields:` NIE łapie relacji NAZWANYCH (`@relation("OwnedNotes", fields:...)`) → fałszywe „tylko 1 FK bez polityki". Poprawny wzorzec: `fields: \[`.
**Rozwiązanie:** Zawężenie do tego, co audyt naprawdę chciał („relacje własności i powiązania z User — resztę zostawić"): 20 FK własności SetNull/brak → **Cascade**; 9 relacji aktora/zespołu → JAWNE onDelete = DOTYCHCZASOWA domyślność (optional→SetNull, required→Restrict) → pokrycie **200/200 FK przy ZERO zmian w DB** (potwierdzone: `migrate diff --from-schema-datamodel before --to-schema-datamodel after --script` dało DOKŁADNIE 40 ALTER = 20×(drop+add), tylko własność). Bezpieczna edycja 29 linii: skrypt Node z regexem PER unikalna nazwa relacji + asercja „dokładnie 1 trafienie" (nie sed na ślepo). Migracja ręczna `0196` (numer z `npm run next:migration`). Weryfikacja BEZ deployu na lokalnym Postgresie: `migrate deploy` + `pg_constraint.confdeltype='c'` + **test kaskady asercją PO ID rekordu** (NIE po ownerId — SetNull też zwolniłby ownerId i dałby fałszywy PASS; tylko sprawdzenie, że RZĄD zniknął, wykrywa regresję sieroctwa). Drift-check: flaga to `--from-url $DB` (nie `--from-database`).
**Lekcja:** Liczby z audytu bywają nieaktualne — najpierw POLICZ realny stan (`grep 'fields: \[' | grep -v onDelete`), nie ufaj „108". Najmniejszy poprawny zakres bije ślepą masową migrację: zmieniaj tylko własność (→Cascade), relacje aktora rób JAWNE = dotychczasowa domyślność (0 ALTER, pokrycie 100%). Testy kaskady FK ZAWSZE asercją po ID rekordu, nie po kolumnie FK. SQL migracji bez DB: `migrate diff` schema↔schema. Pre-existing drift wykryty przy okazji (`Workshop*.updatedAt` DB-default z migr. 0095 bez deklaracji w schemacie — tylko 2 z 10 tabel-z-defaultem driftują; runtime OK bo `@updatedAt` ustawiane app-level) — udokumentowany, nie „naprawiany" bez pewności kierunku.

## 2026-06-24 — Masowa migracja N plików: podagenci edit-only + commit centralny; burst kontra limit
**Problem:** Z-114 = ~22 modale „ad-hoc" do migracji na wspólny `ui/Modal`. Robienie bezpośrednio wykończyłoby kontekst głównej pętli (każdy duży plik „wisi" do końca rozmowy i jest przeliczany w każdej turze); pojedynczo = wolno. Próba „4 agentów naraz" trafiła w limit Anthropic w połowie — jeden urwał się na rozjechanym JSX (niedomknięty `<Modal>`), dwa zostawiły sam dodany import.
**Rozwiązanie:** Wzorzec orkiestracji do masowej, mechanicznej roboty: podagenci z ROZŁĄCZNYMI paczkami plików, **edit-only** (zakaz `git`/`npm`/`typecheck`/commit — współdzielone drzewo!), każdy najpierw czyta JEDEN już-zmigrowany przykład z repo (wzorzec 1:1). Orchestrator po powrocie WSZYSTKICH: `typecheck` całości + grep (`<Modal` jest / `fixed inset-0` zniknął) + JEDEN commit. Recovery po urwaniu na limicie: `git checkout` plików rozjechanych/ledwo-tkniętych, commit tylko ukończonych (kompilujących). Na końcu **sweep `fixed inset-0`** potwierdza, że reszta trafień to NIE-modale.
**Lekcja:** Do migracji N-plików: podagenci edit-only + weryfikacja/commit CENTRALNIE (nie pozwól agentom robić git na wspólnym drzewie — wyścigi). Limit Anthropic to OKNO zużycia WSPÓLNE dla agentów i głównej pętli — nie odpalaj zbyt wielu naraz (burst go przebije). Agenci NIE oszczędzają tokenów (mają narzut: własny system-prompt + raport), oszczędzają KONTEKST głównej pętli — używaj ich, gdy wąskim gardłem jest Twój kontekst, nie surowe tokeny. Modal-migracja: tylko prawdziwe dialogi (nakładka+panel ze `stopPropagation`); POMIJAJ dropdowny/skanery/nav-overlay/palety/immersyjne/pełnoekranowe przejęcia. Mapowanie: nagłówek→`title`, przyciski→`footer` (dwustronne w `justify-between` `width:100%`), treść→`children` (usuń wrapper `px-* py-* flex gap-*` — Modal daje padding+gap; kilka rodzeństwa → `<>`).

## 2026-06-24 — Audyt c.d.: weryfikuj założenia agenta przy realnym kodzie; pułapki ICU i DB-testów
**Problem:** Przy „dobijaniu" autonomicznych zaleceń audytu (po skanie agentem Explore) część typowań agenta nie trzymała się kodu: (a) Z-251 „testy parsera składników" — `parseIngredients` to wywołanie LLM (`llm.kitchen`), nie czysta funkcja; (b) Z-382 „N+1 w kalendarzu" — `lib/calendar.ts` to tylko `isoDay`/`monthRange`, agregacja już zoptymalizowana; (c) Z-264 „PetSale RODO" — to NIE luka (model ma FK `onDelete:Cascade` do User i Pet), w odróżnieniu od Contact/ServiceFavorite (bez FK, naprawione w Z-370). Dodatkowo test `formatMoney` (pl-PL) pękał: separator tysięcy bywa OBECNY (pełne ICU „1 234,50") albo NIE (małe ICU „1234,50").
**Rozwiązanie:** Każde zalecenie weryfikuj GREP/Read w realnym `src/` ZANIM dotkniesz — nazwy plików w audycie/od agenta bywają zgadnięte (np. agent typował `src/actions/wallet.ts`, jest `portfel.ts`). Wynik Z-400: soft-delete/Kosz (`TrashModule` w `lib/trash.ts`) pokrywa TYLKO `notes`+`tasks` — reszta kasuje twardo; rozszerzenie = większy follow-up (restore per-moduł + decyzja, które encje odzyskiwalne). Z-264 zamknięte testem regresji kaskady. Testy `Intl.NumberFormat`: usuwaj CAŁĄ białą spację (`/\s/g`→"") i NIE asercuj separatora tysięcy (zależy od buildu ICU); sprawdź realny output przez `node -e` zamiast zgadywać.
**Lekcja:** „Audyt mówi X" ≠ „w kodzie jest X" — weryfikuj przy źródle. Testy liczb/dat/walut: asercje odporne na ICU (strip whitespace, regex zamiast równości, daty względne z dniem ≤28 by uniknąć brzegu miesiąca/29 lutego). Testy DB-gated lokalnie: `pg_ctlcluster 16 main start` + rola/baza `omnia/omnia_dev` (superuser dla prostoty) + `migrate deploy` LOKALNYM binarnym prisma 5 (NIE `npx prisma` — ściąga prisma 7!) → `DATABASE_URL=… npm run test:unit` odpala też DB-gated (256→272 z DB).

## 2026-06-24 — Z-232 finał: trzecia klasa list (NAWIGACYJNE) — hub `onEnter` + guard; Magazyn partial
**Problem:** Listy CZYSTO nawigacyjne (kafelek=`<Link>` do detalu: Zwierzęta/Flota/Portfel/Warsztaty/Języki) były pomijane w Z-232 — hub miał tylko toggle/edit/delete, brak akcji „otwórz". Magazyn: wiersz otwiera arkusz edycji (akcje nie in-place), lista grupowana w wielu sekcjach (lowStock/expiring/per-magazyn).
**Rozwiązanie:** Rozszerzono kontrakt huba o **`onEnter`** (Enter=„otwórz"). KLUCZOWY guard w hooku: nie odpalaj `onEnter`, gdy `document.activeElement` to realna kontrolka (`button`/`a`/`select`/`[role=button]`) — inaczej Enter na zogniskowanym przycisku/linku hijackowałby natywną aktywację (podwójne zadziałanie). Listy nawigacyjne: `focused` (−1) w rodzicu, `onNavigateUp/Down`, `onEnter`→`router.push(detal)`, `onQuickAdd`→otwórz formularz; karta `<Link>` dostaje ring sterowany `focused` (`borderColor`/`background`) + `onMouseEnter=setFocused` (ZAMIAST inline hover-swap — inaczej mysz i klawiatura walczą o styl). Magazyn (wiele sekcji): spłaszcz główną listę do `orderedItems` + `Map(id→index)`, by policzyć GLOBALNY indeks fokusu w renderze grupowanym (indeks lokalny sekcji by się mylił); `Enter`/`e`=otwórz arkusz, `a`=dodaj, `/`=szukaj (ref na input); ring przez `outline` (przycisk bez bordera → brak skoku layoutu).
**Lekcja:** Hub ma teraz TRZY klasy list: (1) prosta lista akcji (toggle/edit/delete), (2) strona wielolistowa (wybierz główną encję), (3) NAWIGACYJNA (`onEnter`→push). Dla nawigacyjnej: `onEnter` + guard na kontrolki + ring z `focused`/`onMouseEnter`. Dla list z wieloma sekcjami licz globalny indeks przez `Map(id→index)` na spłaszczonej liście, nie indeks lokalny sekcji. Częściowy keyset jest OK, gdy akcje są w arkuszu/detalu — daj to, co pasuje (j/k+Enter+a+/), nie udawaj toggle/delete. Po wznowieniu sesji Edit wymaga realnego Read pliku (sam Grep nie wystarcza — „File has not been read yet").

## 2026-06-24 — Rollout Z-232 c.d.: akcje w karcie → wynieś do rodzica; strony wielolistowe; dialog-guard
**Problem:** Druga fala Z-232 (Zdrowie, Leki, Przepisy) odsłoniła trzy pułapki, których nie było w prostych listach (Kontakty/Nawyki/Dostawcy): (1) w `HealthHomePage`/`MedicationsPage` akcje (cykl statusu, usuń, aktywny/wstrzymany) były ZAMKNIĘTE w komponencie karty — `EventCard`/`ScheduleCard` miały własny `useRouter` + `remove`/`cycleStatus`/`toggleActive` — więc hub wołany z rodzica nie miał jak ich odpalić na zogniskowanym wierszu. (2) Strony mają PO KILKA list (Zdrowie: nadchodzące + minione; Leki: dawki „na dziś" + harmonogramy) — jeden `focused`/`onToggleStatus` nie obsłuży wszystkich naraz. (3) `RecipeList` miał własny `keydown` tylko na `/`+`n` z blokadą przy otwartych dialogach importu — a hub blokuje tylko pisanie w `input`/`textarea`, NIE Twoje dialogi.
**Rozwiązanie:** (1) Wynieś akcje karty do rodzica jako handlery `(entity) => …` i przekaż propami (`onCycleStatus`/`onDelete`/`onToggleActive`); karta staje się prezentacyjna + `onMouseEnter={onFocus}` + ring `borderColor: focused ? "var(--border-focus)" : "var(--border)"`. Model `focused` (number, −1) i `ordered[focused]` trzymaj w rodzicu — focus i akcje MUSZĄ być w jednym miejscu. (2) Lista jednorodna (Zdrowie: ten sam typ encji w 2 sekcjach) → spłaszcz do jednego `ordered=[...upcoming,...past]` i licz indeks globalnie (`upcoming.length + j` dla minionych). Listy RÓŻNOTYPOWE (Leki: `DoseSlot` vs `MedicationSchedule`) → zawęź `j/k` do listy GŁÓWNYCH encji (harmonogramy: `x`=aktywny, `e`, `d`), a szybką listę (odhaczanie dawek) zostaw pod myszą/dotykiem. (3) Przy migracji inline→hub odtwórz appowe guardy W handlerach: `onQuickAdd: () => { if (!dialogOpen) … }`. Usuń osierocony `useEffect` z importu, bo `tsc` (strict) wywali nieużywany symbol.
**Lekcja:** Wpięcie huba to nie tylko `useKeyboardShortcuts({…})` — NAJPIERW sprawdź, gdzie żyją akcje. Jeśli w karcie, wynieś je do rodzica (focus + akcje w jednym miejscu, karta prezentacyjna). Strona z wieloma listami wymaga decyzji „która lista słucha klawiszy": jednorodne spłaszcz i indeksuj globalnie, różnotypowe — wybierz główną encję, reszta pod myszą. Hub gwarantuje TYLKO guard pisania; każdy inny stan blokujący (dialog/sheet) replikuj w handlerach. Weryfikacja bez proda: `npm run typecheck` (czyste `tsc --noEmit`), NIE `npm run build` (jego `migrate.js` rusza Neon). Magazyn (`StorageList`) świadomie POMINIĘTY: wiersz otwiera arkusz edycji (usuń/zmiana są w arkuszu, nie in-place) + sekcje lowStock/expiring/grouped — to nie „czysty cel", nie forsowano (zgodnie z wcześniejszą lekcją).

## 2026-06-24 — Rollout skrótów: szukaj „shadow hubów" (własny listener duplikujący useKeyboardShortcuts)
**Problem:** Przy rolloutcie keyboard-nav (Z-232) Nawyki (`HabitsPage`) wyglądały na „bez skrótów", ale miały WŁASNY `window.addEventListener("keydown")` z j/k/n/a/space/x/e i stanem `focused` — czyli reimplementację huba, nie jego brak. Naiwny rollout dołożyłby drugi listener (konflikt globalny) zamiast zastąpić istniejący.
**Rozwiązanie:** Przed wpięciem huba do modułu: `grep -rl 'addEventListener("keydown"' src/components`. Nawyki zmigrowane na `useKeyboardShortcuts` (usunięty inline listener), przy okazji dochodzi `d`=usuń (wersja inline go nie miała). Reszta trafień to legit handlery komponentowe (Esc w modalu, paleta, StudySession, edytory, mapa sklepu) — nie ruszać.
**Lekcja:** „Moduł bez skrótów" to często moduł z własnym, zdryfowanym listenerem. Rollout współdzielonego huba zaczynaj od grepa po inline `keydown`: trafienia w listach to cele MIGRACJI (zastąp, nie dokładaj), a inline-handlery modali/edytorów są słusznie osobne. Migracja przy okazji wyrównuje braki w skrótach (tu: brakujące `d`=usuń). Uwaga też na listy CZYSTO nawigacyjne (np. talie Języków = `<Link>` do detalu) — hub (toggle/edit/delete) tam nie pasuje, bo brak akcji „otwórz/Enter"; nie forsuj.

## 2026-06-24 — Rollout keyset (Z-071): czyste cele są rzadkie — nie wpychaj go na siłę
**Problem:** Helper keyset (`lib/pagination.ts`, Z-070) jest gotowy, ale „rollout na kolejne listy" (Z-071) ma mało czystych celów. Przegląd kandydatów: ruch magazynowy (`StorageMovement`) — embed z `take: 20` (już ograniczony); powiadomienia — sort `readAt asc nulls first, createdAt desc` (nie czysto-chronologiczny, kursor `id` nie pozycjonuje); feed aktywności na Home — bounded widget (`.slice(0,10)`, over-fetch 30 pod filtr uprawnień po stronie klienta); `NewsItem` per topic — bez `take`, ALE karmi agregację „bieżący stan wiedzy = max(version)" liczoną ze WSZYSTKICH itemów (paginacja by ją rozjechała). Listy modułów (tasks/notes) ładują całość i filtrują/sortują po stronie klienta — keyset się z tym gryzie.
**Rozwiązanie:** Nie forsowałem keysetu tam, gdzie nie pasuje. Czysty cel (audit log) już go ma; pozostałe listy są albo bounded, albo mają sort nie-monotoniczny, albo karmią agregację po całości, albo są client-filtered.
**Lekcja:** Keyset (kursorowy) pasuje TYLKO do czysto-chronologicznej, append-only listy z deterministycznym `orderBy [pole desc, id desc]`, której konsument NIE musi widzieć całości naraz. Zanim wpniesz keyset, sprawdź 4 dyskwalifikatory: (1) lista już ograniczona `take`/`slice` (bounded widget — nie trzeba), (2) sort nie-monotoniczny po kluczu kursora (np. unread-first), (3) konsument agreguje po WSZYSTKICH wierszach, (4) filtrowanie/sortowanie po stronie klienta (load-all). Trafienie któregokolwiek = keyset to zła odpowiedź; nie dokładaj „Load older" do widgetu dla samej zasady.

## 2026-06-24 — useKeyboardShortcuts: kontrakt „wszystkie handlery wymagane" blokował rollout (Z-232)
**Problem:** `useKeyboardShortcuts(handlers)` wymagał KOMPLETU 10 handlerów (`ShortcutHandlers` bez opcjonalności), więc każdy nowy moduł musiał stubować nawet bezsensowne dla siebie akcje (`onToggleStatus: () => {}`, `onCommandPalette: () => {}` — tak robią Notes/Shopping/Tasks). To czyniło rollout keyboard-first (Z-232, tylko 3/~20 modułów) drogim. Dodatkowo hook robił `e.preventDefault()` przed każdym handlerem bezwarunkowo — stub `onCommandPalette: () => {}` POŁYKAŁ Ctrl+K (preventDefault + no-op), więc moduł bez własnej palety blokował globalną.
**Rozwiązanie:** `ShortcutHandlers` → wszystkie pola opcjonalne; hook woła handler i blokuje klawisz TYLKO gdy handler jest podany (`if (handlers.onX) { preventDefault(); onX() }`). Ctrl+K zawsze `return` (by nie wpaść w `case "k"` = nawigacja w górę), ale `preventDefault` tylko gdy jest `onCommandPalette`. Istniejące 3 callery przekazują komplet → zero zmian zachowania (potwierdza tsc). Rollout na Kontakty wpina tylko sensowne akcje (j/k/e/d/a/f/Esc), pomijając toggle/filterTab/palette.
**Lekcja:** Hook-kontrakt „wszystkie callbacki wymagane" to anty-wzorzec dla rzeczy adoptowanej przyrostowo — zrób pola opcjonalne i **blokuj domyślną akcję klawisza dopiero, gdy faktycznie go obsługujesz** (inaczej globalny listener typu Ctrl+K połknie pusty stub). Kolejność: najpierw enabler (opcjonalny kontrakt, zachowanie istniejących callerów 1:1, weryfikacja tsc), potem rollout modułu — interakcję (czy `j/k` faktycznie przesuwa zaznaczenie) i tak trzeba domknąć e2e.

## 2026-06-17 — Rozbicie pliku Server Actions ("use server") — barrel NIE może mieć "use server"
**Problem:** Rozbijając `actions/services.ts` (1400 linii, 48 Server Actions, `"use server"`) chciałem zostawić `actions/services.ts` jako barrel re-eksportujący akcje z plików per-obszar, by nie ruszać 16 importerów. Próba `export { x } from "./services/disputes"` w pliku z `"use server"` → **build fail**: „Only async functions are allowed to be exported in a 'use server' file". Plik `"use server"` może eksportować WYŁĄCZNIE async-funkcje (akcje) — żadnych re-eksportów, stałych, typów-wartości.
**Rozwiązanie:** Wzorzec docelowy: każdy obszar to osobny plik `"use server"` z samymi akcjami (np. `actions/services/disputes.ts`), a `actions/services.ts` staje się **zwykłym barrelem BEZ `"use server"`**: `export * from "./services/<obszar>"`. Nie-akcyjny barrel MOŻE re-eksportować Server Actions (tożsamość akcji bierze się z modułu definiującego, nie z barrela), więc publiczny import `@/actions/services` działa bez zmian u konsumentów. Plumbing (mappery, resolvery, stałe) i typy MUSZĄ wyjść do zwykłych modułów (`@/lib/services/helpers`, `@/lib/services`), bo nie wolno ich trzymać w plikach `"use server"`. Efekt: services.ts 1400→20 linii (barrel), 11 plików akcji per-obszar.
**Lekcja:** Plik `"use server"` = tylko async-akcje. Aby rozbić taki plik zachowując publiczną ścieżkę importu: (1) wynieś typy/helpery do zwykłych modułów, (2) zrób pliki per-obszar `"use server"`, (3) zamień oryginał na **nie-`"use server"` barrel** `export *`. Migruj przyrostowo (każdy obszar to osobny plik `"use server"` + ewentualnie redirect jego importerów), a barrel wprowadź na końcu, gdy oryginał nie ma już własnych akcji. Brak e2e dla modułu = weryfikacja tylko build+tsc (build łapie naruszenia „use server").

## 2026-06-17 — Bezpieczny rozbiór monolitu (1467 linii) przy zachowaniu guardu spójności
**Problem:** `execute/route.ts` (egzekutor akcji AI) urósł do 1467 linii — jeden `executeAction` z łańcuchem `if (type === "...")` dla ~20 modułów, a `check-action-coverage.js` skanował TYLKO ten plik szukając `type === "..."`. Naiwne przeniesienie handlera do osobnego pliku wywaliłoby build (guard zgłosiłby „akcja bez obsługi"), a bloki tego samego modułu były rozproszone po 2-3 miejscach (grupa „bazowa" + „DODATKOWE AKCJE CRUD" po wspólnym `teamOr`).
**Rozwiązanie:** Najpierw **enabler**: guard skanuje teraz też `src/lib/ai/executors/*.ts` (podąża za przeniesionym kodem). Potem rozbiór w 8 małych, osobno commitowanych slice'ach: (1) wspólna infra → `shared.ts` (typy `ActionResult`/`ExecOutcome`, resolvery), (2-8) po 1-3 domeny → `XExecutor.ts`. Dla domen rozproszonych: executor scala WSZYSTKIE grupy, dispatch w pierwszym miejscu robi `return`, pozostałe (nieosiągalne) grupy kasujemy; każdy executor liczy własny `ownerOr` przez `ownerOrArr`. Po każdym slice: `tsc` + `check:actions` + `build` + porównanie baseline testów. Efekt: 1467→148 linii (−90%), 15 executorów, `executeAction` = czysty dispatcher.
**Lekcja:** Rozbijając monolit pilnowany przez statyczny guard, **najpierw naucz guard podążać za kodem** (skanuj katalog docelowy), dopiero potem przenoś — inaczej każdy krok wywala build. Przenoś **małymi, osobno commitowanymi slice'ami z pełną weryfikacją po każdym** (guard łapie pominiętą akcję, tsc typy, build całość). Czyste przeniesienie = zachowuj logikę 1:1 (nawet nieużywane `const`); refaktor kosmetyczny rób osobno.

## 2026-06-17 — Liczba testów jednostkowych „spadła" po refaktorze — to był artefakt środowiska, nie regresja
**Problem:** Po wyodrębnieniu wspólnej infrastruktury egzekutora AI (`executors/shared.ts`) `npm run test:unit` pokazał `191 tests / 184 pass / 7 skipped`, podczas gdy wcześniej w sesji widziałem `221 / 221 / 0`. Wyglądało na regresję (zniknęło 30 testów + 7 skipów).
**Rozwiązanie:** `git stash` + uruchomienie testów na ZACOMMITOWANYM stanie sprzed refaktoru dało identyczne `191/184/7` — czyli mój refaktor nic nie zepsuł. Wcześniejsze „221" wzięło się stąd, że `test:unit` był odpalany **w tym samym poleceniu shella zaraz po `next build`** (i po seedzie/migracji dev-Postgresa przez e2e). Część testów jest data-driven po wierszach z bazy, więc stan dev-DB zmienia liczbę zarejestrowanych subtestów; 7 testów to środowiskowe skipy (DB/sieć).
**Lekcja:** Regresję testową weryfikuj porównaniem do **zacommitowanego baseline’u** (`git stash` → test → `stash pop`), nie do liczby zapamiętanej wcześniej w sesji. Nie licz na stabilną liczbę testów, gdy (a) `test:unit` leci w tym samym poleceniu co `build`, (b) testy dotykają dev-DB, którą e2e migruje/seeduje. Dla czystego baseline’u odpalaj `test:unit` osobno.

## 2026-06-17 — Nawigacja klient-side (setState) w stronie RSC ładującej dane per-URL → inne „strony" puste/stałe
**Problem:** W planie posiłków (`MealPlanWeek`) nawigacja tygodni (`goPrev/goNext/goToday`) robiła **tylko** `setAnchorDate(...)` po stronie klienta — bez zmiany URL. Tymczasem `app/kitchen/plan/page.tsx` (RSC) ładuje wpisy **dokładnie dla jednego tygodnia** z `searchParams.week` (albo „dziś"). Skutek: po przejściu na inny tydzień siatka pokazywała nowe daty, ale `entries` (prop) zostawały ze startowego tygodnia → inne tygodnie wyglądały na puste; a posiłek dodany poza bieżącym tygodniem znikał po najbliższej rewalidacji, bo serwer przeładowywał tydzień z URL (niezmieniony), nie oglądany. Brak testu e2e na nawigację tygodni sprawił, że to umknęło mimo statusu „Done".
**Rozwiązanie:** Nawigacja STERowana URL-em — `router.push('/kitchen/plan?week=<dateKey>')`; serwer przeładowuje `entries`+`weekCost` dla oglądanego tygodnia. Lokalny `anchorDate` zostawiony dla natychmiastowej zmiany siatki + `useEffect([initialWeek])` resynchronizuje go po przeładowaniu (URL = jedno źródło prawdy). Dodany test e2e: klik „Następny tydzień" → URL ma `?week=YYYY-MM-DD`.
**Lekcja:** Jeśli strona RSC ładuje dane na podstawie `searchParams`, to **cała nawigacja po tych danych musi przechodzić przez URL** (`router.push`/`<Link>`), nie przez lokalny `useState`. Stan lokalny zmienia tylko to, co widać, nie to, co serwer załaduje — i cicho rozjeżdża widok z danymi. Każdy taki „przełącznik zakresu" (tydzień/miesiąc/strona/filtr) zasługuje na test e2e sprawdzający zmianę URL.

## 2026-06-17 — Nowe pole modelu trzeba podpiąć we WSZYSTKICH ścieżkach create (nie tylko add/update)
**Problem:** Dodając `unitPrice` do `RecipeIngredient` (Z-252, koszt przepisu) łatwo było podpiąć je tylko w `addIngredient`/`updateIngredient` i zapomnieć o pozostałych miejscach, które tworzą składniki: zbiorczy `create` w `createRecipe` (mapowanie `data.ingredients`) oraz `duplicateRecipe` (kopiowanie `src.ingredients`). Pominięcie któregokolwiek = pole po cichu gubione przy tworzeniu/duplikowaniu przepisu (build by przeszedł, bo pole jest opcjonalne).
**Rozwiązanie:** Przed zakończeniem zadania `grep` po nazwie modelu + `create:`/`.create(`/`.map(` w pliku akcji — w `recipes.ts` były **4** ścieżki zapisu składnika (add, update, bulk-create w createRecipe, copy w duplicateRecipe). Wszystkie cztery dostały `unitPrice`. Migracja: dodatkowa kolumna nullable (`ADD COLUMN IF NOT EXISTS ... DOUBLE PRECISION`) — bezpieczna, bez backfillu.
**Lekcja:** Po dodaniu pola do modelu z wieloma punktami tworzenia rekordu zrób szybki audyt wszystkich `create`/`createMany`/`.map(` dla tego modelu (zwłaszcza ścieżki „duplikuj"/„importuj"). Opcjonalne pole nie wysypie buildu, więc brak go zauważysz dopiero jako zgubione dane.

## 2026-06-17 — Kolumna właściciela BEZ FK do User → ciche osierocenie przy usuwaniu konta (RODO)
**Problem:** Analiza twardego usuwania konta (Z-051) była sterowana **regułami FK** (`ON DELETE CASCADE`/`SET NULL`/`RESTRICT`) — i dla modeli z FK do `User` to działa. Ale przy weryfikacji Z-370 (Kontakty w RODO) okazało się, że `Contact.ownerId` oraz `ServiceFavorite.userId` to kolumny właściciela, które **nie mają w ogóle klucza obcego do `User`** (potwierdzone zapytaniem do `pg_constraint`). Skutek: po `user.delete()` rekordy te nie były ani kasowane (brak CASCADE), ani zerowane (brak SET NULL), ani blokujące (brak RESTRICT) — po prostu **zostawały jako sieroty** wskazujące na nieistniejącego usera. Dla kontaktów to dane osób trzecich → realne naruszenie „prawa do bycia zapomnianym".
**Rozwiązanie:** W `purgeUserData` dodano jawne `tx.contact.deleteMany({ where: { ownerId } })` i `tx.serviceFavorite.deleteMany({ where: { userId } })` przed `tx.user.delete()`. Test `purge.test.ts` rozszerzony o seed kontaktu usera A (asercja: skasowany) i usera B (asercja: nietknięty — izolacja). 3/3 zielone, tsc czysty.
**Lekcja:** Przy kasowaniu/anonimizacji danych konta NIE polegaj wyłącznie na regułach FK — model może mieć kolumnę właściciela (`ownerId`/`userId`) **bez** zadeklarowanego FK (w tym repo to się zdarza, bo część relacji jest „luźna"). Zrób osobny przegląd wszystkich kolumn `ownerId`/`userId`/`authorId` w `schema.prisma` i dla każdej bez `@relation`/FK dołóż jawny `deleteMany`. Inaczej RODO-purge zostawia sieroty po cichu.

## 2026-06-16 — Mylący prefiks `use` na zwykłej funkcji łamie rules-of-hooks (ESLint) — WeatherPage
**Problem:** Pomiar ESLint (Z-011) wykrył błąd `react-hooks/rules-of-hooks` w `WeatherPage.tsx`: „React Hook `useGeolocation` cannot be called inside a callback". W rzeczywistości `useGeolocation` to **zwykły helper** (woła `navigator.geolocation.getCurrentPosition` + `setCoords`/`showToast`, BEZ żadnych hooków React) — ale nazwany z prefiksem `use`, więc ESLint (i czytelnik) traktuje go jak hook i widzi naruszenie zasad hooków przy wołaniu w callbacku `onUseGeo`. Działało w runtime, ale to realny dług/pułapka.
**Rozwiązanie:** Zmiana nazwy `useGeolocation` → `requestGeolocation` (w definicji i wywołaniu). Zero zmiany zachowania, znika false-positive i mylące nazewnictwo. (Przy okazji: pełny ESLint na dojrzałym kodzie dał 74 problemy, gł. kosmetyczne `react/no-unescaped-entities` + `exhaustive-deps` + kwestie konfiguracji pluginu @typescript-eslint — pełne wdrożenie odłożone do pliku decyzji jako Z-011.)
**Lekcja:** Prefiks `use` REZERWUJ wyłącznie dla prawdziwych hooków React. Zwykłe funkcje-akcje (`requestX`, `detectX`, `handleX`) nazywaj bez `use` — inaczej `react-hooks/rules-of-hooks` rzuca false-positive przy wołaniu w callbackach/warunkach, a kod wprowadza w błąd co do reguł hooków.

## 2026-06-16 — `userDayBounds().end` o ~1 s za późno: `formatToParts` gubi milisekundy (wykryte testem)
**Problem:** Dopisując testy `lib/userTime.ts` (granice doby w strefie usera) okazało się, że `end` doby wychodzi `00:00:00.998` NASTĘPNEGO dnia zamiast `23:59:59.999`. Przyczyna: `tzOffsetMs` liczył offset przez `Intl.DateTimeFormat.formatToParts`, które **nie zwraca milisekund** — `Date.UTC(...,second)` obcinało ms, dając offset zaniżony o ułamek sekundy; `zonedWallToUtc` dodawał ten błąd, więc koniec doby (`…:59.999`) przeskakiwał o ~1 s. `start` (ms=0) był OK, dlatego bug nie rzucał się w oczy. Efekt: zdarzenia w pierwszej ~1 s nowej doby mogły wpaść w „dziś".
**Rozwiązanie:** W `tzOffsetMs` doliczyć ms instantu: `Date.UTC(p.year, p.month-1, p.day, hour, p.minute, p.second, at.getUTCMilliseconds())` (offsety stref to pełne minuty, więc ms instantu = ms zegara ściennego). 5 testów deterministycznych (tz+base jawnie) na UTC/CEST/CET + przejście doby + `userTomorrowStart`.
**Lekcja:** `Intl.DateTimeFormat.formatToParts` NIE ma `millisecond` — licząc offset/round-trip czasu zachowaj ms osobno (z instantu), inaczej granice doby (`…:59.999`) rozjadą się o ~1 s. Testy granic czasu pisz deterministycznie: przekazuj strefę i bazową datę jawnie (nie polegaj na strefie runnera), asercje na `toISOString()`.

## 2026-06-16 — XSS w rendererze markdown: linki `[x](javascript:…)` nie miały allowlisty schematów
**Problem:** Przy dopisywaniu testów bezpieczeństwa `lib/markdown.ts` (Z-057) wyszło, że globalne escapowanie `&`/`<` chroni przed wstrzyknięciem TAGÓW, ale **linki markdown nie były ograniczone do bezpiecznych schematów** — tylko obrazy miały regułę „tylko http(s)". `[klik](javascript:alert(1))` zamieniało się na `<a href="javascript:alert(1)">` (XSS po kliknięciu). Dodatkowo href **nie escapował `"`**, więc `[x](https://a"onmouseover=alert(1))` mogło wyjść z atrybutu (attribute injection). Renderer jest używany w raportach, AI, QA, przepisach — wejście bywa z modeli LLM i treści użytkownika.
**Rozwiązanie:** W `inlineFormat` link renderowany jako `<a>` **tylko** dla schematów `http(s)://` / relatywny `/` / kotwica `#` / `mailto:` (inaczej zostaje literalnym tekstem, jak obrazy spoza http(s)); href dodatkowo `"`→`%22`. 7 testów (`src/lib/__tests__/markdown.test.ts`): brak surowego `<script>`/`<img onerror>`, obraz/link http(s) OK, `javascript:`/`data:` zablokowane, brak attribute-injection, kod escapuje `>`, tabele/nagłówki/bold renderują.
**Lekcja:** W każdym własnym rendererze markdown/HTML **niezależnie kontroluj schematy URL w `href` i `src`** (allowlista http(s)/relatywny/mailto), nie tylko escapuj `<`/`&` — `javascript:`/`data:` w linku to klasyczny XSS, który escapowanie tagów przepuszcza. I escapuj cudzysłów w wartościach atrybutów. Jeśli jeden typ (obrazy) ma allowlistę, a drugi (linki) nie — to luka.

## 2026-06-16 — CI padał: `node --test "glob"` wymaga Node ≥22 (Node 20 nie rozwija glob → 0 s crash)
**Problem:** Pierwszy run CI (job `verify`) padł na kroku `test:unit` w ~0 s, mimo że lokalnie przechodzi. Workflow miał `node-version: 20`. Skrypt `test:unit` = `node --import tsx --test "src/**/*.test.ts"`. **Glob-pattern w argumencie `node --test` jest wspierany dopiero od Node 22** — Node 20 traktuje `"src/**/*.test.ts"` jako literalną ścieżkę, której nie ma → natychmiastowy błąd (ENOENT) i exit≠0. Lokalnie mam Node 22, więc nie wyszło. (Osobno padł job `e2e-smoke` — Playwright wymaga zaseedowanych userów E2E, co robi projekt `setup:db`; ustawiony jako nieblokujący do walidacji.)
**Rozwiązanie:** `node-version: 22` w obu jobach CI (zgodnie z lokalnym env, gdzie wszystko jest zielone). E2E oznaczone `continue-on-error: true` (sygnał, nie wywala gate'u) do pierwszej walidacji smoke na realnym runnerze.
**Lekcja:** Trzymaj wersję Node w CI **zgodną z lokalną** (gdzie weryfikujesz) — różnica major potrafi zmienić zachowanie narzędzi. Konkretnie: `node --test` z glob-em wymaga **Node ≥22**; na starszym Node użyj jawnej listy plików, katalogu, albo runnera, który sam rozwija glob. Po dodaniu workflow **sprawdź pierwszy run przez GitHub MCP** — CI „napisane" ≠ „działające".

## 2026-06-16 — Dryf schema↔DB przy indeksach: `@@index` brakuje w schema, ale indeks JEST w bazie
**Problem:** Przy Z-030 (indeksy `ownerId`/`ownerTeamId`) skan `schema.prisma` wykazał brak `@@index` na `Note` (i 6 innych modelach). Dodałem migrację `CREATE INDEX "Note_ownerId_idx" …`, a `migrate deploy` padł: `ERROR: relation "Note_ownerId_idx" already exists` (42P07). Indeks **istniał w bazie** mimo braku `@@index` w schemacie (dryf — wcześniejsza migracja go stworzyła, a `@@index` nigdy nie trafił do schema). Migracja idzie w transakcji, więc padł CAŁY plik (także poprawne `CREATE INDEX` dla Team/ShoppingList zostały wycofane), a migracja wylądowała w stanie *failed* (blokuje kolejne `migrate deploy`).
**Rozwiązanie:** `prisma migrate resolve --rolled-back "0186_owner_indexes"`, potem przepisać migrację na **`CREATE INDEX IF NOT EXISTS`** (idempotentnie pomija istniejące, tworzy brakujące) i ponowny `migrate deploy`. `@@index` zostawiłem w schemacie dla Note — teraz schema odzwierciedla realny stan DB (dryf naprawiony). Zweryfikowane: 9/9 indeksów obecnych, `migrate status` = „up to date".
**Lekcja:** Przed migracją indeksów **sprawdzaj realne indeksy w bazie** (`pg_indexes`/`information_schema`), nie tylko `@@index` w schema.prisma — potrafią się rozjechać. Indeksy w migracjach pisz z **`IF NOT EXISTS`** (idempotentnie), bo `migrate deploy` jest transakcyjny i jedno `already exists` wywala całą partię oraz zostawia migrację w stanie failed (kolejne deploy zablokowane do `migrate resolve`).

## 2026-06-16 — Twarde usunięcie konta (RODO art. 17): SET NULL osierociłby dane, więc kasuj jawnie
**Problem:** `prisma.user.delete()` nie wystarcza do RODO art. 17. Realne reguły FK do `User` (sprawdzone zapytaniem do `pg_constraint`) dzielą się na trzy grupy: **CASCADE** (znika z userem — OK), **RESTRICT** (`Team.ownerId`, `TeamInvitation.invitedById/invitedUserId` — blokują `user.delete()`), i **SET NULL** (Note, Recipe, ShoppingList, Habit, HealthEvent, MedicationSchedule, LanguageDeck, Cookbook, MealPlanEntry, TaskProject, Task, Report). SET NULL jest groźny: po usunięciu usera te osobiste rekordy **zostają w bazie z `ownerId=null`** (osierocone), czyli dane osobowe NIE są usunięte — łamie art. 17. Druga pułapka: sesja to **JWT**, więc usunięcie rekordu User nie unieważnia ciasteczka.
**Rozwiązanie:** `purgeUserData(userId)` (czysta funkcja w `src/lib/privacy/purge.ts`, testowalna lokalnie) w transakcji: (1) usuń RESTRICT-y (zaproszenia), (2) **jawnie skasuj** treści SET-NULL po `ownerId=user`/`authorId=user` (tylko osobiste — dane zespołów mają `ownerId=null`, więc filtr ich nie tknie → izolacja zachowana), zadania w kolejności komentarze/share→zadania→projekty, (3) `user.delete()` (kaskada reszty). `deleteMyAccount` (action) dokłada: potwierdzenie e-mailem, **blokadę gdy user jest właścicielem zespołu** (graceful degradation — przekazanie własności to decyzja usera), i `signOut({redirectTo})` (czyści JWT). `AuditLog` (bez FK, zrzut e-maila) celowo zostaje. Zweryfikowane tymczasowym skryptem na lokalnym Postgresie (user A skasowany w całości, user B i jego zespół nietknięte).
**Lekcja:** Przy „twardym usuwaniu" nie ufaj samej kaskadzie — **odpytaj bazę o realne `confdeltype`** każdego FK do usuwanej encji. `ON DELETE SET NULL` = rekord zostaje osierocony (dla danych osobowych to błąd RODO) → kasuj go jawnie, filtrując po właścicielu osobistym, żeby nie ruszyć danych zespołów. Pamiętaj o strategii sesji: przy **JWT** po usunięciu konta trzeba wymusić `signOut`, bo ciasteczko samo nie wygaśnie.

## 2026-06-16 — IDOR na zadaniach bez projektu (guard tylko `if (task.projectId)`) — audyt Z-052/Z-190
**Problem:** Podczas audytu autoryzacji Server Actions (zalecenia Z-052/Z-190) statyczny skan per-funkcja dał 10 „podejrzanych”, z czego 9 to false-positive (guard przez `auth()`+`where:{userId}`, `hasPermission(ADMIN)`, albo `assertCanEditSkin` — wzorce, których nie łapał mój regex `assert*Access`). Ale 1 był realny i **systemowy**: `Task` nie ma `ownerId` (własność = `projectId` LUB `createdById`/`assigneeId`), a wszystkie mutacje po `id` w `tasks.ts` guardowały tylko `if (task.projectId) assertProjectAccess(...)`. Zadania osobiste (`projectId=null`) omijały kontrolę → każdy zalogowany mógł je edytować/usuwać/przejmować po `id`. `reorderTask` nie sprawdzał właściciela **w ogóle** (tylko `requireAuth`).
**Rozwiązanie:** Helper `assertTaskAccess(task, userId)` w `tasks.ts`: jeśli `projectId` → `assertProjectAccess`; w przeciwnym razie `createdById===userId || assigneeId===userId` (parytet z `getAllUserTasks`), inaczej rzut „Access denied”. Podmieniłem nim wszystkie `if (task.projectId) assertProjectAccess(...)` (getTask, updateTask, updateTaskTags, deleteTask, toggleTaskStatus, addTaskComment, shareTask, shareTaskByEmail, removeTaskShare), dodałem brakujący guard w `completeRecurringTask` i `reorderTask`. tsc/next build/testy zielone.
**Lekcja:** Gdy model NIE ma `ownerId`, a własność jest „przez rodzica LUB pola osobiste”, guard `if (parentId)` jest dziurą dla rekordów bez rodzica — kontrola dostępu musi pokrywać **oba** tory własności i być spójna ze stroną odczytu (ten sam zestaw warunków co `getAll*`). Skan statyczny anty-IDOR ma duży odsetek false-positive (różne, równoważne wzorce guardów) — traktuj go jako „listę do ręcznej weryfikacji”, nie wyrocznię; realnym strażnikiem regresji są testy izolacji (Z-172), nie statyka.

## 2026-06-15 — „Książka” admina jako pliki w repo + pieczenie; równoległe subagenty padają na limicie sesji
**Problem:** Trzeba było dodać obszerny, admin-only dokument („Analiza/Audyt”) wersjonowany w repo (nie w bazie). Dwie pułapki: (1) statyczny HTML w `public/` byłby publiczny (łamie „tylko admin”), a `next build` z `npx` na świeżym klonie ściągał Next 16 zamiast projektowego Next 14 (brak `node_modules` → najpierw `npm install`, potem `./node_modules/.bin/next build`); (2) zrównoleglenie pisania treści przez 5 subagentów `general-purpose` skończyło się tym, że **limit sesji ubił je w trakcie** — z ~22 zaplanowanych rozdziałów na dysk trafił tylko 1, reszta pracy (research) przepadła w transkryptach agentów.
**Rozwiązanie:** Wzorzec jak istniejące `/admin/docs`: źródło = Markdown w `content/audyt/*.md` + `manifest.json`, „upiekłem” je skryptem `scripts/copy-audyt.js` do `src/generated/audyt-book.ts` (wpięte w `build`, commitowane), a trasa `/admin/audyt` (bramka `module.admin`) renderuje aktywny rozdział istniejącym, bezpiecznym `markdownToHtml` (zero surowego HTML). Status rozdziału liczę z obecności pliku → dodanie `.md` = rozdział „gotowy”. Po wpadce z agentami przeszedłem na pisanie bezpośrednie + **commit po każdej partii rozdziałów** (re-bake `copy-audyt.js` + `git add` + commit), żeby kolejny ewentualny limit niczego nie kasował. Przy okazji: renderer `markdown.ts` **już** wspiera `#`–`######` i listy zagnieżdżone — notka w CLAUDE.md była nieaktualna (poprawiona).
**Lekcja:** Dokument „w repo, nie w bazie, tylko dla admina” = pliki Markdown + skrypt pieczący do `src/generated/` + bramkowana trasa renderująca przez `markdownToHtml` (parytet z `/admin/docs`, zero ryzyka runtime-fs i zero publicznego wycieku). Przy dużych zadaniach NIE polegaj na równoległych subagentach jako jedynym nośniku postępu — **commituj przyrostowo**, bo limit sesji potrafi uciąć agenty i ich praca (poza tym, co już zapisali na dysk) znika. Weryfikuj build projektowym Nextem (`./node_modules/.bin/next build` po `npm install`), nie `npx next` (ściąga najnowszy major).

## 2026-06-14 — Zmiana statusu/terminu zadania zamykała otwarte szczegóły/edycję
**Problem:** W `TasksPage` panel szczegółów wyliczał `openTask` wyłącznie z propu `tasks` (lista filtrowana serwerowo). Gdy zmiana statusu lub terminu wypchnęła zadanie z bieżącego widoku (ukończenie w widoku aktywnych, zmiana terminu poza „Dziś"/„Nadchodzące"), `revalidatePath` odświeżał `tasks`, zadania już w nim nie było, `tasks.find` zwracał `undefined`, `openTask` stawał się `null` i panel szczegółów/edycji **zamykał się sam**. Istniał już dokładnie ten sam mechanizm-obejście, ale tylko dla świeżo utworzonych zadań (`justCreated`).
**Rozwiązanie:** Dodano „migawkę" ostatniej znanej wersji otwartego zadania (`openTaskSnapshot`): dopóki zadanie jest w widoku, migawka jest odświeżana; gdy z niego wypadnie, panel pokazuje migawkę zamiast się zamykać (z listy zadanie i tak znika). Migawkę wiążemy z aktualnym `openTaskId` (żeby nie pokazać poprzedniego zadania) i czyścimy przy zamknięciu panelu. Formularz `TaskDetail` i tak trzyma własny stan lokalny, więc edycja działa dalej na poprawnym `task.id`.
**Lekcja:** Panel szczegółów/edycji nie może wyliczać otwartego rekordu wprost z listy filtrowanej serwerowo — każda mutacja, która zmienia przynależność rekordu do widoku, usunie go z listy i zamknie panel. Trzymaj „sticky" referencję otwartego rekordu (ostatnia znana wersja) jako fallback. Gdy w kodzie jest już lokalne obejście dla jednego przypadku (tu `justCreated`), to sygnał, że problem jest ogólniejszy — uogólnij je, zamiast mnożyć łatki.

## 2026-06-08 — Narzędzie „wskazywania" do chrome to był błąd: chrome jest POD modalem
**Problem:** W poprzednim kroku admiński tryb wskazywania (wskaż element → zgłoś) przeniosłem z pływającego FAB do chrome (przycisk w górnym pasku mobile + wpis w panelu admina, na desktopie tylko skrót). Dwa realne błędy: (1) na mobile pasek górny jest **pod modalem** (`fixed inset-0 z-50`), więc przy otwartym modalu przycisku nie dało się kliknąć — a wskazywanie elementu W MODALU to główny przypadek użycia; (2) na desktopie funkcja została bez widocznego wejścia (sam skrót Ctrl+Shift+B), co jest niewykrywalne.
**Rozwiązanie:** Przywróciłem **pływający** przycisk (admin-only), bo tylko on może wynieść się NAD modal. Logika świadoma modali (`useOverlayState`): w spoczynku 44 px nad asystentem, `z-index 39` (asystent 41 może go lekko zasłonić, nigdy odwrotnie), z odstępem; gdy otwarty jest modal treściowy — asystent chowa swój FAB, a ten wskakuje w jego główne miejsce i na `z-index 10001` (nad modalem `z-50`), więc da się kliknąć i wskazać element w modalu. Pływający FAB jest widoczny na desktopie i mobile naraz (rozwiązuje brak wejścia na desktopie). Zepsuty przycisk z górnego paska usunąłem; dzwonek powiadomień ZOSTAJE w chrome (nie ma wymogu działania nad modalem). Wpis w panelu admina + skrót zostały jako dodatkowe wejścia.
**Lekcja:** Element, który z definicji musi działać NAD modalem (overlay-owe „wskaż element", globalne akcje na modalu), NIE może mieszkać w chrome (pasek/sidebar/menu) — chrome renderuje się pod modalem (`z` < 50). Taki trigger musi być pływający z `z-index` ponad warstwą modali (i najlepiej świadomy modali: chować się/relokować). Przenosząc funkcję „z rogu do nawigacji" sprawdź najpierw, czy nie ma ona przypadku użycia wymagającego bycia nad modalem — jeśli ma, zostaje pływająca.

## 2026-06-08 — Trzy FAB-y w jednym rogu: powiadomienia + admin-zgłoszenie wyniesione do chrome
**Problem:** Po dołożeniu (na develop) pływającego dzwonka powiadomień w prawym dolnym rogu zebrały się trzy pływające przyciski (asystent AI, dzwonek, admiński „zgłoś błąd"), a dzwonek i przycisk admina miały **identyczną pozycję** (`right-5`, `bottom-[132px] md:bottom-[84px]`) — kolizja. Sam stos trzech FAB-ów to też zła UX: róg powinien mieć jedną główną akcję.
**Rozwiązanie:** Decyzja UX (wariant „hybryda"): róg = wyłącznie asystent AI. Dzwonek i admiński trigger to elementy *chrome*, nie akcje główne, więc wyszły z rogu do nawigacji. `NotificationBell` zrobiono **osadzalnym** (prop `placement`): `sidebar` → wiersz w stopce sidebara (panel rozwija się W GÓRĘ, `bottom:100%+8px; left`), `topbar` → kompaktowa ikona w górnym pasku mobile (panel W DÓŁ, `top:100%+8px; right`); wrapper zmieniony z `fixed` na `relative`. Renderowany w dwóch miejscach (sidebar desktop + górny pasek mobile) — bezpieczne, bo `syncReminders` jest idempotentne (`upsert` po `dedupeKey`), więc podwójny skan nie duplikuje powiadomień. Admiński „tryb wskazywania" **stracił stały pływający przycisk** — uruchamiają go: skrót Ctrl/Cmd+Shift+B (już był), wpis w panelu admina i admiński przycisk w górnym pasku (mobile), oba przez nową magistralę zdarzeń `feedbackBus` (`window` CustomEvent `omnia:feedback-start` → listener w `FeedbackInspector`, analogicznie do `assistantBus`). `FeedbackInspector` renderuje teraz tylko overlay trybu (podświetlenie + pasek), bez FAB.
**Lekcja:** Powiadomienia i narzędzia admina to *chrome*, nie akcje główne — nie pakuj ich jako FAB do rogu z akcją sygnaturową (jeden róg = jedna akcja). Komponent z własnym panelem zrób osadzalnym (prop `placement` + przełączana kotwica panelu w zależności czy siedzi u góry, czy u dołu ekranu) zamiast zaszywać `position:fixed`. Funkcję bez stałego przycisku da się wygodnie wyzwalać z wielu miejsc lekką magistralą `window`-CustomEvent (taniej niż Context). I zanim wyrenderujesz stanowy komponent w dwóch miejscach naraz — upewnij się, że jego efekt montażu (tu skan terminów) jest idempotentny.

## 2026-06-07 — Quick-add zadania (pole nad listą) dublował logikę tytuł/treść poza asystentem AI
**Problem:** Regułę „pojedynczy tekst → treść, tytuł generowany" wdrożono najpierw tylko w prompcie asystenta AI (`agent/route.ts`). Ale szybkie pole „Dodaj zadanie…" nad listą zadań (`QuickAddTask`) omija asystenta i woła `createTask` bezpośrednio — wrzucało cały wpisany tekst do `title`, a `description` zostawiało puste. Czyli ta sama luka istniała w drugim, niezależnym punkcie wejścia.
**Rozwiązanie:** `QuickAddTask.handleSubmit` traktuje teraz wpisany tekst jako `description` i generuje zwięzły `title` przez nowy route `/api/llm/tasks/title` (wzorzec skopiowany z `/api/llm/notes/title`, op „dispatch"). Fallback offline: lokalny `deriveLocalTitle` (pierwszy wiersz przycięty do ~60 zn.), więc brak LLM nie blokuje dodania. Zachowano wyjątek dla krótkiego, jednowierszowego wpisu (≤50 zn., bez `\n`) — to po prostu sam tytuł (np. „kup mleko"), bez wołania LLM i bez dublowania w opisie — spójnie z regułą wyjątku w prompcie agenta.
**Lekcja:** Reguła UX dotycząca tworzenia rekordu musi być wdrożona w KAŻDYM punkcie wejścia, nie tylko w asystencie AI. Po zmianie zachowania asystenta sprawdź szybkie pola dodawania (QuickAdd*) w modułach — one wołają Server Actions bezpośrednio i łatwo o nich zapomnieć.

---

## 2026-06-07 — AI: pojedynczy tekst przy tworzeniu zadania/notatki = treść, tytuł generowany
**Problem:** Gdy użytkownik dyktuje asystentowi jeden blok tekstu bez wyraźnego rozdzielenia „tytuł" vs „treść", AI wrzucało cały tekst jako tytuł (zwłaszcza dla notatek — `create_note` w katalogu akcji nie miało żadnej wskazówki redakcyjnej), zamiast potraktować go jako zawartość i wygenerować zwięzły tytuł.
**Rozwiązanie:** Zmiana wyłącznie w prompcie agenta (`ACTION_CATALOG_BY_MODULE` w `src/app/api/llm/home/agent/route.ts`) — executor przepuszcza title/description/content 1:1, więc o mapowaniu decyduje model. Do `create_task` i `create_note` dodano regułę „TYTUŁ vs TREŚĆ": jeden tekst → traktuj jako treść (description/content), title wygeneruj jako krótką etykietę; wyjątek dla wyraźnie krótkiego samego tytułu.
**Lekcja:** Reguły mapowania pól przy tworzeniu rekordów przez AI to kwestia promptu, nie kodu — i muszą być spójne między analogicznymi akcjami (to, co dodano dla zadań w 0097, trzeba było replikować dla notatek). Przy dodawaniu wskazówki redakcyjnej dla jednej akcji sprawdź bliźniacze akcje w tym samym katalogu.

---

## 2026-06-08 — Regex z flagą `u` / `\p{...}` wywala build (target TS < es6)
**Problem:** `text.replace(/[^\p{L}\p{N}\s]/gu, " ")` w komponencie nauki języków wywaliło `next build`: „This regular expression flag is only available when targeting 'es6' or later". Repo ma starszy target TS — unicode property escapes (`\p{L}`) i flaga `u` są niedozwolone.
**Rozwiązanie:** zamiast `\p{L}\p{N}` + flaga `u` — usuwanie diakrytyków przez `normalize("NFD").replace(/[̀-ͯ]/g, "")` i strip interpunkcji jawną listą znaków (`/[.,;:!?()…—–\-_"'„"«»]/g`) bez flagi `u`. Polskie litery (ł, ż) zostają, bo nie są dekomponowane przez NFD i nie ma ich na liście interpunkcji.
**Lekcja:** w tym repo NIE używaj flagi regex `u` ani `\p{...}` (target TS to blokuje, podobnie jak iterację po Map). Diakrytyki: NFD + `[̀-ͯ]`. Interpunkcja: jawna lista znaków, nie `\P{L}`.

---

## 2026-06-07 — Iteracja po `Map`/`Set` wywala build (target TS) + lokalny Postgres jako weryfikowalny build w sandboxie
**Problem:** (1) `for (const [k, v] of someMap)` w akcji serwerowej wywaliło `next build`: „Map can only be iterated through with '--downlevelIteration' or '--target' es2015+". Konfiguracja TS repo na to nie pozwala. (2) Realny problem przekrojowy: w sandboxie web nie ma `DATABASE_URL`, więc `npm run build` (który kończy się `scripts/migrate.js` = `prisma migrate deploy`) zawsze padał — nie dało się zweryfikować zmian.
**Rozwiązanie:** (1) zamiast iterować po `Map` użyj `Array.from(map.values())` (lub `.entries()` opakowane w `Array.from`). (2) Postawiono lokalny Postgres 16 (jest w obrazie, `pg_ctlcluster 16 main start`), rola+baza `omnia/omnia_dev`, `.env.local` z `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate deploy` zaaplikował wszystkie migracje. Od tego momentu pełny `npm run build` przechodzi lokalnie i każda zmiana jest weryfikowalna — bez dotykania produkcji.
**Lekcja:** Nie iteruj bezpośrednio po `Map`/`Set` w tym repo — `Array.from(...)`. A gdy trzeba realnie zbudować/odpalić appkę w sandboxie, postaw lokalny Postgres i wskaż go w `.env.local` zamiast walczyć z brakiem bazy (eksportuj te zmienne też do shella, bo `scripts/migrate.js` nie ładuje `.env.local`).

---

## 2026-06-07 — „Spaghetti" wymagań: zadania odwołujące się do starszych raportów, których stan już się zdezaktualizował
**Problem:** Dwa zgłoszenia administratora (marketplace Fixly/Booksy + „dokończ wskazania raportu architektury 2026-05-31") zazębiały się i odwoływały do raportów sprzed tygodnia. Raporty luk (`omnia-luki-wdrozeniowe-2026-06-01`) opisywały stan na 01.06, a od tego czasu doszły całe moduły (Magazynowanie, Warsztaty, Wiadomości, Pogoda, Skiny) i przebudowa asystenta na czat — więc backlog liczony „z pamięci/ze starego raportu" byłby fałszywy. Ryzyko: zaplanować implementację rzeczy już zrobionych lub odwrotnie.
**Rozwiązanie:** Zanim cokolwiek zaplanowano, **zweryfikowano każdą sporną pozycję bezpośrednio w kodzie** (grep modeli `Notification`/`Contact`/`Service*`, odczyt `src/actions/calendar.ts` pod kątem agregowanych źródeł, lista komponentów `tasks/`). Powstał jeden scalający raport `omnia-master-plan-domkniecie-2026-06-07` z kolumną statusu ✅/🟡/❌ **opartą na audycie kodu**, a nie na poprzednich raportach. Treść raportu trzymana w pliku `docs/reports/<slug>.md` i **generowana z niego** do migracji seedującej skryptem (jedno źródło prawdy, brak rozjazdu plik↔baza). Dollar-quoting `$omnia_master_plan$` + walidacja braku kolizji znacznika w treści przed zapisem.
**Lekcja:** Gdy zadanie odwołuje się do starszego raportu „co zostało do zrobienia", NIGDY nie ufaj jego statusom wprost — zweryfikuj w kodzie aktualny stan (migracje potrafią wyprzedzić raporty o tygodnie). Przy raportach kopiowanych do migracji generuj SQL z pliku md skryptem, nie ręcznie, i sprawdzaj kolizję dollar-tagu.

---

## 2026-06-07 — Współistnienie pływających przycisków (asystent vs admin-zgłoszenie) i ich zachowanie nad modalami
**Problem:** Admiński FAB „zgłoś błąd" (robaczek) nakładał się na magiczną ikonę asystenta i — bo był później w DOM przy równym `z-40` — **zasłaniał ją** (miało być odwrotnie: główna akcja na wierzchu). Dodatkowo oba FAB-y mają sens nad modalem (admin musi móc wskazać element w modalu), ale przy `z-40` chowały się pod nakładkami modali (`z-50`), a magiczna ikona nie powinna być w ogóle dostępna „dialog na dialogu".
**Rozwiązanie:** Wspólny hook `useOverlayState` (`src/hooks/useOverlayState.ts`) z `MutationObserver` na `document.body` wykrywa otwarte nakładki. Modale w tej apce **nie ustawiają `role="dialog"`** — dzielą wzorzec `fixed inset-0 z-50+`, więc detekcja idzie po selektorze klas `[class~="fixed"][class~="inset-0"]`. Nakładki, które NIE są „modalami treściowymi" (sam asystent, menu mobilne, `ActionDrawer`) oznaczyłem `data-omnia-overlay` i wykluczam z detekcji. Hierarchia: magiczna ikona `z-index 41` (nad adminem 39, z odstępem — magiczna może lekko zasłonić admina, nigdy odwrotnie). Gdy otwarty **modal treściowy**: magiczną ikonę chowamy, a admiński FAB skacze w główne miejsce po niej i nad modal (`z-index 10001`). Gdy otwarty **asystent**: admiński FAB chowamy (by nie zasłaniał), a overlay asystenta + `ActionDrawer` podniosłem do `z-index 9990/9991`, żeby asystent otwarty z trybu wskazywania renderował się NAD modalem, z którego admin wskazał element (kontekst i tak jest już przechwycony jako tekst).
**Lekcja:** Gdy modale nie mają wspólnego `role`/markera, detekcję „czy jest otwarty modal" oprzyj na ich realnym wspólnym wzorcu klas (`fixed inset-0`) przez `MutationObserver`, a wyjątki (własne nakładki) wyklucz znacznikiem `data-*` zamiast oznaczać 30+ modali. Przy stosie pływających przycisków ustal jawną hierarchię `z-index` (główna akcja > pomocnicza) — nie polegaj na kolejności w DOM. I uważaj na podnoszenie `z-index` nakładki, która ma „dzieci-modale" (tu `ActionDrawer` jeździ na asystencie): podnieś je razem, inaczej dziecko zniknie pod rodzicem.

## 2026-06-07 — Admin „tryb wskazywania" do zgłaszania błędów: otwieranie self-contained chatu z zewnątrz + przechwytywanie kliknięć
**Problem:** Admin miał móc włączyć tryb, kliknąć dowolny element UI, a aplikacja miała rozpoznać „miejsce" i otworzyć asystenta (`AICommandSheet`) z gotowym kontekstem, by z opisu admina zrobić zadanie w projekcie „Omnia". Dwie trudności: (1) `AICommandSheet` trzyma cały stan lokalnie (`isOpen`, wątek) i jest montowany raz w `AppShell` — nie było żadnego mechanizmu otwarcia go z innego komponentu; (2) w trybie wskazywania klik musi podświetlać element i być przechwycony, ale NIE może wywołać normalnej akcji aplikacji (np. nawigacji).
**Rozwiązanie:** (1) Lekka **magistrala zdarzeń** `window` (`src/lib/ai/assistantBus.ts`, `openAssistant({feedbackContext})` → `CustomEvent("omnia:assistant-open")`) zamiast refaktoru na React Context — `AICommandSheet` dodaje jeden `useEffect` z listenerem, który otwiera sheet i seeduje wątek kartą „co trafiło do kontekstu". Tryb zgłoszenia trzymany w `useRef` (nie state), bo `handleSend` i listener muszą widzieć aktualną wartość bez re-bindu; pierwsza wiadomość admina jest opakowywana w prompt „utwórz JEDNO zadanie w projekcie Omnia, tytuł wygeneruj z opisu" i leci zwykłą ścieżką agent→plan→`ActionDrawer` (zero zmian w agencie/executorze — `create_task` + `projectName:"Omnia"` już działały; `ensureOmniaProject()` tworzy projekt z góry). (2) `FeedbackInspector` (montowany w `AppShell` tylko gdy `isAdmin`) zakłada listenery `pointermove`/`click`/`keydown` w **fazie capture** (`addEventListener(..., true)`) i robi `preventDefault()+stopPropagation()` — dzięki capture łapie zdarzenie zanim dojdzie do handlerów aplikacji. Własny UI (pasek/anuluj) oznaczony `data-feedback-ui` i pomijany w handlerach, żeby dało się go kliknąć.
**Lekcja:** Żeby sterować komponentem o lokalnym stanie z zewnątrz bez przebudowy drzewa — wystarczy `window` CustomEvent + jeden listener w środku (tańsze niż Context/lifting state). Do globalnego „inspect mode" przechwytuj zdarzenia w **fazie capture** z `stopPropagation`, inaczej klik odpali akcje aplikacji; a własne kontrolki overlay’a wyklucz znacznikiem (`data-*`). I gdy się da, podłączaj nową funkcję pod istniejący pipeline (agent→plan→ActionDrawer) zamiast dorabiać równoległą ścieżkę — tu cała „twórczość" to tylko dobrze sformułowany prompt.

## 2026-06-06 — Daty w podglądzie akcji asystenta: surowy ISO zamiast formatu dla człowieka
**Problem:** Zadanie „Prezentacja daty w Magicznej ikonie" miało **pusty opis** — zrozumiałem je błędnie (data w nagłówku asystenta) i zaimplementowałem nie to. Właściwy cel: w podglądzie wykrytych akcji (`ActionDrawer`) parametry-daty pokazywały się jako **surowy string ISO z JSON-a** (`2026-06-08T00:00:00.000Z`), bo edytor renderował każdy parametr jednolicie jako `String(v)` w zwykłym `<input>`. Format maszynowy, nieczytelny i niewygodny do edycji.
**Rozwiązanie:** W `ActionDrawer` wykrywam wartości-daty **po wartości** (regex ISO + walidacja `new Date`), nie po nazwie klucza — działa dla dowolnego pola (`dueDate`/`scheduledAt`/`expiresAt`…) bez listy nazw. Render natywnym pickerem: `datetime-local` gdy jest znaczący czas, `date` dla samej daty/północy (`T00:00:00Z` to typowo termin dzienny). Picker pokazuje datę w formacie lokalnym (pl) + etykieta `toLocaleDateString("pl-PL", …)`. Dla daty bez czasu `Date` budowany lokalnie (`new Date(y,m-1,d)`), by dzień się nie przesuwał. Picker oddaje `YYYY-MM-DD`/`YYYY-MM-DDTHH:mm` — backend i tak robi `new Date(String(...))`, więc executor bez zmian. Błędną pierwszą zmianę wycofałem `git revert`; błędny raport (migracja 0095) zastąpiłem nową migracją 0096 (DELETE starego wiersza + INSERT właściwego), bo **migracje są append-only** — nie usuwa się zastosowanych plików, korektę robi się nową migracją.
**Lekcja:** Gdy zadanie ma pusty/niejasny opis — dopytaj zanim zaimplementujesz, zwłaszcza przy ogólnikowym tytule („prezentacja X"). Daty z JSON-a (ISO) nigdy nie pokazuj userowi jako stringa — wykrywaj je po wartości i renderuj natywnym `date`/`datetime-local` (lokalny format + edycja), pamiętając o budowaniu daty bez czasu lokalnie (inaczej strefa przesuwa dzień). A poprawki już wypchniętych migracji/seedów rób **nową** migracją (DELETE+INSERT), nie edycją/usuwaniem starej — bo `prisma migrate deploy` śledzi je po nazwie.

## 2026-06-06 — Opis zadania tworzonego przez AI: wierne przepisanie zamiast streszczenia
**Problem:** Gdy użytkownik dyktował zadanie asystentowi AI (krok „plan" → `ActionDrawer` → `create_task`), pole `description` nowego zadania bywało puste albo streszczone — model gubił fakty, liczby i szczegóły z oryginalnej wypowiedzi. Oczekiwanie: opis ma zawierać DOKŁADNIE to, co padło jako treść zadania, jedynie lekko zredagowane (forma bezosobowa, gramatyka), bez streszczania i bez zmiany znaczenia.
**Rozwiązanie:** `description` trafia 1:1 do `Task.description` (executor nic z nim nie robi), więc to czysto kwestia promptu. W katalogu akcji `tasks` (`buildActionCatalog` w `agent/route.ts`) przy `create_task` dodano wyraźną regułę: `description` = wierne przepisanie treści polecenia, dozwolona tylko lekka redakcja (bezosobowość + gramatyka/interpunkcja), zakaz streszczania/skracania/pomijania faktów; `title` zostaje krótką etykietą. Pominięcie `description` tylko gdy user podał sam tytuł.
**Lekcja:** Gdy pole z akcji AI ma być „wierną kopią wypowiedzi", nie zakładaj że model sam to zrobi — domyślnie streszcza. Trzeba w prompcie jawnie rozdzielić rolę pól (krótki `title` vs pełny `description`) i wprost zabronić streszczania/pomijania faktów. Najpierw sprawdź, czy executor przepuszcza wartość bez modyfikacji — jeśli tak, naprawa jest wyłącznie w prompcie, nie w kodzie.

## 2026-06-06 — System skórek (motywów) bez FOUC i z bezpiecznym aplikowaniem zmiennych CSS
**Problem:** Aplikacja miała jeden zahardkodowany ciemny motyw (`<html class="dark">`, zmienne w `:root`). Trzeba było dodać 5 skórek systemowych (w tym jasną) + skórki użytkownika (zapis/współdzielenie/reużycie), tak by zmiana motywu była natychmiastowa, bez migotania, a dane skórki (kolory wpisywane przez usera) nie mogły wstrzyknąć się do CSS. Dodatkowo ~30-40% komponentów hardkodowało `color: "#fff"` na przyciskach akcentowych — to nie był token, więc skórka nie mogła nim sterować.
**Rozwiązanie:** Skórka = **częściowa mapa `zmienna CSS → wartość`** trzymana w DB (`Skin.tokens` jako JSON string). Aplikowana **inline na `<html>`** w `layout.tsx` (server component) — element `<html>` JEST `:root`, więc inline style nadpisuje reguły `:root` z `globals.css` najwyższym priorytetem i jest w pierwszym HTML-u (zero FOUC). Pominięte zmienne dziedziczą domyślne ciemne wartości → skórka „Ciemny" to po prostu `{}`. `color-scheme`, `--font-size-base` (gęstość) i `--radius` też zrobione tokenami; ikonę natywnego date-pickera (jasny SVG) zawężono do `html[data-skin-scheme="dark"]`, bo na jasnej skórce była niewidoczna. Bezpieczeństwo: każda wartość przechodzi `sanitizeTokenValue` (whitelista kluczy + regex na hex/rgb()/px/`light|dark` + twarda blokada `;{}<>`), więc nie da się wyjść z deklaracji inline-style. Sweep: `color: "#fff"` → `var(--on-accent)` w 67 plikach (perl -pi), bo to był zawsze tekst na akcencie.
**Lekcja:** Do motywowania bez migotania aplikuj zmienne CSS **inline na elemencie `<html>`** (to `:root`), renderowane po stronie serwera — nie potrzeba osobnych plików CSS per-motyw ani klas, a pominięte zmienne automatycznie dziedziczą domyślne. Gdy user wpisuje wartości lądujące w inline-style, **zawsze** waliduj whitelistą kluczy + regexem wartości (blokuj `;{}<>`), inaczej masz wektor CSS-injection. I tokenizuj nie tylko tła/teksty, ale też `color: #fff` na akcentach (→ `--on-accent`) — bez tego jasne motywy się sypią.

## 2026-06-06 — Otwieranie panelu nowego zadania w widokach wirtualnych: optymistyczny fallback
**Problem:** Po szybkim dodaniu zadania (`QuickAddTask`) panel szczegółów miał się otwierać, by ustawić resztę parametrów. Działało na liście projektu, ale w widokach wirtualnych (Dziś/Nadchodzące/Zaległe) nowe zadanie trafia do Skrzynki bez terminu, a te widoki filtrują `tasks` po `dueDate` na serwerze — więc świeże zadanie nie wchodziło do listy. `openTask = tasks.find(id)` zwracało `null` i panel się nie otwierał.
**Rozwiązanie:** `createTask` już zwraca pełny obiekt zadania, więc `QuickAddTask` przekazuje go w callbacku `onCreated(task)` (nie samo `id`). `TasksPage` trzyma go w stanie `justCreated` i używa jako **fallback**: `openTask = tasks.find(id) ?? (justCreated.id===id ? justCreated : null)`. Panel otwiera się zawsze; gdy rewalidacja dociągnie zadanie do `tasks` (np. po ustawieniu terminu na dziś), `tasks.find` wygrywa jako świeższe źródło. `justCreated` czyszczone efektem `if (!openTaskId) setJustCreated(null)` — łapie każdą ścieżkę zamknięcia (X, Esc, wstecz/popstate, usunięcie). Bezpieczne, bo `TaskDetail` trzyma własny stan i re-synchronizuje tylko przy zmianie `task.id`, więc stały (potencjalnie nieaktualny) obiekt fallbacku nie nadpisze edycji użytkownika.
**Lekcja:** Gdy element UI (panel/podgląd) renderuje się tylko gdy encja jest w przefiltrowanej liście, a właśnie ją utworzyłeś — nie zakładaj, że rewalidacja wstawi ją do tej konkretnej listy (filtry serwerowe mogą ją wykluczyć). Przekaż zwrócony obiekt i użyj go jako optymistycznego fallbacku, preferując świeższą wersję z listy. I czyść taki stan jednym efektem na `null`-owanie klucza, zamiast w każdym handlerze zamknięcia z osobna.

## 2026-06-05 — Per-lista statusy w widokach ZBIORCZYCH: scal konfigurację + rozwiązuj per-zadanie
**Problem:** Po wdrożeniu własnych statusów per-lista zadanie z takim statusem w widokach obejmujących wiele list (Wszystkie/Dziś/Nadchodzące/Zaległe/Grupy) było widoczne tylko w zakładce „Wszystkie" (brak zakładki dla custom-statusu), a w panelu szczegółów dropdown pokazywał surowe `id` zamiast nazwy. Przyczyna: strona dla widoków wirtualnych przekazywała `DEFAULT_STATUS_CONFIG` (bez własnych statusów), a `statusMetaFor` na nieznanym kluczu zwraca fallback `label = key`. Dodatkowo `TASK_INCLUDE` nie pobierał `project.statusConfig`, więc komponenty nie miały skąd wziąć właściwej konfiguracji per zadanie. Drugi, ukryty błąd: przeniesienie zadania do innej listy „osieracało" custom-status (docelowa lista go nie zna).
**Rozwiązanie:** (1) `aggregateStatusConfig(projects, tasks)` scala definicje własnych statusów ze wszystkich list w zakresie (klucze `c_<rand>` są globalnie unikalne) i dokłada do zakładek tylko te custom, które realnie występują wśród zadań; strona używa go dla widoków wirtualnych (realny projekt nadal swojej konfiguracji). (2) `TASK_INCLUDE.project` pobiera `statusConfig`, a `TaskRow`/`TaskDetail` rozwiązują status względem WŁASNEJ listy zadania (`task.project.statusConfig`), nie konfiguracji strony — dropdown pokazuje statusy właściwej listy, nie obce. (3) `updateTask` przy zmianie `projectId` resetuje osierocony custom-status do pierwszego włączonego statusu celu (statusy systemowe są uniwersalne, zostają).
**Lekcja:** Funkcja „per-lista X" prawie zawsze ma drugą połowę: widoki ZBIORCZE, które łączą wiele list. Zaprojektuj od razu dwie ścieżki — scaloną konfigurację dla nagłówków/zakładek/filtrów ORAZ rozwiązywanie per-element wg encji-źródła (zadanie zna swój projekt). I pamiętaj o przenoszeniu między listami: wartość zależna od listy (status, kategoria) musi być re-walidowana wobec celu, inaczej osierocieje.

## 2026-06-05 — Własne statusy zadań per-lista bez migracji DB (rozszerzenie JSON-a)
**Problem:** Statusy zadań były 6 zaszytych wartości (`SYSTEM_TASK_STATUSES`), a `TaskStatus` to ścisły union używany w całym module. Trzeba było pozwolić użytkownikowi dodawać/usuwać własne statusy (systemowe tylko włączać/wyłączać), z nazwą/kolorem/ikoną/flagą „zamykający". Kuszące było dodanie modelu `TaskStatus` w Prisma — ale `Task.status` to już `String`, a konfiguracja statusów listy już siedzi w polu JSON `TaskProject.statusConfig`.
**Rozwiązanie:** Dołożyłem `custom: CustomTaskStatus[]` do tego samego JSON-a (zero migracji). `ProjectStatusConfig.enabled/chain` rozluźnione z `TaskStatus[]` do `string[]` (klucze custom `c_<rand>` się mieszczą). Nowe resolwery `resolveStatuses`/`statusMetaFor(key, config)` zastąpiły zaszyte `statusMeta`/`STATUS_ICONS`/`TASK_STATUS_FILTER_LABELS` w renderze (TaskRow/Filters/List/Detail/Page) — wszystkie biorą metadane z konfiguracji listy. Blokada usunięcia w użyciu: server action liczy `task.count({ projectId, status: key })` dla usuwanych kluczy. Ikony przez mały rejestr `StatusIcon.tsx` (nazwa→komponent Lucide).
**Lekcja:** Gdy „rozszerzalna lista" już ma konfigurację w polu JSON, dokładaj do tego JSON-a, nie nową tabelę. Przy poszerzaniu ścisłego unionu (`TaskStatus`→`string`) jedno miejsce psuje build kaskadą — zrób centralny resolwer (`statusMetaFor`) i przekazuj `config` w dół zamiast importować zaszyte stałe. I uważaj przy czyszczeniu importów ikon: usunięcie `Clock` z importu wywaliło build, bo był jeszcze użyty przy „szacowanym czasie" — sprawdź `grep -oE '<Ikona\b'` przed wycięciem.
## 2026-06-05 — „Widoki" → „Grupy projektów" wplecione w listę projektów (i @@map zamiast rename tabeli)
**Problem:** Zapisane „Widoki wielu projektów" działały, ale użytkownik myślał o tym jako o **grupach projektów** żyjących w samej liście projektów (grupa = folder, który rozwijasz i klikasz po wspólny widok), a osobna sekcja „Widoki" nie trafiała w tę intuicję. Trzeba było zmienić prezentację i nazwę pojęcia bez ryzykownej migracji już-wdrożonej (na `develop`) tabeli.
**Rozwiązanie:** Model danych został ten sam (wiele-do-wielu, `projectIds` JSON) — tylko przemianowany w kodzie `TaskView` → `ProjectGroup` przez Prisma **`@@map("TaskView")`**, więc tabela w DB się nie zmienia (zero ALTER TABLE RENAME, zero ryzyka na żywym środowisku); migracja dodaje jedynie kolumnę `color`. Sidebar przebudowany: grupy jako rozwijalne **foldery** nad listą projektów (chevron + stan rozwinięcia w localStorage `tasks.groups.expanded`), klik w grupę → wspólny widok `/tasks/multi?group=<id>`, a przy każdym projekcie dyskretny **znacznik przynależności** (kropki w kolorze grup, tooltip z nazwami) — widać obie strony relacji (grupa→projekty po rozwinięciu, projekt→grupy po kropkach). Reużyte wzorce: chevron z `TaskGroup`/`NoteGroupSection`, persist localStorage z `MealPlanWeek`/`NotesPage`, kolor grupy jak `NoteGroup.color`.
**Lekcja:** Gdy zmiana jest głównie **konceptualno-prezentacyjna** (zmiana nazwy encji, inny układ), a model danych zostaje — przemianuj w kodzie przez `@@map`, nie ruszaj nazwy tabeli (rename na wdrożonej DB to zbędne ryzyko). I projektując nawigację: jeśli użytkownik mówi „to ma być w liście X jako element Y", oddaj dokładnie tę strukturę (foldery w liście), zamiast trzymać to w osobnej sekcji — intuicja > elegancja osobnego panelu.

## 2026-06-04 — Widok wielu projektów: trwały + samoopisowy zamiast „na sesję"
**Problem:** Pierwsza wersja widoku wielu projektów trzymała wybór projektów tylko w URL (`?projects=a,b`) generowanym z trybu zaznaczania w sidebarze — czyli de facto „na sesję", bez możliwości zapisania i nazwania zestawu. Dodatkowo nagłówek pokazywał tylko „🗂 Wiele projektów (2)", więc użytkownik widział zadania, ale NIE wiedział, z których projektów pochodzą (a przy `groupBy=priority` z localStorage znikały też nagłówki grup per-projekt).
**Rozwiązanie:** Wprowadziłem trwały model `TaskView` (per-user, `projectIds` jako JSON string[]) + CRUD w `taskViews.ts`; sidebar dostał sekcję „Widoki" z inline edytorem (nazwa + emoji + checkboxy projektów) i hover edit/delete — wiele nazwanych widoków na stałe. Trasę `/tasks/multi` rozszerzyłem o `?view=<id>` (obok back-compat `?projects=`). Kluczowy fix UX: zawsze widoczny „pasek zakresu" pod nagłówkiem z chipami projektów (klik → pojedynczy projekt), niezależny od trybu grupowania — odpowiada na pytanie „z czego to jest" bez polegania na nagłówkach grup.
**Lekcja:** „Pokaż kilka X naraz" prawie zawsze znaczy też „zapisz ten zestaw" — rób od razu trwałą, nazwaną encję per-user (wzorzec JSON-string listy id jak `statusConfig`/`UserMenuPref`), nie stan w URL/sesji. I dla każdego widoku-agregatu dodawaj jawny, zawsze widoczny opis zakresu (chipy), bo grupowanie bywa przełączane i samo nie wystarcza.

## 2026-06-04 — Względny bump priorytetu zadań w asystencie (i backtick w template literalu)
**Problem:** Magiczna ikona przy „podnieś priorytet o 1 dla zadań X, Y, Z" musiała przez `update_task` ustawić bezwzględną wartość priorytetu — LLM zgadywał wspólny poziom i gubił to, że każde zadanie miało INNY priorytet wyjściowy (powinien wzrosnąć o 1 względem siebie). Przy okazji dodając opis akcji do katalogu w `agent/route.ts` wkleiłem `` `steps` `` z backtickami WEWNĄTRZ template literala (katalog akcji to jeden wielki backtick-string) → `next build` padał na „Syntax Error" w SWC bez czytelnego wskazania linii.
**Rozwiązanie:** Dodałem dedykowaną akcję `shift_task_priority { steps, taskId? }` analogiczną do `shift_task_due_date` — executor czyta obecny priorytet zadania i przesuwa go o `steps` po drabinie NONE<LOW<MEDIUM<HIGH<URGENT z klampem do zakresu. Dzięki temu LLM proponuje osobny shift per zadanie i nie musi znać/zgadywać wartości wyjściowych. Backticki w opisie zamieniłem na cudzysłowy.
**Lekcja:** Operacje „o N względem obecnego" rób jako osobny typ akcji liczony po stronie executora (jak shift due-date), nie każ LLM-owi liczyć delty na wartościach bezwzględnych. I NIGDY nie używaj backticków w stringach katalogu akcji — cały katalog to template literal, wewnętrzny backtick zamyka go i wywala build dopiero w SWC.

## 2026-06-04 — Lokalna weryfikacja buildu bez prod-DB i bez Prisma 7
**Problem:** `npm run build` kończy się `node scripts/migrate.js`, który robi `prisma migrate deploy` na PRAWDZIWEJ bazie (Neon) — nie wolno tego puszczać lokalnie. Do tego `datasource.provider = "postgresql"`, więc obiecywany w docsach SQLite (`file:./dev.db`) nie zadziała wprost z `db:push`. Dodatkowo `npx prisma generate` bez zainstalowanych `node_modules` ściąga Prisma 7, która odrzuca składnię `url`/`directUrl` ze schematu Prisma 5 (P1012).
**Rozwiązanie:** Najpierw `npm install` (postinstall sam odpala lokalną Prisma 5 `generate` i waliduje schemat). Do sprawdzenia kodu wystarczy podzbiór pipeline'u: `node scripts/check-action-coverage.js` + `npx next build` z dowolnymi (atrapowymi) `DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET` — strony są `force-dynamic`, więc build nie odpytuje bazy (błędy `UntrustedHost` przy prerenderze są nieszkodliwe). Pomijamy `migrate.js`.
**Lekcja:** „Sprawdź build" lokalnie = `next build`, nie pełne `npm run build` (które dotyka prod). Zawsze używaj lokalnej Prisma z `node_modules` (po `npm install`), nie globalnego `npx prisma`.

## 2026-06-04 — Generyczny harmonogram leków = jedna tabela z `kind` (MEDICATION|CARE)
**Problem:** Wymaganie „poddział leki + dawkowanie, ale na tej samej zasadzie zmiana opatrunku/paznokcie" mogło skusić do dwóch osobnych modeli albo do per-modułowego silnika cykliczności.
**Rozwiązanie:** Jeden model `MedicationSchedule` z polem `kind` i „płaską" cyklicznością (`freqType` DAILY/WEEKLY/HOURLY + `interval` + `daysOfWeek` CSV + `timesOfDay` JSON + okno `startDate/endDate`), rozwijaną do slotów przez czysty helper `src/lib/medicationSchedule.ts` (reużywa `habitStats`: `isoDate`/`parseDays`). Ten sam helper karmi agendę „na dziś", Kalendarz i read-tool AI — bez duplikacji logiki dni/godzin.
**Lekcja:** Gdy „dwie rzeczy działają na identycznej zasadzie", różnicuj je polem-dyskryminatorem, a logikę trzymaj w jednej czystej funkcji współdzielonej przez UI/serwer/AI. Dzień licz LOKALNIE ("YYYY-MM-DD") jak Nawyki, nie w UTC.

## 2026-06-04 — Polski cudzysłów „…" w stringu JS rozwala build (swc: „Expected unicode escape")
**Problem:** Dwukrotnie przy edycji promptów/tekstów wstawiłem `„tekst"` w środku stringa JS w podwójnych cudzysłowach (`"… „od czego zacząć".\n"`). Prosty `"` (U+0022) po polskim otwierającym `„` PRZEDWCZEŚNIE zamyka string, a dalszy `\n` daje błąd składni `Expected unicode escape`. swc wskazywał mylną linię (np. 9:1 albo środek innego stringa), co utrudniało namiar.
**Rozwiązanie:** W literałach JS używaj polskiego cudzysłowu zamykającego `”` (U+201D), nie prostego `"`: `„od czego zacząć”`. Alternatywnie escape `\"` albo backticki. Przy zagadkowym „Expected unicode escape"/„Syntax Error" w pliku z polskim tekstem szukaj prostego `"` wewnątrz `"…"`.
**Lekcja:** Polski tekst w stringach JS = pole minowe na proste cudzysłowy. Trzymaj się pary `„ … ”` (curly) w treści, a `"` rezerwuj na granice stringa. To powtórka — wpisane, by nie tracić czasu trzeci raz.

## 2026-06-04 — Rozrost asystenta: katalog akcji vs executor i odchudzanie promptu
**Problem:** „Magiczna ikona" ma ~90 akcji opisanych w wielkim stringu-katalogu (`agent/route.ts`) i wykonywanych łańcuchem `if` (`execute/route.ts`) — utrzymywane w dwóch miejscach, łatwo o rozjazd (agent proponuje akcję, której executor nie zna → „Nieznany typ akcji" w runtime). Dodatkowo cały katalog (~4k tokenów) leciał w KAŻDEJ iteracji pętli, podbijając koszt/latencję.
**Rozwiązanie:** (1) `scripts/check-action-coverage.js` w buildzie pilnuje, że każdy typ z katalogu ma obsługę w executorze (statycznie, bez DB). (2) Katalog rozbity per-moduł + tani router (op „dispatch") wybiera moduły istotne dla polecenia i wstrzykuje tylko ich sekcje. KLUCZOWE: router ma fallback do pełnego katalogu (błąd/pusto/≤3 moduły) i zawsze dorzuca moduł podstawowy — w najgorszym razie zachowanie = jak przed zmianą (zero regresji).
**Lekcja:** Gdy dwie powierzchnie (prompt-katalog i dispatcher) muszą być zgodne — dodaj tani guard w buildzie, nie licz na pamięć. Optymalizując prompt LLM przez „selekcję kontekstu", zawsze zostaw bezpieczny fallback do pełnego kontekstu, żeby błąd selekcji nie psuł funkcji, a jedynie nie dawał oszczędności.

---

## 2026-06-03 — Magiczna ikona pokazywała surowe id w parametrach akcji (tryb agenta)
**Problem:** Zgłoszenie dotyczyło starej (sprzed przebudowy) magicznej ikony: dodanie produktu do listy zakupów pokazywało akcję z parametrem `id`, który nic nie mówi użytkownikowi. Weryfikacja obecnej implementacji: tryb prosty (`interpret`→`execute`) jest czysty — prompt emituje wyłącznie nazwy (`listName`, `projectName`, `vehicleName`, …) + `searchQuery`, a backend rozwiązuje je na id. ALE tryb **agenta** (`/api/llm/home/agent`) wciąż mógł odtworzyć ten błąd: `ACTION_CATALOG` jawnie instruował model, by „CELOWAĆ w konkretne rekordy przez id z wyników (taskId/itemId/noteId/listId)", a te surowe cuid trafiały do `ActionDrawer` i były pokazywane użytkownikowi (read-only, ale wciąż nieczytelne).
**Rozwiązanie:** Nie tykamy backendu (resolvery id-first z fallbackiem po nazwie są zweryfikowane pod kątem bezpieczeństwa — id z klienta nigdy nie jest ufane, Server Action asertuje dostęp). Zamiast tego: (1) `ActionDrawer` w ogóle nie renderuje parametrów `*Id` — i tak przechodzą dalej do backendu dla precyzyjnego namiaru, więc nic nie tracimy, a użytkownik nie widzi śmieci; (2) prompt agenta każe dla każdej akcji celującej w istniejący rekord ZAWSZE wypełnić czytelny `searchQuery` (nazwa/tytuł) obok opcjonalnego id — to ten tekst widzi użytkownik. Precyzja namiaru zachowana, czytelność naprawiona.
**Lekcja:** Po przebudowie funkcji weryfikuj zgłoszenie na ŻYWYM kodzie, a nie na opisie sprzed zmiany — bug mógł przewędrować do innej ścieżki (tu: z trybu prostego do trybu agenta). Identyfikatory techniczne to detal backendu; trzymaj je z dala od warstwy prezentacji, zamiast pokazywać „read-only". Naprawiaj na najwęższej możliwej warstwie (UI + prompt), nie ruszając zweryfikowanej logiki dostępu.

---

## 2026-06-03 — Streaming odpowiedzi agenta przy protokole JSON-tool-loop (SSE)
**Problem:** Asystent (magiczna ikona) działa w pętli „LLM zwraca JSON ze `step` → wykonaj narzędzia → powtórz". Chcieliśmy strumieniować odpowiedź (UX jak w topowych asystentach), ale prawdziwy streaming tokenów koliduje z protokołem JSON — nie da się renderować częściowo sparsowanego obiektu `{ "step": "answer", "answer": "…ucięte" }`.
**Rozwiązanie:** Nie strumieniujemy tokenów finalnej odpowiedzi (to wymagałoby porzucenia JSON-a). Zamiast tego wydzieliliśmy pętlę do `runAgentLoop(messages, userId, onThought?)` i strumieniujemy **myśli pośrednie na żywo** przez SSE: każda iteracja, gdy jej JSON się sparsuje, woła `onThought(thought)`, a klient (czytnik `res.body.getReader()` + split po `\n\n`) pokazuje „Sprawdzam zadania… / Szukam w internecie…". Finalny wynik leci jako zdarzenie `{type:"final", body}`. Tryb nstrumieniowy to ta sama pętla z `body.stream=true` zwracająca `new Response(ReadableStream, {headers: text/event-stream})`; tryb zwykły (JSON) został nietknięty jako fallback. Klient degraduje do JSON, gdy `content-type` nie jest `event-stream` (np. proxy zbuforuje SSE).
**Lekcja:** Przy protokole JSON-tool-loop strumieniuj **postęp/rozumowanie**, nie tokeny finalnego pola — to daje 90% odczucia „na żywo" bez łamania parsowania. Zawsze zostaw nieblokujący fallback do trybu jednorazowego (JSON), bo SSE bywa buforowane przez warstwy pośrednie (Render). Jedna implementacja pętli, dwa opakowania (JSON / SSE) — zero duplikacji logiki.

---

## 2026-06-03 — Asystent-czat: lokalny build (SQLite vs Postgres) + higiena kontekstu
**Problem:** Przy rozbudowie „magicznej ikony" do pełnego czatu pojawiły się dwa wyboje. (1) `prisma db push` z `.env.local` (file:./dev.db) padał: `Environment variable not found: DIRECT_URL` oraz `Datasource db: PostgreSQL` — Prisma CLI czyta `.env` (nie `.env.local`), a datasource jest na sztywno `postgresql`, więc lokalnie nie da się ot tak pushnąć SQLite. (2) Pełna historia rozmowy wstrzykiwana do LLM w każdej turze grozi przepełnieniem okna kontekstu (Groq llama-3.3-70b ≈ 32k).
**Rozwiązanie:** (1) Do samego typecheck/buildu wystarczy `npx prisma generate` (nie łączy się z bazą) + atrapa `DATABASE_URL`/`DIRECT_URL` w `.env`. Schemat rozmów (`AiConversation`/`AiMessage`) wjeżdża na prod migracją Postgres (`0078_…`, idempotentną przez `DO $$ … EXCEPTION WHEN duplicate_object`), bo `migrate.js` z `npm run build` rusza dopiero po `next build`. Build weryfikujemy `npx next build` (bez kroku migrate na prod DB). (2) Do agenta przekazujemy tylko ostatnie `MAX_HISTORY_MESSAGES` tur (poziom wyświetlania), a nie surowy transkrypt narzędzi — historia żyje w DB, do modelu idzie przycięty kontekst.
**Lekcja:** `npm run build` w tym repo dotyka prod DB (migrate.js) — do lokalnej weryfikacji używaj `npx tsc --noEmit` + `npx next build`. Prisma CLI ≠ Next.js w kwestii plików env. Persystencję rozmowy trzymaj w bazie, ale do LLM zawsze wysyłaj przycięte, zwięzłe okno — nie cały transkrypt.

---

## 2026-06-03 — Mikrofon (dyktowanie) nie wyłącza się po zatwierdzeniu/wyjściu z pola
**Problem:** W `QuickNoteBar` i `NoteRow` przycisk mikrofonu żyje wewnątrz sekcji warunkowej (`expanded` / tryb edycji). Zatwierdzenie (zapis notatki), Anuluj i Escape zwijały/zamykały tę sekcję, ale **nie zatrzymywały obiektu `SpeechRecognition`** — nagrywanie leciało dalej, a przycisk Stop znikał z DOM. Użytkownik musiał ponownie wejść w to samo miejsce, włączyć i wyłączyć mikrofon, żeby go w końcu uciszyć. `SmartTextarea` nie zatrzymywał dyktowania przy Ctrl+Enter ani przy unmount.
**Rozwiązanie:** Dyktowanie zatrzymujemy w punkcie, w którym znika UI mikrofonu: `reset()` w `QuickNoteBar` woła `stopVoiceInput()`; w `NoteRow` `handleSave()` woła `stopVoiceInput()` + efekt `useEffect` zatrzymujący `recognition` gdy `isEditing` zejdzie na false (łapie Anuluj/Escape); `SmartTextarea` przy Ctrl+Enter najpierw `stopRecording()`. Dodatkowo każdy z komponentów ma efekt cleanup na unmount (`useEffect(() => () => recognitionRef.current?.stop(), [])`). W `NoteRow` zapisaliśmy też `recognitionRef.current = rec` w `startVoiceEdit`, żeby cleanup go obejmował.
**Lekcja:** Zasób imperatywny z własnym cyklem życia (Web Speech API, WebSocket, `setInterval`) nie znika razem z warunkowo renderowanym przyciskiem — trzeba go jawnie zatrzymać w każdej ścieżce wyjścia (submit/cancel/escape) ORAZ na unmount. Stan `isRecording` ≠ faktyczny stan silnika rozpoznawania; sterujemy realnym obiektem, nie tylko flagą UI.

---

## 2026-06-03 — Spread `Set` w strict mode (downlevelIteration) + niezależny dolny pasek
**Problem:** `[...new Set(arr)]` w `menuPrefs.ts` wywaliło `error TS2802` — przy ustawionym `target` < es2015 spread iterowalnych (Set/Map) wymaga `--downlevelIteration`. Osobny temat: dolny pasek mobilny współdzielił kolejność z menu (`enabled.slice(0,4)`), więc nie dało się go ułożyć niezależnie.
**Rozwiązanie:** Zamiast spreadu użyłem `Array.from(new Set(...))` (działa niezależnie od targetu). Dolny pasek dostał własne pole `MenuPrefs.tabBar` (JSON w `UserMenuPref.tabBar`) + helper `resolveTabBar`, niezależne od `order`/`disabled`.
**Lekcja:** W tym repo (strict, starszy target) deduplikuj przez `Array.from(new Set(...))`, nie przez `[...set]`. A gdy dwie powierzchnie (menu boczne vs dolny pasek) mają „przypadkiem" tę samą kolejność — to znak, że brakuje osobnego stanu; lepiej dać im niezależne preferencje niż wyprowadzać jedną z drugiej.
---

## 2026-06-03 — Asystent AI (magiczna ikona): agent obsługiwał tylko 4 z 9 modułów akcji
**Problem:** Główny przepływ magicznej ikony (`AICommandSheet`) korzysta WYŁĄCZNIE z `/api/llm/home/agent`, a ten miał `MODULES = ["shopping","tasks","notes","pets"]` i katalog akcji tylko dla tych modułów. Tymczasem `/api/llm/home/execute` od dawna potrafi wykonać też `habits`, `portfel`, `kitchen`, `flota`, `magazynowanie` (i taki sam komplet dokumentuje stara trasa `interpret`). Efekt: stojąc np. w `/portfel` i mówiąc „dodaj wydatek 50 zł" agent nie miał pojęcia o module portfel, a `normalizeActions` po cichu rzutowało nieznany moduł na `shopping`. Dodatkowo `deriveContextFromPath` rozpoznawało tylko 5 ścieżek — na `/portfel`, `/flota`, `/kitchen`, `/habits` asystent „nie wiedział, gdzie jest".
**Rozwiązanie:** Zrównano zasięg agenta z możliwościami `execute`: rozszerzono `MODULES`, dopisano sekcje katalogu akcji (habits/portfel/kitchen/flota/magazyn) i regułę wyboru modułu podstawowego (jak w `interpret`). Rozszerzono `deriveContextFromPath` o wszystkie moduły akcji (helper `ctx(primary)` ustawia bieżący moduł jako podstawowy, a resztę jako dodatkowe — polecenia międzymodułowe działają z każdego ekranu). Dodano pętlę korekty planu: agent zwraca teraz transkrypt także przy `step:"plan"`, a klient odsyła go z polem `refine`, by przeplanować całość bez zamykania przeglądu akcji.
**Lekcja:** Gdy istnieją dwie warstwy „rozumienia" (agent/interpret) i jedna „wykonania" (execute), ich zakresy MUSZĄ być trzymane w jednym źródle prawdy albo świadomie zsynchronizowane — inaczej warstwa wykonawcza cicho obsługuje akcje, których planista nigdy nie wyprodukuje. Przy dokładaniu modułu do `execute` zawsze sprawdź też katalog agenta, listę `MODULES`, `normalizeActions` i mapę kontekstu UI.

---

## 2026-06-03 — Magazynowanie 2.0: konflikt peer-deps @zxing i fałszywie „czysty" typecheck po cd
**Problem:** (1) `npm i @zxing/browser@latest @zxing/library@latest` padało na ERESOLVE — `@zxing/browser@0.2.0` wymaga peer `@zxing/library@^0.22.0`, a `@latest` to 0.23.0. (2) Po serii `git commit` uruchamianych z `cd /home/user/home && …` katalog roboczy powłoki Bash został w `/home/user/home`, więc kolejne `npx tsc --noEmit -p tsconfig.json` zwracało „path does not exist: tsconfig.json" — a `grep` po tym pustym wyjściu pokazywał 0 błędów, czyli FAŁSZYWIE „czysto".
**Rozwiązanie:** (1) Przypięto zgodne wersje: `@zxing/browser@0.2.0` + `@zxing/library@0.22.0` (peer spełniony, bez `--legacy-peer-deps`). (2) Każdą komendę typecheck/build poprzedzam jawnym `cd /home/user/home/worldofmag` i liczę błędy przez `grep -c "error TS"`.
**Lekcja:** Przy parach paczek z `peerDependencies` (jak @zxing/browser↔library) NIE używaj `@latest` na obu — przypnij wersje spełniające peer. I pamiętaj, że `cwd` powłoki Bash bywa „lepki" między wywołaniami: jeśli wynik narzędzia zależy od katalogu (tsc z `-p`), zawsze ustaw `cd` w tej samej komendzie, bo inaczej puste/błędne wyjście udaje sukces.

---

## 2026-06-02 — Ikona kalendarza/zegara niewidoczna w trybie ciemnym (pola date/time)
**Problem:** Natywne pola `input[type="date"|"datetime-local"|"time"]` renderowały wbudowaną ikonę pickera (kalendarz/zegar) w prawie czarnym kolorze, więc na ciemnym tle motywu była praktycznie niewidoczna.
**Rozwiązanie:** Najpierw ustawiłem `color-scheme: dark` + `filter: invert(1)` na `::-webkit-calendar-picker-indicator` — ale to NIE zadziałało: `color-scheme: dark` już renderuje ikonę na biało, a `invert(1)` zamieniał ją z powrotem na czarno (dwie poprawki znosiły się nawzajem). Ostateczny fix: zostawiam `color-scheme: dark`, usuwam invert i podmieniam ikonę na własny jasny SVG (`background-image` z `stroke=%23e8e8e8`) — osobny kalendarz dla date/datetime/month/week i zegar dla time. Deterministyczne, niezależne od tego jak przeglądarka traktuje color-scheme.
**Lekcja:** Nie łącz `color-scheme: dark` z `filter: invert()` na tej samej ikonie pickera — color-scheme już ją rozjaśnia, więc invert ją z powrotem zaciemnia. Gdy chcesz pewny, jednolity wygląd ikony date/time w dark mode, podmień ją własnym jasnym SVG przez `background-image` na `::-webkit-calendar-picker-indicator`, zamiast polegać na inwersji koloru bazowego.

## 2026-06-02 — Zadania cykliczne: kolejne wystąpienie tylko z panelu, nie z listy
**Problem:** Logika „oznacz cykliczne jako zrobione → utwórz kolejne wystąpienie" (`completeRecurringTask`) była wpięta tylko w panel szczegółów (`TaskDetail.handleStatusChange`). Oznaczenie zrobione z listy (checkbox / skrót `x`/spacja) szło przez `toggleTaskStatus` → `updateTask`, więc cyklicznie zadanie po prostu zmieniało status i NIE powstawało następne. Dodatkowo nowe wystąpienie nie kopiowało tagów ani `startDate`.
**Rozwiązanie:** W `toggleTaskStatus` przy wejściu w `DONE` dla zadania z `recurring` deleguję do `completeRecurringTask` (jedna ścieżka prawdy). `completeRecurringTask` kopiuje teraz tagi i przesuwa `startDate` o tę samą różnicę co termin (zachowane wyprzedzenie). Dodałem `RecurringRule.anchor` (`DUE`|`COMPLETION`) + selektor w UI — następny termin liczony od terminu albo od daty wykonania.
**Lekcja:** Gdy jakieś zachowanie ma „specjalną" logikę (np. cykliczność przy DONE), upewnij się, że WSZYSTKIE ścieżki UI prowadzące do tego stanu przez nią przechodzą (panel + lista + skrót), a nie tylko jedna. Najlepiej skupić to w jednej funkcji domenowej i z niej korzystać wszędzie.

## 2026-06-02 — Akcje chowane pod `hover` są niedostępne na dotyku (mobile)
**Problem:** Usuwanie/zmiana nazwy projektu istniały tylko w bocznym menu (`TasksSideNav`), gdzie przyciski pokazują się dopiero `onMouseEnter` (hover). Na telefonie nie ma hovera, a sub-nav zadań w mobilnym menu i tak zwracał `null` — więc tych akcji NIE dało się wykonać na mobile.
**Rozwiązanie:** Dodałem `ProjectActionsMenu` (zwykły przycisk „⋮" + menu, zamykane klikiem w tło) w nagłówku listy zadań — działa identycznie myszą i dotykiem. Do przenoszenia (projekt zadania, lista produktu) użyłem natywnych `<select>` — natywny picker OS to najlepszy UX na mobile.
**Lekcja:** Każda akcja ukryta pod `hover` to potencjalnie funkcja niedostępna na mobile. Krytyczne akcje dawaj jako trwale widoczne przyciski/menu (klik, nie hover) i sprawdzaj, czy mobilna ścieżka (sub-nav/menu) w ogóle je renderuje.

## 2026-06-02 — Komunikat usuwania projektu kłamał o kasowaniu zadań
**Problem:** `TasksSideNav` pokazywał `confirm("Usunąć projekt i wszystkie zadania?")`, ale relacja `Task.projectId` ma `onDelete: SetNull` — zadania NIE są kasowane, tylko tracą przypisanie (i nadal są widoczne w „Wszystkie", bo `getAllUserTasks` zwraca też `createdById = user`). Komunikat straszył utratą danych, której nie było.
**Rozwiązanie:** Doprecyzowałem ostrzeżenie (liczba zadań + „nie zostaną usunięte, stracą przypisanie, pozostaną w «Wszystkie»"), dodałem ochronę przed usunięciem Skrzynki (`isInbox`) po stronie akcji i obsługę błędu w UI. Przy okazji: `updateTask` przepuszczał zmianę `projectId` bez sprawdzenia dostępu do celu — dodałem `assertProjectAccess(patch.projectId)`.
**Lekcja:** Treść `confirm`/ostrzeżenia musi odpowiadać realnej semantyce relacji w schemacie (`SetNull` ≠ `Cascade`). Gdy dodajesz UI zmieniające FK (np. przeniesienie do innego projektu/listy), w akcji sprawdź dostęp zarówno do źródła, jak i do celu, oraz rewaliduj obie ścieżki.

## 2026-06-01 — Magiczna ikona obcinała wsadowe polecenia do ~7 akcji (limit tokenów)
**Problem:** Po wklejeniu do asystenta („magiczna ikona") dużego JSON-a z 47 zadaniami, drawer pokazywał tylko 7 pierwszych. Nie było jawnego limitu liczby akcji — wąskim gardłem był sztywny `maxTokens: 1024` w `src/app/api/llm/home/interpret/route.ts`. Każda akcja `create_task` to ~150–250 tokenów, więc w 1024 tokenach model „domykał" tablicę JSON na ~7 pozycjach.
**Rozwiązanie:** Budżet tokenów skalowany do długości wejścia: `Math.min(8192, Math.max(1024, ceil(text.length/2)))`. Dodatkowo tolerancyjny parser `parseActionArray` — gdy odpowiedź urwie się mimo to, przycina do ostatniego kompletnego `}` i domyka `]`, więc zwraca tyle akcji, ile się zmieściło, zamiast 502.
**Lekcja:** Sztywny `maxTokens` przy odpowiedziach o zmiennej długości (listy/JSON) to cichy obcinacz — skaluj budżet do rozmiaru wejścia i zawsze miej plan B na urwany JSON (graceful degrade zamiast twardego błędu). Przy poleceniach generujących N elementów licz „tokeny na element × N", nie jedną stałą.

## 2026-05-31 — Kolizja numerów migracji przy mergu gałęzi roboczej do `develop`
**Problem:** Gałąź robocza dodawała migracje `0049`/`0050` (raporty E2E), ale w międzyczasie `develop` urósł o własne `0049_architecture_full_report`, `0049_omnia_implementation_report_v2` i `0050_omnia_handoff_prompt` (Faza 0 Omnia). Po `git fetch` okazało się, że te same numery są zajęte — merge stworzyłby zdublowane prefiksy migracji, a kolejność stosowania (Prisma sortuje po nazwie katalogu) stałaby się niejednoznaczna.
**Rozwiązanie:** Przed mergem przenumerowałem swoje migracje na `0051`/`0052` (`git mv`), tak by trafiły po najnowszej na `develop`. Zweryfikowałem cały łańcuch `prisma migrate deploy` na świeżej bazie (51 migracji, raporty wstawione) oraz `npm run build`. Konflikt treści był tylko w `doświadczenia.md` (oba wpisy zachowane).
**Lekcja:** Numer migracji to wspólny zasób — przed dodaniem nowej i przed mergem do `develop` **zrób `git fetch origin develop` i sprawdź najwyższy numer tam**, nie tylko lokalnie. Gdy gałąź długo żyje, `develop` mógł już zająć „następny" numer. Najtaniej naprawić to `git mv` na wolny, wyższy numer przed mergem (migracje nie były jeszcze wdrożone na prod), niż rozplątywać zdublowane prefiksy po fakcie.

## 2026-05-31 — Cytaty blokowe (`>`) nie renderują się w raportach (Markdown renderer)
**Problem:** Pisząc duży raport architektury (migracja `0049`) chciałem użyć cytatów blokowych Markdown (`> tekst`) jako „callout". W `src/lib/markdown.ts` funkcja `markdownToHtml` najpierw wywołuje `escapeOutsideCodeBlocks`, która zamienia `>` na `&gt;` w całym tekście poza blokami kodu. Dopiero **później** działa regex cytatu `^> (.+)$`. Po escapowaniu linia zaczyna się od `&gt; `, więc regex nigdy nie trafia — cytat renderuje się jako zwykły akapit z dosłownym `&gt;` na początku. Istniejące raporty (np. `0019`, `0022`, `0035`) mają ten sam ukryty defekt.
**Rozwiązanie:** Naprawiono źródło w `src/lib/markdown.ts`. Kluczowa zmiana: globalny escape **przestał escapować `>`** — escapujemy tylko `&` i `<` (to one neutralizują wstrzyknięcie HTML; samotny `>` nie otwiera tagu). Dzięki temu marker `> ` przeżywa do passu cytatów. Dodano też pass list numerowanych (`1.`, `<ol class="md-ol">`) przed listami punktowanymi oraz wieloliniowe cytaty. **Pułapka po drodze:** próba „czystego" wariantu (usunięcie globalnego escape i escapowanie dopiero w `inlineFormat`) wprowadziła **dziurę XSS** — regex tabel zjada pojedynczy `\n` separatora, skleja kolejny akapit z blokiem `<table>`, a gałąź „pomiń już-otagowane" zwracała ten akapit **bez escapowania**. Dlatego zostawiłem escape globalny (gwarancja, że każdy tekst jest zescapowany), jedynie wyłączając z niego `>`. Pokryte testem manualnym (cytaty, listy, tabele, bloki kodu, oraz XSS dla akapitu sklejonego po tabeli).
**Lekcja:** W tym własnym rendererze **kolejność transformacji i to, co escapujemy globalnie, są warunkiem bezpieczeństwa, nie tylko poprawności**. Nie przenoś escapowania „w dół" do `inlineFormat` bez prześledzenia każdej ścieżki, którą tekst trafia do wyjścia — zwłaszcza gałęzi „pomiń już-otagowane bloki", bo bloki potrafią się sklejać (regex zjada separator) i przepuścić surowy HTML. Bezpieczny, minimalny fix to escapować `&` i `<` globalnie (a `>` zostawić), zamiast refaktoryzować całą kolejność.

## 2026-05-31 — Smoke testy E2E padały na logowaniu: zły id providera w `auth.setup.ts`
**Problem:** Wszystkie klikacze padały, bo projekt `setup:auth` nie tworzył sesji — `/api/auth/session` zwracało `null`. W logach serwera: `[auth][error] TypeError: Cannot read properties of undefined (reading 'type')`. Powód: provider credentials w `src/lib/auth.ts` jest zarejestrowany z `id: "e2e"`, więc jego callback to `/api/auth/callback/e2e`, ale `e2e/setup/auth.setup.ts` POST-ował na `/api/auth/callback/credentials`. NextAuth nie znajdował providera o tym id → błąd `Configuration` (302 na `/api/auth/error?error=Configuration`), brak ciasteczka sesji.
**Rozwiązanie:** Zmieniono ścieżkę w `auth.setup.ts` na `/api/auth/callback/e2e` (zgodną z `id` providera). Po poprawce setup loguje admina i limited usera, a smoke przechodzi.
**Lekcja:** Ścieżka callbacku NextAuth to `/api/auth/callback/<id>`, gdzie `<id>` to **`id` providera**, a nie jego typ. Gdy provider ma jawne `id`, endpoint logowania w testach musi go używać. Objaw „session = null + error=Configuration + Cannot read 'type'" = NextAuth nie dopasował providera po id w URL-u.

## 2026-05-31 — Menu: trzy źródła nawigacji i „disabled zamiast hidden"
**Problem:** Pozycje menu były powielone w trzech miejscach (`AppShell` `MODULES`, ręcznie kodowane `NavItem`-y w `ModuleSidebar`, oraz osobne bloki mobilne + dolny pasek), a brak uprawnień renderował element jako wyszarzony z kłódką (`opacity: 0.35` + `Lock`) zamiast go ukrywać. Każda zmiana działu wymagała edycji wielu list, a użytkownik widział działy, do których i tak nie miał dostępu.
**Rozwiązanie:** Wprowadzono jedno źródło prawdy `src/lib/modules.tsx` (lista `MODULES` + helper `resolveMenu(permissions, prefs)` zwracający `enabled`/`more`). Brak uprawnień ⇒ pozycja w ogóle nie jest renderowana. Dodano per-user preferencje (`UserMenuPref`: kolejność + wyłączone działy, domyślnie wszystko oprócz QA) z sekcją „Więcej…" do włączania działów i edytorem w ustawieniach. Sidebar desktop i drawer mobilny czytają tę samą listę.
**Lekcja:** Gdy ta sama nawigacja jest kopiowana do desktopu, mobile i dolnego paska, najpierw wydziel wspólną definicję (dane + helper widoczności), a dopiero potem renderuj w każdym miejscu. „Brak uprawnień" to ukrycie, nie wyszarzenie — wyszarzony, klikalny element myli i tak kończy się odbiciem na auth-checku.

## 2026-05-31 — „Strona domowa raportów" nie pozwalała przejść do większości raportów
**Problem:** Zgłoszenie „na stronie domowej raportów nie da się przejść do żadnych widoków". `/reports` (`ReportsHomePage`) to dashboard, który listował tylko `reports.slice(0, 8)` najnowszych raportów, a kafelek „Wszystkie raporty" w sekcji „Zarządzanie" linkował do `/reports` — czyli do samego siebie. W bazie jest ~20 raportów systemowych (wiele migracji `INSERT INTO "Report"`), więc starsze raporty były **całkowicie nieosiągalne** z tej strony. Trasa szczegółów `/reports/[slug]` i tak była dynamiczna (używa `auth()`), więc to nie był problem renderu — wiersze raportów działały, brakowało tylko dostępu do reszty.
**Rozwiązanie:** Zdjęto limit `slice(0, 8)` (strona domowa = pełna, klikalna lista wszystkich raportów), usunięto zapętlony self-link „Wszystkie raporty", a sekcję „Zarządzanie" ograniczono do admina (realny cel: panel admina). Dodatkowo dla parytetu dodano `export const dynamic = "force-dynamic"` w `/reports/[slug]/page.tsx` (jedyna uwierzytelniona strona treści bez tego).
**Lekcja:** „Nie da się nigdzie przejść" z listy-dashboardu najczęściej znaczy: dane są ucięte (limit/`slice`) albo link prowadzi do tej samej trasy (martwy self-link), a nie że nawigacja jest technicznie zepsuta. Przy dashboardach typu „ostatnie N" zawsze zostaw realne wyjście do pełnej listy — i sprawdź, czy kafelki „Zarządzanie"/„Zobacz wszystko" nie linkują do bieżącej strony.

## 2026-05-31 — Nowy moduł nie pojawił się w menu na mobile (dwa źródła nawigacji)
**Problem:** Po dodaniu działów „Nauka języków" i „Zdrowie" wpisy pojawiły się na desktopie, ale na iPhonie ich nie było. Zaktualizowany był tylko `ModuleSidebar.tsx` (sidebar desktop), a nawigacja mobilna żyje **osobno** w `AppShell.tsx` (tablica `MODULES` + jawna lista `MobileItem`, plus dolny pasek zakładek). Pozycje zablokowane brakiem uprawnień i tak renderują się jako wyszarzone — więc „kompletny brak w menu" to sygnał, że to nie RBAC, tylko brakujący wpis/niewdrożony kod.
**Rozwiązanie:** Dodano oba działy w `AppShell.tsx`: do `MODULES` (wykrywanie aktywnego modułu w górnym pasku) oraz do mobilnej listy jako `MobileItem` z `locked={isLocked(...)}`. Dolny pasek zakładek zostaje kuratorowany (4 pozycje) — bez zmian.
**Lekcja:** Dodając moduł, aktualizuj OBA źródła nawigacji: `ModuleSidebar.tsx` (desktop) i `AppShell.tsx` (mobile: `MODULES` + `MobileItem`). Przy diagnozie „nie ma w menu" rozróżniaj: wyszarzone = brak uprawnienia (RBAC), całkowity brak = brakujący wpis w którymś menu albo niewdrożony build.

## 2026-05-30 — `npx prisma` ciągnie Prisma 7, schemat projektu to Prisma 5
**Problem:** W świeżym kontenerze (brak `node_modules`) `npx prisma validate` pobrało najnowszą Prismę 7, która odrzuca `url`/`directUrl` w bloku `datasource` (P1012) — choć projekt jest na `prisma@^5.22`. Build/migracje wyglądały na zepsute, a problem był tylko w wersji narzędzia.
**Rozwiązanie:** Najpierw `npm install`, potem wołać binarkę projektu: `./node_modules/.bin/prisma …` (nie `npx prisma`, które bez lokalnej instalacji ściąga latest). Migracje generować offline bez bazy: `git show HEAD:worldofmag/prisma/schema.prisma > /tmp/old.prisma` i `prisma migrate diff --from-schema-datamodel /tmp/old.prisma --to-schema-datamodel prisma/schema.prisma --script`.
**Lekcja:** W tym repo zawsze używaj lokalnej binarki Prisma (zgodnej z `package.json`), nie `npx`. Raporty techniczne trafiają do bazy przez migrację SQL (`INSERT … ON CONFLICT (slug) DO NOTHING`, treść w dollar-quote), bo prod DB nie jest osiągalna z kontenera — nie przez skrypt runtime z `createReport`.

## 2026-05-30 — Admin odebrał sobie dostęp do panelu /admin (RBAC lockout)
**Problem:** Na dev administrator przez panel `/admin/access` przypadkowo usunął sobie dostęp do panelu admina i nie da się go odzyskać z poziomu UI (bramka `/admin` wymaga `module.admin`, a edycja RBAC sama jest pod tą bramką → klasyczny self-lockout). Brak dostępu do bazy.
**Rozwiązanie:** Migracja `0043_restore_admin_access` odtwarza cały łańcuch uprawnień idempotentnie: (1) `Permission(slug='module.admin')`, (2) `RolePermission(ADMIN → module.admin)`, (3) `UserRole(role='ADMIN')` dla `tyka.szymon@gmail.com`. Każdy `INSERT ... SELECT ... WHERE NOT EXISTS`, więc bezpieczna do wielokrotnego uruchomienia i niezależna od tego, które ogniwo zostało usunięte. Stosuje te same wzorce co `0015_permissions` (`gen_random_uuid()::text`, Postgres).
**Lekcja:** Dostęp do panelu admina zależy wyłącznie od uprawnienia `module.admin` (przez `UserRole`→`RolePermission`→`Permission`), nie od legacy `User.role`. Gdy nie ma dostępu do bazy, recovery RBAC robimy migracją idempotentną odtwarzającą wszystkie ogniwa łańcucha naraz — nie zgadujemy, które usunięto.
**Zabezpieczenie (dodane):** `src/actions/access.ts` ma helper `countAdminAccessHolders()` i blokuje trzy drogi self-lockoutu: `toggleRolePermission` (odebranie `module.admin` roli), `removeUserRole` (usunięcie ostatniej roli z dostępem) i `deletePermission` (usunięcie samego `module.admin`) — jeśli operacja zostawiłaby 0 użytkowników z dostępem do `/admin`, rzuca błędem. Bo Next.js maskuje treść błędów server actions w produkcji, lustrzana blokada jest też w UI (`PermissionManager.tsx`): odpowiednie kontrolki są wyłączone z tooltipem, a handlery łapią błąd i pokazują `alert`. Granica bezpieczeństwa to server action; UI to UX. Uwaga: guard celowo nie blokuje, gdy posiadaczy jest już 0 (stan lockoutu) — żeby nie zablokować naprawy.

## 2026-05-30 — Nawigacja z asystenta AI: adresy od LLM trzeba walidować jak nieufne wejście
**Problem:** Magiczna ikona (AICommandSheet) dostała krok `navigate` — LLM zwraca URL, na który mamy przekierować użytkownika (`router.push`). URL pochodzi z modelu, więc bez kontroli groziłby open-redirect (`//evil.com`, `http://…`) albo wejściem na ścieżki spoza aplikacji.
**Rozwiązanie:** `sanitizeNavUrl()` w `agent/route.ts` przepuszcza tylko ścieżki zaczynające się od jednego `/` (odrzuca `//` i absolutne URL-e) i pasujące do whitelisty prefiksów (`/tasks`, `/shopping`, `/notes`, `/pets`). Gdy URL jest niedozwolony, prosimy LLM o poprawkę zamiast go zwracać. Żeby przekierowanie miało sens, `TasksPage` czyta `?status=` i `?task=` (analogicznie do `?focus=`/`?pinned=` w Notatkach).
**Lekcja:** Każdy URL/identyfikator pochodzący z LLM traktuj jak dane od użytkownika — waliduj przeciw whitelist, nie blacklist. Nawigacja deep-link działa tylko, jeśli strona docelowa faktycznie czyta parametry z query — dodanie kroku `navigate` bez wsparcia parametrów po stronie widoku nic nie da.

## 2026-05-29 — Powiadomienie zadania pojawiało się podwójnie (Notification API bez dedup)
**Problem:** Powiadomienie „Zadanie za chwilę: …” przychodziło dwukrotnie. `checkDueNotifications()`
w `TasksPage.tsx` było wołane z `useEffect([tasks])`, więc każda zmiana propu `tasks`
(re-render / `revalidatePath`) ponownie tworzyła `new Notification(...)` dla tego samego zadania.
Brakowało też w treści informacji, z jakiego projektu jest zadanie — był tylko tytuł + „from Omnia”
(„Omnia” to nazwa PWA doklejana jako źródło przez system, nie da się jej usunąć z poziomu kodu).
**Rozwiązanie:** Dedup przez `useRef<Set<string>>` z kluczem `id:dueDate` (przeżywa re-rendery,
re-notyfikacja tylko gdy zmieni się termin). Do treści powiadomienia dodano nazwę projektu (z emoji),
więc widać konkretny projekt zamiast samej marki.
**Lekcja:** Powiadomienia odpalane w `useEffect` zależnym od danych MUSZĄ mieć dedup poza stanem Reacta
(`useRef`), bo efekt powtórzy się przy każdym re-renderze. Nazwy aplikacji w Notification API nie
nadpiszesz — kontekst (projekt/źródło) podawaj w `title`/`body`.

## 2026-05-29 — Margines ikony: licz od ZEWNĘTRZNEJ krawędzi pociągnięcia, nie od promienia
**Problem:** Trzeba było dać ikonie aplikacji jednolity ~2px margines. Pierścienie rysowane są
`stroke`iem o szerokości `sw`, więc realny zasięg grafiki to `R + sw/2`, a nie `R`. Liczenie marginesu
od samego `R` zostawiłoby pół grubości stroke’a wystające poza zakładany margines.
**Rozwiązanie:** W `brandLogo.ts` promień zewnętrzny liczony jako `R = 50 - MARGIN - MAX_SW/2`
(siatka 100×100). Wewnętrzne pierścienie kurczą się same (`r *= K`). Po zmianie geometrii podbito
`ICON_VERSION` (cache iOS).
**Lekcja:** Przy marginesach grafiki wektorowej ze `stroke` uwzględniaj `sw/2`. Każda zmiana wyglądu
ikony = podbicie `ICON_VERSION`.

---

## 2026-05-29 — iOS uparcie cache'uje apple-touch-icon po ŚCIEŻCE (ignoruje ?query) → wersjonowanie ścieżki
**Problem:** Po zmianie logo ikona na ekranie startowym iPhone nadal była stara, mimo że
favicon w Safari/Chrome był nowy, a endpoint `/apple-icon` serwował poprawny PNG (zweryfikowane
lokalnie). Odświeżanie strony i ponowne „Dodaj do ekranu początkowego" nie pomagało. Przyczyna:
iOS/WebKit cache'uje apple-touch-icon po SAMEJ ścieżce URL i IGNORUJE parametr `?hash`, który
Next dokleja przy zmianie ikony (`/apple-icon?abc`). Dodatkowo w `<head>` były DWA linki
apple-touch-icon: automatyczny z konwencji `app/apple-icon.tsx` oraz nasz — iOS mógł brać stary.
**Rozwiązanie:** (1) Ikonę iOS podajemy pod WERSJONOWANĄ ścieżką `/apple-touch-icon/<ICON_VERSION>`
(trasa `app/apple-touch-icon/[v]/route.tsx`), a `ICON_VERSION` (appName.ts) podbijamy przy każdej
zmianie wyglądu — nowa ścieżka = iOS traktuje to jako nowy zasób, bez cache. (2) Usunięto
`app/apple-icon.tsx`, by w `<head>` był tylko jeden link. (3) Dodano `apple-touch-icon` do
wykluczeń matchera middleware.
**Lekcja:** Przy zmianie ikony iOS NIE polegaj na `?query` ani na samym usunięciu kafelka —
zmień ŚCIEŻKĘ pliku apple-touch-icon (wersjonowanie). Pilnuj, by w `<head>` był dokładnie jeden
`<link rel="apple-touch-icon">` (usuń konwencyjne `apple-icon.tsx`, jeśli dodajesz własny link).

## 2026-05-29 — Generowane ikony (icon/apple-icon/pwa-icon) za bramką logowania → iOS pokazuje starą ikonę
**Problem:** Po wdrożeniu nowego logo na produkcji ikona „dodaj do ekranu głównego" na iPhone
pokazywała STARE fioletowe „O", a nie nowe pierścienie (na dev działało). Render produkcyjny
ikony był poprawny (sprawdzony skryptem przez `next/og`) — więc problem nie był w kodzie ikony.
Dwie realne przyczyny: (1) matcher w `src/middleware.ts` wykluczał z bramki logowania tylko
stary katalog `icons`, ale NIE generowane trasy `icon`/`apple-icon`/`pwa-icon` ani dynamiczny
`manifest` — iOS/Safari pobiera te zasoby BEZ sesji, dostawał redirect 302 na `/auth/signin`
i spadał na cache starej ikony; (2) w repo wciąż leżał stary `public/icons/apple-touch-icon.png`
(to fioletowe „O").
**Rozwiązanie:** Rozszerzono wykluczenia matchera o `icon|apple-icon|pwa-icon|manifest|favicon`,
usunięto stare pliki `public/icons/*` i przepięto powiadomienia (`TasksPage`) na `/pwa-icon/192`.
**Lekcja:** Wszystkie publiczne zasoby pobierane bez sesji (ikony, manifest, og-image, robots,
sitemap, sw.js) MUSZĄ być wykluczone z matchera middleware autoryzacji — inaczej zwracają
redirect zamiast pliku. Po podmianie ikon usuń stare statyki z `public/`, bo przeglądarka/OS
potrafi je serwować lub cache'ować. iOS szczególnie agresywnie cache'uje apple-touch-icon —
po naprawie trzeba usunąć i ponownie dodać aplikację do ekranu głównego.

## 2026-05-29 — Ręczny `<link rel="apple-touch-icon">` nadpisuje generowaną `apple-icon.tsx`
**Problem:** Po wdrożeniu nowej ikony marki (generowanej przez `src/app/apple-icon.tsx`)
ikona na ekranie domowym iPhone wciąż pokazywała STARĄ grafikę. Powód: w `src/app/layout.tsx`
w bloku `<head>` był zaszyty ręcznie `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`
wskazujący stary, statyczny PNG. Ten ręczny link ma pierwszeństwo przed konwencją plikową
Next.js (`apple-icon.tsx`), więc nowa ikona nigdy się nie pojawiała.
**Rozwiązanie:** Usunięto ręczny `<link rel="apple-touch-icon">` (oraz `appleWebApp.startupImage`
wskazujący ten sam stary plik). Po usunięciu Next sam wstrzykuje link do generowanej ikony.
**Lekcja:** Gdy używasz konwencji plikowej Next (`icon.tsx`/`apple-icon.tsx`), NIE dubluj
linków do ikon ręcznie w `<head>` — ręczny `<link>`/`<meta>` wygrywa i „zamraża" stary zasób.
Przy podmianie ikon najpierw sprawdź `layout.tsx` (`<head>` i `metadata.icons`/`appleWebApp`).

---

## 2026-05-28 — Build na Render pada: `Module not found: '@/...'` bo `NODE_ENV=production` wycina devDependencies

**Problem:** Nowy serwis prod na Render (`omnia-prod`) wywalał build:
`Module not found: Can't resolve '@/actions/config'` (oraz `@/actions/reports`,
`@/lib/auth`, `@/lib/permissions`) — same pliki pod `src/app/admin/`. Lokalnie
build przechodził bez problemu, na obu wersjach Node (22 i 24). Mylące tropy:
wielkość liter (Mac↔Linux), wersja Node, brak `baseUrl` w `tsconfig` — wszystkie
okazały się fałszywe. Prawdziwy ślad był w logu: „added **111 packages**" —
zdecydowanie za mało. `typescript` siedzi w `devDependencies`, a ustawione
`NODE_ENV=production` każe `npm ci` pominąć devDependencies. Bez pakietu
`typescript` Next.js po cichu nie wczytuje aliasu `@` z `tsconfig.json` →
„Module not found". Widać tylko ~5 błędów (a nie 77), bo build przerywa się na
pierwszych alfabetycznie trasach (`/admin/...`).

**Rozwiązanie:** Dodano `worldofmag/.npmrc` z linią `include=dev`, co wymusza
instalację devDependencies również przy `NODE_ENV=production`. Zweryfikowane:
`NODE_ENV=production npm ci` z tym `.npmrc` instaluje 198 pakietów (zamiast 57),
`typescript` jest obecny, a `next build` przechodzi (69/69 stron) na Node 24.

**Lekcja:** Gdy build na Render/CI pada na `Module not found: '@/...'`, a
lokalnie działa — sprawdź najpierw liczbę zainstalowanych pakietów w logu.
`NODE_ENV=production` + `npm ci` = brak devDependencies (w tym `typescript`,
`@types/*`, `tailwindcss`), których Next potrzebuje do BUILDU. Diagnozę
odtwarzaj przez `NODE_ENV=production npm ci` w czystym checkoutcie, nie przez
zwykłe `npm install`. Trzymaj `.npmrc` z `include=dev` w katalogu aplikacji.

---

## 2026-05-25 — TS: iteracja po `Map.values()` wywala `tsc` (TS2802)

**Problem:** W `petGenetics.ts` `for (const x of map.values())` wywaliło
`tsc --noEmit`: *TS2802: can only be iterated through when using
'--downlevelIteration' or '--target' 'es2015' or higher*. `next build` używa
naszej konfiguracji TS i przy tym targecie iteracja po iteratorach Map/Set jest
zablokowana.

**Rozwiązanie:** Owinąć w `Array.from(map.values())` (działa też dla
`map.keys()`, `map.entries()`, `set.values()`).

**Lekcja:** W tym repo nie iteruj bezpośrednio po iteratorach `Map`/`Set` w
`for...of` — używaj `Array.from(...)`. Dotyczy też spreadu `[...map.values()]`.
Szybka walidacja przed buildem: `npx tsc --noEmit`.

---

## 2026-05-25 — Nowe modele (moduł Zwierzęta): JSON jako String, brak enumów, seed permisji w 2 miejscach

**Problem:** Projektując schemat modułu Zwierzęta, narzucała się pokusa użycia
typu Prisma `Json` (np. `featureFlags Json`) i enumów dla statusów — tak
sugerowały automatyczne analizy. To jednak złamałoby konwencję projektu:
`datasource` to `postgresql`, ale lokalny dev używa SQLite (`file:./dev.db`),
gdzie `Json`/enum się nie kompilują, a `mode: "insensitive"` w zapytaniach jest
Postgres-only. Drugi haczyk: permisje modułów są seedowane **wyłącznie w SQL
migracji** (uruchamianym przez `migrate deploy` w buildzie prod), więc lokalny
`db:push` ich nie tworzy i nowy moduł byłby niewidoczny lokalnie.

**Rozwiązanie:** Wszystkie pola JSON (`featureFlags`, `recurring`, `details`,
`payload`) jako `String?` z `JSON.parse/stringify` (jak istniejące
`Task.recurring String? // JSON`); statusy/typy jako `String` + unia TS.
Permisję `module.pets` zaseedowano w migracji `0026` (prod) **oraz**
idempotentnie w `prisma/seed.ts` (upsert + grant ADMIN) dla lokalnego
`db:push`.

**Lekcja:** W tym repo zawsze: zero enumów, JSON trzymaj w `String`, a nową
permisję modułu dopisuj w dwóch miejscach — w SQL migracji (prod) i w
`seed.ts` (lokalny db:push). Wspólną logikę (np. `computeNextDue`) wydzielaj do
`src/lib` zamiast duplikować między modułami.

---

## 2026-05-24 — Playwright: własny fixture `isMobile` tworzy cykl zależności

**Problem:** Po dodaniu do `test.extend<>()` własnego fixture'a `isMobile`
(`async ({ page }, use) => …`) `playwright test --list` wywalał: *Fixtures
"page" -> "context" -> "isMobile" -> "page" form a dependency cycle* i zbierał
0 testów. Powód: `isMobile` to **wbudowana opcja Playwrighta** (część
deskryptora urządzenia, np. `devices['iPhone 13']`). Builtin `context` czyta
opcję `isMobile`, a mój fixture `isMobile` zależał od `page` (które zależy od
`context`) — kółko się zamknęło.

**Rozwiązanie:** Usunąłem własny fixture. Testy nadal destrukturyzują
`{ isMobile }` — i dostają wartość wbudowaną (true dla projektu iPhone 13,
false dla desktop), dokładnie to, czego chciałem.

**Lekcja:** Nie nadpisuj nazw wbudowanych opcji/fixture'ów Playwrighta
(`isMobile`, `browserName`, `viewport`, `userAgent`, `storageState`, …) własnym
fixturem zależnym od `page`/`context` — powstaje cykl. Jeśli potrzebujesz tej
informacji, czytaj builtin (destrukturyzuj `{ isMobile }`) albo nadaj własnemu
fixture'owi inną nazwę. Szybka walidacja całej serii bez przeglądarki:
`npx playwright test --list` (kompiluje i zbiera testy, nie startuje serwera).

---

## 2026-05-24 — E2E (Playwright) dla aplikacji z logowaniem tylko przez Google: env-gated credentials provider

**Problem:** Aplikacja loguje się WYŁĄCZNIE przez Google OAuth (NextAuth v5), którego nie da się skryptować w Playwright (Google blokuje automatyzację, captcha/2FA). Bez rozwiązania logowania żaden test nie przejdzie dalej niż `/auth/signin`. Dodatkowo `hasPermission` nie ma bypassu dla ADMIN — uprawnienia pochodzą wyłącznie z `RolePermission`, więc testowy użytkownik „admin" bez nadanych grantów i tak nie wejdzie do modułów.

**Rozwiązanie:**
- **Env-gated Credentials provider** w `src/lib/auth.ts`: dodawany do `providers` tylko gdy `process.env.E2E_TEST_MODE === "1"`. W produkcji (Render) ta zmienna nigdy nie jest ustawiona, więc provider jest całkowicie nieaktywny — zero ryzyka. Działa, bo sesja jest `strategy: "jwt"` (Credentials wymaga JWT, nie database sessions). `webServer` w `playwright.config.ts` startuje `npm run dev` z `E2E_TEST_MODE=1`.
- **Seed użytkowników + uprawnień w setupie** (`e2e/fixtures/db.ts`): idempotentny upsert ról `E2E_ALL` (wszystkie permissiony) i `E2E_LIMITED` (tylko `module.home`) + grantów `RolePermission`. Dwa storage-state'y (`admin.json`, `limited.json`) dają pokrycie scenariuszy pozytywnych i gating/blokad jednym mechanizmem.
- **Logowanie bez UI**: `auth.setup.ts` woła `/api/auth/csrf` → POST `/api/auth/callback/credentials`, weryfikuje `/api/auth/session`, zapisuje `storageState`. Reużywane przez projekty `desktop` i `mobile` (iPhone 13).
- **tsconfig split**: `e2e/` i `playwright.config.ts` wykluczone z głównego tsconfig (żeby `next build` ich nie kompilował), osobny `e2e/tsconfig.json` do typechecku testów.

**Lekcja:** Aby E2E-testować appkę z OAuth-only, nie automatyzuj prawdziwego logowania — dodaj **provider testowy gated zmienną środowiskową** (aktywny tylko lokalnie/CI) i loguj przez endpoint `/api/auth/callback/credentials`, zapisując `storageState`. Gdy uprawnienia są czysto rolowe (bez bypassu admina), **seed grantów `RolePermission` musi być częścią setupu testów**, inaczej nawet „admin" jest zablokowany. Trzymaj testy poza `tsconfig` Next, żeby nie wchodziły w produkcyjny build.

---

## 2026-05-24 — Trasy TIR: Google Maps nie omija ograniczeń — liczymy trasę u nas (ORS HGV) i przekazujemy waypointy

**Problem:** Wymaganie brzmiało „pobierz ograniczenia dla ciężarówek + roboty i ustaw Google Maps tak, by je omijał". Konsumencka aplikacja Google Maps **nie ma trybu ciężarówki** i **nie da się wstrzyknąć własnych „omijaj te odcinki"** — parametr `avoid` obsługuje wyłącznie płatne drogi / autostrady / promy. Naiwna implementacja (np. eksport pinów do My Maps) tylko pokazuje ograniczenia, ale nawigacja i tak prowadzi przez nie.

**Rozwiązanie:**
- **Routing po naszej stronie, Google tylko prowadzi.** Profil `driving-hgv` OpenRouteService ma w grafie zakodowane tagi OSM `maxweight`/`maxheight`/`hgv`, więc po podaniu `options.profile_params.restrictions` (waga/wysokość/długość/szerokość/oś) + `options.vehicle_type:"hgv"` natywnie omija drogi z ograniczeniami. Aktualne roboty z Overpass (`highway=construction`) zamieniamy na małe kwadraty i podajemy jako `options.avoid_polygons` (MultiPolygon), z fallbackiem do trasy bazowej gdy ORS odrzuci polygony. Geometrię z gotowej trasy próbkujemy do max 8 waypointów i budujemy URL `https://www.google.com/maps/dir/?api=1&...&waypoints=...&travelmode=driving`.
- **Endpoint `/geojson`** ORS (`.../driving-hgv/geojson`) zwraca gotowy `LineString` — zero dekodowania encoded-polyline.
- **`vehicle_type` jest siblingiem `profile_params`**, nie jest zagnieżdżony w środku (łatwa pomyłka).
- **Limit waypointów Google ~9** → cap 8 punktów pośrednich; korytarz jest „przybliżony" (Google przelicza odcinki między punktami) — to trzeba uczciwie napisać w UI.

**Lekcja:** Zanim obiecasz integrację z cudzą nawigacją, zweryfikuj jej realne API. Gdy platforma docelowa nie umie czegoś z definicji, przenieś logikę do siebie i użyj jej tylko jako „wyświetlacza". Pytaj użytkownika o kierunek (warstwa wizualna vs liczenie trasy) zanim zaczniesz kodować — to zmienia całą architekturę.

## 2026-05-24 — Migrację Prisma trzeba dopisać ręcznie, gdy w środowisku nie ma bazy

**Problem:** Dodałem model `VehicleProfile` do `schema.prisma`, ale `prisma migrate dev` wymaga połączenia z bazą (shadow DB), a kontener nie ma `DATABASE_URL` (provider = postgresql, brak lokalnego Postgresa). Prod stosuje migracje przez `scripts/migrate.js` → `prisma migrate deploy`, które **tylko aplikuje istniejące pliki migracji**, nie generuje ich ze schematu. Sama edycja `schema.prisma` → tabela nigdy by nie powstała na prodzie.

**Rozwiązanie:** Ręcznie napisany `prisma/migrations/0025_vehicle_profile/migration.sql` zgodny z konwencją repo (Float → `DOUBLE PRECISION`, `updatedAt TIMESTAMP(3) NOT NULL`, `createdAt ... DEFAULT CURRENT_TIMESTAMP`, `@unique` → `CREATE UNIQUE INDEX`, FK `ON DELETE CASCADE`). Walidacja przez `npx prisma generate` (działa bez bazy) + `tsc --noEmit` + pełny `next build` (przeszedł, `/truck` jako dynamic route).

**Lekcja:** Bez bazy: `prisma generate` (typy) + ręczna migracja SQL wzorowana na ostatniej + `next build` jako pełna walidacja kompilacji/granic RSC. Pamiętaj, że pliki `"use server"` mogą eksportować **tylko** async funkcje (typy/interfejsy są OK, bo znikają w kompilacji).

## 2026-05-24 — Sidebar-lock działa tylko dla ścieżek znanych `permissionForPath`

**Problem:** Dodanie wpisu do `MODULES` w `AppShell.tsx` i `NavItem` w `ModuleSidebar.tsx` to za mało — blokada (kłódka) i gate strony opierają się o `isPathLocked` → `permissionForPath`. Bez gałęzi dla `/truck` w `permissionForPath` lock by nie zadziałał (tak jak istniejące `/reports`, które nie ma mapowania).

**Rozwiązanie:** Dodać `if (path.startsWith("/truck")) return PERMISSIONS.TRUCK` w `permissionForPath` razem ze slugiem w `PERMISSIONS`. Uprawnienie nadawane idempotentnie w `scripts/migrate.js:seedPermissions()` (mapka grantów per-uprawnienie: `module.truck → [ADMIN, BETA_TESTER]`), bo właśnie tam żyje `module.qa` — nie w migracji SQL.

**Lekcja:** Przy nowym module zawsze ruszasz trójkę: `PERMISSIONS` + `permissionForPath` + seed w `migrate.js`. Sam wpis w nawigacji nie wystarcza.

---

## 2026-05-24 — Scenariusze QA dla 10 modułów: badaj kod równolegle, jeden wspólny helper, slugi globalnie unikalne

**Problem:** Pisząc scenariusze testowe dla wszystkich pozostałych modułów (tasks, notes, kitchen, home, reports, teams, settings, auth, admin, qa-meta) były dwa ryzyka: (1) zmyślenie funkcji, których nie ma w kodzie (np. nieistniejący skrót klawiaturowy, zły zestaw statusów), (2) duplikacja boilerplate (`md()` + pętla upsert) w 11 plikach seedów, plus kolizje slugów między modułami (upsert po slug → kolizja nadpisałaby cudzy scenariusz).

**Rozwiązanie:**
- **Research przez równoległe agenty Explore** przed pisaniem: każdy agent zinwentaryzował realne routes/server-actions/statusy/uprawnienia jednego obszaru. Dzięki temu scenariusze odnoszą się do prawdziwych nazw (`toggleTaskStatus`, `bulkSetMealPlan`, `assertNoteAccess`, role OWNER/ADMIN/MEMBER) zamiast ogólników. Statusy zadań to faktycznie TODO/IN_PROGRESS/DONE/CANCELLED/DEFERRED — bez researchu wpisałbym z głowy.
- **Jeden `qa-helpers.ts`** eksportuje typy + `md()` + `seedModule(prisma, module, epics, authorId)`. Każdy `qa-<module>.ts` eksportuje tylko `*_EPICS: EpicSeed[]`. `qa-all.ts` importuje wszystkie i odpala seedModule w pętli. Refaktor istniejącego `qa-shopping.ts` z inline-logiki na sam eksport tablicy.
- **Weryfikacja unikalności slugów** jednym grepem (`grep -rho 'slug: "..."' | sort | uniq -d`) — zero duplikatów na 201 scenariuszy. Slugi prefiksowane modułem (`scenario-tasks-…`, `scenario-kitchen-…`) eliminują kolizje.

**Lekcja:** Przy generowaniu treści opisującej istniejący kod (scenariusze, dokumentacja, testy) ZAWSZE najpierw zbadaj kod — równoległe agenty Explore to tani sposób na zgruntowanie 10 obszarów naraz bez zaśmiecania własnego kontekstu. Przy N plikach z tym samym wzorcem seeda wyciągnij wspólny `seedModule()` od razu (nie kopiuj pętli upsert 11×). Gdy klucz idempotencji to globalny `slug`, prefiksuj go scope'em i zweryfikuj unikalność jednym poleceniem przed seedem — kolizja slugów po cichu nadpisałaby inny rekord.

---

## 2026-05-24 — Nowy moduł QA: gating przez permission slug, którego wcześniej nie było

**Problem:** Dodając dział QA trzeba było (1) udostępnić go tylko dla `ADMIN` i nowej roli `TESTER`, (2) zapewnić hierarchię treści Epic → User Story → Scenariusz w bazie. Pułapki: schema Prismy jest `postgresql`-only, więc `prisma db push`/`migrate dev` lokalnie failuje (`P1001 localhost:5432`) — nie ma lokalnego Postgresa, dev.db to pusty plik. Druga pułapka: nowy permission `module.qa` nie istnieje w bazie po deployu, a `RolePermission` trzeba zasiać, bo inaczej nawet admin nie zobaczy modułu.

**Rozwiązanie:**
- **Migracja ręczna zamiast `migrate dev`:** napisałem `prisma/migrations/0024_qa_module/migration.sql` ręcznie (CREATE TABLE + indeksy + FK), zgodnie z konwencją wcześniejszych migracji. Lokalnie weryfikacja przez `npx prisma generate` (klient widzi typy) + `npx tsc --noEmit` + `next build` z atrapą `DATABASE_URL` — strony `force-dynamic` nie są prerenderowane, więc build nie dotyka bazy.
- **Seed uprawnień w `scripts/migrate.js`:** po `prisma migrate deploy` skrypt robi `upsert` permission `module.qa` i `RolePermission` dla `ADMIN` + `TESTER` (idempotentnie). Dzięki temu rola TESTER „istnieje" jako zbiór uprawnień bez osobnej tabeli ról — `UserRole.role` to zwykły string. `getAvailableRoles()` w `access.ts` dorzuca wbudowane role do dropdowna, żeby admin mógł przypisać TESTER zanim ktokolwiek ją ma.
- **Trzy osobne tabele zamiast self-relacji:** Epic / UserStory / TestScenario jako oddzielne modele (a nie jedna tabela z `parentId`) — czytelniejsze typy, łatwiejsze `include`, osobne pola (`type`/`priority` tylko na scenariuszu) bez nullowania.

**Lekcja:** Przy module gated nowym uprawnieniem ZAWSZE dodaj seed permission + RolePermission do `scripts/migrate.js` (nie tylko do `PERMISSIONS` w kodzie) — inaczej po deploy moduł jest niewidoczny dla wszystkich. Przy postgres-only schemacie nie próbuj `migrate dev` lokalnie: pisz migration.sql ręcznie i weryfikuj `tsc` + `next build` z atrapą env. Typ z `Promise<X[]>` udostępniaj jako `X` (pojedynczy element), a do propów zagnieżdżonych używaj `X["children"][number]` — nie `X[number]` gdy `X` nie jest tablicą.

---

## 2026-05-22 — Personal dashboard pattern: ukrywaj sekcje per-permission, nie pokazuj „locked"

**Problem:** Stara `HomePage.tsx` pokazywała 3 pille (Shopping/Tasks-dziś/Tasks-overdue) gdzie pille Tasks zostawały na ekranie ale z `Lock` ikoną i `opacity: 0.35` gdy user nie miał `module.tasks`. Niby informacyjne, ale w praktyce: martwy pixel, smog wizualny, mówi "tu coś jest ale nie dla ciebie". Po rozbudowie aplikacji (Kuchnia, Raporty, Zespoły, Admin) wprowadzenie 6+ pille z lockami byłoby tragiczne — user widziałby dashboard pełen ikon kłódki zamiast actionable contentu.

**Rozwiązanie:** Nowa `HomePage.tsx` warunkowo renderuje SEKCJE zamiast lockowanych tile'ów. `ModuleSnapshotGrid` filtruje listę tile'ów wg `userPermissions.includes()` PRZED renderem — user widzi tylko swoje moduły. `TodaySnapshot` ukrywa swoją kolumnę gdy brak permissions lub brak danych. `AdminDashboardWidget` renderowany tylko jeśli `isAdmin`. `InvitationsBanner` widoczny tylko gdy `count > 0`. Footer links zachowuje lockowanie (subtelnie, bo to nawigacja awaryjna). Plus `getSubtitle()` w greeting dynamiczny: „Masz 3 zaległe zadania" / „Dzisiaj czeka 5 zadań" / „2 pozycje do kupienia" — pokazuje stan modułu w jednej linii.

**Lekcja:** Lockowane elementy mają sens tylko gdy `(a)` ich liczba jest niewielka i `(b)` ich pokazanie ma wartość edukacyjną („jest taka feature do której nie masz dostępu"). W dashboardzie power-userskim z 6+ modułami **lepiej ukryć całkowicie niedostępne sekcje** niż utopić dashboard w `opacity: 0.35`. Reguła: jeśli user nie może z tego nic zrobić — nie pokazuj. Wyjątek: nawigacja awaryjna (footer/sidebar) — tam lockowane linki sygnalizują strukturę aplikacji. Drugi insight: `subtitle` w greeting kontekstowy (priority: overdue > today > pending > meals > zero-state) natychmiast komunikuje "co dziś jest ważne" — działa jak personal CEO briefing zamiast statycznego powitania.

---

## 2026-05-21 — Ujednolicenie 4 stron domowych przez ekstrakcję wspólnych primitive'ów

**Problem:** Cztery moduły (Shopping/Tasks/Notes/`/`) miały strony domowe zbudowane na tym samym "języku wizualnym" (max-width 640, h1 22px, sekcje 11px uppercase, karty 14px), ALE każda miała własne dziwactwa: Shopping — 3-kolumnowy management grid z 5 itemami, Tasks — pojedynczy link "Tagi" (a osobno virtual views z tekstowymi liczbami), Notes — brak przycisku Create na home page, główna `/` — własna paleta i layout sekcji. Dodatkowo `/kitchen` w ogóle nie miał home — robił redirect do `/kitchen/recipes`. Niespójność rosła wraz z każdym nowym modułem.

**Rozwiązanie:** Stworzony katalog `src/components/ui/home/` z 5 współdzielonymi primitive'ami: `PageHeader` (h1 z ikoną + subtitle + action), `StatTile` (klikalna kafel ze statystyką, opcjonalnie `emphasized` z accent border), `SectionHeading` (uppercase 11px z optional action po prawej), `ManagementGrid` (auto-fit grid 2-kol fallback), `EmptyState` (ikona + komunikat + opcjonalny CTA). Plus `styles.ts` z cardStyle, page container i hover handlers. Wszystkie 4 strony zrefaktoryzowane. NOWY `KitchenHomePage` zbudowany od zera używając tych samych primitive'ów: stats grid (Przepisy/Posiłki dziś/Spiżarnia/Wygasające), Today's meals (4 sloty), Recently cooked, Expiring soon, Cookbooks carousel, Management grid.

**Lekcja:** "Te same patterns, różne implementacje" w 4 miejscach = każda zmiana wymaga 4 edit'ów i wprowadza nowe rozbieżności. Wyciągnięcie wspólnych primitive'ów do `src/components/ui/home/` zwiększyło spójność (każda strona ma identyczną typografię, padding, hover behavior) i obniżyło koszt dodania kolejnej strony (Kitchen home gotowy w 1 plik, nie 5). Reguła: gdy 3+ strony robią to samo wizualnie różnymi sposobami, refaktoruj do współdzielonego primitive'a — koszt jednorazowy, korzyść w każdym przyszłym dodaniu. Drugi insight: subtitle w header + kontekstowy ("3 zaległe zadania" / "2 posiłki dziś") natychmiast pokazuje stan modułu bez scrollu, znacznie lepiej niż statyczna nazwa.

---

## 2026-05-21 — Headerowy dropdown do przełączania kontekstu modułu = anti-pattern

**Problem:** Moduł Zakupy (najstarszy w projekcie) miał `ListDropdown` w nagłówku strony — custom dropdown pozycjonowany `absolute`, z hover-revealed akcjami rename/delete. Na mobile niemożliwy w użyciu: overlay zawartości, brak hover na touch, mały hit target. Na desktopie cramped między `SortControl`/`Wyczyść`/statsami w headerze. Newer moduły (Tasks) używały już lepszego patternu — sub-sidebar w `ModuleSidebar` plus natywny `<select>` na mobile — ale nikt nie wrócił do Zakupów.

**Rozwiązanie:** Powstał `ShoppingSideNav` mirrorujący `TasksSideNav` (lista entries z inline rename/create/delete, sub-linki Mapy/Ikony, separator), podpięty w `ModuleSidebar` warunkowo dla `/shopping/*`. Mobile dostał natywne `<select>` w headerze strony (jak `TasksPage`) — full-screen native picker iOS/Android. `ListDropdown.tsx` usunięty. Server action `getListSummaries(archived?)` wyciągnięty z `app/shopping/page.tsx` jako jedyne źródło danych dla sidebara i catalogu.

**Lekcja:** Custom dropdown w headerze ≠ rozwiązanie do przełączania kontekstu w module. Wzorzec referencyjny: **sub-sidebar (desktop) + natywny `<select>` (mobile)**. Sub-sidebar daje stały widok wszystkich list z licznikami i miejsce na inline-CRUD bez utrudniającej hover-revealed UI. Natywny `<select>` na mobile to fullscreen UI systemu — zawsze lepszy niż jakikolwiek custom dropdown. Gdy zauważasz że nowsze moduły mają lepszy nawigacji pattern niż starsze, refaktoruj starsze do zgodności — niespójność modułów jest gorsza niż każdy z nich osobno.

---

## 2026-05-21 — `bulkSetMealPlan` race condition: pętla findFirst + create/update bez `$transaction`

**Problem:** W `bulkSetMealPlan` była pętla po `input.entries` z `prisma.mealPlanEntry.findFirst({ date, slot, ownerId })` → `update` albo `create`. Dwa concurrent wywołania (np. AI Plan tygodnia kliknięte dwa razy) mogły oba zobaczyć "slot pusty" i utworzyć duplikaty wpisów dla tej samej kombinacji date×slot×owner. W schemie nie ma `@@unique([date, slot, ownerId])`, więc DB tego nie zatrzyma.

**Rozwiązanie:** Cała pętla owinięta w `prisma.$transaction(async (tx) => {...})`, wszystkie zapytania przepisane na `tx.mealPlanEntry.*`. Liczniki `added`/`skipped` zwracane z transakcji.

**Lekcja:** Każdy server action który robi „find-then-create/update" w pętli to potencjalny race condition. Owijaj w `$transaction` zawsze gdy: (1) jest pętla po wielu rekordach, (2) między `find` a `create/update` może wejść drugi request. Trwałą gwarancją jest też `@@unique` w schemie — ale transakcja serializuje czytanie/pisanie nawet bez constraintu.

---

## 2026-05-21 — Polski plural inline w 5+ miejscach → wyodrębnić utility na drugiej kopii

**Problem:** W kuchni mieliśmy 5 inline-instancji formuły `n === 1 ? 'X' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'Y' : 'Z'` dla "przepis/przepisy/przepisów", "pozycja/pozycje/pozycji", "posiłek/posiłki/posiłków". Powielanie tej samej logiki z drobnymi różnicami (np. `< 10 || >= 20` vs `< 12 || > 14` — pierwsza jest BŁĘDNA dla liczb 12-14 i 112-114).

**Rozwiązanie:** `src/lib/polishPlural.ts` z funkcją `polishPlural(n, [one, few, many])`. Refactor 5 call site'ów (CookbookList, CookbookView, ShopForRecipeDialog, ShoppingFromPlanDialog, PlanWeekDialog).

**Lekcja:** Reguła "trzy podobne linie" — przy drugiej kopii już ekstraktuj. Polski plural ma subtelność `n % 100 ∈ [12,14] → many`, którą inline-formuły czasem łapią błędnie. Jeden punkt prawdy → testowalne i jednorazowo poprawione.

---

## 2026-05-21 — `setUTCHours(12, …)` to świadomy „noon UTC trick" — nazwa wprowadza w błąd

**Problem:** `startOfDayUTC()` ustawiała `setUTCHours(12,0,0,0)`. Nazwa sugeruje początek dnia (północ UTC), kod robi południe UTC. Reviewer mógł "naprawić" na `setUTCHours(0,…)` co skutkowałoby przesunięciem MealPlanEntry o dzień w PL (UTC+1/+2): 2026-05-21T00:00Z = 2026-05-21T02:00 lokalnie OK, ale przy odczycie z `new Date(date).toLocaleDateString("pl")` dla użytkownika z TZ ujemnym dzień się cofa. Noon UTC jest stabilny — żadna strefa nie przesunie tego do innego dnia kalendarzowego.

**Rozwiązanie:** Rename na `dayKeyUTC`, dodany komentarz wyjaśniający dlaczego noon a nie midnight.

**Lekcja:** „Magic numbers" / „magic logic" w date utility ZAWSZE wymagają komentarza wyjaśniającego DLACZEGO. Nazwa funkcji musi mówić co robi (key dla daty), nie jak była zaimplementowana w pierwszej iteracji. Drugi reviewer (lub późniejszy ty) nie ma kontekstu i może "uprościć" coś co było celowe.

---

## 2026-05-21 — `revalidatePath` z ID gdy ścieżka jest po slugu — cache nie unieważnia się

**Problem:** W `markRecipeCooked(id)` byłem nieuważny i napisałem `revalidatePath(\`/kitchen/recipes/${id}\`)`. Tymczasem dynamic route używa `[recipeId]`, ale linki w UI (RecipeView, RecipeCard) używają `recipe.slug`. W efekcie Next.js cachuje stronę pod kluczem slug-owym, a `revalidatePath` z ID nie pasuje do żadnej już wyrenderowanej ścieżki. Po `Ugotowałem` user widzi stary `cookCount` aż do twardego F5.

**Rozwiązanie:** Po `prisma.recipe.update` dorzucić `select: { slug: true }` i wywołać `revalidatePath(\`/kitchen/recipes/${updated.slug}\`)`.

**Lekcja:** `revalidatePath` musi mieć dokładnie tę samą ścieżkę, którą Next.js wyrenderował i zacachował. Jeśli URL używa `slug`, to `id` nie unieważni cache nawet jeśli oba są zaakceptowane przez `getRecipe`. Reguła: w server action pobierz `slug` z rekordu po update i użyj go w `revalidatePath`.

---

## 2026-05-21 — `trackActivity` z literal union modułów — przy nowym module trzeba rozszerzyć typ

**Problem:** Stworzyłem `src/actions/recipes.ts` i `cookbooks.ts` z `trackActivity("kitchen", …)`. TypeScript rzucił `TS2345: Argument of type '"kitchen"' is not assignable to parameter of type '"shopping" | "tasks" | "notes"'` — funkcja `trackActivity` w `src/actions/activity.ts` ma sztywno wpisany literal union dla modułów.

**Rozwiązanie:** Dodanie `"kitchen"` do literal union w sygnaturze `trackActivity(module: "shopping" | "tasks" | "notes" | "kitchen", …)`. Sama tabela `UserActivity.module` to `String` — DB nie wymaga zmian.

**Lekcja:** Po dodaniu nowego modułu — sprawdzić wszystkie literal union typy w `src/actions/activity.ts`, `src/lib/permissions.ts`, `permissionForPath()`, `MODULES` w `AppShell.tsx`. TypeScript wyłapie większość, ale warto przejrzeć ręcznie żeby nie zaskoczyło to dopiero podczas buildu.

---

## 2026-05-20 — Brakujące `teamId` w `select` po rozszerzeniu schematu

**Problem:** Dodaliśmy pole `teamId` do modelu `Report` w `schema.prisma`. Typ `ReportMeta = Omit<Report, "content">` automatycznie zaczął wymagać `teamId`. Oba zapytania Prisma używały `select` bez `teamId`, więc TypeScript rzucił błąd dopiero na produkcyjnym buildzie Render — lokalnie nie było `prisma generate`.

**Rozwiązanie:** Dodanie `teamId: true` do obu `select` w `getReportsMeta()` i `getUserReportsMeta()`. Zmiana rzutowania z `as ReportMeta[]` na `as unknown as ReportMeta[]` tam gdzie mapowanie usuwa pole `author`.

**Lekcja:** Po każdym dodaniu pola do modelu Prisma — przejrzeć wszystkie miejsca które używają `Omit<Model, ...>` jako typ zwracany. Jeśli zapytanie używa `select` (nie `include`), musi jawnie wymieniać każde pole. Typy Prisma są ścisłe — `select` bez nowego pola ≠ pełny model.

---

## 2026-05-20 — Server Actions bez `requireAuth()` na mutacjach

**Problem:** Nowe pliki akcji (`tags.ts`, `noteGroups.ts`) zostały stworzone bez dodania `requireAuth()` do funkcji mutujących (create/update/delete). `getConfigValue()` odczytywał klucz API (`groq_api_key`) bez żadnej ochrony.

**Rozwiązanie:** Dodanie `requireAuth()` do każdej funkcji mutującej w `tags.ts` i `noteGroups.ts`. `getConfigValue()` dostało `requireAdmin()`.

**Lekcja:** Tworząc nowy plik `actions/*.ts` — jako pierwszy krok dodaj `requireAuth()` lub `requireAdmin()` do każdej funkcji która modyfikuje dane. Funkcje tylko-do-odczytu (`getTags`, `getNoteGroups`) mogą być publiczne jeśli dane nie są wrażliwe, ale mutacje zawsze wymagają auth. Funkcje odczytujące wrażliwe dane (klucze API, konfiguracja) — `requireAdmin()`.

---

## 2026-05-20 — Łańcuch przekazywania propsów zerwany (searchQuery)

**Problem:** `NoteRow` implementował podświetlanie wyników wyszukiwania (`highlightMatch`), ale `searchQuery` był urywany na poziomie `NoteList` — nie był destrukturyzowany i nie trafiał do `sharedProps`, przez co `NoteGroupSection` i `NoteRow` nigdy go nie otrzymywały.

**Rozwiązanie:** Dodanie `searchQuery` do destrukturyzacji w `NoteList`, do `sharedProps`, do interfejsu `NoteGroupSectionProps` i do wywołania `NoteRow`.

**Lekcja:** Przy dodawaniu nowego propu do komponentu głęboko w drzewie — zawsze przejść cały łańcuch od góry do dołu i upewnić się że prop jest: (1) w interfejsie każdego komponentu pośredniego, (2) destrukturyzowany, (3) przekazywany dalej. Samo dodanie do interfejsu TypeScript bez destrukturyzacji nie generuje błędu kompilacji — prop po cichu ginie.

---

## 2026-05-20 — Konflikty merge: feature branch vs. bardziej zaawansowany master

**Problem:** Feature branch `claude/update-claude-config-FPi9s` modyfikował te same pliki co master, ale master był bardziej zaawansowany (miał grid view, `assertNoteAccess`, itd.). Merge `--no-ff` do mastera wygenerował konflikty w 8 plikach jednocześnie.

**Rozwiązanie:** `git checkout --ours` dla plików gdzie master był zdecydowanie bardziej kompletny (NoteRow, ShoppingPage, NoteList, NoteGroupSection, CommandPalette, notes.ts). Ręczne scalenie dla `schema.prisma` i `reports.ts` gdzie obie strony wnosiły coś unikalnego.

**Lekcja:** Przed mergem feature brancha — sprawdzić `git diff master...feature-branch` żeby zobaczyć co się rozjechało. Jeśli master poszedł dalej w tych samych plikach, lepiej zrobić `git rebase master` na feature branchu przed mergem — unika konfliktów lub ogranicza je do minimalnego diff. `--no-ff` merge jest dobry dla historii, ale rebase najpierw czyni go czystym.

---

## 2026-05-20 — `prompt()` zablokowany w niektórych kontekstach przeglądarki

**Problem:** `window.prompt()` użyte do tworzenia nowej listy zakupów w CommandPalette jest zablokowane w Safari na iOS w trybie PWA, w niektórych iframe'ach i ogólnie nie pasuje do stylu aplikacji.

**Rozwiązanie:** Inline input wbudowany bezpośrednio w CommandPalette — `useState(creatingList)` + `useState(newListName)` + ref do focusu + obsługa `Enter`/`Escape`.

**Lekcja:** Nigdy nie używać `window.prompt()`, `window.alert()`, `window.confirm()` w aplikacji Next.js. Zawsze zastępować własnym UI — inline inputem, modalem lub toast z akcją. Natywne dialogi są blokowane w PWA, iframe i na iOS Safari.

## 2026-05-29 — Brak UI dodawania na liście zakupów → na mobile nie dało się nic dodać
**Problem:** Widok listy zakupów (`ShoppingPage`) nie renderował żadnego pola dodawania
produktu — jedyną drogą była paleta poleceń (`Ctrl+K`, tylko desktop). Komponent
`QuickAddBar` istniał, ale był osierocony, a `[listId]/page.tsx` pobierał `categoryNames`
i ich nie przekazywał. Na telefonie (brak skrótu klawiszowego) dodawanie było niemożliwe.
**Rozwiązanie:** Podpięto istniejący, responsywny `QuickAddBar` w `ShoppingPage` i przekazano
`categoryNames` z page.tsx.
**Lekcja:** Każda funkcja sterowana wyłącznie skrótem klawiszowym musi mieć też widoczny
element UI (przycisk/pole), inaczej znika na mobile. Po refaktorze sprawdź, czy komponenty
nie zostały „osierocone" — `grep` na użycie komponentu, nie tylko na jego istnienie.

## 2026-05-29 — FAB chowający się za mobilnym dolnym paskiem nawigacji
**Problem:** „Magiczna" ikona AI (FAB) miała `position:fixed; bottom:24; z-index:30`, a dolny
pasek nawigacji na mobile to `z-40`, wysokość `56px + safe-area` — FAB był pod paskiem i
wyglądał na „zniknięty".
**Rozwiązanie:** FAB na klasach Tailwind: `bottom-[calc(72px+env(safe-area-inset-bottom))]
md:bottom-6 z-40` — ponad paskiem na mobile, bez zmian na desktopie.
**Lekcja:** Elementy `position:fixed` w rogu muszą uwzględniać wysokość mobilnego paska
nawigacji (+ `env(safe-area-inset-bottom)`) i mieć z-index ≥ pasek.

## 2026-05-29 — Surowy „Digest" zamiast komunikatu przy błędzie Server Action
**Problem:** Dodanie zadania z desktopu potrafiło rzucić błąd widoczny tylko jako
„Digest: …", bo handler wołał `createTask` w `startTransition` bez `try/catch`, a akcja
mogła rzucić m.in. gdy przekazano wirtualny widok (`all`/`today`) jako `projectId` do
`assertProjectAccess`.
**Rozwiązanie:** Utwardzono `createTask` (walidacja tytułu, wirtualne widoki = brak projektu,
bezpieczne parsowanie dat) i owinięto wywołanie w `try/catch` z `useToast`.
**Lekcja:** Każde wywołanie Server Action z UI owijaj w `try/catch` i pokazuj błąd (Toast) —
„cichy Digest" to brak obsługi błędu. Akcje walidujące `projectId` muszą odsiewać wirtualne
identyfikatory widoków, których nie ma w bazie.

## 2026-05-29 — Lokalny dev: provider Prisma to tylko PostgreSQL (notka SQLite w CLAUDE.md nieaktualna)
**Problem:** `npm run db:push` z `file:./dev.db` zawiódł — `schema.prisma` ma `provider =
"postgresql"`, a Prisma CLI nie czyta `.env.local` (tylko `.env`). Build odpala też
`scripts/migrate.js`, który próbuje połączyć się z bazą.
**Rozwiązanie:** Do walidacji bez bazy wystarczy `prisma validate` + `prisma generate` z
dowolnymi (atrapowymi) `DATABASE_URL`/`DIRECT_URL` (nie łączą się). `next build` kompiluje
strony `force-dynamic` bez połączenia z bazą — błąd dotyczy wyłącznie post-build migracji.
**Lekcja:** Schemat i typy waliduj `prisma validate` + `prisma generate` + `tsc --noEmit` +
`next build`; połączenie z bazą (db:push/migrate) wymaga realnego Postgresa (Docker/Neon),
nie pliku SQLite.

## 2026-05-29 — Kopiowanie do schowka działało na desktopie, na mobile NotAllowedError
**Problem:** Przycisk „Kopiuj prompt dla Claude Code" w adminie (`OmniaClipboardButton`)
wywoływał `navigator.clipboard.writeText()` dopiero PO `await getOmniaTasksForClipboard()`
(server action). Na iOS Safari po `await` przeglądarka traci „transient activation" z gestu
kliknięcia i blokuje zapis do schowka → NotAllowedError. Na desktopie ten sam kod działał.
**Rozwiązanie:** Zapis startujemy synchronicznie w obrębie gestu przez `navigator.clipboard.write`
z `ClipboardItem`, któremu wolno podać `Promise<Blob>` — przeglądarka czeka na tekst nie tracąc
aktywacji. Fallback: `writeText` (desktop/Android), a dla najstarszych przeglądarek textarea +
`execCommand`. Wynik producenta tekstu cache'owany, by fallback nie pobierał danych dwa razy.
**Lekcja:** Na iOS NIGDY nie wołaj `clipboard.writeText` po `await`. Jeśli tekst wymaga async pracy,
przekaż `Promise` do `ClipboardItem` i użyj `clipboard.write([item])` — to jedyny sposób na zachowanie
aktywacji użytkownika po fetchu. Zawsze testuj kopiowanie na realnym Safari/iPhone, nie tylko na desktopie.

## 2026-05-29 — AI tworzyło zadanie w skrzynce zamiast w otwartym projekcie
**Problem:** Na widoku `/tasks/<projectId>` polecenie do „magicznej ikony AI" („utwórz zadanie X")
tworzyło zadanie w skrzynce, nie w otwartym projekcie. `AICommandSheet` wysyłał do LLM tylko opisowy
`routeHint` („widok projektu zadań") bez ID/nazwy projektu, a `execute` przy braku `projectName`
wpadał w fallback do inboxa.
**Rozwiązanie:** `AICommandSheet` wyciąga `activeProjectId` ze ścieżki (tylko dla realnego projektu,
nie widoków wirtualnych today/upcoming/overdue/all) i przekazuje `currentProjectId` do interpret i
execute. Interpret dokleja nazwę bieżącego projektu do promptu (LLM ustawia `projectName` tylko gdy
użytkownik wskaże inny). Execute: gdy brak `projectName`, używa `currentProjectId` (po sprawdzeniu
dostępu) PRZED fallbackiem do skrzynki.
**Lekcja:** Kontekst widoku przekazuj do LLM jako twarde dane (ID), nie tylko opis w `routeHint`.
Domyślne wartości zależne od kontekstu egzekwuj po stronie serwera (execute), nie licz wyłącznie na to,
że model „się domyśli".

## 2026-05-29 — „from Omnia" w powiadomieniu jest NIEUSUWALNE z kodu
**Problem:** Prośba o usunięcie „from Omnia" z tytułu powiadomienia. Śledztwo: aplikacja NIE wysyła
e-maili (brak nodemailer/resend/itp.) ani web-push (brak handlera `push` w `sw.js`, brak VAPID).
Powiadomienia to `new Notification()` w `TasksPage.tsx`. „Omnia" pochodzi z pola `name` manifestu PWA
(`appName.ts` → `APP_TITLE`) i jest doklejane przez SYSTEM/przeglądarkę jako źródło powiadomienia.
**Rozwiązanie:** Brak zmiany w kodzie — sufiks źródła jest dodawany przez OS dla zainstalowanego PWA
(jak u każdej aplikacji) i nie ma API, by go usunąć. Jedyny kodowy regulator to zmiana `name` w
manifeście (zmienia słowo, nie usuwa „from"). Udokumentowano w raporcie zamiast pozorować poprawkę.
**Lekcja:** Atrybucji aplikacji w powiadomieniach (Notification API / web-push) nie da się usunąć z
kodu — to zachowanie systemowe. Nie obiecuj „naprawy"; wyjaśnij ograniczenie i jedyny realny regulator
(nazwa w manifeście).

## 2026-05-29 — Załączniki zdjęć bez zewnętrznego storage → downscale do data-URL w DB
**Problem:** Przepisy miały dostawać załączniki/zdjęcia, ale projekt nie ma żadnego storage (S3/CDN) —
obrazy trzymane były dotąd tylko jako URL-e (string).
**Rozwiązanie:** Zdjęcia zmniejszane po stronie klienta (canvas, max 1400 px, JPEG q≈0.82) i zapisywane
jako `data:`-URL w `RecipeImage.url` (Postgres TEXT). OCR per zdjęcie (vision LLM) zapisuje transkrypcję
w nowym polu `RecipeImage.ocrMarkdown` (NULL=nieanalizowane, ""=brak tekstu), prezentowaną obok zdjęcia.
**Lekcja:** Bez storage pragmatycznie trzymaj zdjęcia jako downscalowane data-URL-e w DB, ale ZAWSZE
zmniejszaj po stronie klienta przed zapisem (rozmiar wiersza/transferu). Rozróżniaj „nieanalizowane"
(NULL) od „przeanalizowane, brak wyniku" ("") — inaczej nie wiadomo, czy ponowić OCR.

## 2026-05-29 — Powiadomienia zadań nie działały na iPhone (new Notification vs Service Worker)
**Problem:** Po poprzedniej poprawce powiadomienia o zadaniach pojawiały się tylko na desktopie,
a na iPhone (Safari/PWA) w ogóle. Kod używał konstruktora `new Notification(...)`, który na iOS
nie jest wspierany — iOS pokazuje powiadomienia wyłącznie przez Service Worker
(`registration.showNotification`). Konstruktor cicho zawodził na telefonie.
**Rozwiązanie:** Dodano `showTaskNotification()` w `TasksPage.tsx`, która najpierw próbuje
`navigator.serviceWorker.ready` → `reg.showNotification(...)` (działa i na iOS, i na desktopie),
a `new Notification()` jest tylko fallbackiem. W `sw.js` dodano handler `notificationclick`
(fokus okna / otwarcie /tasks) i podbito wersję cache do v2. `tag` = klucz dedup, by system nie
zdublował powiadomienia.
**Lekcja:** Powiadomienia w PWA pisz od razu przez `registration.showNotification` — konstruktor
`new Notification()` nie działa na iOS. Każda zmiana w `sw.js` wymaga podbicia wersji cache,
by klient pobrał nowy worker.

## 2026-05-29 — OCR przepisów zwracał błąd (wycofany model wizyjny Groq)
**Problem:** Po wybraniu zdjęcia OCR przepisu zwracał błąd i przepis nie powstawał. Trasy
`/api/llm/kitchen/ocr-image` i `/ocr-text` używały modelu `llama-3.2-11b-vision-preview`, który
Groq WYCOFAŁ (`model_decommissioned`) — każde zapytanie wizyjne kończyło się błędem.
**Rozwiązanie:** Nazwę modelu wyniesiono do `src/lib/groqVision.ts` (`GROQ_VISION_MODEL =
meta-llama/llama-4-scout-17b-16e-instruct`) i podpięto w obu trasach. Dodano `parseGroqError()`,
która wyciąga prawdziwy komunikat z odpowiedzi Groq i dokleja kod HTTP — przy kolejnej awarii widać
realną przyczynę zamiast gołego statusu.
**Lekcja:** Modele „preview" u Groq bywają wycofywane bez zapowiedzi — trzymaj nazwę modelu w jednym
miejscu (stała) i przepuszczaj prawdziwy komunikat błędu dostawcy do frontu, by diagnoza nie wymagała
zgadywania.

## 2026-05-30 — Powiadomienia: brak timera + zawieszanie na navigator.serviceWorker.ready
**Problem:** Po przejściu na `registration.showNotification` powiadomienia działały gorzej —
na komputerze potrafiły zniknąć, na iPhone (apka otwarta) też bywało źle. Dwa błędy: (1) BRAK
timera — `checkDueNotifications` odpalało się tylko przy montażu i zmianie propu `tasks`, więc
przypomnienie „10 min przed" pojawiało się tylko przypadkiem; (2) `navigator.serviceWorker.ready`
to obietnica, która NIGDY się nie odrzuca — przy niezdrowym/nieaktywnym SW `await` wisiał w
nieskończoność i nie było fallbacku na `new Notification()`.
**Rozwiązanie:** Dodano `setInterval` co 30 s (czytający najnowsze zadania przez `tasksRef`) oraz
ścigano `ready` z timeoutem 1,5 s (`Promise.race`) — gdy SW nie odpowie, spadamy na konstruktor
`new Notification()` (desktop). iOS w tle nadal wymaga Web Push (osobny, zaplanowany krok).
**Lekcja:** `navigator.serviceWorker.ready` nigdy nie rejectuje — nie czekaj na nią bez timeoutu,
bo zabijesz ścieżkę fallback. Powiadomienia „o czasie" wymagają własnego timera; sama zależność od
danych w `useEffect` nie wystarcza. Klient pokaże notyfikację tylko gdy apka żyje — tło to Web Push.

## 2026-05-30 — OCR przepisu zwracał 422 (jednostrzałowe zdjęcie→JSON jest kruche)
**Problem:** Po naprawie modelu (scout) import przepisu ze zdjęcia leciał 422 „not-a-recipe" nawet
dla czytelnych kartek. Trasa `ocr-image` prosiła model wizyjny, by JEDNOCZEŚNIE odczytał obraz i
zwrócił sztywny JSON przepisu — model często się „poddawał" i zwracał `{"error":"not-a-recipe"}`.
Model był OK (scout to właściwy model wizyjny Groq; maverick jest wycofywany na rzecz tekstowego
gpt-oss-120b), problemem było połączenie dwóch trudnych zadań w jednym wywołaniu.
**Rozwiązanie:** Rozbito OCR na dwa kroki: (1) model wizyjny robi wierną transkrypcję tekstu ze
zdjęcia, (2) model tekstowy (`llama-3.3-70b-versatile`, tryb `response_format: json_object`) układa
transkrypcję w przepis. 422 zwracamy tylko gdy naprawdę nie odczytano tekstu. Wspólny helper
`groqChat()` + `stripJsonFence()` w `groqVision.ts`. `ocr-text` też dostał tryb JSON.
**Lekcja:** Nie każ modelowi wizyjnemu czytać i strukturyzować w jednym strzale — rozdziel
„czytanie obrazu" (vision) od „układania w JSON" (model tekstowy + json_object). Dużo wyższa
skuteczność, zwłaszcza dla pisma odręcznego.

## 2026-05-30 — Agent „magicznej ikony": akcje celowane po id wymagają re-weryfikacji własności na serwerze
**Problem:** Nowy agent AI pobiera dane przez narzędzia odczytu i generuje akcje zbiorcze celujące
w konkretne rekordy przez `taskId`/`itemId`/`noteId`/`listId`. Te akcje trafiają najpierw do `ActionDrawer`,
gdzie użytkownik może edytować payload — a więc id przychodzące do `/execute` są w pełni klienckie
i NIE wolno im ufać (klient mógłby podstawić cudze id).
**Rozwiązanie:** Egzekutor dla ścieżki id nie robi „gołego" `findUnique(id)`, tylko wykonuje akcję przez
istniejące Server Actions z `src/actions/*` (`updateTask`, `deleteItem`, `updateNote`…), które same
asertują dostęp (`assertProjectAccess`/`assertListAccess`/`assertNoteAccess`). Fallback po `searchQuery`
wyszukuje WYŁĄCZNIE w zakresie własności użytkownika (OR ownerId/team/membership). Pętla agenta jest
bezstanowa — przy `clarify` zwraca transkrypt do klienta i wznawia po dosłaniu odpowiedzi; nawet
zmanipulowany transkrypt nie obejdzie kontroli dostępu, bo te są po stronie serwera w warstwie zapisu.
**Lekcja:** Gdy LLM proponuje akcje na konkretnych rekordach po id, a użytkownik może edytować payload
przed wykonaniem — id są nieufne. Wykonuj zapisy przez te same serwisy co UI (asercje dostępu wewnątrz),
a nie bezpośrednim Prisma po id. Bezpieczeństwo trzymaj w warstwie zapisu, nie w transkrypcie/promptcie.

## 2026-05-31 — Klikanie UI jest możliwe w kontenerze, ale brakuje bibliotek przeglądarki
**Problem:** Claude meldował, że nie może wyklikać UI, bo „strony są bramkowane Google OAuth, a kontener nie ma Postgresa". W rzeczywistości harness E2E już istniał (`scripts/e2e.sh`, `E2E_TEST_MODE=1` → provider `credentials`, Postgres w Dockerze), a kontener ma Dockera. Prawdziwe przeszkody były dwie: (1) Claude nie wiedział o harнессie (CLAUDE.md o nim milczał), (2) w świeżym kontenerze Chromium nie startuje — brak bibliotek systemowych przeglądarki, a `apt`/`playwright install-deps` jest zablokowany polityką sieci.
**Rozwiązanie:** Dopisano do CLAUDE.md sekcję „Weryfikacja klikana (E2E) — JAK i KIEDY". `scripts/e2e.sh` wykrywa brak `DISPLAY` (auto-headless, zdejmuje `--headed`) i przed testami sprawdza, czy Chromium w ogóle wstaje — jeśli nie, kieruje na ścieżkę dockerową. Dodano `scripts/e2e-docker.sh` + `npm run test:e2e:docker`, które odpalają Playwright w oficjalnym obrazie `mcr.microsoft.com/playwright` (ma wszystkie zależności) na sieci hosta — działa nawet bez bibliotek na hoście. Naprawiono też mylący quick-start (schema jest postgres-only, nie SQLite).
**Lekcja:** „Nie da się wyklikać" zwykle nie znaczy „się nie da", tylko „brakuje jednego z klocków": wiedzy o harнессie, bazy, albo bibliotek przeglądarki. W kontenerach bez X-serwera/zależności najpewniejszą drogą jest uruchomienie Playwrighta w jego oficjalnym obrazie Docker, zamiast walki z `apt`.

## 2026-05-31 — Design system: prymitywy UI zamiast inline-style
**Problem:** Raport architektury (§18.2) wskazał setki inline-style w komponentach (np. `home/TodaySnapshot` ~67), brak wspólnych komponentów bazowych — niespójny język wizualny i trudny refaktor.
**Rozwiązanie:** Dodano `src/components/ui/` z prymitywami opartymi WYŁĄCZNIE o tokeny CSS (`var(--bg-*)`, `--text-*`, akcenty): `Button`, `IconButton`, `Card`, `Surface`, `Badge`, `EmptyState` + helper `src/lib/cn.ts` (bez clsx). Plus `src/lib/ownership.ts` (`ownedByWhere`, `getUserScope`, `assertOwnership`) ujednolicający wzorzec dostępu user/zespół powtarzany w ~30 plikach akcji.
**Lekcja:** Przy „głębokim refaktorze" najpierw buduj fundament (prymitywy + helpery) jako kod addytywny, który się kompiluje samodzielnie, a propagację (przepisanie istniejących komponentów/akcji) rób etapami — wtedy build pozostaje zielony, a ryzyko regresji jest rozłożone.

## 2026-06-01 — Polskie cudzysłowy „…” w stringach łamią build (straight `"` w środku)
**Problem:** Przy budowie modułów Wiadomości/Pogoda `next build` wywalał się z „Unterminated string constant" w kilku miejscach. Przyczyną były prompty i placeholdery typu `"… różnych „gorących tematów". …"` — zamykający znak po słowie był zwykłym ASCII `"`, a nie typograficznym `”`. Wewnątrz `"..."` (i atrybutu JSX `placeholder="..."`) taki `"` przedwcześnie kończy string. W template literalach (backtick) i komentarzach to samo nie przeszkadza — dlatego część wystąpień była niegroźna.
**Rozwiązanie:** W stringach delimitowanych `"` usunięto wewnętrzne proste cudzysłowy (albo zamieniono na opis bez cudzysłowu). `grep -nP '„[^"]*"'` szybko wskazuje kandydatów — ale trzeba ręcznie odsiać te w backtickach/komentarzach (bezpieczne) od tych w `"..."`/JSX (psują build).
**Lekcja:** Pisząc polskie teksty w kodzie używaj backticków dla stringów z cudzysłowami, albo trzymaj poprawne pary „…” (U+201E/U+201D). Nie mieszaj prostego `"` w środku stringa delimitowanego `"`. Po napisaniu większej partii promptów warto od razu odpalić `npx next build` (sam typecheck nie złapie błędu składni w stringu).

## 2026-06-01 — Nowe strony nie scrollują się na telefonie (brak własnego kontenera scrolla)
**Problem:** W modułach Wiadomości i Pogoda nie dało się przewijać palcem w pionie na telefonie (w innych działach działało). Strony miały root `<div className="mx-auto max-w-6xl px-4 py-6">` bez własnego kontenera przewijania.
**Rozwiązanie:** `AppShell` ustawia `<main>` jako `overflow-hidden` i deleguje scroll do każdej strony — wzorcowy kontener to `pageContainerStyle` (`flex:1; overflowY:auto`). Owinięto treść obu stron w `<div className="flex-1 overflow-y-auto">` (zewnętrzny scroll) + wewnętrzny `mx-auto max-w-*` (centrowanie). Bez tego treść była przycinana przez `overflow-hidden` na `<main>`.
**Lekcja:** W tym repo `<main>` nie scrolluje — KAŻDA strona modułu musi mieć własny kontener `flex-1 overflow-y-auto` (albo użyć `pageContainerStyle` z `@/components/ui/home`). Tworząc nowy moduł, nie zaczynaj od gołego `mx-auto max-w-*` — to działa na desktopie tylko gdy treść się mieści, a na mobile od razu blokuje przewijanie.

## 2026-06-02 — Wiadomości: „brak nowych" zamiast inicjalizacji bazy wiedzy (ciche fail bootstrapu)
**Problem:** Użytkownik zawsze dostawał „Brak nowych istotnych wiadomości" — nawet dla tematu bez bazy wiedzy, gdzie powinna ruszyć inicjalizacja „jak Wikipedia". Przyczyna: `bootstrapKnowledge` zwracało `false`, gdy nie udało się pobrać ŻADNEGO materiału (feedy RSS bywają błędne, a fallback DuckDuckGo jest blokowany z IP serwerowni Render bez klucza Brave). `refreshTopic` przy `bootstrapped===0` pokazywał generyczny komunikat. Efekt: baza nigdy się nie inicjalizowała, moduł sprawiał wrażenie „martwego".
**Rozwiązanie:** (1) Inicjalizacja zawsze tworzy wersję 1 — gdy są materiały, opiera się na nich; gdy ich brak, LLM pisze obszerną wersję wstępną z wiedzy ogólnej z adnotacją „do weryfikacji". (2) Czytelny błąd, gdy LLM nieskonfigurowany (`LlmError` z `status===503` → komunikat „ustaw model w Admin → LLM"), zamiast cichego „brak nowych". (3) Pozbyto się okna 24h na rzecz znacznika `lastPublishedAt` (najnowsza data publikacji w bazie) — pobieramy tylko nowsze. (4) Zatwierdzenie wiadomości DOPISUJE datowaną sekcję (data publikacji w mediach), nie przepisuje treści.
**Lekcja:** Funkcja, od której zależy „czy w ogóle coś się stanie", nie może po cichu zwracać `false` na każdej ścieżce błędu — rozróżniaj „brak wyników" od „nie dało się wykonać" i albo zawsze dostarcz wynik minimalny (degrade), albo zgłoś czytelny błąd. Generyczny komunikat „brak nowych" maskował trzy różne realne awarie (zły RSS, zablokowany DDG, brak LLM).

---

## 2026-06-03 — Zmiany z jednego urządzenia niewidoczne na innym bez twardego refresh (PWA iOS)
**Problem:** Dane dodane/zmienione/usunięte na urządzeniu A nie pojawiały się na urządzeniu B (ani w drugiej karcie) dopóki użytkownik nie zrobił pełnego przeładowania strony. Przełączenie modułu z menu i powrót też nie odświeżało. Najgorzej w PWA wyciągniętym na ekran główny iPhone'a (Safari standalone) — nie ma paska przeglądarki ani przycisku odświeżania, więc trzeba było ubić całą aplikację. Przyczyny: (1) Server Actions + `revalidatePath()` odświeżają dane TYLKO dla klienta, który wykonał mutację — inne urządzenia nie są powiadamiane; (2) Router Cache Next.js serwuje zcache'owany payload RSC przy nawigacji w obrębie aplikacji.
**Rozwiązanie:** Globalny komponent kliencki `DataFreshness` (montowany raz w `AppShell`) woła `router.refresh()` przy powrocie do aplikacji (`visibilitychange`→visible, `focus`, `pageshow`) oraz cyklicznie co 45 s, ale tylko gdy karta jest widoczna. Throttle `MIN_GAP_MS` 3 s eliminuje podwójny refresh gdy `focus` i `visibilitychange` strzelają naraz; pełny cleanup listenerów + `clearInterval` na unmount. Dodatkowo `experimental.staleTimes: { dynamic: 0 }` w `next.config.mjs` wyłącza ponowne użycie Router Cache dla stron dynamicznych → nawigacja w aplikacji zawsze pobiera świeże dane. Realtime (SSE/WebSocket) świadomie odrzucone — nie współgra z Render free tier (usypianie po 15 min, limity połączeń).
**Lekcja:** W Next.js App Router `revalidatePath()` to NIE jest synchronizacja między urządzeniami — odświeża wyłącznie sesję, która wykonała mutację. Cross-device świeżość bez infrastruktury realtime osiąga się przez `router.refresh()` na zdarzeniach powrotu do aplikacji + lekki polling, a staleności nawigacji w obrębie SPA pozbywa się `staleTimes`. W PWA standalone na iOS NIE MA ręcznego odświeżania — `visibilitychange` jest tam jedynym pewnym haczykiem na „wróciłem do appki, daj świeże dane".

---

## 2026-06-10 — `npx next build` z roota repo: cwd resetuje się między turami + zabłąkane `.next/`
**Problem:** W trakcie sesji `Bash` zwracał cwd `/home/user/home` (root repo), choć wcześniej budowałem z `worldofmag/`. Odpalenie `npx next build` z roota dało „Couldn't find any `pages` or `app` directory" i — co gorsza — npm zaczął ŚCIĄGAĆ `next@16` (bo w roocie nie ma node_modules), a sam start builda zdążył utworzyć `.next/trace`+`.next/trace-build` w roocie. Repo-root `.gitignore` NIE ignorował `.next/` (tylko `worldofmag/.gitignore` to robi), więc `git add -A` wciągnął te artefakty do commita i poszły na `develop`.
**Rozwiązanie:** (1) Każdą komendę zależną od katalogu pisz z jawnym `cd /home/user/home/worldofmag && …` w tej samej linii — cwd Basha potrafi się zresetować między wywołaniami (szczególnie po `git checkout` gałęzi). (2) Usunięto artefakty `git rm -r --cached .next` + dodano `.next/` do **root** `.gitignore`. (3) Przed `git add -A` sprawdzaj `git status --short`, czy nie ma śmieci spoza `worldofmag/`.
**Lekcja:** Nie zakładaj, że cwd Basha trzyma się między turami — prefiksuj `cd <abs-path> &&`. Polecenia narzędziowe (`next`, `prisma`) odpalaj wyłącznie z `worldofmag/`, nigdy z roota (root nie ma node_modules → npm próbuje pobrać pakiet z sieci, co i tak jest blokowane). I pamiętaj, że root repo ma osobny, ubogi `.gitignore` — artefakty buildu spoza `worldofmag/` nie są tam ignorowane.

## 2026-06-10 — Lokalny Postgres (weryfikacja buildu) bywa „down" po czasie — trzeba go wznowić
**Problem:** `npm run build` (pełny, z `scripts/migrate.js`) zaczął padać `P1001: Can't reach database server at 127.0.0.1:5432` mimo że wcześniej w sesji działał. Kontener uśpił/zrestartował klaster Postgresa (był `down` wg `pg_lsclusters`), a do tego zostawił stale pid file.
**Rozwiązanie:** `sudo pg_ctlcluster 16 main start` (sam komunikat „Removed stale pid file" jest nieszkodliwy) → klaster `online` → build przechodzi. `next build` (sam kompilator+typy) NIE potrzebuje DB i przechodzi nawet gdy Postgres leży — DB jest potrzebna dopiero w kroku `migrate deploy` pełnego `npm run build`.
**Lekcja:** W zdalnym sandboxie lokalny Postgres do weryfikacji buildu nie jest trwały — jak `migrate.js` zacznie zgłaszać P1001, najpierw `pg_lsclusters` i ewentualnie `pg_ctlcluster 16 main start`, dopiero potem panikuj. Do szybkiej iteracji nad kodem wystarcza `npx next build` (bez DB); pełny `npm run build` rób przed mergem, gdy DB stoi.

## 2026-06-10 — A2: szyfrowanie kluczy API zalezy od stalego AUTH_SECRET/CONFIG_SECRET
**Problem:** Wdrazajac szyfrowanie sekretow w spoczynku (AES-256-GCM, klucz wyprowadzony z env
`CONFIG_SECRET`||`AUTH_SECRET`), latwo przeoczyc, ze ZMIANA tego env-sekretu czyni wszystkie
zaszyfrowane klucze nieodszyfrowywalnymi (deszyfracja zwraca pusty string → „LLM nie skonfigurowany").
**Rozwiazanie:** `decryptSecret` jest wstecznie kompatybilne (wartosci bez prefiksu `enc:v1:` =
plaintext, zwracane bez zmian), wiec stare klucze dzialaja do pierwszego ponownego zapisu (ktory je
szyfruje). Przy zlym kluczu deszyfracja zwraca "" (nie rzuca), wiec system degraduje sie lagodnie, a
nie crashuje. WAZNE operacyjnie: `AUTH_SECRET` na Render musi byc STALY — jego rotacja wymaga
ponownego wpisania wszystkich kluczy API w panelu admina.
**Lekcja:** Szyfrowanie „at rest" wiaze dane z kluczem z env — udokumentuj to i nigdy nie rotuj
`AUTH_SECRET` bez planu ponownego wprowadzenia sekretow. Funkcje deszyfrujace rob tolerancyjne
(plaintext-passthrough + brak wyjatku na zlym kluczu), by migracja byla bezszwowa, a awaria miekka.

## 2026-06-10 — Pusta migracja zapisana jako „applied" → potem nie da sie dodac tresci
**Problem:** Przez reset cwd Basha `mkdir`+`cat > migration.sql` trafilo do ZLEJ sciezki (root repo),
a w `worldofmag/prisma/migrations/0161.../migration.sql` powstal PUSTY plik. `prisma migrate deploy`
zastosowal pusta migracje (no-op) i zapisal ja w `_prisma_migrations` jako applied. Gdy pozniej
dopisalem prawidlowy SQL do tego pliku, kolejny `migrate deploy` (w `npm run build`) probowal go
uruchomic → kolizja (CREATE TABLE na istniejacej tabeli / checksum mismatch) → FAILED record blokujacy
build.
**Rozwiazanie:** (1) tabele utworzylem recznie `psql -f migration.sql`; (2) pogodzilem stan migracji:
`prisma migrate resolve --rolled-back 0161_...` a potem `--applied 0161_...` (skoro tabela juz
istnieje, nie chcemy jej uruchamiac ponownie). Build przeszedl. Na prodzie migracja zastosuje sie
swiezo z prawidlowa trescia — problem byl wylacznie lokalnym artefaktem.
**Lekcja:** ZAWSZE twórz migracje z `cd .../worldofmag &&` w tej samej linii i OD RAZU wypełnij SQL —
nigdy nie zostawiaj pustego `migration.sql`, bo Prisma zapisze go jako applied i nie pozwoli go pozniej
„dopelnic". Jak juz sie stanie: `migrate resolve --rolled-back` → `--applied` (gdy schemat zgadza sie
recznie) zamiast walczyc z `migrate deploy`.

## 2026-06-13 — Drive OAuth: osobny flow zamiast scope w głównym loginie + redirect_uri/refresh_token
**Problem:** Integracja Dysku Google wymagała serwerowego zapisu plików (drive.file), ale sam „link z prawem do edycji" nie działa serwerowo (Drive API wymaga OAuth/konta serwisowego). Kuszące było dorzucenie scope Drive do istniejącego Google providera NextAuth — to jednak wymusiłoby zgodę na Drive u KAŻDEGO usera przy logowaniu, a `auth.config.ts` jest edge-safe i współdzielony z middleware (Drive client nie wejdzie tam czysto). Dodatkowo łatwo zapomnieć, że refresh_token Google zwraca tylko przy `access_type=offline` + `prompt=consent`, a callback bez zarejestrowanego redirect_uri zwraca `redirect_uri_mismatch`.
**Rozwiązanie:** Osobny, opcjonalny flow OAuth (`/api/drive/connect` → consent → `/api/drive/callback`) uruchamiany przyciskiem w Ustawieniach, niezależny od NextAuth; tokeny per-user w `DriveConnection`, automatyczny refresh. Upload zwraca URL do proxy (`/api/drive/file/<id>`) wstawiany w istniejące pola string — zero zmian schematu modułów. redirect_uri budowany z origin żądania (działa na localhost i prod), `state` w cookie httpOnly chroni przed CSRF.
**Lekcja:** Incremental authorization (osobny przycisk „Połącz") jest czystsze niż rozszerzanie scope głównego loginu, gdy nowe uprawnienie jest opcjonalne i nie każdy go potrzebuje — nie ruszasz krytycznej ścieżki auth ani middleware. Przy Google OAuth pamiętaj o trójce: `access_type=offline` + `prompt=consent` (żeby dostać refresh_token) oraz zarejestrowany redirect_uri w Cloud Console (inaczej `redirect_uri_mismatch`). Lokalnie `prisma` CLI czyta `.env`, a Next `.env.local` — i globalny `npx prisma` może być nowszej majora niż projekt (użyj `./node_modules/.bin/prisma`).

---

## 2026-06-13 — `force-static` na stronie pod AppShell → puste menu (sidebar bez sesji)
**Problem:** Klik „Jak używać?" w Mapach sklepów prowadził na `/shopping/stores/guide`, po czym menu boczne pokazywało tylko kilka pozycji (Reports itd.), a strona robiła się „czarna". Przyczyna: ta strona miała `export const dynamic = "force-static"` (jedyna taka w `src/app`). Prerender na etapie buildu odbywa się BEZ sesji, więc `AppShell`/`ModuleSidebar` renderowały się z pustą listą uprawnień → blokowały wszystkie pozycje wymagające `module.*`, zostawały tylko te bez wymogu permission.
**Rozwiązanie:** usunięcie `export const dynamic = "force-static"` — strona stała się dynamiczna (jak reszta aplikacji), więc ma dostęp do sesji i pełnego menu. Treść strony i tak była statyczna, nic nie stracono. W build output trasa zmienia się z `○ (Static)` na `ƒ (Dynamic)`.
**Lekcja:** W App Routerze layout (`AppShell`) zależny od `auth()`/sesji NIE współgra z `force-static` na stronie potomnej — statyczny prerender „zamraża" widok bez użytkownika, co psuje wszystko, co zależy od uprawnień (sidebar, gating). Stron renderowanych pod uwierzytelnionym shellem nie oznaczaj `force-static`; jeśli chcesz cache, rozważ ISR/segmentowe opcje, ale nie pełną statykę. Szybki wykrywacz: `grep -rn force-static src/app`.

---

## 2026-06-14 — Widok „Dziś" w Zadaniach: doba liczona w strefie serwera (UTC) vs daty zapisywane niespójnie
**Problem:** Zadanie przesunięte o JEDEN dzień w przyszłość nadal pokazywało się na liście „Dziś" (przesunięte o kilka dni — znikało poprawnie). `getTodayTasks`/`getOverdueTasks` oraz liczniki na `/tasks` liczyły granice doby przez `new Date(); setHours(0/23…)`, czyli w strefie **serwera** (Render = UTC). Tymczasem daty `dueDate` zapisywane były jako instanty UTC niespójnie: `TaskRow` używał lokalnego południa (`+"T12:00:00"`), ale `TaskDetail`/`QuickAddTask`/`AITaskInput` robiły `new Date("YYYY-MM-DD")` = **UTC-północ**. Dla użytkownika w UTC+2 instant „jutra" potrafił wpaść w UTC-owe okno „dziś", a tylko granica +1 dnia jest na to wrażliwa (kilka dni = daleko od granicy).
**Rozwiązanie:** Granice doby liczone w strefie **użytkownika**: helper `src/lib/userTime.ts` (`userDayBounds`/`userTomorrowStart`) zwraca instanty UTC odpowiadające lokalnej północy/23:59:59.999, na podstawie ciasteczka `tz` (IANA z `Intl.DateTimeFormat().resolvedOptions().timeZone`, ustawiane raz w `AppShell`; fallback `Europe/Warsaw`). Offset strefy z `Intl.DateTimeFormat(..., {timeZone}).formatToParts` (poprawnie wokół DST). Dodatkowo znormalizowano zapis wybranego dnia do lokalnego południa wszędzie (jak w `TaskRow`), by instant jednoznacznie należał do doby użytkownika.
**Lekcja:** Nigdy nie mieszaj „dnia liczonego w strefie serwera" z instantami UTC zapisywanymi w strefie klienta — `setHours` na serwerze (UTC) to cicha pułapka dla widoków „dziś/jutro". Albo licz granice doby w strefie użytkownika (cookie `tz` + `Intl`), albo trzymaj daty „dniowe" jako stały punkt (np. lokalne południe) i porównuj po dniu. Objaw „błąd tylko przy przesunięciu o 1 dzień, przy kilku dniach OK" to klasyczny sygnał problemu z granicą doby/strefą, nie z logiką filtra.

---

## 2026-07-15 — Spec-driven pipeline: jeden moment pytań + automatyczne przechodzenie między etapami
**Problem:** Pipeline (`/specify /plan /tasks /implement /verify /review`) wymagał od właściciela ręcznego
wpisywania kolejnych komend, a pytania (`AskUserQuestion`) mogły paść na każdym etapie — rozproszone,
uciążliwe. Dodatkowo przycisk „kopiuj prompt dla Claude Code" w Zadaniach kopiował **stary** prompt
(analizuj+implementuj+raport, z nieaktualnym `db:push (dev SQLite)`), zamiast uruchamiać pipeline.
**Rozwiązanie:** (1) Konfrontacja z oficjalnymi źródłami — struktura komend/agentów (`.claude/commands/*.md`
z frontmatterem `description`/`argument-hint`, `.claude/agents/*.md` z `name`/`description`/`tools`) jest
zgodna z dokumentacją Claude Code; metodyka wzorowana na **GitHub Spec Kit** (`/specify→/plan→/tasks→
/implement`), a nasze `/verify` i `/review` to dodatkowe bramki, zaś Spec-Kitowy `/clarify` **zwinęliśmy do
jednego momentu pytań w `/specify`**. (2) `/specify` zbiera **wszystkie** decyzje w JEDNYM `AskUserQuestion`
(opcja rekomendowana zawsze **pierwsza** + etykieta `(zalecane)`), po czym **sam** woła kolejny etap przez
narzędzie **Skill** (`plan`→`tasks`→`implement`→`verify`→`review`); każdy etap kończy się auto-przejściem,
a `/verify`/`/review` przy brakach zawracają do `/implement`. Etapy pośrednie mają zakaz zadawania pytań —
wybierają rekomendowany domyślny i jadą dalej, zatrzymanie tylko przy realnym ryzyku nieodwracalnej szkody.
(3) `OMNIA_LLM_PROMPT` w `src/lib/omniaClipboard.ts` przepisany: wklejony do Claude Code instruuje
uruchomienie `/specify` z tytułami/opisami zadań jako zakresem funkcji. Przewodnik (`.claude/spec-pipeline/
README.md`) + strona `/admin/spec-pipeline` opisują nowy model; po edycji README trzeba **przegenerować**
`src/generated/spec-pipeline.ts` (`node scripts/copy-spec-pipeline.js`), bo `dev` czyta wersję commitowaną.
**Lekcja:** Auto-przechodzenie między komendami w Claude Code robi się tak, że komenda na końcu **wywołuje
skill następnej** (komendy z `.claude/commands/*.md` są też widoczne jako skille) — nie licz na to, że model
„sam się domyśli". Żeby pytania padały raz: skoncentruj `AskUserQuestion` w pierwszej komendzie i w kolejnych
jawnie zabroń pytań (Szymon prawie zawsze bierze opcję rekomendowaną — dawaj ją pierwszą i oznaczaj
`(zalecane)`). I pamiętaj o regeneracji `src/generated/*.ts` po każdej zmianie źródła przewodnika.

---

## 2026-07-15 — Spec-driven pipeline: spójność artefaktów (C-54) + furtka pytań (C-55)
**Problem:** Po pierwszej iteracji pipeline miał dwie luki: (1) etapy pośrednie miały **twardy zakaz
pytań** (wyjątek tylko „utrata danych"), więc przy naprawdę ważnej, nieprzewidzianej decyzji na późnym
etapie pipeline **zgadywał** zamiast spytać; (2) „zawracanie" przy nowych ustaleniach nie było
jednolitą regułą — nie było jasne, że gdy implementacja/plan wykryje błąd we wcześniejszym artefakcie,
trzeba **poprawić ten artefakt** (spec/plan), a nie obejść problem w kodzie.
**Rozwiązanie:** Dodano dwie reguły do `constitution.md` (sekcja G): **C-54 — spójność artefaktów i
zawracanie** (`spec.md → plan.md → tasks.md → kod` to łańcuch prawdy; etap, który wykryje błąd wyżej,
aktualizuje ten plik i przelicza w dół; pętle `/verify`→`/implement`, `/review`→`/implement` wbudowane)
oraz **C-55 — jeden moment pytań z wąską furtką** (pytania skoncentrowane w `/specify`; dalej autonomia,
ale wolno zadać JEDNO zbiorcze pytanie, gdy decyzja jest jednocześnie: istotna, nieprzewidziana na
starcie, kosztowna przy złym wyborze i nierozstrzygalna z artefaktów/kodu). Każda komenda odwołuje się
do C-54/C-55 zamiast powtarzać prozę; przewodnik (README) i strona `/admin/spec-pipeline` opisują
„trzy zasady UX" (jeden moment pytań z furtką / auto-przejścia z zawracaniem / spójność artefaktów).
Subagent `omnia-implementer` (nie ma jak wołać `AskUserQuestion`) **oddaje** furtkową decyzję wołającemu.
**Lekcja:** W autonomicznym pipeline nie stawiaj „nigdy nie pytaj" — to zmusza model do zgadywania.
Lepszy jest **wysoki próg z furtką**: domyślnie autonomia + rekomendowany domyślny, ale jawnie
dozwolone jedno zbiorcze pytanie przy naprawdę ważnej, niejednoznacznej decyzji. I zawsze trzymaj
**spójność artefaktów** — nowe ustalenie na późnym etapie ma wracać do właściwego pliku (spec/plan),
inaczej zostaje rozjazd „kod robi X, spec mówi Y". Reguły przebiegu warto trzymać w konstytucji
(numerowane), by komendy tylko się do nich odwoływały. Po edycji README pamiętaj o
`node scripts/copy-spec-pipeline.js` (regeneracja `src/generated/spec-pipeline.ts`).

---

## 2026-07-15 — Spec pipeline: /review bez ręcznego approve + obowiązkowe pytanie o merge do master
**Problem:** Właściciel chciał, by `/review` przechodził automatycznie (sam wystawiał werdykt, bez jego
approve — jak reszta etapów), a cały pipeline **zawsze** kończył się jednym pytaniem
„Mistrzu Magu, czy zrobić merge develop do master?" (promocja na produkcję).
**Rozwiązanie:** `/review` wystawia werdykt sam; po APPROVE robi merge do `develop` (standing
authorization, bez pytania), a na sam koniec zadaje **jedno** `AskUserQuestion` o promocję `develop →
master` z opcją „Nie — zostaw na develop" jako rekomendowaną pierwszą (`master` = produkcja, C-52). Na
„Tak" pipeline robi `checkout master` → `merge --no-ff develop` → `push` (jedyny moment dotknięcia
`master`). W konstytucji: C-52 rozszerzone o obowiązkowe pytanie domykające, a C-55 dostał „wyjątek
sankcjonowany" — to pytanie jest zawsze zadawane i nie łamie zasady „jednego momentu pytań".
Przy okazji: dodane w JSX zdanie w cudzysłowach drukarskich („…") łapało warning
`react/no-unescaped-entities` — rozwiązane przez wrzucenie tekstu w wyrażenie-string `{"…"}` (nie dokłada
do puli ~64 kosmetycznych warningów, które i tak są na roadmapie do sprzątnięcia).
**Lekcja:** W autonomicznym pipeline „approve" na końcu ma wystawiać sam recenzent — approve właściciela
to tylko **bramka produkcyjna** (`develop → master`), i tę robimy jednym, zawsze-zadawanym pytaniem z
bezpiecznym domyślnym „Nie". Cudzysłowy drukarskie w tekście JSX pakuj w `{"…"}`, żeby nie budzić
`react/no-unescaped-entities`.

## 2026-07-20 — Iteracja po `Set` w Server Action wywala `next build` (downlevelIteration)
**Problem:** Nowa akcja `bulkUpdateTasks` używała `for (const pid of affectedProjectIds)` po `Set<string>`.
`next build` (typecheck) padał: „Type 'Set<string>' can only be iterated through when using the
'--downlevelIteration' flag or with a '--target' of 'es2015' or higher" — tsconfig projektu ma niższy
target/brak downlevelIteration.
**Rozwiązanie:** Zamiana na `Array.from(set).forEach(...)`. `lint` tego nie łapie — wychodzi dopiero na
kroku „Checking validity of types" w `next build`.
**Lekcja:** W kodzie `src/` nie iteruj `Set`/`Map` przez `for...of` ani span spreadem w gorących
miejscach — używaj `Array.from(...)`. Realny typecheck daje dopiero `next build`, nie sam `lint`.
