# Active Context — sanity-tools monorepo

Last updated: 2026-08-20

## New package: @liiift-studio/sanity-ui-compat 0.1.0 (2026-08-20)

Built to unblock taking the Studios to Sanity v6. **Not yet published, not yet adopted by any
plugin.** Lives at `sanity-ui-compat/` as a plain directory (like `sanity-detect-languages` and
`sanity-order-schema`), so it needs no new GitHub repo.

### Why it exists — the trap
`@sanity/ui` v4 and `@sanity/icons` v5 emptied their barrels, but **still declare the removed
names in their `.d.ts` typed `never`**. A named import therefore passes `tsc`, passes `tsup`,
and dies at runtime. The subpath form (`@sanity/ui/tooltip`) does not exist on v2/v3, so
neither import shape works across the range. Reading the installed namespace at runtime is the
only shape that links across v2 → v4 — it is not a stylistic choice.

**A green build proves nothing here.** Use `npm run probe` (see below).

### Origin
~80% is `deploy-vercel-from-sanity/src/compat/` copied verbatim (`resolve.ts`, `domFallback`/
`primitive`, `tooltip.tsx`, `code.tsx`, `toast.tsx`, `ActionMenu`). That plugin shipped the
pattern first in 1.2.0; this generalises it. It should adopt this package and delete its local
copy — that migration is also the cheapest validation, since it is a known-good consumer.

### What was added beyond the reference
- Composable `Menu`/`MenuButton`/`MenuItem` trio — 17 plugins write menus as nested JSX and
  cannot use the declarative `ActionMenu` without a rewrite. The fallback drives focus by
  querying live DOM for `[role="menuitem"]`, **deliberately not** by child registration:
  registration order is mount order, which diverges from visual order the moment a child is
  conditional or fragment-wrapped, and the symptom is arrow keys skipping a row.
- `Progress` — owned outright, see latent bugs below.
- Grid/Badge/Inline prop translation, `Checkbox`/`Radio`/`TextArea`/`Container`, `Autocomplete`.

### The rename is far wider than Stack
v4 carries **20** `space?: never` tombstones and ignores the old names at runtime rather than
warning. Measured call sites across this monorepo: `Stack space` **298**, `Grid columns` **48**,
`Badge mode` **12** (removed outright, not renamed), `Inline space` **5**. Guessing wrong
collapses layout silently. Pass the OLD names to this package; it translates per major.

### Two pre-existing bugs found while verifying
- **`Progress` has never existed in `@sanity/ui`** — absent from 2.8.9, 3.1.14 and 4.0.5.
  `sanity-delete-unused-assets` and `sanity-export-data` both import and render it
  conditionally, so it only crashes once a scan actually runs. Compat now ships a real one.
- **`DuplicateIcon` has never existed in `@sanity/icons`** — absent from v3.8.0's named exports
  and v5.2.1's 236-key symbol map. `sanity-duplicate-and-rename` has been rendering a blank.
  Mapped to `copy` (chosen over `documents`/`stack`, which read as "several documents").

### Verified — and the limit of that
`npm run probe` resolves every export against the INSTALLED majors. Against ui 4.0.5 +
icons 5.2.1: `STACK_USES_GAP = true`, zero primitives fell back to DOM, 14/14 wrappers present,
zero icons hit `MissingIcon`, all 43 symbols present in the map. Re-run on every new major.

**Resolution is not rendering.** The probe proves names bind; it does not prove a tooltip
positions or the fallback menu traps focus. That needs `test-studio` on v6.

### Packaging gotchas hit
- `"type": "module"` flips tsup's output naming (`index.js` becomes ESM, CJS becomes
  `index.cjs`), silently breaking an `exports` map written for the `.js`/`.mjs` layout. Removed
  it to match the rest of the suite. The build succeeded while shipping a broken package.
- Exact-string externals are fine *here* because this package never imports a subpath. **Any
  plugin that does import a subpath must extend its own tsup externals** — esbuild matches
  externals exactly, so `@sanity/ui/tooltip` would be bundled, duplicating the ui runtime and
  breaking theme/portal context.

