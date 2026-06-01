-- Usługi (Marketplace) module: dwustronny rynek usług klient ↔ wykonawca
-- (konkurencja dla Fixly/Booksy). Ownership/scoping wzorem istniejących modułów.

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🛠️',
    "color" TEXT NOT NULL DEFAULT 'var(--accent-blue)',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "area" TEXT,
    "phone" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceListing" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceModel" TEXT NOT NULL DEFAULT 'quote',
    "priceAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "listingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "preferredAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReview" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceCategory_userId_idx" ON "ServiceCategory"("userId");
CREATE INDEX "ServiceCategory_teamId_idx" ON "ServiceCategory"("teamId");
CREATE UNIQUE INDEX "ServiceProvider_userId_key" ON "ServiceProvider"("userId");
CREATE INDEX "ServiceProvider_visible_idx" ON "ServiceProvider"("visible");
CREATE INDEX "ServiceListing_providerId_active_idx" ON "ServiceListing"("providerId", "active");
CREATE INDEX "ServiceListing_categoryId_idx" ON "ServiceListing"("categoryId");
CREATE INDEX "ServiceRequest_clientId_status_idx" ON "ServiceRequest"("clientId", "status");
CREATE INDEX "ServiceRequest_providerId_status_idx" ON "ServiceRequest"("providerId", "status");
CREATE UNIQUE INDEX "ServiceReview_requestId_key" ON "ServiceReview"("requestId");

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceReview" ADD CONSTRAINT "ServiceReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed kategorii systemowych (idempotentnie)
INSERT INTO "ServiceCategory" ("id", "name", "icon", "color", "sortOrder", "userId", "teamId", "createdAt") VALUES
  ('svc-cat-remont',   'Remonty i wykończenia', '🔨', 'var(--accent-orange)', 1, NULL, NULL, NOW()),
  ('svc-cat-hydraulik','Hydraulika',            '🚿', 'var(--accent-blue)',   2, NULL, NULL, NOW()),
  ('svc-cat-elektryk', 'Elektryka',             '💡', 'var(--accent-amber)',  3, NULL, NULL, NOW()),
  ('svc-cat-sprzatanie','Sprzątanie',           '🧹', 'var(--accent-green)',  4, NULL, NULL, NOW()),
  ('svc-cat-ogrod',    'Ogród i zieleń',        '🌿', 'var(--accent-green)',  5, NULL, NULL, NOW()),
  ('svc-cat-uroda',    'Uroda i fryzjer',       '💇', 'var(--accent-purple)', 6, NULL, NULL, NOW()),
  ('svc-cat-korepetycje','Korepetycje',         '📚', 'var(--accent-blue)',   7, NULL, NULL, NOW()),
  ('svc-cat-it',       'IT i komputery',        '💻', 'var(--accent-purple)', 8, NULL, NULL, NOW()),
  ('svc-cat-transport','Transport i przeprowadzki', '🚚', 'var(--accent-blue)', 9, NULL, NULL, NOW()),
  ('svc-cat-auto',     'Motoryzacja',           '🚗', 'var(--accent-red)',  10, NULL, NULL, NOW())
ON CONFLICT ("id") DO NOTHING;
