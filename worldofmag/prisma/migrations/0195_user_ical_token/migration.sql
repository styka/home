-- Z-150: odwoływalny token feedu iCal per user (subskrypcja agendy w Google/Apple
-- bez logowania). Nullable — generowany na żądanie; revoke = regeneracja/wyzerowanie
-- (stary URL przestaje działać). Token traktowany jak sekret (długi, losowy).
-- IF NOT EXISTS — idempotentnie (konwencja projektu).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "icalToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_icalToken_key" ON "User"("icalToken");
