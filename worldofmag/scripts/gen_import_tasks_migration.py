# -*- coding: utf-8 -*-
"""One-shot generator: parse the spreadsheet paste into app-shaped Task JSON and
emit a Prisma migration that seeds it as an admin-visible Report.

Run:  python3 scripts/gen_import_tasks_migration.py
Output: prisma/migrations/0062_import_tasks_spreadsheet_report/migration.sql
"""
import json, math, os, re

# Each row mirrors the spreadsheet columns we keep:
#   typ      'C' (cykliczne) | 'T' (jednorazowe)
#   cykl     raw Cykliczność text ('' if none)
#   czas     Czas (h), Polish decimal comma, '' if blank
#   ctx      Kontekst
#   prio     leading number of Priorytet (1..4)
#   place    Miejsce ('' for '-----')
#   termin   Termin (ISO date)
#   who      'a' | 's'   (a=Asia, s=Szymon)
#   urg      Pilność ('!', '!!', '!!!')
#   zadanie  Zadanie cell (first line = title, rest = description)
#   opis     list of extra Opis columns
ROWS = [
 ('C','co miesiąc','0,1','raj',1,'','2026-04-28','a','!!',
  "Raj - Simparica (Trio do podania 28 maj - potem za kolejne 3 miesiące)\n- w koconiu skończyła się simparica trio",[]),
 ('C','co 2 dni','0,5','raj',1,'','2026-05-16','a','!!!',
  "Raj fizjoterapia\n- ćwiczyć\n- przygotować potrzebne sprzęty\n- po niecałym miesiącu ćwiczeń umówić się do VitalVet",[]),
 ('T','','1','dom',1,'','2026-03-28','a','!!!',
  "Remont/ogród; \n- Łukasz - upomnieć się - czekam na odpowiedź mailową\n- Mateusz - kolory blatów\n- Andrzej - czekam co odpisze w sprawie wycen ekip; zawieszona kostka i mamy prawo do poprawek tarasu\n- musimy odpowiedzieć andrzejowi na ofertę mebli na wymiar",[]),
 ('T','','0,5','dom',1,'','2026-05-05','s','!!!',
  "Dowiedzieć się czy na obecnej konstrukcji dachu będzie można założyć panele słoneczne",[]),
 ('T','','0,5','zdrowie',1,'','2026-03-28','s','!!!',
  "Dermatolog (alergolog i inni) -\n- podsumować co było na wizycie i ustalić co dalej",["AllMedica w Wadowicach"]),
 ('C','co rok','','raj',1,'','2026-03-28','a','!!!',
  "Szczepienie przeciwko kaszlowi kennelowemu\n- zastanowić się czy w tym roku będziemy szczepić (ostatnie szczepienie: 2025.06.18)",[]),
 ('C','co ile trzeba','0,5','raj',1,'','2026-03-28','a','!!!',
  "Schodzić z Forthyronu\n- badanie krwi (co miesiąc) - czekam na wyniki razem z cytologią\n- kontrola w ivet (20 maj)",["co dalej?"]),
 ('C','co ile trzeba','0,2','zdrowie',1,'Katowice','2026-05-04','s','!!',
  "Stomatologia \n- umówić wizytę\n- zdjęcie lekarstwa",[]),
 ('C','1 lipca','1','inne',1,'','2026-03-28','s','!!!',
  "Ogarnąć dla Asi prezent na kolejną okazję \n\nKRUK\n\nKwiatki na walentynki i na rocznicę zamówić (odbiór piątek i niedziela)\n\nwybrać romansidło\n\nZarezerwowany stolik w restauracji na 14:30 w sobotę: https://maps.app.goo.gl/6rnG78ykTk5ZEs2S6\n\nhttps://www.facebook.com/share/p/1D1BujfxZo/",
  ["https://www.amazon.pl/s?k=kindle&i=electronics&rh=n%3A20657432031%2Cp_123%3A323125%2Cp_n_condition-type%3A21329610031%2Cp_6%3AA2R2221NX79QZP&dc&crid=UAF0BIQY7KQ3&qid=1756750445&rnid=20875378031&sprefix=k%2Caps%2C102&ref=sr_nr_p_6_1&ds=v1%3AaOMZ2cWsq%2B%2F3qvxSZB43C3tkuimM%2FJRzmgr5Qyw53%2Bskupić\nKindle Paperwhite 6 Signature Edition\nalbo colorsoft 32 GB\nsprawdzić recenzje colorsoft\n\n koszulę nocną, znaleźć teatr, ogarnąć restaurację, jeszcze coś? może coś drobnego, albo coś do Potworka? Nauka jazdy terenowej ( To ci się może przydać do prezentu dla mnie\nJedna dziewczyna z turnieju k9 byla u nich i była zadowolona\n\n\nhttps://www.facebook.com/eror4x4 ). Garmin który będzie się ładował słonecznie. ",
   "kolczyki\nvoucher\n?\nhttps://www.perplexity.ai/search/podaj-10-pomyslow-na-33-urodzi-QG9pkkbSR4CaUOBK5gXrpA"]),
 ('C','co ile? Maj','1','zdrowie',1,'','2026-03-28','a','!!!',
  "Szczpienia\n\n(MAJ) \nZałatwić receptę, kupić i zaszczepić w czerwcu (procedurę zacząć w maju): \nodkleszczowe zapalenie mózgu:\n- Szymon - :FSME-IMMUN 0,5 ml 2,4 µg/0,5 ml\n- Asia - Encepur Adults",
  ["DONE 1. Ze zdjęć żółtej książeczki stworzyć excela ze szczepieniami jakie mieliśmy; \n2. Wpisać daty szczepień covid; \n3. Uzupełnić listę o szczepienia z książeczek zdrowia dziecka; \n4. Spytać rodziców czy było więcej szczepień; \n5. Ustalić listę na co chcemy mieć odporność (m.in: kleszczowe zapalenie mózgu, koklusz); \n6. U lekarza w Gilowicach spytać na co jeszcze warto się zaszczepić; \n7. Z lekarzem zweryfikować listę odbytych szczepień i zrobić plan szczepień; \n8. Zaszczepić się zgodnie z planem szczepień;",
   "https://www.gov.pl/web/zdrowie/szczepienia-obowiazkowe-i-zalecane\n\nNiepubliczny Zakład Opieki Zdrowotnej \"VITA\" – Ślemień, Żywiecka 5 -\n tel: 338654075 - przychodniaslemien@gmail.com - to jest dobry numer!!!!!"]),
 ('C','co rok - 1 marca','1','dom',1,'','2026-03-28','a','!!',
  "Pomyśleć o czymś na rocznicę ślubu",[]),
 ('T','','0,5','dom',1,'Kocoń','2026-05-15','a','!!!',
  "ZUK - umowa na przyłącza na czerwiec - być w kontakcie",[]),
 ('C','co 2 dni','1','zdrowie',2,'','2026-03-28','s','!!!',
  "CHRAPANIE - LARYNGOLOGIA\n- ćwiczenia\n- spać z ortezą",["Laryngolog Blicharz","KOD: 8382\n"]),
 ('C','co 3 lata','1','zdrowie',2,'','2026-03-28','s','!!!',
  "Okulista\n- sprawdzić czy mam już zrobione wszystkie badania by iść do okulisty",[]),
 ('T','','2','zdrowie',2,'','2026-03-28','s','!!!',
  "ORTOPEDA:\nZlecone badania krwi\numówić wizytę do ortopedy.\nSpytać o Badanie ORTO kręgosłupa na urazówce w Piekarach ",[]),
 ('T','','1','dom',2,'','2026-04-14','s','!!!',
  "Mateusz blaty - wybrać kolor",[]),
 ('C','co miesiąc','2','zdrowie',2,'','2026-03-28','s','!!',
  "Odburzanie",[]),
 ('C','co 3 miiesiące','0,2','raj',4,'','2026-04-28','a','!',
  "Upewnić się że mamy w obu domach:\n- Simparice (+ Simparica trio na odrobaczanie)\n- Forthyron",[]),
 ('C','pn','0','praca',4,'','2026-05-26','s','!',
  "Dyscyplina - koncentracja - cierpliwość",[]),
 ('C','co 2 dni','0,5','zdrowie',3,'','2026-03-28','s','!!!',
  "ćwiczenia: basen, gęsia stopka, rozciąganie barków i szyi, głębokie mięśnnie brzuch, JOGA",[]),
 ('C','co 2 lata','','raj',3,'','2026-04-27','a','!!!',
  "Raj RTG całości? czy tylko bioder? Czekamy na wyniki cytologii",["gdzie wyniki z ARKI? wyniki cytologi i wymazu z ogona"]),
 ('C','co 2 tygodnie','2','dom',3,'Kocoń','2026-03-28','a','!!',
  "Odpajęczanie domu i posesji",[]),
 ('C','co rok pół roku','1,5','inne',4,'','2026-03-28','s','!!',
  "Julka - wymyśleć coś fajnego",[]),
 ('C','co rok (2 stycznia)','2','dom',1,'','2026-03-28','a','!!!',
  "Rozliczenie roku + zwrot Asi za mieszkanie, terapie, lekarze, masaże + sprawdzić czy Asia odesłała mi 20k",[]),
 ('T','','2','dom',1,'','2026-07-28','a','!!',
  "Chlorowanie studni",[]),
 ('C','co miesiąc - 20 dnia miesiąca','1','dom',1,'','2026-03-28','a','!!!',
  "Rozliczenie miesiąca",[]),
 ('T','','1','inne',1,'','2026-03-28','s','!!!',
  "kupić:\n- suplementy (glicyna, ...)\n- koszulki\n- skarpetki\n- akcesoria basenowe (moskitiera?)",[]),
 ('C','pt','1','dom',1,'Kocoń','2026-05-08','a','!!!',
  "Odkurzanie (Kocoń)",[]),
 ('T','','1','samochód',1,'','2026-03-29','s','!!!',
  "Mazda - drzwi - jechać do Specka?",[]),
 ('C','co 2 dni','1','inne',1,'','2026-03-28','s','!!!',
  "Ogarnąć nieprzeczytane i odłożone maile + zwolnić miejsce na gdrive",[]),
 ('T','','1','dom',2,'','2026-03-28','s','!!',
  "Zrobić porządek w aktach",[]),
 ('T','','1','dom',3,'','2026-03-28','s','!',
  "Sprawdzić czy coś się zmieniło w temacie zbliżeniowych przelewó blik na iPhone\nhttps://www.perplexity.ai/search/czy-w-sklepach-z-terminalami-p-NlqXsL4bSgCxAWdYgjgMPA",[]),
 ('C','co 2 tygodnie','0,5','raj',4,'Kocoń','2026-05-09','a','!!',
  "Raj - umyć miski (Kocoń)",[]),
 ('T','','1','dom',3,'','2026-03-28','a','!!',
  "Kupić szczotkę wirującą",[]),
 ('C','co ile trzebba','2','praca',3,'','2026-03-28','s','!!',
  "Zwolnić miejsce na gdrive",[]),
 ('C','pt','0,5','raj',3,'','2026-05-04','a','!!',
  "Raj - czesanie",[]),
 ('C','co 10 tygodni','0,5','dom',3,'Kocoń','2026-03-28','a','!!',
  "Wyczyścić rumbę",[]),
 ('T','','1','dom',3,'','2026-03-28','a','!',
  "Załatwić wymianę akumulatora do odkurzacza",[]),
 ('C','pt','1','dom',4,'Kocoń','2026-05-08','a','!!!',
  "Poodkładać rzeczy na miejsca (Kocoń)",[]),
 ('T','','1','praca',3,'','2026-03-28','s','!!!',
  "Kupić dodatkowe ekrany do lapka z pracy",["Wybrać coś tu: https://www.google.com/search?sca_esv=37db28bfa134011b&rlz=1CDGOYI_enPL826PL826&hl=pl&sxsrf=ADLYWIJIdkN5Lg5aElpeSuqozwa09xtaIA:1719342820750&q=monitor+doczepiany+do+laptopa&udm=3"]),
 ('C','co 3 tygodnie','1','dom',4,'Kocoń','2026-04-18','a','!!',
  "Wytrzeć kurze (Kocoń)",["parapety, biurko, regał w salonie, drzwi + inne"]),
 ('C','co miesiąc','0,5','dom',4,'Kocoń','2026-05-04','a','!',
  "Czyszczenie odpływów (sprawdzić wszystkie) - Kocoń",[]),
 ('C','co miesiąc','0,5','dom',4,'Kocoń','2026-04-22','a','!',
  "Sprawdzić czy w lodówce jest nadmiar wody i przeczyścić (Kocoń)",[]),
 ('T','','2','dom',3,'','2026-03-28','a','!!',
  "Działka Jeleśnia, sprawdzić ceny działek",["Dowiedzieć się czy sprzedaż wymaga podatku jeśli to idzie na remont. Jeśli tak to zastanowić się co dalej, czy sprzedać czy uzbroić czy wyrównać (ile to kosztuje)"]),
 ('C','co rok','1','inne',4,'','2026-03-28','s','!!',
  "Znaleźć kameralne koncerty zagranicznych artystow",[]),
 ('C','co rok (24 października)','3','dom',3,'','2026-03-28','s','!',
  "Wymyśleć prezenty dla wszystkich na kolejną okazję",[]),
 ('C','do 22 dnia nieparzystego miesiąca','0,3','dom',3,'Kocoń','2026-05-22','a','!',
  "Odczyt prądu (Kocoń) - Asia 20 dnia miesiąca",[]),
]

