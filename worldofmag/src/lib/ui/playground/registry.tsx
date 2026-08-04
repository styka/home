"use client";

import { useState } from "react";
import { Inbox, ListTodo, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Surface } from "@/components/ui/Surface";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, fieldControlStyle } from "@/components/ui/Field";
import { DataList } from "@/components/ui/DataList";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { ViewEmpty, ViewLoading, ViewError, ViewNoAccess } from "@/components/ui/view/ViewState";
import { ViewBar } from "@/components/ui/view/ViewBar";
import { ModuleView } from "@/components/ui/view/ModuleView";

/**
 * 045 — REJESTR komponentów playgroundu.
 *
 * Playground wywodzi listę STĄD, a nie z ręcznie utrzymywanej tablicy w komponencie
 * strony. To jest cała różnica względem poprzedniej wersji: tam dodanie komponentu
 * do galerii wymagało dopisania go w trzech miejscach (lista, warunek renderujący,
 * słownik etykiet), więc w praktyce nikt tego nie robił i galeria pokazywała sześć
 * komponentów z kilkudziesięciu istniejących.
 */

/** Kategorie — `String` + unia TS, nigdy enum (C-12). */
export type PlaygroundCategory =
  | "prymitywy"
  | "formularze"
  | "dane-i-listy"
  | "powloka-i-nawigacja"
  | "stany-brzegowe"
  | "wzorce-widoku";

export const CATEGORY_LABELS: Record<PlaygroundCategory, string> = {
  prymitywy: "Prymitywy",
  formularze: "Formularze",
  "dane-i-listy": "Dane i listy",
  "powloka-i-nawigacja": "Powłoka i nawigacja",
  "stany-brzegowe": "Stany brzegowe",
  "wzorce-widoku": "Wzorce widoku",
};

export const CATEGORY_ORDER: PlaygroundCategory[] = [
  "prymitywy",
  "formularze",
  "dane-i-listy",
  "stany-brzegowe",
  "powloka-i-nawigacja",
  "wzorce-widoku",
];

/** Kontrolka właściwości — pozwala pobawić się komponentem na żywo. */
export type PlaygroundControl =
  | { key: string; label: string; kind: "text"; default: string }
  | { key: string; label: string; kind: "boolean"; default: boolean }
  | { key: string; label: string; kind: "number"; default: number; min?: number; max?: number }
  | { key: string; label: string; kind: "select"; default: string; options: { value: string; label: string }[] };

export type ControlValues = Record<string, string | number | boolean>;

export interface PlaygroundEntryDef {
  id: string;
  name: string;
  category: PlaygroundCategory;
  summary: string;
  /** Skąd go zaimportować — pokazywane jako gotowa linijka do skopiowania. */
  importPath: string;
  controls?: PlaygroundControl[];
  render: (v: ControlValues) => React.ReactNode;
  /** Warianty brzegowe — pusty, długi tekst, błąd. Nie tylko przypadek idealny. */
  variants?: { label: string; render: () => React.ReactNode }[];
}

const DEMO_ITEMS = [
  { id: "1", title: "Kupić mleko" },
  { id: "2", title: "Oddać książkę do biblioteki" },
  { id: "3", title: "Zadzwonić do serwisu w sprawie przeglądu" },
];

const LONG_TEXT =
  "Bardzo długi tytuł pozycji, który nie mieści się w jednej linii i sprawdza, czy komponent go przycina, zawija, czy rozpycha układ w bok";

// ─── Demonstracje wymagające stanu ───────────────────────────────────────────

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Otwórz modal</Button>
      {open && (
        <Modal open={open} onClose={() => setOpen(false)} title="Przykładowy modal" footer={<Button onClick={() => setOpen(false)}>Zamknij</Button>}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Radix Dialog: pułapka focusu, Esc, blokada przewijania tła i przywrócenie focusu po zamknięciu.
          </p>
        </Modal>
      )}
    </>
  );
}

