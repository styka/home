-- Preferencje menu per użytkownik: kolejność modułów + lista wyłączonych działów.
-- order/disabled przechowywane jako JSON (string[]). Brak wiersza ⇒ wartości domyślne
-- (wszystkie działy włączone oprócz QA, kolejność bazowa).

-- CreateTable
CREATE TABLE "UserMenuPref" (
    "userId" TEXT NOT NULL,
    "order" TEXT NOT NULL DEFAULT '[]',
    "disabled" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserMenuPref_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserMenuPref" ADD CONSTRAINT "UserMenuPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
