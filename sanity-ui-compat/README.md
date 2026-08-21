# @liiift-studio/sanity-ui-compat

Version-agnostic access to `@sanity/ui` and `@sanity/icons` across Sanity Studio v3–v6.

## The problem this solves

`@sanity/ui` v4 and `@sanity/icons` v5 emptied their barrels. Nine exports moved to
subpath entry points (`@sanity/ui/tooltip`, `@sanity/ui/menu`, …) and every named
`*Icon` export was replaced by `<Icon symbol="…">`.

The trap is that **both packages still declare the removed names in their `.d.ts`,
typed `never`**. So this:

```ts
import { Tooltip } from '@sanity/ui'
```

type-checks, builds, passes `tsc --noEmit`, passes `tsup` — and then the Studio
fails at runtime. Meanwhile the subpath form (`@sanity/ui/tooltip`) does not exist
on v2 or v3, so neither import shape works across the range we support.

This package reads the installed namespace at **runtime** and resolves each export
against whatever is actually there, falling back where it must. That is not a
stylistic choice; it is the only shape that links across v2 → v4.

## Usage

```ts
import { Stack, Card, Tooltip, MenuButton, useToast } from '@liiift-studio/sanity-ui-compat'
import { TrashIcon, UploadIcon } from '@liiift-studio/sanity-ui-compat/icons'
```

Take it as a plain **`dependency`**, not a `peerDependency`. It never bundles
`@sanity/ui` — it reads the host's — so duplicate copies in a tree are benign, and
pinning per plugin means you republish a plugin when you're editing it rather than
because a sibling moved.

## Silent renames it absorbs

v4 renamed or removed 20 props and **ignores the old names at runtime** rather than
warning. Wrong guess = collapsed layout, no error. Call sites measured across
`tools/sanity-tools` when this was written:

| Old | New on v4 | Sites |
|---|---|---|
| `Stack space` | `gap` | 298 |
| `Grid columns` | `gridTemplateColumns` | 48 |
| `Badge mode` | *removed entirely* | 12 |
| `Inline space` | `gap` | 5 |

Pass the **old** names to this package's `Stack`, `Grid`, `Inline` and `Badge`; it
translates per installed major.

## Two upstream bugs it papers over — deliberately

Both predate v6 and were found while verifying this package.

- **`Progress` has never existed in `@sanity/ui`** — not in v2.8.9, v3.1.14 or
  v4.0.5. `sanity-delete-unused-assets` and `sanity-export-data` both import it and
  render it conditionally, so it only crashes once a scan is running. This package
  ships a real one.
- **`DuplicateIcon` has never existed in `@sanity/icons`** — absent from v3.8.0's
  named exports and from v5.2.1's 236-key symbol map. Mapped to `copy` here.

## Known limitation: `Autocomplete` on v4

On v2/v3 you get Studio's real combobox. On v4 you get a `TextInput` + native
`<datalist>` — `renderOption` and `filterOption` are ignored. A correct ARIA 1.2
combobox is a large piece of work and a half-correct one is worse than an honest
plain input. Check whether your plugin actually needs combobox behaviour before
shipping it on a v4 Studio.

## Verifying

```bash
npm run verify      # typecheck + build + probe + smoke
```

Or individually:

| script | what it proves |
|---|---|
| `typecheck` | types line up. Necessary, **not** sufficient — see the trap above |
| `probe` | every export *binds* to something real against the installed majors |
| `smoke` | the fallbacks actually **render**, and translated props reach the DOM |

`smoke` is the one that catches real regressions. Both defects found by the first
adoption pass — a narrowed `Tooltip` silently dropping `content`/`placement`, and
`Grid` missing `gap` — were invisible to `tsc` **and** to `probe`, and both are now
covered. It also caught that real `@sanity/ui` components throw outright without a
`ThemeProvider`, which is why the harness supplies one.

Last run, against `@sanity/ui` 4.0.5 + `@sanity/icons` 5.2.1 (the hard case):

```
STACK_USES_GAP = true          primitives falling back to DOM: none
wrapper exports present: 14/14 icons resolving to MissingIcon: none
symbol table rows: 43          symbols absent from v5 map: none
20/20 render checks passed
```

**Still not proven.** These render through `react-dom/server` in Node, not in a
Studio. Server rendering cannot exercise hover, keyboard focus, portalling or
layer stacking — so the fallback `Tooltip`'s placement, the fallback menu's roving
focus and Escape handling, and whether either sits *above* a Studio dialog remain
unverified. Those need `test-studio` on Sanity 6.

## Status

`0.x` until the composable `Menu`/`MenuButton`/`MenuItem` trio and `Progress` have
run in a real Studio. The trio's fallback drives focus by querying the live DOM for
`[role="menuitem"]` rather than by child registration, so conditional or fragment-
wrapped children cannot desynchronise arrow-key order — that is the part most
deserving of test coverage.
