// Framework-agnostic handlers for the backup proxy.
//
// The Studio never holds a GitHub token. It asks the proxy, by opaque key, and
// the proxy resolves that key against a server-side allowlist before calling
// GitHub with its own credential. The Studio therefore cannot point this at an
// arbitrary repository even if its bundle is fully readable.

/** Server-side configuration, read from the environment. */
export interface ProxyEnv {
	/** GitHub token. Needs Actions:read, plus Actions:write only if triggering is enabled. */
	githubToken: string
	/** Shared key the Studio sends on every request. */
	statusKey?: string
	/** Allowlisted targets, keyed by the opaque key the Studio sends. */
	targets: Record<string, ProxyTarget>
	/** When false, /trigger is refused outright. Defaults to true. */
	allowTrigger?: boolean
}

/** One allowlisted repository/workflow pair. */
export interface ProxyTarget {
	owner: string
	repo: string
	workflow: string
	ref?: string
}

/** What a handler returns, for the adapter to serialise. */
export interface ProxyResult {
	status: number
	body: unknown
}

const GITHUB_API = 'https://api.github.com'

/** Call GitHub with the server-held token. */
async function github(path: string, env: ProxyEnv, init?: RequestInit): Promise<Response> {
	return fetch(`${GITHUB_API}${path}`, {
		...init,
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${env.githubToken}`,
			'X-GitHub-Api-Version': '2022-11-28',
			...init?.headers,
		},
	})
}

/**
 * Reject a request whose status key does not match.
 * Returns null when the request may proceed.
 */
export function checkStatusKey(provided: string | null, env: ProxyEnv): ProxyResult | null {
	if (!env.statusKey) return null
	if (provided !== env.statusKey) return { status: 401, body: { error: 'Invalid status key' } }
	return null
}

/** Resolve an opaque key to an allowlisted target. */
function resolveTarget(key: string | null, env: ProxyEnv): ProxyTarget | null {
	if (!key) return null
	return env.targets[key] ?? null
}

/**
 * List recent runs for an allowlisted target.
 *
 * @param key - opaque target key sent by the Studio
 * @param limit - how many runs to return, capped at 20
 * @param statusKey - key supplied on the request
 */
export async function handleRuns(
	key: string | null,
	limit: number,
	statusKey: string | null,
	env: ProxyEnv,
): Promise<ProxyResult> {
	const denied = checkStatusKey(statusKey, env)
	if (denied) return denied

	const target = resolveTarget(key, env)
	if (!target) return { status: 404, body: { error: 'Unknown target key' } }

	const capped = Math.min(Math.max(limit || 5, 1), 20)
	const res = await github(
		`/repos/${target.owner}/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}/runs?per_page=${capped}`,
		env,
	)
	if (!res.ok) {
		return { status: 502, body: { error: `GitHub ${res.status} listing runs` } }
	}
	const data = (await res.json()) as { workflow_runs?: unknown[] }
	// Pass GitHub's shape straight through; the plugin normalises it in one place.
	return { status: 200, body: { runs: data.workflow_runs ?? [] } }
}

/**
 * Trigger a workflow_dispatch run for an allowlisted target.
 *
 * @param key - opaque target key sent by the Studio
 * @param statusKey - key supplied on the request
 */
export async function handleTrigger(
	key: string | null,
	statusKey: string | null,
	env: ProxyEnv,
): Promise<ProxyResult> {
	const denied = checkStatusKey(statusKey, env)
	if (denied) return denied

	if (env.allowTrigger === false) {
		return { status: 403, body: { error: 'Triggering is disabled on this proxy' } }
	}

	const target = resolveTarget(key, env)
	if (!target) return { status: 404, body: { error: 'Unknown target key' } }

	const res = await github(
		`/repos/${target.owner}/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}/dispatches`,
		env,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ref: target.ref ?? 'main' }),
		},
	)
	if (res.status !== 204) {
		return { status: 502, body: { error: `GitHub ${res.status} dispatching workflow` } }
	}
	return { status: 202, body: { ok: true } }
}

/**
 * Parse targets from a compact env string.
 *
 * Format: `key:owner/repo/workflow.yml@ref`, comma separated. The ref is optional
 * and defaults to main.
 *
 * @example
 * "mckl:Liiift-Studio/mckl-cms/backup-routine.yml,darden:Liiift-Studio/Darden-Studio/backup-routine.yml"
 */
export function parseTargets(spec: string | undefined): Record<string, ProxyTarget> {
	const out: Record<string, ProxyTarget> = {}
	if (!spec) return out
	for (const entry of spec.split(',').map(s => s.trim()).filter(Boolean)) {
		const [key, rest] = entry.split(':', 2)
		if (!key || !rest) continue
		const [pathPart, ref] = rest.split('@', 2)
		const segments = pathPart.split('/')
		if (segments.length !== 3) continue
		out[key] = { owner: segments[0], repo: segments[1], workflow: segments[2], ref: ref || 'main' }
	}
	return out
}

/** Build ProxyEnv from process.env. */
export function envFromProcess(e: Record<string, string | undefined>): ProxyEnv {
	return {
		githubToken: e.BACKUP_GITHUB_TOKEN ?? '',
		statusKey: e.BACKUP_STATUS_KEY,
		targets: parseTargets(e.BACKUP_TARGETS),
		allowTrigger: e.BACKUP_ALLOW_TRIGGER !== 'false',
	}
}
