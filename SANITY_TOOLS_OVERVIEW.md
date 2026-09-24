# Liiift Sanity Tools — Monorepo Overview

This is the `Liiift-Studio/liiift-sanity-tools` monorepo. Each subdirectory is an independent npm package with its own `package.json`. There is no shared root install — always `cd` into the specific package directory to run commands.

---

## Published Packages

These packages are on npm under `@overpunch/` and are actively consumed by foundry sites.

### `sanity-font-uploader/` → `@overpunch/sanity-font-manager`

The main font management suite for Sanity Studio. Consumed by Darden, TDF, and MCKL.

**Exports:** `BatchUploadFonts`, `SingleUploaderTool`, `GenerateCollectionsPairsComponent`, `PrimaryCollectionGeneratorTypeface`, `FontScriptUploaderComponent`, `UploadScriptsComponent`, `UpdateScriptsComponent`, `RegenerateSubfamiliesComponent`, `SetOTF`, `StyleCountInput`, `KeyValueInput`, `KeyValueReferenceInput`, `VariableInstanceReferencesInput`, `NestedObjectArraySelector`, `StatusDisplay`, `PriceInput`, `UploadButton` — plus hooks (`useSanityClient`, `useNestedObjects`), schema fields (`openTypeField`, `styleCountField`, `stylisticSetField`, `createStylesField`), and utilities (`generateFontData`, `generateCssFile`, `generateFontFile`, `generateSubset`, etc.).

Re-exports `SCRIPTS`, `SCRIPTS_OBJECT`, `HtmlDescription`, `DISCOUNT_REQUIREMENT_TYPES`, `DISCOUNT_REQUIREMENT_TYPES_OBJECT`, `KeyValueInput`, and `NestedObjectArraySelector` for backward compatibility — but these now live in their dedicated packages below.

**Build:** `npm run build` (runs vitest then tsup). **Publish:** `npm publish --access public`. **Local dev:** `npm run link:tdf` / `link:darden` / `link:mckl` / `link:all`.

---

### `sanity-foundry-constants/` → `@overpunch/sanity-foundry-constants`

Environment-driven constants shared across all foundry Sanity studios.

**Exports:** `SCRIPTS`, `SCRIPTS_OBJECT`, `HtmlDescription`, `DISCOUNT_REQUIREMENT_TYPES`, `DISCOUNT_REQUIREMENT_TYPES_OBJECT`

All values are read from environment variables at runtime (`SANITY_STUDIO_SCRIPTS`, `SANITY_STUDIO_DISCOUNT_REQ_TYPES`). Safe to use in any Sanity studio without side effects.

---

### `sanity-key-value-input/` → `@overpunch/sanity-key-value-input`

Standalone Sanity input component for ordered key→value string pair editing.

**Exports:** `KeyValueInput`

Use as `components: { input: KeyValueInput }` on any Sanity array field with items of type `{ _key, key, value }`.

---

### `sanity-nested-object-selector/` → `@overpunch/sanity-nested-object-selector`

Searchable checkbox selector for items fetched from nested arrays inside Sanity documents. Configured entirely via schema `options`.

**Exports:** `NestedObjectArraySelector`, `useNestedObjects`

Schema options: `sourceType`, `nestedField`, `titleField`, `valueField`, `filter`, `sortBy`, `emptyMessage`, `searchPlaceholder`.

---

### `sanity-advanced-reference-array/` → `sanity-advanced-reference-array`

Advanced reference array field with enhanced UI. A peer dependency of `@overpunch/sanity-font-manager`.

---

### `sanity-type-foundry-utilities/` → `@overpunch/sanity-type-foundry-utilities`

Admin tools bundled into a `UtilitiesDesk` for Sanity Studio. **Consumed by Positype and Sorkin — not by Darden, TDF, or MCKL.**

Bundles: ConvertIds, DeleteUnused, ExportData, SearchAndDelete, DuplicateAndRename, and more into a single desk tool entry. Install once and get the full admin suite.

---

### `sanity-sales-portal/` → `@overpunch/sales-portal`

Sales portal integration for Sanity Studio. Consumed by multiple foundry sites.

---

### `sanity-studio-version-badge/`

Studio version badge plugin — displays the current studio version in the navbar.

---

### `sanity-renewals-authorization/`

Subscription/renewal authorization logic for Sanity Studio.

---

## Standalone Tool Packages (Bundled into sanity-type-foundry-utilities)

These packages exist as standalone directories and can be used independently, but are typically consumed via `sanity-type-foundry-utilities` as a bundle:

| Directory | Purpose |
|---|---|
| `sanity-bulk-data-operations/` | Bulk create/update/delete on Sanity documents |
| `sanity-convert-ids-to-slugs/` | Migrate document IDs to slug-based IDs |
| `sanity-convert-references/` | Convert reference field types across documents |
| `sanity-delete-unused-assets/` | Clean up unreferenced Sanity assets |
| `sanity-duplicate-and-rename/` | Duplicate documents with rename |
| `sanity-enhanced-commerce/` | Enhanced e-commerce schema helpers |
| `sanity-export-data/` | Export Sanity data to various formats |
| `sanity-font-data-extractor/` | Extract font metadata from uploaded files |
| `sanity-search-and-delete/` | Search documents and bulk delete |

---

## Package Relationships

```
@overpunch/sanity-font-manager
  ├── peer: sanity-advanced-reference-array (optional)
  └── re-exports: sanity-foundry-constants, sanity-key-value-input, sanity-nested-object-selector
      (for backward compat — consumers should import from dedicated packages directly)

@overpunch/sanity-type-foundry-utilities
  └── bundles: bulk-data-operations, convert-ids-to-slugs, convert-references,
               delete-unused-assets, duplicate-and-rename, export-data,
               search-and-delete, font-data-extractor
```

---

## Consumer Map

| Package | Darden | TDF | MCKL | Positype | Sorkin |
|---|---|---|---|---|---|
| `@overpunch/sanity-font-manager` | ✅ | ✅ | ✅ | — | — |
| `@overpunch/sanity-foundry-constants` | ✅ | ✅ | ✅ | — | — |
| `@overpunch/sanity-key-value-input` | ✅ | ✅ | ✅ | — | — |
| `@overpunch/sanity-nested-object-selector` | — | ✅ | — | — | — |
| `sanity-advanced-reference-array` | ✅ | ✅ | ✅ | — | — |
| `@overpunch/sanity-type-foundry-utilities` | — | — | — | ✅ | ✅ |
| `@overpunch/sales-portal` | — | — | — | ✅ | ✅ |

---

## Dev Workflow

```bash
# Work on a specific package
cd sanity-font-uploader   # or any other package dir
npm install
npm run build

# Local link for live dev against a consumer site
cd sanity-font-uploader
npm run link:tdf          # or link:darden / link:mckl / link:all
npm run dev               # watch build

# Publish
npm publish --access public
```

---

## Test Studio

`/test-studio` — a Sanity Studio used to test plugins locally. Run `cd test-studio && npm run dev`.
