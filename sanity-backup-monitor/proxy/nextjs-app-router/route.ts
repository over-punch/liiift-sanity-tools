// Next.js App Router adapter for the backup proxy.
//
// Copy the whole proxy/ directory into your app, put this at
// app/api/backup-proxy/[...path]/route.ts, and set the env vars from
// .env.example. Nothing here holds logic; core.ts does the work.

import { envFromProcess, handleRuns, handleTrigger } from '../core'

/** Header the Studio sends its shared key in. */
const STATUS_KEY_HEADER = 'x-backup-status-key'

/** Serialise a ProxyResult as a Response. */
function toResponse(result: { status: number; body: unknown }): Response {
	return new Response(JSON.stringify(result.body), {
		status: result.status,
		headers: { 'Content-Type': 'application/json' },
	})
}

/** GET /runs?key=<target>&limit=<n> */
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
	const { path } = await context.params
	const env = envFromProcess(process.env)
	const url = new URL(request.url)
	const statusKey = request.headers.get(STATUS_KEY_HEADER)

	if (path[0] === 'runs') {
		return toResponse(
			await handleRuns(
				url.searchParams.get('key'),
				Number(url.searchParams.get('limit') ?? 5),
				statusKey,
				env,
			),
		)
	}
	return toResponse({ status: 404, body: { error: 'Unknown endpoint' } })
}

/** POST /trigger  body: { key } */
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
	const { path } = await context.params
	const env = envFromProcess(process.env)
	const statusKey = request.headers.get(STATUS_KEY_HEADER)

	if (path[0] === 'trigger') {
		const body = (await request.json().catch(() => ({}))) as { key?: string }
		return toResponse(await handleTrigger(body.key ?? null, statusKey, env))
	}
	return toResponse({ status: 404, body: { error: 'Unknown endpoint' } })
}