PRIORITY = {1: "URGENT", 2: "HIGH", 3: "MEDIUM", 4: "LOW"}
CATEGORY = {"raj": "Raj", "dom": "Dom", "zdrowie": "Zdrowie",
            "inne": "Inne", "praca": "Praca", "samochód": "Samochód"}
WHO = {"a": "Asia", "s": "Szymon"}
WEEKDAY = {"pn": 1, "wt": 2, "śr": 3, "czw": 4, "pt": 5, "sb": 6, "nd": 0}


def mins(czas):
    if not czas.strip():
        return None
    h = float(czas.replace(",", "."))
    return int(round(h * 60)) or None


def parse_recurring(typ, cykl):
    """Best-effort RecurringRule from Polish text. Returns dict or None.
    None means "recurring but cadence not machine-parseable" — raw text is kept
    in the description so nothing is lost."""
    if typ != "C":
        return None
    t = cykl.strip().lower()
    if not t:
        return None
    # fixed weekday, e.g. "pn", "pt"
    if t in WEEKDAY:
        return {"type": "WEEKLY", "interval": 1, "daysOfWeek": [WEEKDAY[t]]}
    # "co N dni" / "co dzień"
    m = re.search(r"co\s+(\d+)\s+dni", t)
    if m:
        return {"type": "DAILY", "interval": int(m.group(1))}
    # "co N tygodni(e)" / "co tydzień"
    m = re.search(r"co\s+(\d+)\s+tygodn", t)
    if m:
        return {"type": "WEEKLY", "interval": int(m.group(1))}
    if "co tydzień" in t:
        return {"type": "WEEKLY", "interval": 1}
    # "co N miesiąc/miesiące/miiesiące" + optional "N dnia"
    dom = None
    md = re.search(r"(\d+)\s+dnia", t)
    if md:
        dom = int(md.group(1))
    m = re.search(r"co\s+(\d+)\s+mi+esi", t)
    if m:
        r = {"type": "MONTHLY", "interval": int(m.group(1))}
        if dom:
            r["dayOfMonth"] = dom
        return r
    if "co miesiąc" in t:
        r = {"type": "MONTHLY", "interval": 1}
        if dom:
            r["dayOfMonth"] = dom
        return r
    # "nieparzystego miesiąca" ≈ co 2 miesiące
    if "nieparzyst" in t and "miesi" in t:
        r = {"type": "MONTHLY", "interval": 2}
        if dom:
            r["dayOfMonth"] = dom
        return r
    # "co N lat(a)" / "co rok"  ("co rok pół roku" is ambiguous → None)
    if "pół roku" in t:
        return None
    m = re.search(r"co\s+(\d+)\s+lat", t)
    if m:
        return {"type": "YEARLY", "interval": int(m.group(1))}
    if "co rok" in t:
        return {"type": "YEARLY", "interval": 1}
    # everything else ("co ile trzeba", "1 lipca", "co ile? Maj", …) → unknown
    return None


