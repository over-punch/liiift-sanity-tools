# @liiift-studio/sanity-detect-languages

A Sanity Studio document action that fills a typeface's supported-languages list from the character
sets already stored on its fonts. Bundles the [Hyperglot](https://github.com/rosettatype/hyperglot)
orthography data, so every studio detects identically and reports the same version.

No font parsing: it reads `characterSet.chars` off each linked font document.

## Install

```bash
npm install @liiift-studio/sanity-detect-languages
```

## Use

```js
// sanity.config.js
import { createDetectLanguagesAction } from '@liiift-studio/sanity-detect-languages'

const DetectLanguages = createDetectLanguagesAction({
  write: { type: 'field', name: 'languages' },
})

export default defineConfig({
  document: {
    actions: (input, context) =>
      context.schemaType === 'typeface' ? [...input, DetectLanguages] : input,
  },
})
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `documentType` | `'typeface'` | Document type the action attaches to |
| `fontsPath` | `'styles.fonts'` | Dot path to the font reference array |
| `write` | `{ type: 'field', name: 'languages' }` | Where the result is stored |

### `write` shapes

- **`{ type: 'field', name }`** — an array of language names. Preferred: countable, filterable, diffable.
- **`{ type: 'string', name }`** — a comma-separated string, for studios still on a plain text field.
- **`{ type: 'metadataRow', key }`** — upserts a row in an existing `metadata` array, leaving every
  other row untouched. For studios that keep languages beside credits.

**Point `write` at the field your site renders.** Aiming it at a notes field will overwrite editorial
copy — a real incident this package exists to prevent: Darden's `additionalLanguages` holds
hand-written text like *"Additional language support available … upon request: Arabic, Cyrillic,
Georgian, Greek"*, and the previous site-local action wrote its detected list straight over it. Keep
the generated list and the hand-written note in separate fields.

## Behaviour

- **Intersection, not union.** A language is claimed only if *every* style covers it — the defensible
  claim for a family sold as a whole.
- **Drafts included.** Unpublished styles only exist as drafts, so both ids are looked up and
  draft/published pairs collapse to one (draft wins).
- **Missing character sets are reported, not ignored.** A style that was never processed would
  otherwise narrow the result invisibly; the toast names the skipped styles and the count used.

## Attribution

Orthography data derives from Hyperglot © Rosetta Type Foundry, Apache-2.0. See [`NOTICE`](./NOTICE).
