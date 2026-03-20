import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	checkRateLimit,
	recordFailedAttempt,
	resetAttempts,
	verifyPin,
	generateSessionToken,
	createSession
} from '$lib/server/auth.js';
import { getConfig, getConfigBool, getConfigInt, CONFIG_KEYS } from '$lib/server/config.js';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	if (
		typeof body !== 'object' ||
		body === null ||
		!('pin' in body) ||
		typeof (body as Record<string, unknown>).pin !== 'string'
	) {
		return json({ error: 'PIN is required' }, { status: 400 });
	}

	const submittedPin = ((body as Record<string, unknown>).pin as string).trim();

	// Validate PIN is digits only (prevent injection)
	if (!/^\d+$/.test(submittedPin)) {
		return json({ error: 'Invalid PIN format' }, { status: 400 });
	}

	const ip = getClientAddress();

	// Rate limiting check
	const rateLimit = await checkRateLimit(ip);
	if (!rateLimit.allowed) {
		return json(
			{ error: 'Too many attempts', lockedUntil: rateLimit.lockedUntil },
			{ status: 429 }
		);
	}

	// Get stored PIN hash
	const pinHash = await getConfig(CONFIG_KEYS.PIN_HASH);
	if (!pinHash) {
		return json({ error: 'App not configured' }, { status: 503 });
	}

	const valid = await verifyPin(submittedPin, pinHash);

	if (!valid) {
		const { remaining, lockedUntil } = await recordFailedAttempt(ip);
		return json({ error: 'Incorrect PIN', remaining, lockedUntil }, { status: 401 });
	}

	// Success — clear failed attempts and create session
	await resetAttempts(ip);

	const rawToken = generateSessionToken();
	await createSession(rawToken);

	const lockOnClose = await getConfigBool(CONFIG_KEYS.LOCK_ON_CLOSE);
	const durationHours = await getConfigInt(CONFIG_KEYS.SESSION_DURATION_HOURS, 24);

	cookies.set('session', rawToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: false,
		// No maxAge when lockOnClose — cookie becomes a session cookie
		...(lockOnClose ? {} : { maxAge: durationHours * 3600 })
	});

	return json({ success: true });
};