def build_task(idx, row):
    typ, cykl, czas, ctx, prio, place, termin, who, urg, zadanie, opis = row
    lines = zadanie.split("\n")
    title = lines[0].strip()
    body_rest = "\n".join(lines[1:]).strip()

    desc_parts = []
    if body_rest:
        desc_parts.append(body_rest)
    for col in opis:
        col = col.strip()
        if col:
            desc_parts.append(col)

    # Faithful footer for spreadsheet columns without a first-class Task field.
    meta = []
    meta.append(f"Typ: {'cykliczne' if typ == 'C' else 'jednorazowe'}")
    if cykl.strip():
        meta.append(f"Cykliczność (oryg.): {cykl.strip()}")
    if place.strip():
        meta.append(f"Miejsce: {place.strip()}")
    meta.append(f"Przypisane: {WHO.get(who, who)}")
    meta.append(f"Pilność: {urg}")
    desc_parts.append("— Meta (z arkusza) —\n" + "\n".join(meta))

    description = "\n\n".join(desc_parts) if desc_parts else None

    return {
        "title": title,
        "description": description,
        "status": "TODO",
        "priority": PRIORITY[prio],
        "dueDate": f"{termin}T00:00:00.000Z",
        "startDate": None,
        "completedAt": None,
        "estimatedMins": mins(czas),
        "recurring": parse_recurring(typ, cykl),
        "category": CATEGORY.get(ctx, "Other"),
        "order": float(idx),
    }


