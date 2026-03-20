import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CONFIG_KEYS, setConfig } from '$lib/server/config.js';

/** Update general app settings (authenticated) */
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }

	if (typeof body !== 'object' || body === null) return json({ error: 'Invalid body' }, { status: 400 });
	const b = body as Record<string, unknown>;

	if (b.appName !== undefined) {
		if (typeof b.appName !== 'string' || !b.appName.trim()) return json({ error: 'Invalid app name' }, { status: 422 });
		await setConfig(CONFIG_KEYS.APP_NAME, b.appName.trim().slice(0, 50), { displayName: 'App Name', valueType: 'STRING' });
	}

	if (b.sessionHours !== undefined) {
		const h = Number(b.sessionHours);
		if (!Number.isInteger(h) || h < 1 || h > 8760) return json({ error: 'Invalid session duration' }, { status: 422 });
		await setConfig(CONFIG_KEYS.SESSION_DURATION_HOURS, String(h), { displayName: 'Session Duration (hours)', valueType: 'NUMBER', scope: 'SECURITY' });
	}

	if (b.lockOnClose !== undefined) {
		await setConfig(CONFIG_KEYS.LOCK_ON_CLOSE, b.lockOnClose ? 'true' : 'false', { displayName: 'Lock on Browser Close', valueType: 'BOOLEAN', scope: 'SECURITY' });
	}

	// Push notification settings
	if (b.vapidPublicKey !== undefined) {
		if (typeof b.vapidPublicKey !== 'string') return json({ error: 'Invalid VAPID public key' }, { status: 422 });
		await setConfig(CONFIG_KEYS.VAPID_PUBLIC_KEY, b.vapidPublicKey.trim(), { displayName: 'VAPID Public Key', valueType: 'STRING', scope: 'SECURITY' });
	}
	if (b.vapidPrivateKey !== undefined && b.vapidPrivateKey !== '') {
		if (typeof b.vapidPrivateKey !== 'string') return json({ error: 'Invalid VAPID private key' }, { status: 422 });
		await setConfig(CONFIG_KEYS.VAPID_PRIVATE_KEY, b.vapidPrivateKey.trim(), { displayName: 'VAPID Private Key', valueType: 'SECRET', scope: 'SECURITY' });
	}
	if (b.vapidSubject !== undefined) {
		if (typeof b.vapidSubject !== 'string') return json({ error: 'Invalid VAPID subject' }, { status: 422 });
		await setConfig(CONFIG_KEYS.VAPID_SUBJECT, b.vapidSubject.trim(), { displayName: 'VAPID Subject', valueType: 'STRING', scope: 'SECURITY' });
	}
	if (b.cronSecret !== undefined && b.cronSecret !== '') {
		if (typeof b.cronSecret !== 'string') return json({ error: 'Invalid cron secret' }, { status: 422 });
		await setConfig(CONFIG_KEYS.CRON_SECRET, b.cronSecret.trim(), { displayName: 'Cron Secret', valueType: 'SECRET', scope: 'SECURITY' });
	}

	return json({ success: true });
};
