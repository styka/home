# specs/ — artefakty spec-driven pipeline'u

Ten katalog trzyma **specyfikacje, plany i raporty** kolejnych zmian w Omnii, wytwarzane przez
pipeline `/specify → /plan → /tasks → /implement → /verify → /review`.

## Konwencja
Każdy feature dostaje własny katalog:

```
specs/
└── NNN-slug/
    ├── spec.md      # CO i DLACZEGO (kryteria akceptacji)
    ├── plan.md      # JAK (architektura, migracja, pliki)
    ├── tasks.md     # lista zadań T-1, T-2, … (żywy stan)
    ├── verify.md    # raport weryfikacji
    └── review.md    # raport recenzji + werdykt
```

- `NNN` — kolejny wolny numer, zero-padded (`001`, `002`, …).
- `slug` — krótki kebab-case (ASCII, bez znaków diakrytycznych).
- Szablony: `.claude/spec-pipeline/templates/`. Reguły: `.claude/spec-pipeline/constitution.md`.
- Pełny przewodnik: `.claude/spec-pipeline/README.md` (oraz w aplikacji: `/admin/spec-pipeline`).

Artefakty **zostają w repo** — to historia decyzji: dlaczego dana zmiana wygląda jak wygląda.
