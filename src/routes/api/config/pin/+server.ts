import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CONFIG_KEYS, setConfig } from '$lib/server/config.js';
import { hashPin } from '$lib/server/auth.js';

/** Update PIN (authenticated) */
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	if (typeof body !== 'object' || body === null) return json({ error: 'Invalid body' }, { status: 400 });

	const b = body as Record<string, unknown>;
	const pin = b.pin;
	const pinLength = b.pinLength;

	if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
		return json({ error: 'PIN must be 4–8 digits' }, { status: 422 });
	}

	if (pinLength !== undefined) {
		const pl = Number(pinLength);
		if (!Number.isInteger(pl) || pl < 4 || pl > 8) return json({ error: 'PIN length must be 4–8' }, { status: 422 });
		if (pin.length !== pl) return json({ error: 'PIN length mismatch' }, { status: 422 });
		await setConfig(CONFIG_KEYS.PIN_LENGTH, String(pl), { displayName: 'PIN Length', valueType: 'NUMBER', scope: 'SECURITY' });
	}

	const hash = await hashPin(pin);
	await setConfig(CONFIG_KEYS.PIN_HASH, hash, { displayName: 'PIN Hash', valueType: 'SECRET', scope: 'SECURITY' });

	return json({ success: true });
};
