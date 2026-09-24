# Project Brief — Liiift Sanity Tools / sanity-font-manager

## Identity

Monorepo of Sanity Studio plugins published under `@liiift-studio`. The primary active package is `sanity-font-manager` (in the `sanity-font-uploader/` subdirectory — name is historical).

## Scope

Develop and maintain reusable Sanity Studio UI components for type foundry CMS workflows — font uploading, format conversion, metadata extraction, CSS generation, collection/pair generation, script variant management, and variable font tooling.

## Primary package

`@overpunch/sanity-font-manager` — consumed by Darden, TDF, and MCKL Sanity Studios.

## Constraints

- Sanity v3/v4/v5 compatible — no version-specific APIs
- Peer deps only: `sanity`, `@sanity/ui`, `@sanity/icons`, `react` — no MUI or other heavy UI libs
- fontWorker (TTF→WOFF2 conversion) stays server-side in each consumer site — not in this library
- No Next.js patterns — these are Sanity plugins only
- Publish to public npm under `@liiift-studio` org — OTP required

## Goals

- Single source of truth for all font management UI across all foundry Studios
- Migrate local Studio components from consumer repos into this library when sufficiently generic
- Maintain backwards compatibility across Sanity v3/v4/v5
