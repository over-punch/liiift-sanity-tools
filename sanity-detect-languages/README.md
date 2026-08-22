# @liiift-studio/sanity-detect-languages

[![npm version](https://img.shields.io/npm/v/@liiift-studio/sanity-detect-languages.svg)](https://www.npmjs.com/package/@liiift-studio/sanity-detect-languages)
[![Sanity Studio v3–v6](https://img.shields.io/badge/Sanity%20Studio-v3%20%C2%B7%20v4%20%C2%B7%20v5%20%C2%B7%20v6-f03e2f)](#studio-compatibility)
[![license](https://img.shields.io/npm/l/@liiift-studio/sanity-detect-languages.svg)](#attribution)

A Sanity Studio document action that fills a typeface's supported-languages list from the character
sets already stored on its fonts. Bundles the [Hyperglot](https://github.com/rosettatype/hyperglot)
orthography data, so every studio detects identically and reports the same version.

No font parsing: it reads `characterSet.chars` off each linked font document.

## Install

```bash
npm install @liiift-studio/sanity-detect-languages
```

Import specifier: `@liiift-studio/sanity-detect-languages` (dual ESM/CJS build).

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

> **On Studio v6, make sure your toasts have somewhere to land.** The skipped-styles report is
> delivered as a toast. `@sanity/ui` v4 (which Studio v6 ships) no longer exposes `useToast` from
> the package root, so the compat layer falls back to its own in-memory toast queue. That queue
> **only paints if something in the Studio mounts `<ToastViewport/>`** — otherwise the action still
> works and still writes the field, but the "3 styles skipped" warning is silently swallowed. If
> you are on v6 and never see a toast, mount a viewport rather than assuming nothing was skipped.

## Studio compatibility

| Peer | Range | Notes |
|---|---|---|
| `sanity` | `>=3 <7` | Studio v3, v4, v5 and v6 |
| `@sanity/ui` | `>=2 <5` | **Not a typo** — Studio v6 ships `@sanity/ui` **v4**, not v5 |
| `react` | `>=18` | |

<details>
<summary>How one build spans four Studio majors</summary>

`@sanity/ui` v4 moved `Tooltip`, `Menu`, `MenuButton`, `MenuItem`, `Code`, `Popover`,
`Autocomplete`, `Toast` and `useToast` out of the package root into subpath entries, and
`@sanity/icons` v5 removed every named `*Icon` export.

The trap: **both packages still *declare* the removed names in their `.d.ts`, typed `never`.** A
named import therefore type-checks, compiles green, and only then fails at runtime as an undefined
value — `tsc` cannot see the breakage, so a build passing is not evidence of anything.

This package therefore imports **no `@sanity/ui` or `@sanity/icons` symbol directly**. Its single
UI import (`useToast`) routes through
[`@liiift-studio/sanity-ui-compat`](https://www.npmjs.com/package/@liiift-studio/sanity-ui-compat),
which resolves whichever namespace is actually installed at runtime and degrades to a fallback when
a symbol is absent — the fallback described in the note above.

**Verification status.** v3–v6 support rests on the declared peer ranges, a green build, and the
`vitest` suite (`npm test`). Beyond three in-house Studios it has **not** been exercised in a
running Sanity 6 Studio — treat v6 as supported but lightly travelled, and please report anything
that looks wrong.
</details>

## Attribution

Orthography data derives from Hyperglot © Rosetta Type Foundry, Apache-2.0. See [`NOTICE`](./NOTICE).