tasks = [build_task(i, r) for i, r in enumerate(ROWS)]
payload = json.dumps(tasks, ensure_ascii=False, indent=2)

stats_unparsed = [t["title"] for t, r in zip(tasks, ROWS)
                  if r[0] == "C" and t["recurring"] is None]

report = f"""# Import zadań z arkusza — {len(tasks)} pozycji (2026-06-01)

Zrzut listy zadań wklejonej z arkusza kalkulacyjnego, **przetłumaczony na format
zadań aplikacji** (model `Task`). To dokument referencyjny do importu — JSON niżej
można skopiować i zasilić nim moduł Tasks (np. przez akcję tworzenia zadań).

## Jak czytano kolumny arkusza

| Kolumna arkusza | Pole `Task` | Uwagi |
|---|---|---|
| Zadanie (1. linia) | `title` | pierwsza linia komórki |
| Zadanie (reszta) + Opis (kilka kolumn) | `description` | sklejone, każda kolumna jako osobny akapit |
| Priorytet (1–4) | `priority` | 1.Blocker→URGENT, 2.Critical→HIGH, 3.High→MEDIUM, 4.Normal→LOW |
| Termin | `dueDate` | data ISO |
| Czas (h) | `estimatedMins` | godziny × 60 (przecinek dziesiętny) |
| Cykliczność + Typ=C | `recurring` | parsowane do `RecurringRule` (gdy się dało) |
| Kontekst | `category` | raj/dom/zdrowie/inne/praca/samochód → Raj/Dom/… |
| Miejsce, Pilność, Przypisane (a/s), Typ, oryg. Cykliczność | (brak pola) | zachowane w stopce „Meta" w `description` |

Statusy ustawiono na `TODO` (wszystkie pozycje to zadania otwarte). Pola
`startDate`, `completedAt`, `assigneeId`, `projectId` zostawiono puste — do
ustawienia przy faktycznym imporcie.

## Cykliczność wymagająca ręcznej weryfikacji

Te pozycje są cykliczne, ale tekst cadencji był niejednoznaczny i `recurring`
zostało `null` (oryginalny opis jest w stopce „Meta"): {", ".join(f'„{t}"' for t in stats_unparsed) if stats_unparsed else "brak"}.

## JSON ({len(tasks)} zadań)

```json
{payload}
```
"""

