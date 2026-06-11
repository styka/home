-- M19: slug + tagline profilu publicznego wykonawcy.
ALTER TABLE "ServiceProvider" ADD COLUMN "slug" TEXT;
ALTER TABLE "ServiceProvider" ADD COLUMN "tagline" TEXT;
CREATE UNIQUE INDEX "ServiceProvider_slug_key" ON "ServiceProvider"("slug");
