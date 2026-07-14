-- Z-030: indeksy na kolumnach właściciela (ownerId/ownerTeamId) w modelach
-- multi-tenant, które ich jeszcze nie miały — eliminują pełne skany przy
-- filtrowaniu po właścicielu/zespole (wzorzec ownedByWhere).
-- IF NOT EXISTS: część indeksów (np. Note) mogła już istnieć w bazie z wcześniejszej
-- migracji mimo braku @@index w schema.prisma (dryf) — idempotentnie pomijamy istniejące.

CREATE INDEX IF NOT EXISTS "Team_ownerId_idx" ON "Team"("ownerId");
CREATE INDEX IF NOT EXISTS "ShoppingList_ownerId_idx" ON "ShoppingList"("ownerId");
CREATE INDEX IF NOT EXISTS "ShoppingList_ownerTeamId_idx" ON "ShoppingList"("ownerTeamId");
CREATE INDEX IF NOT EXISTS "Note_ownerId_idx" ON "Note"("ownerId");
CREATE INDEX IF NOT EXISTS "Note_ownerTeamId_idx" ON "Note"("ownerTeamId");
CREATE INDEX IF NOT EXISTS "TaskProject_ownerId_idx" ON "TaskProject"("ownerId");
CREATE INDEX IF NOT EXISTS "TaskProject_ownerTeamId_idx" ON "TaskProject"("ownerTeamId");
CREATE INDEX IF NOT EXISTS "Store_ownerId_idx" ON "Store"("ownerId");
CREATE INDEX IF NOT EXISTS "PetSale_ownerTeamId_idx" ON "PetSale"("ownerTeamId");
