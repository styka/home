-- CreateTable
CREATE TABLE "Skin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "colorScheme" TEXT NOT NULL DEFAULT 'dark',
    "tokens" TEXT NOT NULL DEFAULT '{}',
    "ownerId" TEXT,
    "ownerTeamId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkinPref" (
    "userId" TEXT NOT NULL,
    "skinId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkinPref_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Skin_ownerId_idx" ON "Skin"("ownerId");

-- CreateIndex
CREATE INDEX "Skin_ownerTeamId_idx" ON "Skin"("ownerTeamId");

-- AddForeignKey
ALTER TABLE "Skin" ADD CONSTRAINT "Skin_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skin" ADD CONSTRAINT "Skin_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkinPref" ADD CONSTRAINT "UserSkinPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Seed: 5 skórek systemowych (idempotentnie) ───────────────────────────────
-- Tokeny to częściowa mapa zmiennych CSS. "Ciemny" = pusta mapa (dziedziczy
-- domyślne wartości z globals.css). Pozostałe niosą jawne nadpisania.
INSERT INTO "Skin" ("id", "name", "description", "isSystem", "colorScheme", "tokens", "sortOrder", "isPublic", "createdAt", "updatedAt")
VALUES
  ('skin-system-dark',  'Ciemny',  'Domyślny ciemny motyw — minimalistyczny, deweloperski.', true, 'dark',  $${}$$, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('skin-system-light', 'Jasny',   'Schludny, profesjonalny jasny motyw.', true, 'light',
    $${"--color-scheme":"light","--bg-base":"#ffffff","--bg-surface":"#f6f7f8","--bg-elevated":"#eef0f2","--bg-hover":"#e6e8eb","--border":"#dcdfe3","--border-focus":"#b8bcc2","--text-primary":"#1a1d21","--text-secondary":"#5b626b","--text-muted":"#868d96","--on-accent":"#ffffff","--accent-blue":"#2563eb","--accent-blue-dim":"#1d4ed8","--accent-green":"#16a34a","--accent-red":"#dc2626","--accent-amber":"#d97706","--accent-purple":"#9333ea","--accent-orange":"#ea580c"}$$,
    1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('skin-system-casual','Casual',  'Ciepły, stonowany motyw w odcieniach beżu i ziemi.', true, 'light',
    $${"--color-scheme":"light","--bg-base":"#f5f1ea","--bg-surface":"#efe8dd","--bg-elevated":"#e7ddcd","--bg-hover":"#ddd0bb","--border":"#d8cbb6","--border-focus":"#b8a584","--text-primary":"#3a3026","--text-secondary":"#6f6353","--text-muted":"#928571","--on-accent":"#ffffff","--accent-blue":"#a06a3c","--accent-blue-dim":"#825733","--accent-green":"#7a8450","--accent-red":"#bc5b4a","--accent-amber":"#cc9544","--accent-purple":"#9a7b6a","--accent-orange":"#c87f4a","--radius":"10px","--radius-lg":"16px"}$$,
    2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('skin-system-boy',   'Błękit',  'Pogodny błękitny motyw.', true, 'light',
    $${"--color-scheme":"light","--bg-base":"#f0f6fd","--bg-surface":"#e3eefb","--bg-elevated":"#d4e4f7","--bg-hover":"#c2d8f2","--border":"#bcd6f0","--border-focus":"#8bb6e0","--text-primary":"#16314f","--text-secondary":"#4a6b8a","--text-muted":"#7592b3","--on-accent":"#ffffff","--accent-blue":"#2f7fdb","--accent-blue-dim":"#2466b0","--accent-green":"#2fa3a0","--accent-red":"#e06a6a","--accent-amber":"#e0a83c","--accent-purple":"#7e8fe0","--accent-orange":"#f08a4b","--radius":"12px","--radius-lg":"18px"}$$,
    3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('skin-system-girl',  'Róż',     'Łagodny różowy motyw.', true, 'light',
    $${"--color-scheme":"light","--bg-base":"#fdf2f7","--bg-surface":"#fbe6ef","--bg-elevated":"#f7d6e6","--bg-hover":"#f2c4da","--border":"#f0c6dc","--border-focus":"#e095bb","--text-primary":"#4d1f38","--text-secondary":"#8a4d6c","--text-muted":"#b07591","--on-accent":"#ffffff","--accent-blue":"#d35b9e","--accent-blue-dim":"#b8478a","--accent-green":"#5cb592","--accent-red":"#e06a8a","--accent-amber":"#e0a05c","--accent-purple":"#b06fd6","--accent-orange":"#f0859a","--radius":"14px","--radius-lg":"20px"}$$,
    4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
