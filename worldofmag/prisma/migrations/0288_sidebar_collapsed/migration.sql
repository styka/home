-- 118 (zgł. 11): zwijanie menu bocznego do ikon — stan per użytkownik, obok favoritesCollapsed.
ALTER TABLE "UserMenuPref" ADD COLUMN "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false;
