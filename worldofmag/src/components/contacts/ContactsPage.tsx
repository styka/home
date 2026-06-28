"use client";

import { useState, useTransition, useMemo, useRef, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Users, Search, Plus, Pencil, Trash2, Check, X, Phone, Mail, Building2 } from "lucide-react";
import { PageHeader, EmptyState, pageContainerStyle, pageInnerStyle, cardStyle } from "@/components/ui/home";
import { getContacts, createContact, updateContact, deleteContact, type ContactDTO } from "@/actions/contacts";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13,
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, background: "var(--accent-blue)", color: "var(--on-accent)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "7px 12px", borderRadius: 8, background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, border: "1px solid var(--border)", cursor: "pointer" };

export function ContactsPage({ initialContacts }: { initialContacts: ContactDTO[] }) {
  const [contacts, setContacts] = useState<ContactDTO[]>(initialContacts);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Wirtualizacja długiej listy (Z-071/T-11) ────────────────────────────────
  // Kontakty ładują się w całości i są filtrowane po stronie klienta — idealny cel
  // okienkowania: renderujemy tylko widoczne wiersze (+ overscan), nie wszystkie naraz.
  // WZORZEC DO POWIELENIA na innych długich, płaskich listach (load-all + client-filter):
  //   1) `scrollRef` = istniejący kontener przewijania strony (pageContainerStyle),
  //   2) `listRef` = wrapper listy; `scrollMargin` = jego offset pod nagłówkiem/szukajką
  //      (nad listą jest treść w tym samym scrollu),
  //   3) dynamiczny pomiar wysokości (`measureElement`) — wiersze mają różną wysokość
  //      (tagi/notatki/firma + tryb edycji zamienia wiersz na wyższy formularz),
  //   4) nawigacja klawiaturą woła `virtualizer.scrollToIndex` (wiersze poza ekranem nie
  //      istnieją w DOM, więc `scrollIntoView` po refie by nie zadziałał).
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // scrollMargin = odległość od góry kontenera przewijania do początku listy.
  // Zmienia się, gdy nad listą pojawi się formularz dodawania → przeliczamy też na `adding`.
  useLayoutEffect(() => {
    const sc = scrollRef.current, list = listRef.current;
    if (!sc || !list) return;
    const update = () =>
      setScrollMargin(list.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [adding, contacts.length]);

  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92, // punkt startowy; realna wysokość mierzona dynamicznie
    overscan: 8,
    scrollMargin,
    getItemKey: (i) => contacts[i]?.id ?? i,
  });

  const reload = (q = query) => startTransition(async () => setContacts(await getContacts(q.trim() || undefined)));

  // Skróty klawiszowe (Z-232) — Kontakty wpinają tylko sensowne akcje; brak
  // onToggleStatus / onFilterTab / onCommandPalette dzięki opcjonalnemu kontraktowi.
  const handlers = useMemo(() => {
    const move = (dir: 1 | -1) => {
      if (contacts.length === 0) return;
      setSelectedId((cur) => {
        const idx = cur ? contacts.findIndex((c) => c.id === cur) : -1;
        const nextIdx =
          idx < 0 ? (dir === 1 ? 0 : contacts.length - 1) : Math.min(Math.max(idx + dir, 0), contacts.length - 1);
        const next = contacts[nextIdx];
        // Lista jest wirtualizowana — wiersz może nie istnieć w DOM; przewijamy indeksem.
        if (next) virtualizer.scrollToIndex(nextIdx, { align: "auto" });
        return next?.id ?? cur;
      });
    };
    return {
      onQuickAdd: () => { setAdding(true); setEditId(null); },
      onNavigateDown: () => move(1),
      onNavigateUp: () => move(-1),
      onEdit: () => { if (selectedId) { setEditId(selectedId); setAdding(false); } },
      onDelete: () => {
        if (!selectedId) return;
        const c = contacts.find((x) => x.id === selectedId);
        if (!c || !confirm(`Usunąć kontakt „${c.name}"?`)) return;
        const idx = contacts.findIndex((x) => x.id === selectedId);
        const next = contacts[idx + 1] ?? contacts[idx - 1];
        setSelectedId(next?.id ?? null);
        startTransition(async () => {
          await deleteContact(c.id);
          setContacts(await getContacts(query.trim() || undefined));
        });
      },
      onSearch: () => searchRef.current?.focus(),
      onEscape: () => {
        if (editId) { setEditId(null); return; }
        if (adding) { setAdding(false); return; }
        setSelectedId(null);
      },
    };
  }, [contacts, selectedId, editId, adding, query, virtualizer]);

  useKeyboardShortcuts(handlers);

  return (
    <div ref={scrollRef} style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Users size={22} />}
          iconColor="var(--accent-blue)"
          title="Kontakty"
          subtitle="Osobisty CRM — klienci, wykonawcy, znajomi"
          action={
            <button onClick={() => { setAdding((v) => !v); setEditId(null); }} style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={15} /> Nowy kontakt
            </button>
          }
        />

        <form onSubmit={(e) => { e.preventDefault(); reload(); }} style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po nazwie, telefonie, e-mailu, tagu…" style={{ ...inputStyle, paddingLeft: 32 }} />
          </div>
          <button type="submit" style={primaryBtn} disabled={pending}>Szukaj</button>
        </form>

        {adding && (
          <ContactForm
            onDone={() => { setAdding(false); reload(); }}
            onCancel={() => setAdding(false)}
          />
        )}

        {contacts.length === 0 ? (
          <EmptyState icon={<Users size={28} />} message="Brak kontaktów" hint="Dodaj pierwszy kontakt, by zbudować swoją bazę relacji." />
        ) : (
          // Wrapper o wysokości całej listy (getTotalSize) z absolutnie pozycjonowanymi,
          // dynamicznie mierzonymi wierszami — renderujemy tylko okno widoczne (+overscan).
          <div ref={listRef} style={{ position: "relative", height: virtualizer.getTotalSize(), opacity: pending ? 0.6 : 1 }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const c = contacts[vi.index];
              if (!c) return null;
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute", top: 0, left: 0, width: "100%",
                    transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
                    paddingBottom: 8, // odstęp między wierszami wliczony w pomiar
                  }}
                >
                  {editId === c.id ? (
                    <ContactForm contact={c} onDone={() => { setEditId(null); reload(); }} onCancel={() => setEditId(null)} />
                  ) : (
                    <ContactRow
                      contact={c}
                      selected={selectedId === c.id}
                      onSelect={() => setSelectedId(c.id)}
                      onEdit={() => { setEditId(c.id); setAdding(false); }}
                      onDeleted={() => reload()}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactRow({ contact, onEdit, onDeleted, selected, onSelect }: {
  contact: ContactDTO;
  onEdit: () => void;
  onDeleted: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        ...cardStyle,
        cursor: "default",
        alignItems: "flex-start",
        gap: 10,
        outline: selected ? "2px solid var(--accent-blue)" : "none",
        outlineOffset: -1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{contact.name}</span>
          {contact.company && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--text-muted)" }}>
              <Building2 size={12} /> {contact.company}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          {contact.phone && <a href={`tel:${contact.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-blue)", textDecoration: "none" }}><Phone size={12} /> {contact.phone}</a>}
          {contact.email && <a href={`mailto:${contact.email}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-blue)", textDecoration: "none" }}><Mail size={12} /> {contact.email}</a>}
        </div>
        {contact.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {contact.tags.map((t) => (
              <span key={t} style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>{t}</span>
            ))}
          </div>
        )}
        {contact.notes && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, whiteSpace: "pre-wrap" }}>{contact.notes}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={onEdit} style={secondaryBtn} aria-label="Edytuj"><Pencil size={14} /></button>
        <button onClick={async () => { if (confirm(`Usunąć kontakt „${contact.name}"?`)) { await deleteContact(contact.id); onDeleted(); } }} style={{ ...secondaryBtn, color: "var(--accent-red)" }} aria-label="Usuń"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function ContactForm({ contact, onDone, onCancel }: { contact?: ContactDTO; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [company, setCompany] = useState(contact?.company ?? "");
  const [tags, setTags] = useState(contact?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Podaj imię/nazwę"); return; }
    setBusy(true); setError(null);
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      if (contact) await updateContact(contact.id, { name, phone, email, company, tags: tagList, notes });
      else await createContact({ name, phone, email, company, tags: tagList, notes });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać kontaktu");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 10, border: "1px solid var(--border-focus, var(--accent-blue))", background: "var(--bg-surface)" }}>
      <div><label style={labelStyle}>Imię / nazwa *</label><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="np. Anna Nowak" /></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}><label style={labelStyle}>Telefon</label><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: 140 }}><label style={labelStyle}>E-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}><label style={labelStyle}>Firma</label><input value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: 140 }}><label style={labelStyle}>Tagi (po przecinku)</label><input value={tags} onChange={(e) => setTags(e.target.value)} style={inputStyle} placeholder="klient, hydraulik" /></div>
      </div>
      <div><label style={labelStyle}>Notatki</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
      {error && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}><Check size={15} /> Zapisz</button>
        <button type="button" onClick={onCancel} style={secondaryBtn}><X size={15} /></button>
      </div>
    </form>
  );
}
