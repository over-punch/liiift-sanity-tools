# @liiift-studio/sanity-backup-monitor

Studio panel showing whether your scheduled dataset backups are actually running,
with a button to run one on demand.

## Why

A backup's failure mode is silence. TDF's backup workflow existed, appeared in the
Actions tab, and had not succeeded in three months — nobody noticed, because nothing
surfaced the gap anywhere people look. This panel puts backup age in the Studio, where
editors already are, and colours the card when a backup is overdue.

## Install

```bash
npm i @liiift-studio/sanity-backup-monitor
```

```ts
// sanity.config.ts
import { backupMonitor } from '@liiift-studio/sanity-backup-monitor'

export default defineConfig({
  plugins: [
    backupMonitor({
      proxyUrl: 'https://ops.example.com/api/backup-proxy',
      statusKey: process.env.SANITY_STUDIO_BACKUP_STATUS_KEY,
      targets: [
        {
          label: 'MCKL',
          owner: 'Liiift-Studio',
          repo: 'mckl-cms',
          workflow: 'backup-routine.yml',
          expectedIntervalDays: 7,
          proxyKey: 'mckl',
        },
      ],
    }),
  ],
})
```

## Options

| Option | Purpose |
| --- | --- |
| `targets` | Repositories to watch (see below) |
| `mode` | `proxy` or `direct`. Defaults to `proxy` when `proxyUrl` is set |
| `proxyUrl` | Base URL of the backup proxy |
| `statusKey` | Shared key the proxy checks |
| `token` | GitHub token, **direct mode only** — see the warning below |
| `runLimit` | Runs listed per target (default 5) |
| `name` / `title` / `icon` | Studio tool identity |

Each target takes `label`, `owner`, `repo`, `workflow`, and optionally `ref`
(default `main`), `expectedIntervalDays` (default 7), and `proxyKey`.

## Health thresholds

`expectedIntervalDays` drives the whole panel:

| State | Condition |
| --- | --- |
| **Healthy** | Last success within 1.25x the interval |
| **Overdue** | Past 1.25x, or failures since the last success |
| **Attention** | Past 2x the interval, or no success in the fetched runs |

The 25% grace exists because GitHub delays scheduled runs by minutes, never days. On a
weekly cadence that surfaces a problem at 8.75 days rather than sitting quiet for a
fortnight.

`assessHealth` is exported and pure, so it can be reused or tested independently.

## Use proxy mode

Sanity has **no per-document access control**. A GitHub token stored in the dataset is
readable by everyone who can read the dataset — and on a public dataset, by anyone at
all. Restricting the tool to editors does not help: a viewer can read the token and use
it directly.

Proxy mode keeps the token on a server you control. The Studio sends an opaque key; the
proxy resolves it against a server-side allowlist and calls GitHub itself, so the Studio
cannot reach a repository that is not on that list even if its bundle is fully readable.

Direct mode exists for local development. The panel shows a warning banner whenever it
is active with a token.

See [`proxy/README.md`](./proxy/README.md) for setup.

## Token scope

Fine-grained, limited to the backup repositories:

- **Actions: Read-only** — status panel works, "Back up now" returns 403
- **Actions: Read and write** — triggering also works

Set `BACKUP_ALLOW_TRIGGER=false` on the proxy for a read-only deployment even with a
read/write token.

## Testing

```bash
npm test        # health assessment + proxy allowlist
npm run typecheck
```