function ConfirmDemo({ destructive }: { destructive: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Button variant={destructive ? "danger" : "primary"} onClick={() => setOpen(true)}>
        {destructive ? "Usuń pozycję" : "Wykonaj akcję"}
      </Button>
      {result && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{result}</span>}
      {open && (
        <ConfirmDialog
          title={destructive ? "Usunąć pozycję?" : "Potwierdzić?"}
          description={destructive ? "Pozycja trafi do kosza. Możesz ją stamtąd przywrócić przez 30 dni." : "Akcja zostanie wykonana."}
          confirmLabel={destructive ? "Usuń" : "Potwierdź"}
          destructive={destructive}
          onConfirm={() => { setResult("potwierdzono"); setOpen(false); }}
          onCancel={() => { setResult("anulowano"); setOpen(false); }}
        />
      )}
    </div>
  );
}

function FieldDemo({ error, required }: { error: boolean; required: boolean }) {
  const [value, setValue] = useState("");
  return (
    <div style={{ maxWidth: 340 }}>
      <Field
        label="Nazwa listy"
        hint="Krótka i rozpoznawalna — pojawi się w nawigacji."
        required={required}
        error={error ? "Nazwa nie może być pusta" : null}
      >
        {(props) => (
          <input {...props} value={value} onChange={(e) => setValue(e.target.value)} style={fieldControlStyle} />
        )}
      </Field>
    </div>
  );
}

function DataListDemo({ selectable }: { selectable: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
        Kliknij w listę, potem <kbd>j</kbd>/<kbd>k</kbd>{selectable ? " i " : ""}
        {selectable && <kbd>x</kbd>}
      </p>
      <DataList
        items={DEMO_ITEMS}
        keyOf={(i) => i.id}
        selectable={selectable}
        selectedIds={selected}
        onSelectionChange={setSelected}
        renderItem={(item) => (
          <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)" }}>{item.title}</div>
        )}
      />
      {selectable && selected.length > 0 && (
        <BulkActionBar count={selected.length} noun={["zadanie", "zadania", "zadań"]} onClear={() => setSelected([])}>
          <Button size="sm" variant="secondary">Oznacz</Button>
          <Button size="sm" variant="danger">Usuń</Button>
        </BulkActionBar>
      )}
    </div>
  );
}

function SmartTextareaDemo() {
  const [v, setV] = useState("");
  return <SmartTextarea value={v} onChange={setV} placeholder="Wpisz lub dyktuj…" rows={3} />;
}

// ─── Rejestr ─────────────────────────────────────────────────────────────────

