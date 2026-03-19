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

	return json({ success: true });
};
