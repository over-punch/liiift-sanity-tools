# @liiift-studio/sanity-backup-monitor

Studio panel showing whether your scheduled dataset backups are actually running.

## Why

A backup's failure mode is silence. TDF's backup workflow existed, appeared in the
Actions tab, and had not succeeded in three months — nobody noticed, because nothing
surfaced the gap anywhere people look. This panel puts backup age in the Studio, where
editors already are, and colours the card when a backup is overdue or failing.

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
      token: process.env.SANITY_STUDIO_BACKUP_GH_TOKEN,
      targets: [
        {
          label: 'MCKL',
          owner: 'Liiift-Studio',
          repo: 'mckl-cms',
          workflow: 'backup-routine.yml',
          expectedIntervalDays: 7,
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
| `token` | GitHub token — see Token scope |
| `runLimit` | Runs listed per target (default 5) |
| `allowTrigger` | Show the "Back up now" button (default **false**) |
| `name` / `title` / `icon` | Studio tool identity |

Each target takes `label`, `owner`, `repo`, `workflow`, and optionally `ref`
(default `main`) and `expectedIntervalDays` (default 7).

## Health

`expectedIntervalDays` drives the panel. The badge distinguishes *late* from *broken*,
because those need different responses:

| Badge | Meaning |
| --- | --- |
| **Healthy** | Last success within 1.25x the interval, nothing failing since |
| **Overdue** | Past 1.25x the interval |
| **Stale** | Past 2x the interval |
| **Errors** | Recent success, but runs have failed since |
| **Failing** | No success in the fetched runs |
| **No runs** | Nothing found — usually a wrong `workflow` filename |
| **Unknown** | Runs still in flight, or a timestamp that could not be read |

The 25% grace exists because GitHub delays scheduled runs by minutes or hours, never
days. On a weekly cadence that surfaces a problem at 8.75 days rather than sitting quiet
for a fortnight.

GitHub's `neutral` counts as a success; `skipped`, `cancelled` and `action_required` are
treated as neither success nor failure, so routine path-filter and concurrency events do
not downgrade a healthy target.

`assessHealth` is exported. Its signature is
`assessHealth(runs, expectedIntervalDays?, now?)` — pass `now` to make it deterministic.

## Token scope

The token is compiled into the Studio bundle. On a hosted Studio that bundle sits behind
login, so it is not public — but it **is** readable via devtools by anyone who can open
the Studio, including Viewers. Restricting the tool to editors does not change that.

Use a **fine-grained token scoped to `Actions: Read-only` on a single repository**. Then
what a Studio user could extract reaches nothing they cannot already read from the
dataset. Do not use one token across several repositories: that turns a Viewer on one
project into a reader of another project's backups.

**Triggering is off by default.** `allowTrigger: true` shows the "Back up now" button,
which calls `workflow_dispatch` and needs `Actions: read and write`. A write-scoped token
extractable from the bundle can dispatch workflows on that repo, which is a genuinely
larger risk than reading run history — so the panel shows a warning when that combination
is active, and a server-side proxy is the right answer if you want it in production.

A proxy implementation lives in `proxy/` in this repo but is **not published** and has
not been hardened; see that directory's README before relying on it.

## Testing

```bash
npm test
npm run typecheck
```
