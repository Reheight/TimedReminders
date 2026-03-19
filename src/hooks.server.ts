import type { Handle } from '@sveltejs/kit';
import { validateSession, pruneExpiredSessions } from '$lib/server/auth.js';

// Prune expired sessions once per hour (best-effort, not critical)
let lastPrune = 0;
async function maybePrune() {
	const now = Date.now();
	if (now - lastPrune > 60 * 60 * 1000) {
		lastPrune = now;
		await pruneExpiredSessions().catch(() => null);
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.authenticated = false;

	const rawToken = event.cookies.get('session');
	if (rawToken) {
		const valid = await validateSession(rawToken).catch(() => false);
		if (valid) {
			event.locals.authenticated = true;
			event.locals.sessionId = rawToken;
		} else {
			// Remove stale / expired cookie from client
			event.cookies.delete('session', { path: '/' });
		}
	}

	maybePrune(); // fire-and-forget

	return resolve(event);
};
