-- 090 (zadanie 14, strona zapisu) — NADANIA LINKOWE.
--
-- 051 zostawiło znaną lukę zapisaną wprost: `@@unique([resourceType, resourceId, subjectType,
-- subjectId])` NIE łapie nadań linkowych, bo mają `subjectId = NULL`, a w PostgreSQL NULL-e
-- w indeksie unikalnym są traktowane jako różne. Poprawka nie polega jednak na dołożeniu indeksu
-- częściowego zabraniającego dwóch linków — **dwa linki do tego samego zasobu są uzasadnione**
-- (inna rola, inny termin ważności, jeden do odwołania). Polega na daniu nadaniu linkowemu
-- WŁASNEJ TOŻSAMOŚCI: token. Dwa linki są wtedy dwoma różnymi nadaniami, a nie duplikatem.

ALTER TABLE "ResourceGrant" ADD COLUMN "token" TEXT;

-- Token jest kluczem dostępu, więc musi być unikalny w skali całej instalacji. Indeks CZĘŚCIOWY:
-- nadania osobowe i przestrzenne tokenu nie mają i nie mogą się o niego bić.
CREATE UNIQUE INDEX "ResourceGrant_token_key" ON "ResourceGrant" ("token") WHERE "token" IS NOT NULL;

-- Nadanie linkowe BEZ tokenu byłoby dostępem, którego nie da się użyć ani odwołać po niczym poza
-- identyfikatorem wiersza. Baza tego pilnuje, bo to niezmiennik danych, nie reguła interfejsu.
ALTER TABLE "ResourceGrant" ADD CONSTRAINT "ResourceGrant_link_ma_token"
  CHECK ("subjectType" <> 'link' OR "token" IS NOT NULL);