export const PLAYGROUND_ENTRIES: PlaygroundEntryDef[] = [
  {
    id: "button",
    name: "Button",
    category: "prymitywy",
    summary: "Przycisk w czterech wariantach i trzech rozmiarach. Tekst na tle akcentowym bierze --on-accent, nie biel.",
    importPath: 'import { Button } from "@/components/ui";',
    controls: [
      { key: "variant", label: "Wariant", kind: "select", default: "primary", options: [
        { value: "primary", label: "primary" }, { value: "secondary", label: "secondary" },
        { value: "ghost", label: "ghost" }, { value: "danger", label: "danger" },
      ] },
      { key: "size", label: "Rozmiar", kind: "select", default: "md", options: [
        { value: "sm", label: "sm" }, { value: "md", label: "md" }, { value: "lg", label: "lg" },
      ] },
      { key: "label", label: "Etykieta", kind: "text", default: "Zapisz zmiany" },
      { key: "disabled", label: "Wyłączony", kind: "boolean", default: false },
    ],
    render: (v) => (
      <Button
        variant={v.variant as "primary"}
        size={v.size as "md"}
        disabled={v.disabled as boolean}
      >
        {String(v.label)}
      </Button>
    ),
    variants: [
      { label: "Wszystkie warianty", render: () => (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
      ) },
      { label: "Bardzo długa etykieta", render: () => <Button>{LONG_TEXT}</Button> },
    ],
  },
  {
    id: "icon-button",
    name: "IconButton",
    category: "prymitywy",
    summary: "Przycisk z samą ikoną — wymaga etykiety dostępnościowej.",
    importPath: 'import { IconButton } from "@/components/ui";',
    render: () => (
      <div style={{ display: "flex", gap: 8 }}>
        <IconButton label="Usuń"><Trash2 size={16} /></IconButton>
        <IconButton label="Zadania"><ListTodo size={16} /></IconButton>
      </div>
    ),
  },
  {
    id: "badge",
    name: "Badge",
    category: "prymitywy",
    summary: "Plakietka statusu.",
    importPath: 'import { Badge } from "@/components/ui";',
    controls: [{ key: "label", label: "Treść", kind: "text", default: "Nowe" }],
    render: (v) => <Badge>{String(v.label)}</Badge>,
  },
  {
    id: "card-surface",
    name: "Card / Surface",
    category: "prymitywy",
    summary: "Powierzchnie: karta z obramowaniem i podniesione tło.",
    importPath: 'import { Card, Surface } from "@/components/ui";',
    render: () => (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Card><span style={{ fontSize: 13 }}>Card</span></Card>
        <Surface><span style={{ fontSize: 13 }}>Surface</span></Surface>
      </div>
    ),
  },
  {
    id: "modal",
    name: "Modal",
    category: "formularze",
    summary: "Okno na Radix Dialog: pułapka focusu, Esc, blokada tła. Na telefonie jako panel od dołu.",
    importPath: 'import { Modal } from "@/components/ui";',
    render: () => <ModalDemo />,
  },
  {
    id: "confirm-dialog",
    name: "ConfirmDialog",
    category: "formularze",
    summary: "Jedno potwierdzenie dla całej aplikacji. Focus ląduje na ANULUJ — Enter odruchowo wciśnięty nie ma nic zepsuć.",
    importPath: 'import { ConfirmDialog } from "@/components/ui";',
    controls: [{ key: "destructive", label: "Wariant niszczący", kind: "boolean", default: true }],
    render: (v) => <ConfirmDemo destructive={v.destructive as boolean} />,
  },
  {
    id: "field",
    name: "Field",
    category: "formularze",
    summary: "Pole z etykietą, podpowiedzią i błędem. Wiąże label z kontrolką i podpina aria-describedby.",
    importPath: 'import { Field, fieldControlStyle } from "@/components/ui";',
    controls: [
      { key: "error", label: "Pokaż błąd", kind: "boolean", default: false },
      { key: "required", label: "Wymagane", kind: "boolean", default: true },
    ],
    render: (v) => <FieldDemo error={v.error as boolean} required={v.required as boolean} />,
  },
  {
    id: "smart-textarea",
    name: "SmartTextarea",
    category: "formularze",
    summary: "Pole tekstowe z dyktowaniem (Web Speech) i modyfikacją głosową przez model.",
    importPath: 'import { SmartTextarea } from "@/components/ui/SmartTextarea";',
    render: () => <SmartTextareaDemo />,
  },
  {
    id: "data-list",
    name: "DataList",
    category: "dane-i-listy",
    summary: "Lista z nawigacją j/k, zaznaczaniem i Enter. Klawisze milkną, gdy focus jest w polu tekstowym.",
    importPath: 'import { DataList } from "@/components/ui";',
    controls: [{ key: "selectable", label: "Zaznaczanie", kind: "boolean", default: true }],
    render: (v) => <DataListDemo selectable={v.selectable as boolean} />,
    variants: [
      { label: "Pusta lista", render: () => (
        <DataList items={[]} keyOf={(i: { id: string }) => i.id} renderItem={() => null} emptyState={<ViewEmpty title="Brak pozycji" />} />
      ) },
    ],
  },
  {
    id: "bulk-action-bar",
    name: "BulkActionBar",
    category: "dane-i-listy",
    summary: "Pasek akcji zbiorczych. Pływa nad treścią i siada NAD dolną nawigacją. Odmienia liczebnik po polsku.",
    importPath: 'import { BulkActionBar } from "@/components/ui";',
    controls: [{ key: "count", label: "Zaznaczonych", kind: "number", default: 3, min: 1, max: 25 }],
    render: (v) => (
      <BulkActionBar count={Number(v.count)} noun={["zadanie", "zadania", "zadań"]} onClear={() => {}}>
        <Button size="sm" variant="secondary">Oznacz</Button>
      </BulkActionBar>
    ),
  },
  {
    id: "view-empty",
    name: "ViewEmpty",
    category: "stany-brzegowe",
    summary: "Stan pusty — kreskowane obramowanie sygnalizuje miejsce do wypełnienia.",
    importPath: 'import { ViewEmpty } from "@/components/ui";',
    render: () => (
      <ViewEmpty
        icon={<Inbox size={20} />}
        title="Brak zadań w tym projekcie"
        description="Dodaj pierwsze zadanie albo przenieś je z innego projektu."
        action={{ label: "Dodaj zadanie" }}
      />
    ),
  },
  {
    id: "view-loading",
    name: "ViewLoading",
    category: "stany-brzegowe",
    summary: "Szkielety pokazujące kształt wczytywanej treści — mniejszy skok układu niż przy kręciołku.",
    importPath: 'import { ViewLoading } from "@/components/ui";',
    controls: [{ key: "rows", label: "Wierszy", kind: "number", default: 3, min: 1, max: 8 }],
    render: (v) => <ViewLoading rows={Number(v.rows)} />,
  },
  {
    id: "view-error",
    name: "ViewError",
    category: "stany-brzegowe",
    summary: "Stan błędu — celowo wygląda inaczej niż stan pusty (lekcja z 038).",
    importPath: 'import { ViewError } from "@/components/ui";',
    render: () => <ViewError onRetry={() => {}} />,
  },
  {
    id: "view-no-access",
    name: "ViewNoAccess",
    category: "stany-brzegowe",
    summary: "Brak uprawnień. Mówi, co zrobić, zamiast tylko odmawiać.",
    importPath: 'import { ViewNoAccess } from "@/components/ui";',
    render: () => <ViewNoAccess />,
  },
  {
    id: "view-bar",
    name: "ViewBar",
    category: "powloka-i-nawigacja",
    summary: "Pasek widoku: filtry | akcje | chrom powłoki. Filtry przewijają się we własnym kontenerze, strona nigdy w bok.",
    importPath: 'import { ViewBar } from "@/components/ui";',
    render: () => (
      <ViewBar
        hideChrome
        filters={
          <>
            <Badge>Wszystkie</Badge>
            <Badge>Dziś</Badge>
            <Badge>Zaległe</Badge>
          </>
        }
        actions={<Button size="sm">Dodaj</Button>}
      />
    ),
  },
  {
    id: "module-view",
    name: "ModuleView",
    category: "wzorce-widoku",
    summary: "Kontrakt widoku: moduł deklaruje tytuł, filtry, akcje i stan; ramę rysuje powłoka.",
    importPath: 'import { ModuleView } from "@/components/ui";',
    controls: [
      { key: "state", label: "Stan", kind: "select", default: "ready", options: [
        { value: "ready", label: "gotowy" }, { value: "empty", label: "pusty" },
        { value: "loading", label: "ładowanie" }, { value: "error", label: "błąd" },
        { value: "no-access", label: "brak dostępu" },
      ] },
      { key: "subtitle", label: "Podtytuł", kind: "text", default: "Projekt: Dom" },
    ],
    render: (v) => (
      <div style={{ border: "var(--border-width) var(--border-style) var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", minHeight: 260, display: "flex" }}>
        <ModuleView
          icon={<ListTodo size={20} />}
          iconColor="var(--accent-blue)"
          title="Zadania"
          subtitle={String(v.subtitle)}
          hideChrome
          state={v.state as "ready"}
          empty={{ title: "Brak zadań", description: "Dodaj pierwsze zadanie.", action: { label: "Dodaj" } }}
          filters={<><Badge>Wszystkie</Badge><Badge>Dziś</Badge></>}
          actions={<Button size="sm">Dodaj</Button>}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Tu moduł renderuje swoją treść.</div>
        </ModuleView>
      </div>
    ),
  },
];

export function entriesByCategory(category: PlaygroundCategory): PlaygroundEntryDef[] {
  return PLAYGROUND_ENTRIES.filter((e) => e.category === category);
}

export function defaultControlValues(entry: PlaygroundEntryDef): ControlValues {
  const out: ControlValues = {};
  for (const c of entry.controls ?? []) out[c.key] = c.default;
  return out;
}
