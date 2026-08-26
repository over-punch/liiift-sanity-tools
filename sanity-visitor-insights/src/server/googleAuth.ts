/**
 * Service-account access tokens for the GA4 Data API.
 *
 * Implemented directly against Google's OAuth2 token endpoint rather than through `googleapis`,
 * which is a very large dependency to pull into a package that only needs one grant type. Signing
 * a JWT with node:crypto keeps the dependency surface at zero and removes any risk of a
 * credential-bearing SDK being reachable from the Studio entry point.
 */

import { createSign } from 'node:crypto'

/** Read-only scope for the GA4 Data API — the least privilege this package needs. */
const ANALYTICS_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

/** Google's OAuth2 token endpoint for the JWT bearer grant. */
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/** Seconds an assertion stays valid. Google caps this at one hour. */
const ASSERTION_TTL_SECONDS = 3600

/** Refresh this many seconds before actual expiry, so a token never expires mid-flight. */
const REFRESH_MARGIN_SECONDS = 60

/** The parts of a service-account JSON key this module uses. */
export interface ServiceAccountKey {
	client_email: string
	private_key: string
}

interface CachedToken {
	token: string
	expiresAt: number
}

/** Access tokens are cached per service account for their lifetime. */
const tokenCache = new Map<string, CachedToken>()

/** Base64url without padding, as JWT requires. */
function base64url(input: string | Buffer): string {
	return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Parse a service-account key from an environment variable.
 *
 * Accepts either raw JSON or base64-encoded JSON, because multi-line JSON with embedded newlines
 * is awkward to set in some dashboards and gets mangled often enough to be worth tolerating both.
 *
 * @param raw - the environment variable's value
 * @returns the parsed key, or null when unset or unparseable
 */
export function parseServiceAccountKey(raw: string | undefined): ServiceAccountKey | null {
	if (!raw) return null

	let text = raw.trim()

	// Base64 payloads contain no braces; JSON always starts with one.
	if (!text.startsWith('{')) {
		try {
			text = Buffer.from(text, 'base64').toString('utf8')
		} catch {
			return null
		}
	}

	try {
		const parsed = JSON.parse(text) as Partial<ServiceAccountKey>
		if (!parsed.client_email || !parsed.private_key) return null

		return {
			client_email: parsed.client_email,
			// Escaped newlines survive most env-var round trips; real newlines do not always.
			private_key: parsed.private_key.replace(/\\n/g, '\n'),
		}
	} catch {
		return null
	}
}

/**
 * Get an access token for the GA4 Data API, minting one only when the cached token is near expiry.
 *
 * @param key - the service-account key
 * @returns a bearer token
 * @throws when Google rejects the assertion
 */
export async function getAccessToken(key: ServiceAccountKey): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	const cached = tokenCache.get(key.client_email)

	if (cached && cached.expiresAt - REFRESH_MARGIN_SECONDS > now) {
		return cached.token
	}

	const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
	const claims = base64url(
		JSON.stringify({
			iss: key.client_email,
			scope: ANALYTICS_READONLY_SCOPE,
			aud: TOKEN_ENDPOINT,
			exp: now + ASSERTION_TTL_SECONDS,
			iat: now,
		}),
	)

	const signer = createSign('RSA-SHA256')
	signer.update(`${header}.${claims}`)
	const signature = base64url(signer.sign(key.private_key))
	const assertion = `${header}.${claims}.${signature}`

	const response = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion,
		}),
	})

	if (!response.ok) {
		// Deliberately does not include the response body, which can echo parts of the assertion.
		throw new Error(`Google token exchange failed with ${response.status}`)
	}

	const body = (await response.json()) as { access_token?: string; expires_in?: number }
	if (!body.access_token) throw new Error('Google token exchange returned no access token')

	tokenCache.set(key.client_email, {
		token: body.access_token,
		expiresAt: now + (body.expires_in ?? ASSERTION_TTL_SECONDS),
	})

	return body.access_token
}

/** Clear the token cache. Test seam. */
export function resetTokenCache(): void {
	tokenCache.clear()
}
