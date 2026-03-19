import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { CONFIG_KEYS, applyDefaults, getConfigBool } from '$lib/server/config.js';
import { hashPin } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request }) => {
	// Prevent re-setup if already configured
	const alreadySetup = await getConfigBool(CONFIG_KEYS.IS_SETUP);
	if (alreadySetup) {
		return json({ error: 'App is already configured' }, { status: 409 });
	}

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	if (typeof body !== 'object' || body === null) return json({ error: 'Invalid body' }, { status: 400 });

	const b = body as Record<string, unknown>;

	// Validate PIN
	if (typeof b.pin !== 'string' || !/^\d{4,8}$/.test(b.pin)) {
		return json({ error: 'PIN must be 4–8 digits' }, { status: 422 });
	}
	const pinLength = Number(b.pinLength);
	if (!Number.isInteger(pinLength) || pinLength < 4 || pinLength > 8) {
		return json({ error: 'PIN length must be 4–8' }, { status: 422 });
	}
	if (b.pin.length !== pinLength) {
		return json({ error: 'PIN length mismatch' }, { status: 422 });
	}

	// Validate app name
	if (b.appName !== undefined && typeof b.appName !== 'string') {
		return json({ error: 'Invalid app name' }, { status: 422 });
	}
	const appName = (typeof b.appName === 'string' ? b.appName.trim() : 'Rotation Tracker').slice(0, 50) || 'Rotation Tracker';

	// Validate session hours
	const sessionHours = Number(b.sessionHours ?? 24);
	if (!Number.isFinite(sessionHours) || sessionHours < 1 || sessionHours > 8760) {
		return json({ error: 'Invalid session duration' }, { status: 422 });
	}

	// Validate tracker
	const t = b.tracker as Record<string, unknown> | undefined;
	if (!t || typeof t !== 'object') return json({ error: 'Tracker config is required' }, { status: 422 });
	if (typeof t.name !== 'string' || !t.name.trim()) return json({ error: 'Tracker name is required' }, { status: 422 });
	const onWeeks = Number(t.onWeeks);
	const offWeeks = Number(t.offWeeks);
	if (!Number.isInteger(onWeeks) || onWeeks < 1 || onWeeks > 52) return json({ error: 'onWeeks must be 1–52' }, { status: 422 });
	if (!Number.isInteger(offWeeks) || offWeeks < 1 || offWeeks > 52) return json({ error: 'offWeeks must be 1–52' }, { status: 422 });
	if (t.startPhase !== 'ON' && t.startPhase !== 'OFF') return json({ error: 'startPhase must be ON or OFF' }, { status: 422 });
	if (typeof t.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.startDate)) {
		return json({ error: 'Invalid startDate (YYYY-MM-DD required)' }, { status: 422 });
	}
	const startDate = new Date(t.startDate + 'T00:00:00Z');
	if (isNaN(startDate.getTime())) return json({ error: 'Invalid startDate' }, { status: 422 });
	const color = typeof t.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#8B5CF6';

	// All valid — write config and create tracker in a transaction
	const pinHash = await hashPin(b.pin as string);

	await applyDefaults();

	await prisma.$transaction(async (txClient) => {
		const tx = txClient as unknown as typeof prisma;
		// Write all config entries
		await Promise.all([
			tx.internalConfigurationValue.upsert({
				where: { key: CONFIG_KEYS.PIN_HASH },
				create: { key: CONFIG_KEYS.PIN_HASH, value: pinHash, valueType: 'SECRET', scope: 'SECURITY', adminOnly: true, displayName: 'PIN Hash' },
				update: { value: pinHash }
			}),
			tx.internalConfigurationValue.upsert({
				where: { key: CONFIG_KEYS.PIN_LENGTH },
				create: { key: CONFIG_KEYS.PIN_LENGTH, value: String(pinLength), valueType: 'NUMBER', scope: 'SECURITY', adminOnly: true, displayName: 'PIN Length' },
				update: { value: String(pinLength) }
			}),
			tx.internalConfigurationValue.upsert({
				where: { key: CONFIG_KEYS.APP_NAME },
				create: { key: CONFIG_KEYS.APP_NAME, value: appName, valueType: 'STRING', scope: 'SYSTEM', displayName: 'App Name' },
				update: { value: appName }
			}),
			tx.internalConfigurationValue.upsert({
				where: { key: CONFIG_KEYS.SESSION_DURATION_HOURS },
				create: { key: CONFIG_KEYS.SESSION_DURATION_HOURS, value: String(sessionHours), valueType: 'NUMBER', scope: 'SECURITY', displayName: 'Session Duration (hours)' },
				update: { value: String(sessionHours) }
			}),
			tx.internalConfigurationValue.upsert({
				where: { key: CONFIG_KEYS.LOCK_ON_CLOSE },
				create: { key: CONFIG_KEYS.LOCK_ON_CLOSE, value: b.lockOnClose ? 'true' : 'false', valueType: 'BOOLEAN', scope: 'SECURITY', displayName: 'Lock on Browser Close' },
				update: { value: b.lockOnClose ? 'true' : 'false' }
			}),
			tx.rotationTracker.create({
				data: {
					name: (t.name as string).trim(),
					description: typeof t.description === 'string' ? t.description.slice(0, 200) : null,
					onWeeks,
					offWeeks,
					startDate,
					startPhase: t.startPhase as 'ON' | 'OFF',
					color
				}
			})
		]);

		// Mark setup as complete last
		await tx.internalConfigurationValue.upsert({
			where: { key: CONFIG_KEYS.IS_SETUP },
			create: { key: CONFIG_KEYS.IS_SETUP, value: 'true', valueType: 'BOOLEAN', scope: 'SYSTEM', displayName: 'App Setup Complete' },
			update: { value: 'true' }
		});
	});

	return json({ success: true }, { status: 201 });
};
