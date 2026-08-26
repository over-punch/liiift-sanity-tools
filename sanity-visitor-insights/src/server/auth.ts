/**
 * Request authentication and CORS for the report handler.
 *
 * The Studio forwards its own Sanity session token and this verifies it against Sanity. A shared
 * secret was the obvious alternative and is the wrong one: the Studio bundle is served publicly, so
 * any secret compiled into it is extractable, which moves the bar from "know the URL" to "open
 * devtools". Verifying a session token instead proves the caller is a logged-in project user, and
 * gives a real identity to log rather than an anonymous caller who read a constant.
 *
 * This mirrors the pattern already in production on Darden's order-action endpoints.
 */

/** Minimal shape this module needs from a Next.js API request. */
export interface HandlerRequest {
	method?: string
	url?: string
	headers: Record<string, string | string[] | undefined>
	query?: Record<string, string | string[] | undefined>
}

/** Minimal shape this module needs from a Next.js API response. */
export interface HandlerResponse {
	setHeader(name: string, value: string): void
	status(code: number): HandlerResponse
	json(body: unknown): void
	end(): void
}

/** A verified Sanity Studio user. */
export interface StudioUser {
	id: string
	name?: string
	email?: string
	roles?: Array<{ name: string }>
}

/** Outcome of verifying a request's Studio token. */
export type VerifyResult =
	| { ok: true; user: StudioUser }
	| { ok: false; reason: string }

/** Read a header that may arrive as a string or an array. */
function header(req: HandlerRequest, name: string): string | undefined {
	const raw = req.headers[name] ?? req.headers[name.toLowerCase()]
	return Array.isArray(raw) ? raw[0] : raw
}

/**
 * Verify that a request carries a valid Sanity user token for this project.
 *
 * @param req - the incoming request
 * @param sanityProjectId - project the token must belong to
 * @returns ok with the resolved user, or a reason suitable for logging but never for the response
 */
export async function verifyStudioRequest(req: HandlerRequest, sanityProjectId: string): Promise<VerifyResult> {
	const authorization = header(req, 'authorization') ?? ''
	const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null

	if (!token) return { ok: false, reason: 'no-token' }
	if (!sanityProjectId) {
		// Fail closed rather than silently authorising everything if the env is misconfigured.
		console.error('Visitor insights: Sanity project id not configured — cannot verify Studio requests')
		return { ok: false, reason: 'not-configured' }
	}

	try {
		const response = await fetch(`https://${sanityProjectId}.api.sanity.io/v2021-06-07/users/me`, {
			headers: { Authorization: `Bearer ${token}` },
		})
		if (!response.ok) return { ok: false, reason: `sanity-${response.status}` }

		const user = (await response.json()) as StudioUser | null
		// Sanity answers 200 with a null id for an unauthenticated request rather than a 401.
		if (!user || !user.id) return { ok: false, reason: 'no-user' }

		return { ok: true, user }
	} catch (e) {
		console.error('Visitor insights: Studio token verification failed:', (e as Error).message)
		return { ok: false, reason: 'verify-error' }
	}
}

/**
 * Apply CORS headers for a Studio-originated request and answer the preflight.
 *
 * Echoes one allow-listed origin rather than sending `*`. A wildcard is acceptable for public HTML
 * but not for an endpoint that takes an Authorization header and returns business data.
 *
 * @param req - the incoming request
 * @param res - the response to decorate
 * @param allowedOrigins - exact origins permitted to call cross-origin
 * @returns true when the request was a preflight and is now fully answered
 */
export function applyCors(req: HandlerRequest, res: HandlerResponse, allowedOrigins: readonly string[]): boolean {
	const origin = header(req, 'origin')

	if (origin && allowedOrigins.includes(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin)
		// The response varies by origin, so caches must not serve one origin's response to another.
		res.setHeader('Vary', 'Origin')
		res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
		res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
		res.setHeader('Access-Control-Max-Age', '600')
	}

	if (req.method === 'OPTIONS') {
		// A disallowed origin gets 204 without allow headers; the browser rejects it on its own,
		// so there is no need to reveal whether the origin is known.
		res.status(204).end()
		return true
	}

	return false
}

/**
 * Guard a report endpoint. Responds 401 and returns null when the caller cannot be verified.
 *
 * @returns the verified user, or null when the request has already been answered with a 401
 */
export async function requireStudioUser(
	req: HandlerRequest,
	res: HandlerResponse,
	sanityProjectId: string,
): Promise<StudioUser | null> {
	const result = await verifyStudioRequest(req, sanityProjectId)

	if (result.ok) return result.user

	console.error(`Visitor insights: rejected unauthenticated request (${result.reason}) on ${req.url ?? 'unknown'}`)
	res.status(401).json({ error: 'Not authorised. Sign in to the Studio and try again.' })
	return null
}
