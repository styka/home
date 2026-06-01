"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import {
  ChefHat,
  Plus,
  BookMarked,
  CalendarDays,
  Package,
  BookOpen,
  AlertTriangle,
  ChevronRight,
  Clock,
  Users,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { markMealCooked } from "@/actions/mealPlans";
import { PageHeader, StatTile, SectionHeading, ManagementGrid, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { llm } from "@/lib/llm-client";

interface TodayMeal {
  id: string;
  slot: string;
  title: string;
  recipeSlug: string | null;
  servings: number;
  status: string;
}

interface ExpiringItem {
  id: string;
  name: string;
  daysLeft: number;
}

interface RecentRecipe {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  cookCount: number;
  lastCookedAt: string | null;
  totalMinutes: number;
  servings: number;
}

interface LatestRecipe {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  totalMinutes: number;
  servings: number;
}

interface CookbookSummary {
  id: string;
  name: string;
  emoji: string;
  color: string | null;
  recipeCount: number;
}

interface KitchenHomePageProps {
  recipeCount: number;
  pantryCount: number;
  todayMeals: TodayMeal[];
  expiring: ExpiringItem[];
  expiringSoonCount: number;
  recentlyCooked: RecentRecipe[];
  latestRecipes: LatestRecipe[];
  cookbooks: CookbookSummary[];
  totalCookbooks: number;
}

const SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
};

const SLOT_EMOJI: Record<string, string> = {
  breakfast: "☕",
  lunch: "🍽",
  dinner: "🌙",
  snack: "🍪",
};

