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

## Direct mode vs proxy mode

A `token` passed to this plugin is compiled into the Studio's JavaScript bundle. On a
hosted Studio that bundle sits behind login, so it is not readable by the public — but
it *is* readable, via devtools, by **anyone who can open the Studio**, including Viewers.
Restricting the tool to editors does not change that.

So the choice follows from what the token can do:

| | Token scope | If a Viewer extracts it |
| --- | --- | --- |
| **Status only** | `Actions: read` | They can read workflow run history. Minor. |
| **With triggering** | `Actions: read and write` | They can dispatch workflows on those repos. Not minor. |

**Direct mode is reasonable for a status-only panel** with a read-only, fine-grained
token. Set `BACKUP_ALLOW_TRIGGER` aside entirely and simply do not pass a write-scoped
token; the trigger button will return 403.

**Use proxy mode once you want the trigger button.** The token stays on a server you
control, the Studio sends only an opaque key, and the proxy resolves it against a
server-side allowlist — so a fully readable bundle still cannot reach a repository that
is not on that list.

Separately: if you store a token in a Sanity *document* rather than plugin config, the
dataset ACL governs it, and on a public dataset that means anyone at all. This plugin
does not do that, but it is worth knowing the distinction.

The panel shows a warning banner whenever direct mode is active with a token.

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
