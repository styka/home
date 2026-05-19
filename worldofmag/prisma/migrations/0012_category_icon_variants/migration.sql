-- CreateTable
CREATE TABLE "CategoryIconVariant" (
    "id" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "svgContent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryIconVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryIconVariant_userId_categoryName_idx" ON "CategoryIconVariant"("userId", "categoryName");

-- AddForeignKey
ALTER TABLE "CategoryIconVariant" ADD CONSTRAINT "CategoryIconVariant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
