# Liiift Sanity Tools

**A suite of independently-published plugins, inputs, and utilities for Sanity Studio** — built from real production type-foundry studios and shared as open-source packages on npm under the [`@liiift-studio`](https://www.npmjs.com/org/liiift-studio) scope.

Each tool lives in its own subdirectory with its own `package.json`, README, and release cadence. This repository is the **front door**: it advertises the whole family, links to every package, and hosts the shared [`test-studio`](#shared-dev-workflow) used to develop and verify them together.

> **Looking for one plugin?** Jump to the [overview table](#choose-your-path--the-tool-suite) and follow the link to that package's own README.

---

## Ecosystem at a glance

Every package is a standalone plugin or component that mounts into a Sanity Studio. Most target Sanity v3, and several also support v4 / v5 — each package declares its own `sanity` peer range, so confirm per package. They group into four families — data operations, studio inputs & UI, the type-foundry domain, and commerce & ops — and all share the local `test-studio` harness for development.

<p align="center">
  <img src="https://raw.githubusercontent.com/Liiift-Studio/liiift-sanity-tools/main/assets/ecosystem.svg?v=1" alt="Diagram: Sanity Studio at the centre with four groups of Liiift Sanity Tools plugins — Data operations, Studio inputs & UI, Type-foundry domain, and Commerce & ops — plus the shared test-studio dev harness that mounts every plugin." width="900">
</p>

---

## Choose your path — the tool suite

Most `@liiift-studio/*` packages below are **published on npm** (the table notes the exceptions). Each package declares its own `sanity` peer-dependency range and version — check the package's `package.json` or npm for the authoritative numbers.

### Data operations

| Package | What it does |
|---|---|
| [`@liiift-studio/sanity-bulk-data-operations`](./sanity-bulk-data-operations) | Search, add, and modify data across any document types with safety features |
| [`@liiift-studio/sanity-export-data`](./sanity-export-data) | Export any document types to CSV or JSON, with optional reference population |
| [`@liiift-studio/sanity-search-and-delete`](./sanity-search-and-delete) | Bulk content management — search and delete with danger-mode safety |
| [`@liiift-studio/sanity-delete-unused-assets`](./sanity-delete-unused-assets) | Remove unused assets, analyze storage, and detect duplicates |
| [`@liiift-studio/sanity-convert-references`](./sanity-convert-references) | Convert strong to weak references and scan for broken references |
| [`@liiift-studio/sanity-convert-ids-to-slugs`](./sanity-convert-ids-to-slugs) | Convert document IDs to slug-based IDs with automatic reference updating |
| [`@liiift-studio/sanity-duplicate-and-rename`](./sanity-duplicate-and-rename) | Duplicate and move fields across documents with bulk processing |

### Studio inputs & UI

| Package | What it does |
|---|---|
| [`@liiift-studio/sanity-advanced-reference-array`](./sanity-advanced-reference-array) | Reference array component with search, sort, and bulk operations |
| [`@liiift-studio/sanity-key-value-input`](./sanity-key-value-input) | Input component for ordered key-value string-pair editing |
| [`@liiift-studio/sanity-nested-object-selector`](./sanity-nested-object-selector) | Searchable checkbox selector for nested objects within documents |
| [`@liiift-studio/sanity-studio-version-badge`](./sanity-studio-version-badge) | Shows installed `@liiift-studio` package versions in a badge on the structure root |

### Type-foundry domain

| Package | What it does |
|---|---|
| [`@liiift-studio/sanity-font-manager`](./sanity-font-uploader) | Full font management suite — batch upload, format conversion, metadata extraction, CSS generation, collection/pair generation, script variants. *(Published from the `sanity-font-uploader` directory.)* |
| [`@liiift-studio/sanity-font-data-extractor`](./sanity-font-data-extractor) | Inspect OpenType metadata and variable-font axes; compare fonts side by side |
| [`@liiift-studio/sanity-type-foundry-utilities`](./sanity-type-foundry-utilities) | Utilities desk, Fingerprint Reader for font forensics, and font metadata tools |
| [`@liiift-studio/sanity-typeface-fields`](./sanity-typeface-fields) | Standalone field definitions for typeface documents |
| [`@liiift-studio/sanity-typeface-seo`](./sanity-typeface-seo) | Standalone SEO/social field definitions for typeface documents |
| [`@liiift-studio/sanity-foundry-constants`](./sanity-foundry-constants) | Shared environment-driven constants for foundry studios |

### Commerce & ops

| Package | What it does | Status |
|---|---|---|
| [`@liiift-studio/deploy-vercel-from-sanity`](./deploy-vercel-from-sanity) | Trigger and monitor Vercel deployments with status, history, and build logs | Published on npm |
| [`sanity-sales-portal`](./sanity-sales-portal) | Sales dashboard and analytics plugin | In-repo, not yet on npm |
| [`sanity-renewals-authorization`](./sanity-renewals-authorization) | Renewal order management for subscription-based businesses | In-repo, not yet on npm |
| [`@liiift-studio/sanity-order-schema`](./sanity-order-schema) | Shared order schema for Liiift foundry studios | Private — internal use only |

> **Notes on names & status.** The font manager directory is `sanity-font-uploader` but publishes as `@liiift-studio/sanity-font-manager`. `sanity-sales-portal` and `sanity-renewals-authorization` live in this repo and run in the test-studio, but are not yet published to npm — install them from source for now. `sanity-order-schema` is marked `private` and is intended for internal foundry use only.

---

## Installation

Install only the package you need — each is independent:

```bash
# Examples — pick the ones you want
npm install @liiift-studio/sanity-advanced-reference-array
npm install @liiift-studio/sanity-font-manager
npm install @liiift-studio/sanity-bulk-data-operations
npm install @liiift-studio/deploy-vercel-from-sanity
```

Then follow that package's own README for wiring. A few quickstarts:

### Advanced reference array (input component)

```typescript
import { AdvancedRefArray } from '@liiift-studio/sanity-advanced-reference-array';

export default {
	name: 'myDocument',
	type: 'document',
	fields: [
		{
			name: 'relatedItems',
			type: 'array',
			of: [{ type: 'reference', to: [{ type: 'product' }] }],
			components: {
				input: AdvancedRefArray,
			},
		},
	],
};
```

### Deploy from Sanity (Studio plugin)

```typescript
import { defineConfig } from 'sanity';
import { vercelDeploy } from '@liiift-studio/deploy-vercel-from-sanity';

export default defineConfig({
	// ...
	plugins: [
		vercelDeploy(),
		// ... other plugins
	],
});
```

> Exact import specifiers and options live in each package's README — always check there, since APIs differ per tool.

---

## Shared dev workflow

[`test-studio/`](./test-studio) is a real Sanity Studio that imports the plugins **directly from their source directories** (not from npm), so you can develop a plugin and see it live without publishing. It mirrors the foundry-platform studio pattern (Structure + Utilities + font tools).

```bash
# Run the shared test studio
cd test-studio
npm install
npm run dev          # sanity dev
```

To work on a single plugin:

```bash
cd sanity-<plugin-name>
npm install
npm run build        # if the package has a build step
```

Because each tool is its own package, **there is no root-level install** — always `cd` into the specific tool directory (or `test-studio`) before running `npm`. Changes to shared packages affect every consuming studio (mckl/cms, tdf, positype, sorkin, and others), so verify in `test-studio` before publishing.

> Most packages in this repo are git **submodules** with their own repositories and release pipelines. After cloning, run `git submodule update --init --recursive` to populate them.

---

## Development standards

- **TypeScript-first** with complete type definitions
- **React functional components** with modern hooks
- **Sanity UI** components for visual consistency with the Studio
- **Comprehensive error handling** with user feedback
- Test plugin changes in `test-studio` before committing

## Contributing

Contributions are welcome. Because each tool is its own package (most are separate **submodule** repositories), the workflow has one important wrinkle: code changes land in the submodule's own repo first, then this front-door repo's pointer is updated.

**Local setup:**

```bash
# Clone with all submodules populated
git clone --recurse-submodules https://github.com/Liiift-Studio/liiift-sanity-tools.git
cd liiift-sanity-tools

# Or, if already cloned without submodules:
git submodule update --init --recursive

# Run the shared studio to develop against live plugin source
cd test-studio && npm install && npm run dev
```

**To contribute a change:**

1. **Pick a tool** from the [overview table](#choose-your-path--the-tool-suite).
2. **Work inside that tool's directory** (`cd sanity-<tool>`), `npm install`, and develop against `test-studio` (`npm run dev`).
3. **Open a pull request against that tool's own repository** — most tools are submodules with their own repo, so the PR goes there, not to this front-door repo. After it merges, the submodule pointer here is bumped to pick it up.
4. **Share feedback** from your production usage — these tools grow from real-world needs.

> **Installing the unpublished packages from source.** `sanity-sales-portal` and `sanity-renewals-authorization` are not on npm yet. Import them directly from their source directories (as `test-studio` does), or reference them via a local/file path until they are published.

## Compatibility

- **Sanity Studio:** all packages support v3; several also support v4 / v5. Support is **per package** — check each package's `sanity` `peerDependency` for the exact range (for example, `sanity-bulk-data-operations` declares `^3 || ^4 || ^5`, while `sanity-sales-portal` currently targets `^3` only).
- **Runtime:** Node.js / modern browsers, per Sanity Studio's own requirements

## Links & resources

- **This repository:** [Liiift-Studio/liiift-sanity-tools](https://github.com/Liiift-Studio/liiift-sanity-tools)
- **npm org:** [`@liiift-studio`](https://www.npmjs.com/org/liiift-studio)
- **Organization:** [Liiift Studio](https://github.com/Liiift-Studio)
- **Sanity.io:** [Official website](https://www.sanity.io/) · [Community Slack](https://slack.sanity.io/)

## License

Released under the MIT License — free to use in personal and commercial projects. Individual packages may carry their own license file; check each package.

## Acknowledgments

This suite grew out of months of development and real-world usage across multiple production Sanity studios:

- **Darden Studio** — typography and font-management workflows that inspired the font tools
- **The Designer's Foundry** — UX patterns that shaped the interface design
- **Real production needs** — every tool solves an actual problem faced in live Sanity projects
- **The Sanity community** — inspiration and feedback that drives continuous improvement

---

**Made with care for the Sanity community by [Liiift Studio](https://liiift.studio).**
