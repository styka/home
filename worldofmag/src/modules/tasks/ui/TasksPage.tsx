"use client";

import { useState, useRef, useMemo, useCallback, useTransition, useEffect } from "react";
import Link from "next/link";
import { ListTodo, Search, X, Sparkles, Bell, BellOff, SlidersHorizontal, ListTree, Flag, Pencil, List as ListIcon, Columns3, CalendarRange, ArchiveRestore, CheckSquare, ChevronLeft, ChevronRight, Share2, FolderTree } from "lucide-react";
import { TaskFilters } from "./TaskFilters";
import { TaskList } from "./TaskList";
import { KanbanBoard } from "./KanbanBoard";
import { TimelineView } from "./TimelineView";
import { TaskDetail } from "./TaskDetail";
import { TaskStatusConfigEditor } from "./TaskStatusConfigEditor";
import { QuickAddTask, type QuickAddTaskHandle } from "./QuickAddTask";
import { ProjectActionsMenu } from "./ProjectActionsMenu";
import { TaskListClipboardButton } from "./TaskListClipboardButton";
import { useTrybAdmina } from "@/platform/admin/trybAdmina";
import { useTranslations } from "next-intl";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { BulkActionBar, type BulkPatch } from "./BulkActionBar";
import { ProjectScopeFilter } from "./ProjectScopeFilter";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useIsNarrowScreen } from "@/hooks/useVisualViewport";
import { odczytajUklad, zapiszUklad, ograniczSzerokosc, UKLAD_DOMYSLNY } from "../lib/ukladSzczegolow";
import { odczytajWariantObszarow, zapiszWariantObszarow, WARIANT_DOMYSLNY, type WariantObszarow } from "../lib/wariantObszarow";
import { ObszaryWidok } from "./ObszaryWidok";
import type { ObszarDTO } from "../actions/obszary";
import { useViewState } from "@/hooks/useViewState";
import { idList, oneOf, type RawParams } from "@/platform/viewState/viewState";
import { deleteTask, toggleTaskStatus, bulkUpdateTasks, bulkDeleteTasks } from "../actions/tasks";
import { ModuleView } from "@/components/ui/view";
import type { Task, TaskProject, TaskTagDef, TaskStatusFilter, ViewMode, ProjectStatusConfig } from "@/types";
import { resolveStatuses, statusMetaFor, DEFAULT_STATUS_CONFIG } from "@/types";
import { useConfirm } from "@/components/ui/ConfirmProvider";

interface TasksPageProps {
  tasks: Task[];
  allProjects: TaskProject[];
  allTags: TaskTagDef[];
  projectId: string;
  inboxId: string;
  viewMode: ViewMode;
  projectName: string;
  teamMembers: Array<{ id: string; name: string | null; email: string | null; image: string | null }>;
  initialOpenTaskId?: string;
  statusConfig?: ProjectStatusConfig;
  canEditStatuses?: boolean;
  isAdmin?: boolean;
  /** Widok wielu projektów: projekty w zakresie (chipy pod nagłówkiem). */
  scopeProjects?: Array<{ id: string; name: string; emoji: string; isInbox: boolean }>;
  /** Id zapisanej grupy projektów (gdy widok otwarty z grupy) — do edycji. */
  multiGroupId?: string;
  /** 117: obszary bieżącego projektu (tylko widok projektu; widoki wirtualne dostają pustą). */
  areas?: ObszarDTO[];
  /**
   * 043: parametry adresu przekazane z serwera (`page.tsx` → `searchParams`). Stan widoku czytamy
   * stąd, a NIE z `window` w pierwszym renderze — inaczej serwer wyrenderowałby widok domyślny,
   * klient przefiltrowany i powstałby rozjazd hydratacji (patrz `doświadczenia.md`, 2026-08-02).
   */
  viewParams?: RawParams;
}