export function KitchenHomePage({
  recipeCount,
  pantryCount,
  todayMeals,
  expiring,
  expiringSoonCount,
  recentlyCooked,
  latestRecipes,
  cookbooks,
  totalCookbooks,
}: KitchenHomePageProps) {
  const todayPlannedCount = todayMeals.filter((m) => m.status !== "SKIPPED").length;
  const [suggestions, setSuggestions] = useState<Array<{ recipeId: string; slug: string; title: string; reason?: string }> | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  async function fetchSuggestions() {
    setSuggestBusy(true);
    setSuggestError(null);
    try {
      const res = await llm.kitchen.suggestFromPantry();
      setSuggestions(res.suggestions ?? []);
    } catch {
      setSuggestError("Nie udało się pobrać sugestii — sprawdź klucz API w /admin/config");
    } finally {
      setSuggestBusy(false);
    }
  }

  const subtitle =
    recipeCount === 0
      ? "Dodaj pierwszy przepis i zaplanuj posiłek"
      : todayPlannedCount > 0
      ? `${todayPlannedCount} ${pluralizePolish(todayPlannedCount, "posiłek", "posiłki", "posiłków")} zaplanowane na dziś`
      : expiringSoonCount > 0
      ? `${expiringSoonCount} ${pluralizePolish(expiringSoonCount, "produkt", "produkty", "produktów")} wkrótce się przeterminuje`
      : `${recipeCount} ${pluralizePolish(recipeCount, "przepis", "przepisy", "przepisów")} w bibliotece`;

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<ChefHat size={22} />}
          iconColor="var(--accent-orange)"
          title="Kuchnia"
          subtitle={subtitle}
          action={
            <Link
              href="/kitchen/recipes/new"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              <Plus size={13} />
              Nowy przepis
            </Link>
          }
        />

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <StatTile
            value={recipeCount}
            label="Przepisy"
            color="var(--accent-orange)"
            icon={<BookMarked size={14} />}
            href="/kitchen/recipes"
          />
          <StatTile
            value={todayPlannedCount}
            label="Posiłki dziś"
            color={todayPlannedCount > 0 ? "var(--accent-blue)" : "var(--text-muted)"}
            icon={<CalendarDays size={14} />}
            href="/kitchen/plan"
          />
          <StatTile
            value={pantryCount}
            label="Spiżarnia"
            color="var(--accent-green)"
            icon={<Package size={14} />}
            href="/kitchen/pantry"
          />
          <StatTile
            value={expiringSoonCount}
            label="Wygasające"
            color={expiringSoonCount > 0 ? "var(--accent-red)" : "var(--text-muted)"}
            icon={<AlertTriangle size={14} />}
            href="/kitchen/pantry"
            emphasized={expiringSoonCount > 0}
          />
        </div>

        {/* AI: Co ugotować z tego co mam (K3) */}
        {pantryCount > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Co ugotować z tego co mam?</span>
              <button
                onClick={fetchSuggestions}
                disabled={suggestBusy}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--accent-orange)", cursor: "pointer", opacity: suggestBusy ? 0.6 : 1 }}
              >
                {suggestBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {suggestBusy ? "Sprawdzam…" : "Zaproponuj AI"}
              </button>
            </div>
            {suggestError && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: 0 }}>{suggestError}</p>}
            {suggestions !== null && (
              suggestions.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Brak sugestii — uzupełnij spiżarnię lub dodaj przepisy.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {suggestions.map((s) => (
                    <Link key={s.recipeId} href={`/kitchen/recipes/${s.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-surface)", textDecoration: "none" }}>
                      <Sparkles size={14} style={{ color: "var(--accent-orange)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.title}</div>
                        {s.reason && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.reason}</div>}
                      </div>
                      <ChevronRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    </Link>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Today's meals (always show, even if empty) */}
        <div>
          <SectionHeading
            action={
              <Link
                href="/kitchen/plan"
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                Plan tygodnia <ChevronRight size={11} />
              </Link>
            }
          >
            Dziś w menu
          </SectionHeading>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {SLOT_ORDER.map((slot) => {
              const meal = todayMeals.find((m) => m.slot === slot);
              return <TodaySlotCard key={slot} slot={slot} meal={meal} />;
            })}
          </div>
        </div>

        {/* Expiring soon (only show if items exist) */}
        {expiring.length > 0 && (
          <div>
            <SectionHeading
              action={
                <Link
                  href="/kitchen/pantry"
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  Cała spiżarnia <ChevronRight size={11} />
                </Link>
              }
            >
              Kończy się termin
            </SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {expiring.map((item) => (
                <Link
                  key={item.id}
                  href="/kitchen/pantry"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    textDecoration: "none",
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                    e.currentTarget.style.borderColor = "var(--border-focus)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-surface)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <AlertTriangle
                    size={14}
                    style={{
                      color: expiryColor(item.daysLeft),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: expiryColor(item.daysLeft),
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: expiryColor(item.daysLeft) + "1a",
                      flexShrink: 0,
                    }}
                  >
                    {expiryText(item.daysLeft)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recently cooked */}
        {recentlyCooked.length > 0 && (
          <div>
            <SectionHeading
              action={
                <Link
                  href="/kitchen/recipes"
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  Wszystkie <ChevronRight size={11} />
                </Link>
              }
            >
              Ostatnio gotowane
            </SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentlyCooked.map((r) => (
                <RecipeRow key={r.id} recipe={r} />
              ))}
            </div>
          </div>
        )}

        {/* Latest (newly added) recipes — show only if no recently cooked yet */}
        {recentlyCooked.length === 0 && latestRecipes.length > 0 && (
          <div>
            <SectionHeading
              action={
                <Link
                  href="/kitchen/recipes"
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  Wszystkie <ChevronRight size={11} />
                </Link>
              }
            >
              Nowe w bibliotece
            </SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {latestRecipes.map((r) => (
                <Link
                  key={r.id}
                  href={`/kitchen/recipes/${r.slug}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    textDecoration: "none",
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                    e.currentTarget.style.borderColor = "var(--border-focus)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-surface)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🍳</span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </span>
                  {r.totalMinutes > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      <Clock size={10} /> {r.totalMinutes} min
                    </span>
                  )}
                  <ChevronRight size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state — no recipes at all */}
        {recipeCount === 0 && (
          <EmptyState
            icon={<ChefHat size={32} />}
            message="Brak przepisów w bibliotece"
            hint="Dodaj pierwszy przepis ręcznie, z URL-a, zdjęcia menu lub przez AI"
            cta={{ label: "+ Dodaj przepis", href: "/kitchen/recipes/new", color: "var(--accent-orange)" }}
          />
        )}

        {/* Cookbooks */}
        {cookbooks.length > 0 && (
          <div>
            <SectionHeading
              action={
                totalCookbooks > cookbooks.length ? (
                  <Link
                    href="/kitchen/cookbooks"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    Wszystkie ({totalCookbooks}) <ChevronRight size={11} />
                  </Link>
                ) : undefined
              }
            >
              Książki kucharskie
            </SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              {cookbooks.map((cb) => (
                <Link
                  key={cb.id}
                  href={`/kitchen/cookbooks/${cb.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    textDecoration: "none",
                    transition: "background 0.1s, border-color 0.1s, transform 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                    e.currentTarget.style.borderColor = cb.color ?? "var(--border-focus)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-surface)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{cb.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cb.name}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>
                      {cb.recipeCount} {pluralizePolish(cb.recipeCount, "przepis", "przepisy", "przepisów")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Management */}
        <div>
          <SectionHeading>Zarządzanie</SectionHeading>
          <ManagementGrid
            items={[
              { href: "/kitchen/recipes", icon: <BookMarked size={16} />, label: "Przepisy", color: "var(--accent-orange)" },
              { href: "/kitchen/plan", icon: <CalendarDays size={16} />, label: "Plan tygodnia", color: "var(--accent-blue)" },
              { href: "/kitchen/pantry", icon: <Package size={16} />, label: "Spiżarnia", color: "var(--accent-green)" },
              { href: "/kitchen/cookbooks", icon: <BookOpen size={16} />, label: "Książki", color: "var(--accent-purple)" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function TodaySlotCard({ slot, meal }: { slot: string; meal: TodayMeal | undefined }) {
  const [isPending, startTransition] = useTransition();

  if (!meal) {
    return (
      <Link
        href="/kitchen/plan"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "16px 12px",
          borderRadius: 10,
          border: "1px dashed var(--border)",
          background: "var(--bg-surface)",
          textDecoration: "none",
          minHeight: 88,
          textAlign: "center",
          transition: "background 0.1s, border-color 0.1s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
          e.currentTarget.style.borderColor = "var(--border-focus)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-surface)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <span style={{ fontSize: 18, opacity: 0.5 }}>{SLOT_EMOJI[slot]}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{SLOT_LABELS[slot]}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.7 }}>+ zaplanuj</span>
      </Link>
    );
  }

  const cooked = meal.status === "COOKED";
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 12 }}>{SLOT_EMOJI[slot]}</span>
          {SLOT_LABELS[slot]}
        </span>
        {cooked && (
          <CheckCircle2 size={12} style={{ color: "var(--accent-green)" }} />
        )}
      </div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: cooked ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: cooked ? "line-through" : undefined,
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {meal.title}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
          <Users size={9} /> {meal.servings}
        </span>
        {!cooked && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startTransition(() => markMealCooked(meal.id));
            }}
            disabled={isPending}
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 6,
              border: "1px solid rgba(34,197,94,0.3)",
              background: "rgba(34,197,94,0.1)",
              color: "var(--accent-green)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
            title="Oznacz jako ugotowane"
          >
            {isPending ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
            Gotowe
          </button>
        )}
      </div>
    </>
  );

  const sharedStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    textDecoration: "none",
    minHeight: 88,
    transition: "background 0.1s, border-color 0.1s",
  };

  if (meal.recipeSlug) {
    return (
      <Link
        href={`/kitchen/recipes/${meal.recipeSlug}`}
        style={sharedStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
          e.currentTarget.style.borderColor = "var(--border-focus)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-surface)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        {inner}
      </Link>
    );
  }
  return <div style={sharedStyle}>{inner}</div>;
}

function RecipeRow({ recipe }: { recipe: RecentRecipe }) {
  return (
    <Link
      href={`/kitchen/recipes/${recipe.slug}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        textDecoration: "none",
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
        e.currentTarget.style.borderColor = "var(--border-focus)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {recipe.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.coverImageUrl}
          alt=""
          style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 18,
          }}
        >
          🍳
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {recipe.title}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
          {recipe.totalMinutes > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={10} /> {recipe.totalMinutes} min
            </span>
          )}
          {recipe.lastCookedAt && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {relativeTime(recipe.lastCookedAt)}
            </span>
          )}
        </p>
      </div>
      <span
        style={{
          fontSize: 11,
          color: "var(--accent-orange)",
          background: "rgba(234,88,12,0.1)",
          padding: "2px 8px",
          borderRadius: 10,
          border: "1px solid rgba(234,88,12,0.2)",
          flexShrink: 0,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <ChefHat size={10} />
        {recipe.cookCount}×
      </span>
    </Link>
  );
}

function expiryColor(daysLeft: number): string {
  if (daysLeft < 0) return "var(--accent-red)";
  if (daysLeft <= 1) return "var(--accent-red)";
  if (daysLeft <= 3) return "var(--accent-amber)";
  return "var(--text-muted)";
}

function expiryText(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} dni temu`;
  if (daysLeft === 0) return "dziś";
  if (daysLeft === 1) return "jutro";
  return `za ${daysLeft} ${pluralizePolish(daysLeft, "dzień", "dni", "dni")}`;
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "dziś";
  if (diffDays === 1) return "wczoraj";
  if (diffDays < 7) return `${diffDays} dni temu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg. temu`;
  return `${Math.floor(diffDays / 30)} mies. temu`;
}

function pluralizePolish(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return few;
  return many;
}
