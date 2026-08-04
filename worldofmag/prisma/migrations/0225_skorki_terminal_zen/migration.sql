-- 045: kolejne skórki flagowe — „Terminal" i „Zen".
--
-- Źródłem prawdy dla tokenów jest `src/lib/skins/flagship.ts`; ten plik jest jego odbiciem
-- w SQL-u, bo prod odpala wyłącznie `prisma migrate deploy` i nie wykona kodu TS.
--
-- ON CONFLICT DO NOTHING, nie DO UPDATE — właściciel mógł skórkę systemową zmodyfikować,
-- a migracja nie ma prawa cofać jego zmian.
--
-- Wycofanie: DELETE FROM "Skin" WHERE "id" IN ('skin-system-terminal','skin-system-zen');

-- Terminal
INSERT INTO "Skin" ("id", "name", "description", "isSystem", "colorScheme", "tokens", "ownerId", "ownerTeamId", "isPublic", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'skin-system-terminal',
  $name$Terminal$name$,
  $desc$Zielony fosfor na czerni: krój maszynowy, zerowe zaokrąglenia, ledwie widoczna poświata.$desc$,
  true,
  'dark',
  $tokens${"--color-scheme":"dark","--bg-base":"#050705","--bg-surface":"#0a0f0a","--bg-elevated":"#101710","--bg-hover":"#172017","--border":"#20301f","--border-focus":"#3f6b3d","--text-primary":"#cdf3d8","--text-secondary":"#8fbf9c","--text-muted":"#79a884","--on-accent":"#050705","--accent-blue":"#5fd3c8","--accent-blue-dim":"#2b8a82","--accent-green":"#5ce67f","--accent-green-dim":"#2a9647","--accent-red":"#ff8a80","--accent-red-dim":"#c1483f","--accent-amber":"#e8d15a","--accent-amber-dim":"#9c8a25","--accent-purple":"#b39ae8","--accent-orange":"#f0a35c","--accent-orange-dim":"#b06a26","--font-family-base":"mono","--font-family-display":"mono","--font-family-mono":"mono","--font-size-base":"13px","--font-weight-heading":"700","--letter-spacing-base":"0.01em","--letter-spacing-heading":"0.12em","--text-transform-heading":"uppercase","--line-height-base":"1.55","--space-unit":"4px","--control-height":"32px","--view-padding":"14px","--radius":"0","--radius-lg":"0","--radius-pill":"0","--radius-control":"0","--border-width":"1px","--border-style":"solid","--focus-ring-width":"2px","--shadow-surface":"none","--shadow-elevated":"0 6px 22px rgba(0,0,0,0.7)","--shadow-glow":"0 0 10px color-mix(in srgb, #5ce67f 30%, transparent)","--bg-image-base":"linear-gradient(180deg, #070b07 0%, #050705 100%)","--bg-image-surface":"none","--motion-duration":"80ms","--motion-duration-slow":"180ms","--motion-easing":"linear","--sidebar-width":"220px","--chrome-bg":"#080d08","--chrome-border":"#20301f","--chrome-frame":"corners"}$tokens$,
  NULL, NULL, true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- Zen
INSERT INTO "Skin" ("id", "name", "description", "isSystem", "colorScheme", "tokens", "ownerId", "ownerTeamId", "isPublic", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'skin-system-zen',
  $name$Zen$name$,
  $desc$Jasna i oszczędna: dużo światła, jeden akcent, żadnych cieni ani ozdobników.$desc$,
  true,
  'light',
  $tokens${"--color-scheme":"light","--bg-base":"#f7f7f5","--bg-surface":"#ffffff","--bg-elevated":"#efefeb","--bg-hover":"#e5e5e0","--border":"#d2d2c8","--border-focus":"#9a9a90","--text-primary":"#1a1a19","--text-secondary":"#55554f","--text-muted":"#6d6d66","--on-accent":"#ffffff","--accent-blue":"#2f6f5e","--accent-blue-dim":"#1f4a3e","--accent-green":"#2f6f3e","--accent-green-dim":"#1f4a2a","--accent-red":"#9c3535","--accent-red-dim":"#6e2525","--accent-amber":"#8a6100","--accent-amber-dim":"#5e4200","--accent-purple":"#5a4a8a","--accent-orange":"#8f4a20","--accent-orange-dim":"#653417","--font-family-base":"system","--font-family-display":"system","--font-family-mono":"mono","--font-size-base":"15px","--font-weight-heading":"600","--letter-spacing-base":"0em","--letter-spacing-heading":"-0.02em","--text-transform-heading":"none","--line-height-base":"1.65","--space-unit":"4px","--control-height":"38px","--view-padding":"24px","--radius":"8px","--radius-lg":"14px","--radius-pill":"999px","--radius-control":"8px","--border-width":"1px","--border-style":"solid","--focus-ring-width":"2px","--shadow-surface":"none","--shadow-elevated":"0 2px 10px rgba(30,30,25,0.08)","--shadow-glow":"none","--bg-image-base":"none","--bg-image-surface":"none","--motion-duration":"90ms","--motion-duration-slow":"150ms","--motion-easing":"ease-out","--sidebar-width":"220px","--chrome-bg":"#f0f0ed","--chrome-border":"#d2d2c8","--chrome-frame":"none"}$tokens$,
  NULL, NULL, true, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
