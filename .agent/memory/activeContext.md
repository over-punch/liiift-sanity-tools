# Active Context — sanity-tools monorepo

Last updated: 2026-07-29

## sanity-font-manager 2.11.8 — Detect OTF fix (2026-07-29)

"Detect OTF" on a typeface document had **never** worked in the Darden dataset — every typeface
reported zero features. Root cause in `src/components/SetOTF.jsx`: it derived the list of feature
keys to test from `Object.keys(value)`, the openType field's own value. The per-feature sub-objects
are `hidden` until their key is checked in `features`, so Sanity never materialises them and their
`feature` initialValues (`aalt`, `smcp`, `ss01`, …) never reach the document. Empty key list →
zero detections, always. Chicken-and-egg: it needed the answer to find the answer.

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

Known nit, not fixed (display-only, deliberately left alone): three `title` initialValues in
`openTypeField.js` are sloppy — `allCaps` → `'allCaps'`, `standardLigatures` →
`'StandardLigatures'`, `stylisticSet10` → `'Stylistic Set10'`. The new map uses the clean field
titles instead, so a detected sub-object gets `'All Caps'` where a manually-checked one would get
`'allCaps'`. Worth reconciling in the schema at some point.

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
