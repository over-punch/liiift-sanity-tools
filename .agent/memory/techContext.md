# Tech Context — sanity-font-manager

## Package

- **Published name:** `@overpunch/sanity-font-manager`
- **Directory:** `sanity-font-uploader/` (historical name)
- **Version:** 2.3.2
- **Package manager:** npm
- **Node target:** 16+

## Build

- **Bundler:** tsup v8 — outputs both CJS (`dist/index.js`) and ESM (`dist/index.mjs`)
- **Tests:** vitest v4 — 6 test files, 111 tests
- **Language:** JavaScript (JSX) — no TypeScript

## Runtime dependencies

| Package | Purpose |
|---|---|
| `fontkit` | Parse font files for metadata, metrics, glyph count, variable axes/instances |
| `nanoid` | Generate unique `_key` values for Sanity array items |
| `slugify` | Generate collection/pair slugs |
| `base-64` | Base64 encode/decode |
| `buffer` | Browser-compatible Buffer polyfill |

## Peer dependencies

`sanity >=3`, `@sanity/ui >=3`, `@sanity/icons >=3`, `react >=18`

## Environment variables (used in consumer Studio)

| Variable | Purpose |
|---|---|
| `SANITY_STUDIO_SITE_URL` | Base URL for fontWorker API calls |
| `SANITY_STUDIO_PROJECT_ID` | Sanity CDN URL construction |
| `SANITY_STUDIO_DATASET` | Sanity CDN URL construction |
| `SANITY_STUDIO_DEFAULT_COLLECTION_PRICE` | Default price for collection generators |
| `SANITY_STUDIO_DEFAULT_PAIR_PRICE` | Default price for pair generator |
| `SANITY_STUDIO_SCRIPTS` | Comma-separated script variant names |

## Build commands

```bash
npm run build          # vitest + tsup
npm run test           # vitest only
npm run dev            # tsup --watch
npm publish --access public   # triggers prepublishOnly (build)
```