### Adoption plan (none of it done yet)
Take it as a plain **`dependency`, not a peer** — it never bundles `@sanity/ui`, so duplicates
are benign, and per-plugin pinning makes the version-bump storm lazy instead of mandatory.
Order: `deploy-vercel-from-sanity` (delete its local copy, validates the package) →
`sanity-font-uploader` (94 JS files, zero TS, largest surface, proves `.d.ts`-only ergonomics)
→ the rest. Stay on 0.x until the trio and `Progress` have run in a real Studio.

Full per-plugin audit with file:line risk notes lives in the workflow output referenced from
the session; the two heaviest surfaces are `sanity-font-uploader` (27 ui / 14 icons files) and
`sanity-type-foundry-utilities` (12 / 11). Both store icons as **values** (`icon: TrashIcon`,
a `UTILITIES_MENU` registry typed `React.ComponentType`) — that needs wrapper components, not
an import swap, and is the reason this is not a mechanical sweep.

## sanity-font-manager 2.11.8 — Detect OTF fix (2026-07-29)

## sanity-font-manager 2.11.8 — Detect OTF fix (2026-07-29)

"Detect OTF" on a typeface document had **never** worked in the Darden dataset — every typeface
reported zero features. Root cause in `src/components/SetOTF.jsx`: it derived the list of feature
keys to test from `Object.keys(value)`, the openType field's own value — so it could only ever test
feature keys the document already carried. On Darden no typeface carries any (see the corrected
mechanism note in the 2.11.9 section below), so the key list was always empty and detection returned
zero every time. Chicken-and-egg: it needed the answer to find the answer.

Shipped in 2.11.8 (published, commit `61f9425`):

- `src/schema/openTypeFeatureTags.js` — `OPENTYPE_FEATURE_TAGS`, all 66 feature keys mapped to
  `{title, feature}`. Deliberately dependency-free: `openTypeField.js` imports `SetOTF`, so having
  `SetOTF` import `openTypeField` would create a bundle cycle (same failure class as the `lib-font`
  import-order bug fixed in 2.11.2).
- `src/utils/detectOpenTypeFeatures.js` — pure `collectSupportedTags` / `detectOpenTypeFeatures`.
  Unions tags across **every** linked style, not just `styles.fonts[0]`: a family's italics
  routinely drop stylistic sets its romans carry, and the field describes the family.
- `SetOTF` now writes the `features` array **and** the per-feature sub-objects (preserving existing
  `title`/`customText` edits, always resetting `feature` to canonical), includes drafts in the
  lookup, and shows a "Detecting…" state.
- 16 new tests (300 total), including a drift guard asserting the map matches both the schema's
  feature objects and the `features` checkbox options.

Verified against live Darden data: Daith's 80 styles union to 31 tags → 30 features detected.

## sanity-font-manager 2.11.9 — title reconciliation + latent shape fix (2026-07-29)

Follow-up to 2.11.8, from an audit of the typeface document (commit `128b299`, published).

- **openType titles reconciled.** Five features had labels disagreeing between the field `title`, the
  `features` checkbox option title, and the `title` initialValue — so the same feature could be
  labelled two ways depending on whether it was detected or ticked by hand: `allCaps`,
  `standardLigatures`, `stylisticSet10`, `capitalsToSmallCaps` (now lowercase "to", matching its
  `capitalsToPetiteCaps` sibling) and `justifiedAlternates` (now the registered OpenType name
  "Justification Alternates", which the initialValue already used). The drift guard now asserts
  titles across all four places — it is what caught the last two, which I had missed by eye.
- **Latent `opentypeFeatures` shape bug fixed.** `buildUploadPlan.js` wrote the field as a bare
  array (`getAllFeatureTags(font)`, and `[]` on the error path) while the schema field and every
  reader expect `{chars: [...]}`. `executeUploadPlan` only corrects it via `generateFontData` when
  `fileInput.ttf || fileInput.otf` — so a **WOFF2-only upload would have written an unreadable
  shape**, reproducing the exact symptom 2.11.8 just fixed. `[]` is truthy, so the error path wrote
  one too. Never triggered: all 457 live Darden font docs are correctly shaped, because every real
  upload has carried a TTF or OTF. Guarded by `src/tests/opentypeFeaturesShape.test.js`.