# ── Emit migration (PostgreSQL, dollar-quoted, idempotent) ──────────────────
TAG = "import_zadan_arkusz"
assert f"${TAG}$" not in report, "dollar-quote tag collides with content"

migration = f"""-- Seed raportu (admin-visible) z importem listy zadań z arkusza kalkulacyjnego.
-- Treść = markdown z blokiem ```json zawierającym {len(tasks)} zadań w formacie
-- modelu Task aplikacji (title/description/priority/dueDate/estimatedMins/
-- recurring/category/...). Widoczny w /admin/reports oraz /reports.
-- INSERT idempotentny: ON CONFLICT (slug) DO NOTHING. PostgreSQL-only (gen_random_uuid).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Import zadań z arkusza — {len(tasks)} pozycji (2026-06-01)',
  'import-zadan-arkusz-2026-06-01',
  ${TAG}${report}${TAG}$,
  'import',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
"""

out_dir = "prisma/migrations/0062_import_tasks_spreadsheet_report"
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "migration.sql"), "w", encoding="utf-8") as f:
    f.write(migration)

# also drop the bare JSON next to the script for convenience/inspection
with open("scripts/import_tasks.json", "w", encoding="utf-8") as f:
    f.write(payload + "\n")

print(f"tasks: {len(tasks)}")
print(f"recurring parsed: {sum(1 for t in tasks if t['recurring'])}")
print(f"recurring null (C-type): {len(stats_unparsed)} -> {stats_unparsed}")
print(f"wrote {out_dir}/migration.sql ({len(migration)} bytes)")
