/** API route — backup proxy for @liiift-studio/sanity-backup-monitor (Pages Router). */

import { envFromProcess, handleRuns, handleTrigger } from '@liiift-studio/sanity-backup-monitor/proxy'

/** Header the Studio sends its shared key in. */
const STATUS_KEY_HEADER = 'x-backup-status-key'

/**
 * Handle /api/backup-proxy/runs and /api/backup-proxy/trigger.
 *
 * Place at pages/api/backup-proxy/[...path].js. Imports the compiled core, so
 * this works in a site with no TypeScript configured.
 */
export default async function handler(req, res) {
	const env = envFromProcess(process.env)
	const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path]
	const endpoint = segments[0]
	const statusKey = req.headers[STATUS_KEY_HEADER] || null

	let result
	if (req.method === 'GET' && endpoint === 'runs') {
		result = await handleRuns(
			req.query.key ?? null,
			Number(req.query.limit ?? 5),
			statusKey,
			env,
		)
	} else if (req.method === 'POST' && endpoint === 'trigger') {
		const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
		result = await handleTrigger(body.key ?? null, statusKey, env)
	} else {
		result = { status: 404, body: { error: 'Unknown endpoint' } }
	}

	res.status(result.status).json(result.body)
}
