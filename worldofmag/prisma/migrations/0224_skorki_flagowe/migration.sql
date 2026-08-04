-- 045: skórki flagowe „Mostek" i „Papier" (rozdz. 10 architektury docelowej).
--
-- Źródłem prawdy dla tokenów jest `src/lib/skins/flagship.ts` — ten plik jest jego
-- odbiciem w SQL-u, bo prod odpala wyłącznie `prisma migrate deploy` i nie wykona kodu TS.
--
-- ON CONFLICT DO NOTHING, a NIE DO UPDATE: właściciel mógł skórkę systemową zmodyfikować
-- w /admin/skins, a migracja nie ma prawa cofać jego zmian. Poprawki tokenów w kolejnych
-- przebiegach idą osobną, świadomą migracją.
--
-- Wycofanie: DELETE FROM "Skin" WHERE "id" IN ('skin-system-mostek','skin-system-papier');
-- Bezpieczne, bo UserSkinPref."skinId" jest nullowalny i ma ON DELETE SET NULL w praktyce
-- obsłużone przez deleteSkin(); przy ręcznym DELETE wyczyść też preferencje.

-- Mostek
INSERT INTO "Skin" ("id", "name", "description", "isSystem", "colorScheme", "tokens", "ownerId", "ownerTeamId", "isPublic", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'skin-system-mostek',
  $name$Mostek$name$,
  $desc$Ciemna konsola sci-fi: zwężone wersaliki, pigułkowe krawędzie, poświata zamiast cienia.$desc$,
  true,
  'dark',
  $tokens${"--color-scheme":"dark","--bg-base":"#07090f","--bg-surface":"#0e131d","--bg-elevated":"#161d2b","--bg-hover":"#1f2837","--border":"#2b364b","--border-focus":"#5b6f96","--text-primary":"#e8eef7","--text-secondary":"#a4b3cc","--text-muted":"#8494ae","--on-accent":"#07090f","--accent-blue":"#5fb0ff","--accent-blue-dim":"#2a6fb8","--accent-green":"#4fd18b","--accent-green-dim":"#1f8a56","--accent-red":"#ff7b7b","--accent-red-dim":"#c04141","--accent-amber":"#ffa63d","--accent-amber-dim":"#c07216","--accent-purple":"#c08cf0","--accent-orange":"#ff8f4d","--accent-orange-dim":"#c25c1f","--font-family-base":"system","--font-family-display":"condensed","--font-family-mono":"mono","--font-size-base":"14px","--font-weight-heading":"700","--letter-spacing-base":"0em","--letter-spacing-heading":"0.09em","--text-transform-heading":"uppercase","--line-height-base":"1.5","--space-unit":"4px","--control-height":"34px","--view-padding":"16px","--radius":"2px","--radius-lg":"4px","--radius-pill":"999px","--radius-control":"999px","--border-width":"1px","--border-style":"solid","--focus-ring-width":"2px","--shadow-surface":"none","--shadow-elevated":"0 8px 28px rgba(0,0,0,0.55)","--shadow-glow":"0 0 14px color-mix(in srgb, #ffa63d 45%, transparent)","--bg-image-base":"radial-gradient(circle at 15% 0%, #121a2b 0%, #07090f 55%)","--bg-image-surface":"linear-gradient(180deg, #111726 0%, #0e131d 100%)","--motion-duration":"120ms","--motion-duration-slow":"260ms","--motion-easing":"cubic-bezier(0.2, 0, 0, 1)","--sidebar-width":"220px","--chrome-bg":"#0b1017","--chrome-border":"#2b364b","--chrome-frame":"corners"}$tokens$,
  NULL, NULL, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- Papier
INSERT INTO "Skin" ("id", "name", "description", "isSystem", "colorScheme", "tokens", "ownerId", "ownerTeamId", "isPublic", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'skin-system-papier',
  $name$Papier$name$,
  $desc$Jasna i typograficzna: szeryfowe nagłówki, ciepła biel, miękki cień zamiast ramek.$desc$,
  true,
  'light',
  $tokens${"--color-scheme":"light","--bg-base":"#faf7f1","--bg-surface":"#fffdf9","--bg-elevated":"#f4efe5","--bg-hover":"#ebe4d6","--border":"#ddd4c3","--border-focus":"#a89778","--text-primary":"#1e1b16","--text-secondary":"#544e45","--text-muted":"#6b6459","--on-accent":"#ffffff","--accent-blue":"#1a5aa8","--accent-blue-dim":"#123f76","--accent-green":"#1d6b3d","--accent-green-dim":"#134a2a","--accent-red":"#a52a2a","--accent-red-dim":"#761d1d","--accent-amber":"#8a5600","--accent-amber-dim":"#5f3b00","--accent-purple":"#653a9c","--accent-orange":"#9a4a12","--accent-orange-dim":"#6d340c","--font-family-base":"system","--font-family-display":"serif","--font-family-mono":"mono","--font-size-base":"15px","--font-weight-heading":"700","--letter-spacing-base":"0em","--letter-spacing-heading":"-0.01em","--text-transform-heading":"none","--line-height-base":"1.6","--space-unit":"4px","--control-height":"36px","--view-padding":"20px","--radius":"3px","--radius-lg":"5px","--radius-pill":"999px","--radius-control":"3px","--border-width":"1px","--border-style":"solid","--focus-ring-width":"2px","--shadow-surface":"0 1px 2px rgba(60,50,35,0.06)","--shadow-elevated":"0 6px 20px rgba(60,50,35,0.13)","--shadow-glow":"none","--bg-image-base":"linear-gradient(180deg, #fbf9f4 0%, #f7f3ea 100%)","--bg-image-surface":"none","--motion-duration":"110ms","--motion-duration-slow":"240ms","--motion-easing":"ease-out","--sidebar-width":"220px","--chrome-bg":"#f4efe5","--chrome-border":"#ddd4c3","--chrome-frame":"none"}$tokens$,
  NULL, NULL, true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
