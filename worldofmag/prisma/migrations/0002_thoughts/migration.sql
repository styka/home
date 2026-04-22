-- CreateTable
CREATE TABLE "Thought" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thought_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThoughtAttachment" (
    "id" TEXT NOT NULL,
    "thoughtId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThoughtAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ThoughtAttachment" ADD CONSTRAINT "ThoughtAttachment_thoughtId_fkey" FOREIGN KEY ("thoughtId") REFERENCES "Thought"("id") ON DELETE CASCADE ON UPDATE CASCADE;