- **`dedupeFontDocs`** added and applied in `collectSupportedTags`: draft/published pairs reduce to
  one entry per font (draft wins), so the "across N of M styles" message can't exceed the real count.

Suite: 308 passing. Audit found no other component using the `Object.keys(value)` antipattern —
`SetOTF` was the only one.

**Mechanism (corrected 2026-07-29 — an earlier note in this file blamed `hidden`; that was wrong).**
Sanity applies initialValues **only at document creation**. `hidden` does not suppress them. Evidence
from all three studios:

| Studio | `openType` sub-objects present | Why | Old Detect OTF |
|---|---|---|---|
| MCKL | all 66 on every typeface | docs created when their local `openType` field already existed | worked — all 66 keys were there to test |
| TDF | only for ticked features | ticking a checkbox materialises that sub-object with its initialValues | could only narrow an already-ticked set, never discover |
| Darden | none, on all 17 | field wired in 2026-07; newest typeface doc is Daith, 2025-02-14 | always returned zero |

So the only studio where Detect OTF worked (MCKL) is also the only one whose site renders the field —
which is why this went unnoticed. 2.11.9 makes detection independent of document vintage everywhere.

## sanity-font-manager (v2.3.2, branch: feature/studio-version-badge)

All three consumer sites (Darden, TDF, MCKL) are on `^2.3.2` on their `feature/font-uploader-v2` branches. No pending tasks.

## sanity-typeface-fields (v1.1.1, published)

Standalone Sanity field definitions for typeface documents. Exports 11 fields:
- `freeFontField`, `includesSerifField`, `sortHeaviestFirstField`, `buySectionColumnsField`, `fontSizeMultiplierField`
- `createStateField` (factory — MCKL passes `{ publishedValue: 'active' }`)
- `classificationField`, `releaseDateField`, `detailsField`, `specimenField`, `metadataField`

Unit tests added with Vitest (`src/fields/stateField.test.ts`) — 8 tests covering the factory's defaults, MCKL variant, and structure. Run with `npm test`.

## sanity-typeface-seo (v1.2.1, published)

Sanity SEO field definitions + `SeoEvaluatorInput` React component for all foundries.

### Exports
- `seoField` — base SEO object (title, keywords, cloudinary image, description)
- `seoFieldWithLinks` — extends seoField with adobeLink + fontStandLink (Darden only)
- `SeoEvaluatorInput` — default evaluator component (no live scan)
- `createSeoEvaluatorInput(options)` — factory for per-foundry config (siteUrl, urlFromSlug, slugPath)
- `parseSeoFromHtml(html)` — pure utility for API route handlers
- Types: `SeoValue`, `SeoScanResult`, `SeoEvaluatorOptions`

### SeoEvaluatorInput panels
1. **SEO Checklist** — live quality indicators (title 50-60 chars, description 150-160, keywords, image)
2. **Published vs Draft** — always on; fetches published Sanity doc and diffs SEO fields
3. **Live site scan** — opt-in via `siteUrl`; "Scan now" button fetches rendered HTML, compares meta tags to draft

### Consumer wiring
All three foundries use `createSeoEvaluatorInput({ siteUrl: process.env.SANITY_STUDIO_SITE_URL, urlFromSlug })` in their typeface schema. URL patterns:
- Darden: `/typefaces/${slug}`
- TDF: `/typeface/${slug}` (singular)
- MCKL: `/typefaces/${slug}`

`SANITY_STUDIO_SITE_URL` set in all studio env files (dev + production). Each foundry's Next.js site has `/api/seo-scan` route that self-fetches and uses `parseSeoFromHtml`.

Vitest tests: 12 tests in `src/seoField.test.ts`. Run with `npm test`.