export function TasksPage({ tasks, allProjects, allTags, projectId, inboxId, viewMode, projectName, teamMembers, initialOpenTaskId, statusConfig = DEFAULT_STATUS_CONFIG, canEditStatuses = false, isAdmin = false, scopeProjects = [], multiGroupId, areas = [], viewParams = {} }: TasksPageProps) {
  // 085 (AC-8): administracyjny eksport listy do schowka jest DODATKIEM dla administratora, więc
  // znika razem z resztą, gdy tryb administratora jest wyłączony.
  const { wlaczony: trybAdmina } = useTrybAdmina();
  const t = useTranslations("modules.tasks.TasksPage");
  const confirmDialog = useConfirm();
  const [statusConfigOpen, setStatusConfigOpen] = useState(false);

  // 043: filtr, tagi, grupowanie i układ żyją w ADRESIE strony — dzięki temu zapisany ulubiony
  // widok wraca z tymi samymi ustawieniami, adres da się skopiować, a „wstecz" cofa filtr.
  // Klucz filtra to zwykły tekst (`text`), a nie zamknięta lista: projekty mają WŁASNE statusy,
  // więc dopuszczalnych wartości nie da się wypisać z góry.
  //
  // Klucze parametrów dobrane pod TO, co adres Zadań już niesie: `status` jest istniejącym
  // parametrem (wejście z asystenta/linku `?status=…`), więc go REUŻYWAMY zamiast dokładać drugi
  // o tym samym znaczeniu. `group` i `view` są zajęte przez grupy projektów, stąd `groupBy`.
  // Dopuszczalne wartości filtra to „Wszystkie" + statusy WŁĄCZONE w tej liście — projekty mają
  // własne statusy, więc listy nie da się zapisać na sztywno; wartość spoza niej wraca do „ALL",
  // dokładnie jak dotychczasowa walidacja `initialFilter` na serwerze.
  // Wartością domyślną jest zawsze „ALL", NIE `initialFilter`. To nie jest drobiazg: `serialize`
  // pomija wartość równą domyślnej, więc gdyby domyślną było `initialFilter` (np. „DONE" z linku
  // `?status=DONE`), parametr wypadłby z adresu i po odświeżeniu widok wróciłby do „Wszystkie".
  // `initialFilter` i tak pochodzi z tego samego parametru, więc nic nie tracimy.
  const viewSpec = useMemo(() => ({
    status: oneOf(["ALL", ...statusConfig.enabled], "ALL"),
    tags: idList(),
    // 080 (Z3): zakres projektów jako FILTR widoku, nie jako źródło danych. Kluczowa różnica:
    // gdy parametr zniknie z adresu, `idList()` daje pustą listę, a pusta lista znaczy tu
    // „wszystkie projekty" — nigdy „żaden". Poprzedni widok wielu projektów miał odwrotnie
    // i to była cała przyczyna pustego ekranu po zmianie statusu zadania.
    projekty: idList(),
    groupBy: oneOf(["default", "priority"] as const, "default"),
    layout: oneOf(["list", "kanban", "timeline", "obszary"] as const, "list"),
    // 117 (AC-4): wariant przeglądania „wg obszarów" w ADRESIE (widok ulubiony wraca taki, jaki
    // był); ostatnio użyty wariant z localStorage wchodzi tylko, gdy adres go nie niesie.
    obszary: oneOf(["sekcje", "drill", "panel"] as const, WARIANT_DOMYSLNY),
  }), [statusConfig]);
  const [view, setView] = useViewState(viewSpec, viewParams);

  // Settery owinięte w `useCallback`, bo trafiają do zależności `useMemo` z obsługą skrótów —
  // niestabilna referencja przeliczałaby ten memo przy każdym renderze.
  const activeFilter = view.status;
  const setActiveFilter = useCallback((value: string) => setView({ status: value }), [setView]);
  const selectedTagIds = view.tags;
  const setSelectedTagIds = useCallback(
    (next: string[] | ((prev: string[]) => string[])) =>
      setView((prev) => ({ tags: typeof next === "function" ? next(prev.tags) : next })),
    [setView],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(initialOpenTaskId ?? null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialOpenTaskId ?? null);
  // Świeżo dodane zadanie — fallback dla panelu szczegółów. W widokach wirtualnych
  // (Dziś/Nadchodzące/Zaległe) nowe zadanie trafia do Skrzynki bez terminu, więc nie
  // wchodzi do przefiltrowanej `tasks`; trzymamy zwrócony obiekt, by panel i tak się otworzył.
  const [justCreated, setJustCreated] = useState<Task | null>(null);
  // „Migawka" ostatniej znanej wersji otwartego zadania. Gdy zmiana statusu lub terminu
  // wypchnie zadanie z bieżącego (przefiltrowanego serwerowo) widoku — np. ukończenie w
  // widoku aktywnych albo zmiana terminu poza „Dziś"/„Nadchodzące" — zadania nie ma już w
  // propie `tasks`, więc bez tej migawki panel szczegółów/edycji by się zamknął. Trzymamy
  // panel otwarty na ostatniej znanej wersji; z listy zadanie i tak znika.
  const [openTaskSnapshot, setOpenTaskSnapshot] = useState<Task | null>(null);
  /**
   * 105 (AC-9..AC-12a) — UKŁAD PANELU SZCZEGÓŁÓW.
   *
   * Zgłoszenie właściciela: „komponent z widokiem zadania jest przyklejony do prawej strony
   * przeglądarki i jest taki wąski i niski". Panel miał sztywne 380 px i nie dało się z tym nic
   * zrobić. Teraz szerokość jest ustawialna, a `pelny` oddaje zadaniu całą przestrzeń modułu.
   *
   * Pierwszy render idzie z wartościami DOMYŚLNYMI, a preferencja wczytuje się dopiero w efekcie:
   * serwer nie zna `localStorage`, więc odczyt w trakcie renderu zerwałby hydratację (ta sama
   * pułapka co w `doświadczenia.md`, 2026-08-02).
   */
  const [uklad, setUklad] = useState(UKLAD_DOMYSLNY);
  useEffect(() => {
    const zapisany = odczytajUklad();
    setUklad({ ...zapisany, szerokosc: ograniczSzerokosc(zapisany.szerokosc, window.innerWidth) });
  }, []);
  const zapiszIUstawUklad = useCallback((zmiana: Partial<typeof UKLAD_DOMYSLNY>) => {
    setUklad((poprzedni) => { const nowy = { ...poprzedni, ...zmiana }; zapiszUklad(nowy); return nowy; });
  }, []);
  const przeciaganieRef = useRef<{ startX: number; startSzerokosc: number } | null>(null);
  /**
   * Tryb pełny jest ustawieniem KOMPUTERA — na telefonie panel i tak przykrywa cały ekran własnym
   * elementem. Bez tego warunku włączony tryb chowałby listę także na wąskim ekranie, gdzie nie ma
   * jej czym zastąpić. Używamy istniejącego hooka, zamiast dokładać drugi sposób pytania o szerokość.
   */
  const waskiEkran = useIsNarrowScreen();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // Prezentacja listy: "default" = naturalne grupowanie widoku (dni/projekty), "priority" = po priorytetach.
  // Dotyczy widoków „Nadchodzące/Zaległe/Wszystkie" (Dziś i projekty są zawsze po priorytetach).
  const groupBy = view.groupBy;
  const setGroupBy = useCallback((value: "default" | "priority") => setView({ groupBy: value }), [setView]);
  const setLayout = useCallback((value: "list" | "kanban" | "timeline" | "obszary") => setView({ layout: value }), [setView]);
  // 117: widok „wg obszarów" istnieje tylko w realnym projekcie (obszary należą do projektu);
  // adres z `layout=obszary` w widoku wirtualnym degraduje NIESZKODLIWIE do listy (zasada z 080).
  const obszaryDostepne = viewMode === "project";
  const layout = view.layout === "obszary" && !obszaryDostepne ? "list" : view.layout;
  const wariantObszarow = view.obszary;
  const setWariantObszarow = useCallback(
    (w: WariantObszarow) => { zapiszWariantObszarow(w); setView({ obszary: w }); },
    [setView],
  );
  // Ostatnio użyty wariant jako domyślny przy wejściu bez parametru; adres zawsze wygrywa (AC-4).
  useEffect(() => {
    if (viewParams.obszary !== undefined) return;
    const zapamietany = odczytajWariantObszarow();
    if (zapamietany !== WARIANT_DOMYSLNY) setView({ obszary: zapamietany });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jednorazowo na wejściu do widoku
  }, []);
  const canToggleGrouping = viewMode === "upcoming" || viewMode === "overdue" || viewMode === "all" || viewMode === "multi";
  const [, startTransition] = useTransition();
  // Bulkowa (zbiorcza) edycja — tryb zaznaczania + zaznaczone id + kotwica zakresu (Shift).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const quickAddRef = useRef<QuickAddTaskHandle>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);
  // Pasek akcji na wąskich ekranach przewija się poziomo. Bez wizualnej wskazówki użytkownik nie wie,
  // że są kolejne ikony poza kadrem — trzymamy stan „czy można przewinąć w lewo/prawo" i pokazujemy
  // zanikający gradient („fade") na odpowiedniej krawędzi.
  const actionsScrollRef = useRef<HTMLDivElement>(null);
  const [actionScroll, setActionScroll] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  // Zadania, dla których już wysłaliśmy powiadomienie (klucz: id + termin).
  // Przeżywa re-rendery i zmiany propu `tasks`, więc nie dublujemy notyfikacji.
  const notifiedRef = useRef<Set<string>>(new Set());

  // For virtual views, create tasks in inbox instead
  // 080 (Z3): „multi" przestało być identyfikatorem trasy — zapisany zestaw ma własny adres
  // (`/tasks/zestaw/<id>`) i przychodzi tu z pustym `projectId`, ale z `viewMode === "multi"`.
  const isVirtualView = ["today", "upcoming", "overdue", "all"].includes(projectId) || viewMode === "multi";
  // 090 (zadanie 14): okno udostępniania. Dostaje tylko `resourceType` (tekst z deklaracji) i `id`,
  // więc nie wiąże Zadań z warstwą udostępniania — moduł nie ma tu ani jednej własnej linii logiki
  // dostępu. Widoki wirtualne (dziś/zaległe/wszystkie) nie są zasobem, więc nie mają czego udostępnić.
  const [udostepnianieOtwarte, setUdostepnianieOtwarte] = useState(false);
  const tShare = useTranslations("tasks");
  const addProjectId = isVirtualView ? inboxId : projectId;

  // Świeża wersja z listy; jeśli zadania tam (jeszcze/już) nie ma — użyj świeżo utworzonego.
  const liveOpenTask = openTaskId
    ? tasks.find((t) => t.id === openTaskId) ?? (justCreated?.id === openTaskId ? justCreated : null)
    : null;
  // Panel pokazuje świeżą wersję, a gdy zadanie wypadło z widoku — ostatnią migawkę
  // (tylko dla aktualnie otwartego id, żeby nie pokazać poprzedniego zadania).
  const openTask = openTaskId
    ? liveOpenTask ?? (openTaskSnapshot?.id === openTaskId ? openTaskSnapshot : null)
    : null;

  // Najnowsza lista zadań dla timera — bez tego interwał (zależności []) widziałby
  // tylko `tasks` z pierwszego renderu.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Przelicz wskazówkę przewijania paska akcji na mount, przy resize i gdy zmienia się zestaw
  // widocznych ikon (widok/układ/uprawnienia zmieniają szerokość rzędu).
  useEffect(() => {
    const el = actionsScrollRef.current;
    if (!el) return;
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setActionScroll({ left: el.scrollLeft > 1, right: el.scrollLeft < maxScroll - 1 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [viewMode, layout, canEditStatuses, isAdmin, selectionMode]);

  // Preferencja grupowania przeżywa nawigację między widokami (localStorage).
  // 043: ADRES MA PIERWSZEŃSTWO — gdy w adresie jest `group`, zapamiętana preferencja go nie
  // nadpisuje (inaczej otwarcie zapisanego ulubionego widoku dawałoby inne grupowanie niż zapisane).
  // Przywrócenie z pamięci idzie przez `replace`, żeby nie dokładać wpisu do historii przeglądarki.
  useEffect(() => {
    if (viewParams.groupBy !== undefined) return;
    const saved = localStorage.getItem("tasks.groupBy");
    if (saved === "priority" || saved === "default") setView({ groupBy: saved }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    localStorage.setItem("tasks.groupBy", groupBy);
  }, [groupBy]);

  // Cykliczne sprawdzanie terminów. Wcześniej `checkDueNotifications` odpalało się
  // tylko przy montażu i zmianie propu `tasks`, więc przypomnienie „10 min przed"
  // pojawiało się jedynie przypadkiem (gdy akurat coś przeładowało listę). Timer co
  // 30 s gwarantuje, że termin zostanie złapany niezależnie od zmian danych.
  useEffect(() => {
    const id = setInterval(() => checkDueNotifications(tasksRef.current), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Otwarte szczegóły → wpis w historii, by przycisk „wstecz" zamykał panel
  // (zamiast opuszczać stronę), zwłaszcza na mobile.
  // Po zamknięciu panelu porzuć fallback świeżo utworzonego zadania (każda ścieżka zamknięcia).
  useEffect(() => {
    if (!openTaskId) { setJustCreated(null); setOpenTaskSnapshot(null); }
  }, [openTaskId]);

  // Dopóki otwarte zadanie jest w widoku, odświeżamy jego migawkę. Gdy zniknie z listy
  // (zmiana statusu/terminu), migawka zostaje ostatnią znaną wersją i panel nie zamyka się.
  useEffect(() => {
    if (liveOpenTask) setOpenTaskSnapshot(liveOpenTask);
  }, [liveOpenTask]);

  useEffect(() => {
    if (!openTaskId) return;
    window.history.pushState({ taskDetail: true }, "");
    const onPop = () => setOpenTaskId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [openTaskId]);

  // Wyświetla powiadomienie. Preferuje Service Worker (`registration.showNotification`),
  // bo iOS Safari / PWA NIE wspiera konstruktora `new Notification()` — tam działa tylko
  // ścieżka SW. Na desktopie SW też działa.
  //
  // UWAGA: `navigator.serviceWorker.ready` to obietnica, która NIGDY nie jest odrzucana —
  // gdy SW nie jest aktywny (np. błąd rejestracji), zawiesza się w nieskończoność. Poprzednia
  // wersja czekała na nią bez limitu, więc przy niezdrowym SW powiadomienia na komputerze
  // przestawały działać (brak fallbacku). Dlatego ścigamy `ready` z krótkim timeoutem i przy
  // braku aktywnego SW spadamy na konstruktor (desktop), a gdy i to się nie uda — milczymy.
  const showTaskNotification = useCallback(async (title: string, options: NotificationOptions) => {
    if ("serviceWorker" in navigator) {
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (reg && "showNotification" in reg) {
          await reg.showNotification(title, options);
          return;
        }
      } catch {
        /* spadamy do fallbacku poniżej */
      }
    }
    try {
      new Notification(title, options);
    } catch {
      /* środowisko bez wsparcia powiadomień */
    }
  }, []);

  const checkDueNotifications = useCallback((taskList: Task[]) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    taskList.forEach((t) => {
      if (!t.dueDate || t.status === "DONE" || t.status === "CANCELLED") return;
      const due = new Date(t.dueDate);
      if (due < now || due > soon) return;
      // Dedup: jedno powiadomienie na zadanie + termin. Bez tego każdy re-render
      // (zmiana propu `tasks` / rewalidacja) wysyłał kolejną notyfikację.
      const key = `${t.id}:${t.dueDate}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      // Treść wskazuje konkretny projekt (a nie tylko nazwę aplikacji „Omnia”, którą
      // system doklepuje jako źródło powiadomienia).
      const project = t.project?.isInbox ? "Skrzynka" : t.project?.name ?? "Skrzynka";
      const projectLabel = t.project?.emoji ? `${t.project.emoji} ${project}` : project;
      const time = due.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      void showTaskNotification(`Zadanie za chwilę: ${t.title}`, {
        body: `Projekt: ${projectLabel} · Termin: ${time}`,
        icon: "/pwa-icon/192",
        tag: key, // ten sam tag = system nie zdubluje powiadomienia
      });
    });
  }, [showTaskNotification]);

  // Poniżej definicji `checkDueNotifications` (const nie hoistuje się jak dawna deklaracja funkcji).
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotificationsEnabled(Notification.permission === "granted");
    }
    checkDueNotifications(tasks);
  }, [tasks, checkDueNotifications]);

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotificationsEnabled(perm === "granted");
  }

  /**
   * 080 (Z3): zadania po zawężeniu do wybranych projektów.
   *
   * Zawężamy PRZED liczeniem zakładek i liczników, bo inaczej „Wszystkie (17)" opisywałoby coś
   * innego niż lista pod spodem. Pusty wybór = brak zawężenia.
   */
  const zadaniaWZakresie = useMemo(() => {
    if (view.projekty.length === 0) return tasks;
    const dozwolone = new Set(view.projekty);
    return tasks.filter((t) => t.projectId && dozwolone.has(t.projectId));
  }, [tasks, view.projekty]);

  const displayedTasks = useMemo(() => {
    if (aiSearchResults !== null) {
      return aiSearchResults.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as Task[];
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return zadaniaWZakresie.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tt) => tt.tag.name.includes(q))
      );
    }
    return zadaniaWZakresie;
  }, [zadaniaWZakresie, tasks, searchQuery, aiSearchResults]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    // „Aktywne" = statusy nie-terminalne (DONE/CANCELLED wykluczone, ale W weryfikacji liczy się).
    result["ALL"] = zadaniaWZakresie.filter((t) => !statusMetaFor(t.status, statusConfig).isTerminal).length;
    for (const s of resolveStatuses(statusConfig)) {
      result[s.key] = zadaniaWZakresie.filter((t) => t.status === s.key).length;
    }
    return result;
  }, [zadaniaWZakresie, statusConfig]);

  // Etykiety zakładek (z nazwami własnych statusów); „ALL" stałe.
  const filterLabels = useMemo<Record<string, string>>(
    () => ({ ALL: "Wszystkie", ...Object.fromEntries(resolveStatuses(statusConfig).map((s) => [s.key, s.label])) }),
    [statusConfig]
  );

  // Zakładki filtrów zależne od konfiguracji listy: „Wszystkie" + włączone statusy.
  const statusFilters = useMemo<string[]>(
    () => ["ALL", ...statusConfig.enabled],
    [statusConfig]
  );

  // Zadania faktycznie widoczne w bieżącej zakładce — to samo filtrowanie co w TaskList
  // (status zakładki + tagi, na bazie wyników wyszukiwania). Używane przez przycisk
  // „Kopiuj prompt dla Claude", żeby kopiował dokładnie to, co admin ma przed sobą,
  // a nie wszystkie aktywne zadania listy.
  const visibleTasks = useMemo(() => {
    const byStatus =
      activeFilter === "ALL"
        ? displayedTasks.filter((t) => !statusMetaFor(t.status, statusConfig).isTerminal)
        : displayedTasks.filter((t) => t.status === activeFilter);
    if (selectedTagIds.length === 0) return byStatus;
    return byStatus.filter((t) =>
      selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid))
    );
  }, [displayedTasks, activeFilter, selectedTagIds, statusConfig]);

  // ─── Bulkowa edycja: handlery zaznaczenia ──────────────────────────────────
  /**
   * 105 (AC-17..AC-20) — DWIE funkcje zamiast jednej.
   *
   * Do 105 stało tu `finishSelection`, które robiło dwie rzeczy naraz: czyściło zaznaczenie
   * ORAZ gasiło tryb. Wołane było w sześciu miejscach — i to jest cała przyczyna zgłoszenia:
   * po każdej akcji masowej tryb checkboxów znikał, więc kolejną serię trzeba było zaczynać od
   * ponownego klikania ikony. Nazwa („zakończ") pasowała do trzech z sześciu wywołań, a do
   * trzech pozostałych nie — i nikt tego nie widział, bo obie rzeczy siedziały w jednym ciele.
   *
   * Rozdzielenie jest tu ważniejsze niż wygląda: dopóki „wyczyść" i „wyjdź" są jedną funkcją,
   * każde nowe wywołanie znowu wybierze przypadkiem oba zachowania.
   */
  /** Po akcji masowej: zaznaczenie znika (te zadania są już zmienione), TRYB ZOSTAJE. */
  const wyczyscZaznaczenie = useCallback((msg: string | null) => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
    setBulkMessage(msg);
    if (msg) setTimeout(() => setBulkMessage(null), 4000);
  }, []);
  /** Jawne wyjście z trybu: przycisk w pasku akcji, `Esc`, opuszczenie widoku listy. */
  const zakonczZaznaczanie = useCallback(() => {
    setSelectionMode(false);
    wyczyscZaznaczenie(null);
  }, [wyczyscZaznaczenie]);
  function toggleSelectOne(id: string) {
    setSelectionMode(true);
    setSelectedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setLastSelectedId(id);
  }
  function selectRange(ids: string[]) {
    setSelectionMode(true);
    setSelectedIds((s) => { const n = new Set(s); ids.forEach((i) => n.add(i)); return n; });
    setLastSelectedId(ids[ids.length - 1] ?? null);
  }
  function toggleSelectAllVisible() {
    const ids = visibleTasks.map((t) => t.id);
    const allSel = ids.length > 0 && ids.every((i) => selectedIds.has(i));
    if (allSel) { setSelectedIds(new Set()); setLastSelectedId(null); }
    else { setSelectionMode(true); setSelectedIds(new Set(ids)); }
  }
  function applyBulk(patch: BulkPatch) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkUpdateTasks(ids, patch);
      wyczyscZaznaczenie(res.skipped > 0 ? `Zmieniono ${res.updated} z ${ids.length} (pominięto ${res.skipped})` : `Zmieniono ${res.updated}`);
    });
  }
  async function deleteBulk() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!(await confirmDialog({ title: `Usunąć ${ids.length} zaznaczonych zadań? Trafią do Kosza.`, destructive: true }))) return;
    startBulkTransition(async () => {
      const res = await bulkDeleteTasks(ids);
      wyczyscZaznaczenie(res.skipped > 0 ? `Usunięto ${res.deleted} z ${ids.length} (pominięto ${res.skipped})` : `Usunięto ${res.deleted}`);
    });
  }

  // Zaznaczanie działa tylko w widoku listy — przy zmianie układu wyczyść stan.
  useEffect(() => {
    if (layout !== "list") { zakonczZaznaczanie(); }
  }, [layout, zakonczZaznaczanie]);

  // Kanban: kolumny = wszystkie włączone statusy (także terminalne, by kolumna „Zrobione” się
  // wypełniała) — nie zawężamy po zakładce statusu (w Kanbanie ukryta), filtrujemy tylko po tagach
  // (wyszukiwanie już zawarte w `displayedTasks`). Wcześniej Kanban dostawał surowe `displayedTasks`,
  // więc tagi go nie filtrowały.
  const kanbanTasks = useMemo(() => {
    if (selectedTagIds.length === 0) return displayedTasks;
    return displayedTasks.filter((t) => selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid)));
  }, [displayedTasks, selectedTagIds]);

  // Timeline: zakładka statusu działa („Wszystkie” = wszystkie statusy, jak dotąd; konkretny status
  // zawęża) + filtr tagów (AND). Wcześniej Timeline dostawał surowe `displayedTasks`, więc ani zakładki
  // ani tagi nie miały efektu.
  const timelineTasks = useMemo(() => {
    const byStatus = activeFilter === "ALL" ? displayedTasks : displayedTasks.filter((t) => t.status === activeFilter);
    if (selectedTagIds.length === 0) return byStatus;
    return byStatus.filter((t) => selectedTagIds.every((tid) => t.tags?.some((tt) => tt.tag.id === tid)));
  }, [displayedTasks, activeFilter, selectedTagIds]);

  const filteredForNav = displayedTasks;

  const navigateDown = useCallback(() => {
    if (filteredForNav.length === 0) return;
    const idx = filteredForNav.findIndex((t) => t.id === focusedTaskId);
    const next = filteredForNav[idx + 1] ?? filteredForNav[0];
    setFocusedTaskId(next.id);
    rowRefs.current.get(next.id)?.scrollIntoView({ block: "nearest" });
  }, [filteredForNav, focusedTaskId]);

  const navigateUp = useCallback(() => {
    if (filteredForNav.length === 0) return;
    const idx = filteredForNav.findIndex((t) => t.id === focusedTaskId);
    const prev = idx <= 0 ? filteredForNav[filteredForNav.length - 1] : filteredForNav[idx - 1];
    setFocusedTaskId(prev.id);
    rowRefs.current.get(prev.id)?.scrollIntoView({ block: "nearest" });
  }, [filteredForNav, focusedTaskId]);

  const handlers = useMemo(
    () => ({
      onQuickAdd: () => {
        setTimeout(() => quickAddRef.current?.focus(), 10);
      },
      onNavigateDown: navigateDown,
      onNavigateUp: navigateUp,
      onToggleStatus: () => {
        if (!focusedTaskId) return;
        startTransition(async () => { await toggleTaskStatus(focusedTaskId); });
      },
      onDelete: async () => {
        if (!focusedTaskId) return;
        // 105 (AC-15): to samo okno co w panelu szczegółów — z nazwą zadania i wzmianką o Koszu.
        const usuwane = filteredForNav.find((z) => z.id === focusedTaskId);
        if (!(await confirmDialog({
          title: t("usunacZadanie"),
          description: t("zadanieTrafiDoKosza", { tytul: usuwane?.title ?? "" }),
          destructive: true,
        }))) return;
        const idx = filteredForNav.findIndex((t) => t.id === focusedTaskId);
        const next = filteredForNav[idx + 1] ?? filteredForNav[idx - 1];
        if (openTaskId === focusedTaskId) setOpenTaskId(null);
        setFocusedTaskId(next?.id ?? null);
        startTransition(async () => { await deleteTask(focusedTaskId); });
      },
      onEdit: () => {
        if (!focusedTaskId) return;
        setOpenTaskId(focusedTaskId);
      },
      onSearch: () => {
        setIsSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 10);
      },
      onFilterTab: (index: number) => setActiveFilter(statusFilters[index] ?? "ALL"),
      onCommandPalette: () => {},
      onEscape: () => {
        if (selectionMode || selectedIds.size > 0) { zakonczZaznaczanie(); return; }
        if (aiSearchResults) { setAiSearchResults(null); setSearchQuery(""); return; }
        if (isSearchOpen) { setSearchQuery(""); setIsSearchOpen(false); return; }
        // 105 (AC-12): `Esc` zdejmuje jedną warstwę. W trybie pełnym najbliższą warstwą jest sam
        // tryb, nie otwarte zadanie — dopiero drugie `Esc` zamyka zadanie.
        if (openTaskId && uklad.pelny) { zapiszIUstawUklad({ pelny: false }); return; }
        if (openTaskId) { setOpenTaskId(null); return; }
        setFocusedTaskId(null);
      },
    }),
    [focusedTaskId, filteredForNav, openTaskId, isSearchOpen, aiSearchResults, statusFilters, selectionMode, selectedIds, uklad.pelny, zapiszIUstawUklad, confirmDialog, navigateDown, navigateUp, setActiveFilter, t, zakonczZaznaczanie]
  );

  useKeyboardShortcuts(handlers);

  async function handleAISearch() {
    if (!searchQuery.trim()) return;
    setIsAISearching(true);
    try {
      const res = await fetch("/api/llm/tasks/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          tasks: tasks.slice(0, 100).map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            tags: t.tags?.map((tt) => tt.tag.name),
            status: t.status,
            priority: t.priority,
          })),
        }),
      });
      const data = await res.json();
      const matches: number[] = data.matches ?? [];
      setAiSearchResults(matches.map((idx) => tasks[idx]?.id).filter(Boolean));
    } catch { /* ignore */ } finally {
      setIsAISearching(false);
    }
  }

  return (
    <ModuleView
      layout="fill"
      density="compact"
      state="ready"
      icon={<ListTodo size={16} />}
      iconColor="var(--accent-blue)"
      title={projectName}
      href="/tasks"
      filters={
        <>
        {/* Mobile: project picker */}
        <div className="md:hidden flex-1 mr-2">
          <select
            value={isVirtualView && !projectId ? "all" : projectId}
            onChange={(e) => { window.location.href = `/tasks/${e.target.value}`; }}
            className="bg-transparent text-sm font-semibold focus:outline-none w-full"
            style={{ color: "var(--text-primary)" }}
          >
            <option value="today">{t("dzis")}</option>
            <option value="upcoming">{t("nadchodzace")}</option>
            <option value="overdue">{t("zalegle")}</option>
            <option value="all">◎ Wszystkie</option>
            {allProjects.filter((p) => p.isInbox).map((p) => (
              <option key={p.id} value={p.id}>📥 {p.name}</option>
            ))}
            {allProjects.filter((p) => !p.isInbox).map((p) => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
            ))}
          </select>
        </div>

        {/* Actions — na wąskich ekranach (iPhone) rząd ikon przewija się w poziomie zamiast
            wypadać poza kadr. Uwaga: kontener z overflow przycina wewnętrzne popovery (overflow-y
            liczy się jako auto), więc akcje z rozwijanym menu (ProjectActionsMenu) trzymamy POZA
            strefą scrolla — przypięte po prawej, zawsze widoczne i nieobcięte. */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex items-center min-w-0">
          <div
            ref={actionsScrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const maxScroll = el.scrollWidth - el.clientWidth;
              setActionScroll({ left: el.scrollLeft > 1, right: el.scrollLeft < maxScroll - 1 });
            }}
            className="flex items-center gap-2 min-w-0 overflow-x-auto [&>*]:flex-shrink-0"
            role="toolbar"
            aria-label={t("pasekAkcjiListyPrzewin")}
          >
          {/* 080 (Z3): filtr projektów tylko w widokach ZBIORCZYCH. W widoku jednego projektu
              zawężanie do projektów nie ma sensu — pokazywałby jedną pozycję, zawsze zaznaczoną. */}
          {isVirtualView && allProjects.length > 1 && (
            <ProjectScopeFilter
              allProjects={allProjects}
              selected={view.projekty}
              onChange={(next) => setView({ projekty: next })}
            />
          )}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {counts.ALL > 0 && `${counts.ALL} aktywne`}
          </span>

          {/* Kolejność paska = wg częstości użycia: najczęstsze akcje z lewej (zawsze widoczne bez
              scrolla na mobile), rzadkie na końcu (Powiadomienia → Kosz → Clipboard).
              Widoczność ikon (spójna, per kontekst):
              • Szukaj / Przełącznik układu / Powiadomienia / Kosz — ZAWSZE
              • Grupowanie (ListTree/Flag) — tylko widoki zbiorcze (canToggleGrouping: upcoming/overdue/all/multi)
              • Zaznacz wiele (CheckSquare) — tylko układ Lista (layout==="list")
              • Konfiguracja statusów (SlidersHorizontal) — tylko właściciel listy (canEditStatuses)
              • Clipboard dla Claude — tylko admin (isAdmin)
              Wszystkie ikony size={15}; każda ma title + aria-label. */}

          {/* Szukaj — jedna z najczęstszych akcji, więc pierwsza */}
          <button
            onClick={() => { setIsSearchOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 10); }}
            className="p-1.5 rounded focus:outline-none"
            style={{ color: isSearchOpen ? "var(--accent-blue)" : "var(--text-muted)" }}
            title="Szukaj (/ lub f)"
            aria-label={t("szukajZadan")}
          >
            <Search size={15} />
          </button>

          {/* Przełącznik układu: Lista / Kanban / Timeline — częsty, więc blisko lewej */}
          <div className="flex items-center gap-0.5 rounded" style={{ border: "1px solid var(--border)" }}>
            {([
              { key: "list", label: "Lista", Icon: ListIcon },
              { key: "kanban", label: "Kanban", Icon: Columns3 },
              { key: "timeline", label: "Timeline", Icon: CalendarRange },
              // 117: przeglądanie projektu po obszarach — tylko realny projekt ma drzewo.
              ...(obszaryDostepne ? ([{ key: "obszary", label: "Obszary", Icon: FolderTree }] as const) : []),
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setLayout(key)}
                className="p-1.5 focus:outline-none"
                title={label}
                aria-label={label}
                style={{ color: layout === key ? "var(--accent-blue)" : "var(--text-muted)", background: layout === key ? "var(--bg-hover)" : "transparent" }}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>

          {/* Przełącznik prezentacji: naturalne grupowanie widoku ↔ po priorytetach */}
          {canToggleGrouping && (
            <div
              className="flex items-center rounded overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => setGroupBy("default")}
                className="flex items-center justify-center p-1.5 focus:outline-none"
                style={{
                  color: groupBy === "default" ? "var(--text-primary)" : "var(--text-muted)",
                  backgroundColor: groupBy === "default" ? "var(--bg-hover)" : "transparent",
                }}
                title="Grupuj jak w widoku (dni / projekty)"
                aria-label="Grupuj jak w widoku (dni / projekty)"
              >
                <ListTree size={15} />
              </button>
              <button
                onClick={() => setGroupBy("priority")}
                className="flex items-center justify-center p-1.5 focus:outline-none"
                style={{
                  color: groupBy === "priority" ? "var(--text-primary)" : "var(--text-muted)",
                  backgroundColor: groupBy === "priority" ? "var(--bg-hover)" : "transparent",
                }}
                title={t("grupujPoPriorytetachJak")}
                aria-label="Grupuj po priorytetach"
              >
                <Flag size={15} />
              </button>
            </div>
          )}

          {/* Bulkowa edycja: wejście w tryb zaznaczania (tylko widok listy) */}
          {layout === "list" && (
            <button
              onClick={() => { if (selectionMode || selectedIds.size > 0) zakonczZaznaczanie(); else setSelectionMode(true); }}
              className="p-1.5 rounded focus:outline-none"
              style={{ color: selectionMode ? "var(--accent-blue)" : "var(--text-muted)" }}
              title="Zaznacz wiele (edycja zbiorcza)"
              aria-label={t("zaznaczWieleZadan")}
            >
              <CheckSquare size={15} />
            </button>
          )}

          {canEditStatuses && (
            <button
              onClick={() => setStatusConfigOpen(true)}
              className="p-1.5 rounded focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              title="Statusy listy (konfiguracja)"
              aria-label={t("konfiguracjaStatusowListy")}
            >
              <SlidersHorizontal size={15} />
            </button>
          )}

          {/* Powiadomienia — rzadziej używane, więc bliżej końca */}
          <button
            onClick={requestNotifications}
            className="p-1.5 rounded focus:outline-none"
            style={{ color: notificationsEnabled ? "var(--accent-amber)" : "var(--text-muted)" }}
            title={notificationsEnabled ? "Powiadomienia włączone" : "Włącz powiadomienia"}
            aria-label={notificationsEnabled ? "Powiadomienia włączone" : "Włącz powiadomienia"}
          >
            {notificationsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          </button>

          {/* Kosz = link do /trash (ODZYSKIWANIE), NIE usuwanie. Świadomie osobna ikona
              (ArchiveRestore), by nie mylić się z ikoną kosza „usuń" (Trash2) — ta zostaje wyłącznie
              dla usuwania. Na końcu paska, przy rzadkich akcjach. */}
          <Link
            href="/trash"
            className="flex items-center justify-center p-1.5 rounded"
            style={{ color: "var(--text-muted)" }}
            title={t("koszPrzywrocUsuniete")}
            aria-label={t("koszPrzywrocUsunieteZadania")}
          >
            <ArchiveRestore size={15} />
          </Link>

          {!isVirtualView && (
            <button
              type="button"
              onClick={() => setUdostepnianieOtwarte(true)}
              className="flex items-center justify-center p-1.5 rounded"
              style={{ color: "var(--text-muted)" }}
              title={tShare("shareProject")}
              aria-label={tShare("shareProject")}
            >
              <Share2 size={15} />
            </button>
          )}

          {/* Admin: skopiuj prompt dla Claude Code z zadaniami widocznymi w tej zakładce */}
          {isAdmin && trybAdmina && <TaskListClipboardButton tasks={visibleTasks} />}
          </div>
          {/* Wskazówka przewijania: wyraźny chevron na krawędzi (mocny, zrozumiały sygnał „jest
              więcej →") na tle mocniejszego gradientu = tło nagłówka. Chevron jest KLIKALNY — dotknięcie
              przewija pasek o kawałek, więc działa też jako realny przycisk nawigacji (nie tylko ozdoba). */}
          {actionScroll.left && (
            <button
              type="button"
              aria-label={t("przewinPasekAkcjiW")}
              onClick={() => actionsScrollRef.current?.scrollBy({ left: -140, behavior: "smooth" })}
              className="absolute left-0 top-0 bottom-0 flex items-center pl-0.5 pr-4 focus:outline-none"
              style={{ background: "linear-gradient(to right, var(--bg-surface) 60%, transparent)" }}
            >
              <ChevronLeft size={18} style={{ color: "var(--text-secondary)" }} />
            </button>
          )}
          {actionScroll.right && (
            <button
              type="button"
              aria-label={t("przewinPasekAkcjiW2")}
              onClick={() => actionsScrollRef.current?.scrollBy({ left: 140, behavior: "smooth" })}
              className="absolute right-0 top-0 bottom-0 flex items-center pr-0.5 pl-4 focus:outline-none"
              style={{ background: "linear-gradient(to left, var(--bg-surface) 60%, transparent)" }}
            >
              <ChevronRight size={18} style={{ color: "var(--text-secondary)" }} />
            </button>
          )}
          </div>

          {/* Akcje projektu (zmień nazwę / usuń) — POZA strefą scrolla, żeby rozwijane menu
              nie było przycinane przez overflow; przypięte po prawej, zawsze widoczne. */}
          {viewMode === "project" && (() => {
            const current = allProjects.find((p) => p.id === projectId);
            return current && !current.isInbox
              ? <div className="flex-shrink-0"><ProjectActionsMenu project={current} /></div>
              : null;
          })()}
        </div>
        </>
      }
    >

      {/* Pasek zakresu widoku wielu projektów: zawsze widać, z jakich projektów są zadania.
          Każdy chip prowadzi do pojedynczego projektu; ołówek otwiera edycję zapisanego widoku. */}
      {viewMode === "multi" && scopeProjects.length > 0 && (
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 border-b flex-shrink-0 overflow-x-auto"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
            Projekty:
          </span>
          {scopeProjects.map((p) => (
            <Link
              key={p.id}
              href={`/tasks/${p.id}`}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs flex-shrink-0"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              title={`Otwórz projekt: ${p.name}`}
            >
              <span>{p.isInbox ? "📥" : p.emoji}</span>
              <span className="truncate" style={{ maxWidth: 140 }}>{p.name}</span>
            </Link>
          ))}
          {multiGroupId && (
            <Link
              href={`/tasks/zestaw/${multiGroupId}?edit=1`}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs flex-shrink-0 ml-1"
              style={{ color: "var(--text-muted)" }}
              title={t("edytujGrupeNazwaProjekty")}
            >
              <Pencil size={11} />
            </Link>
          )}
        </div>
      )}

      {canEditStatuses && statusConfigOpen && (
        <TaskStatusConfigEditor
          projectId={projectId}
          config={statusConfig}
          onClose={() => setStatusConfigOpen(false)}
        />
      )}

      {/* Search bar */}
      {isSearchOpen && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setAiSearchResults(null); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setSearchQuery(""); setIsSearchOpen(false); setAiSearchResults(null); }
              if (e.key === "Enter") handleAISearch();
            }}
            placeholder={t("szukajZadanEnterSzukaj")}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {searchQuery && (
            <button
              onClick={handleAISearch}
              disabled={isAISearching}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded focus:outline-none"
              style={{ backgroundColor: "var(--accent-purple)", color: "var(--on-accent)" }}
              title="Wyszukaj semantycznie przez AI"
            >
              {isAISearching ? (
                <span className="flex items-center gap-1"><span className="animate-spin text-xs">⟳</span> AI</span>
              ) : (
                <><Sparkles size={11} /> AI</>
              )}
            </button>
          )}
          {(searchQuery || aiSearchResults) && (
            <button onClick={() => { setSearchQuery(""); setAiSearchResults(null); }} style={{ color: "var(--text-muted)" }}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <QuickAddTask
        ref={quickAddRef}
        projectId={addProjectId}
        onCreated={(t) => { setJustCreated(t); setOpenTaskId(t.id); setFocusedTaskId(t.id); }}
      />

      <TaskFilters
        active={activeFilter}
        counts={counts}
        onChange={setActiveFilter}
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        onTagToggle={(id) => setSelectedTagIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
        onTagsClear={() => setSelectedTagIds([])}
        filters={statusFilters}
        labels={filterLabels}
        showStatusTabs={layout !== "kanban"}
      />

      {aiSearchResults !== null && (
        <div className="px-4 py-1.5 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", backgroundColor: "rgba(168,85,247,0.08)" }}>
          <Sparkles size={11} style={{ color: "var(--accent-purple)" }} />
          <span className="text-xs" style={{ color: "var(--accent-purple)" }}>
            Wyniki AI: {aiSearchResults.length} zadań
          </span>
          <button onClick={() => setAiSearchResults(null)} className="ml-auto focus:outline-none" style={{ color: "var(--text-muted)" }}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 105 (AC-11): w trybie pełnym lista USTĘPUJE MIEJSCA — nie jest chowana przezroczystością,
            tylko nie renderowana, żeby panel dostał całą szerokość obszaru roboczego. Tryb dotyczy
            wyłącznie komputera (`md:`), więc na telefonie warunek jest zawsze fałszywy: tam panel
            i tak przykrywa cały ekran osobnym elementem. */}
        {openTask && uklad.pelny && !waskiEkran ? null : layout === "kanban" ? (
          <KanbanBoard tasks={kanbanTasks} statusConfig={statusConfig} onOpen={(id) => setOpenTaskId(id)} />
        ) : layout === "timeline" ? (
          <TimelineView tasks={timelineTasks} statusConfig={statusConfig} onOpen={(id) => setOpenTaskId(id)} />
        ) : layout === "obszary" ? (
          /* 117: te same zadania co lista (zakładka statusu + tagi + szukaj) — jeden zbiór,
             trzy prezentacje; różni się wyłącznie render (AC-3). */
          <ObszaryWidok
            obszary={areas}
            zadania={visibleTasks}
            projectId={projectId}
            statusConfig={statusConfig}
            wariant={wariantObszarow}
            onWariant={setWariantObszarow}
            focusedTaskId={focusedTaskId}
            onFocus={setFocusedTaskId}
            onOpen={(id) => setOpenTaskId(id)}
          />
        ) : (
          <TaskList
            tasks={displayedTasks}
            filter={activeFilter}
            statusConfig={statusConfig}
            viewMode={viewMode}
            groupBy={canToggleGrouping ? groupBy : "default"}
            selectedTagIds={selectedTagIds}
            focusedTaskId={focusedTaskId}
            onFocus={setFocusedTaskId}
            onOpen={(id) => setOpenTaskId(id)}
            rowRefs={rowRefs}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            lastSelectedId={lastSelectedId}
            onToggleOne={toggleSelectOne}
            onSelectRange={selectRange}
          />
        )}

        {/* Detail panel — desktop */}
        {openTask && (
          <>
            {/* 105 (AC-10): UCHWYT zmiany szerokości. `setPointerCapture` sprawia, że kursor
                wyprowadzony poza wąski pasek nie gubi przeciągania. Zapis do pamięci następuje na
                `pointerup`, nie przy każdym ruchu — inaczej jedno przeciągnięcie to kilkadziesiąt
                zapisów. Strzałki obsługujemy, bo moduł jest keyboard-first (C-31). */}
            {!uklad.pelny && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t("zmienSzerokoscPanelu")}
                tabIndex={0}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  przeciaganieRef.current = { startX: e.clientX, startSzerokosc: uklad.szerokosc };
                }}
                onPointerMove={(e) => {
                  const start = przeciaganieRef.current;
                  if (!start) return;
                  // Panel jest po PRAWEJ, więc ruch w lewo POSZERZA go — stąd odejmowanie.
                  const nowa = ograniczSzerokosc(start.startSzerokosc - (e.clientX - start.startX), window.innerWidth);
                  setUklad((p) => ({ ...p, szerokosc: nowa }));
                }}
                onPointerUp={(e) => {
                  if (!przeciaganieRef.current) return;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  przeciaganieRef.current = null;
                  // Pusta zmiana = „zapisz to, co już jest w stanie". Podczas przeciągania
                  // aktualizujemy wyłącznie stan; do pamięci trafia dopiero wynik.
                  zapiszIUstawUklad({});
                }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const krok = e.key === "ArrowLeft" ? 16 : -16;
                  zapiszIUstawUklad({ szerokosc: ograniczSzerokosc(uklad.szerokosc + krok, window.innerWidth) });
                }}
                className="hidden md:block flex-shrink-0 w-1.5 cursor-col-resize"
                style={{ backgroundColor: "var(--border)" }}
              />
            )}
            <div
              data-omnia-panel="zadanie"
              className={`hidden md:flex flex-col ${uklad.pelny ? "flex-1 min-w-0" : "flex-shrink-0"}`}
              /* Szerokość idzie tu SUROWA, bez ograniczania: `ograniczSzerokosc` potrzebuje
                 `window.innerWidth`, którego serwer nie zna, więc liczenie jej w renderze dałoby
                 inną wartość w HTML-u serwera niż po hydratacji. Granice pilnujemy tam, gdzie
                 wartość POWSTAJE — przy odczycie preferencji i przy przeciąganiu. */
              style={uklad.pelny ? undefined : { width: uklad.szerokosc }}
            >
              <TaskDetail
                task={openTask}
                allTags={allTags}
                allProjects={allProjects}
                obszary={areas}
                statusConfig={statusConfig}
                szeroki={uklad.pelny}
                onPrzelaczSzeroki={() => zapiszIUstawUklad({ pelny: !uklad.pelny })}
                onClose={() => setOpenTaskId(null)}
                onDelete={() => { setOpenTaskId(null); setFocusedTaskId(null); }}
              />
            </div>
          </>
        )}

        {/* Detail panel — mobile modal (padding-top = pasek stanu/notch iPhone).
            data-omnia-overlay="panel": szczegóły zadania to ekran roboczy, nie przelotny dialog —
            wykluczamy je z detekcji „modalu treściowego" (useOverlayState), a jednocześnie
            sygnalizujemy „panel roboczy", by pływające przyciski (asystent AI, „zgłoś błąd")
            zostały WYNIESIONE NAD ten panel (podbity z-index), zamiast zniknąć pod nim.
            WAŻNE: ten div (mimo md:hidden) jest w DOM także na desktopie — na komputerze panelu
            nie widać, a przyciski i tak działają, więc podniesiony z-index jest nieszkodliwy. */}
        {openTask && (
          <div
            data-omnia-overlay="panel"
            className="md:hidden fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: "var(--bg-surface)", paddingTop: "env(safe-area-inset-top)" }}
          >
            <TaskDetail
              task={openTask}
              allTags={allTags}
              allProjects={allProjects}
              obszary={areas}
              statusConfig={statusConfig}
              onClose={() => setOpenTaskId(null)}
              onDelete={() => { setOpenTaskId(null); setFocusedTaskId(null); }}
            />
          </div>
        )}
      </div>

      {/* Pasek akcji zbiorczych — widoczny gdy coś zaznaczono (tylko widok listy) */}
      {layout === "list" && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          totalVisible={visibleTasks.length}
          allSelected={visibleTasks.length > 0 && visibleTasks.every((t) => selectedIds.has(t.id))}
          pending={bulkPending}
          statusConfig={statusConfig}
          allProjects={allProjects}
          allTags={allTags}
          onSelectAll={toggleSelectAllVisible}
          onClear={() => wyczyscZaznaczenie(null)}
          onApply={applyBulk}
          onDelete={deleteBulk}
        />
      )}

      {/* Krótki komunikat wyniku operacji zbiorczej */}
      {bulkMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg text-sm shadow-lg pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)", backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          {bulkMessage}
        </div>
      )}

      {udostepnianieOtwarte && (
        <ShareDialog resourceType="tasks.project" resourceId={projectId} onClose={() => setUdostepnianieOtwarte(false)} />
      )}
    </ModuleView>
  );
}
