/**
 * Typed configuration key registry.
 * Keys are stored in InternalConfigurationValue with matching valueType.
 */
export const CONFIG_KEYS = {
	IS_SETUP: 'app.isSetup',
	PIN_HASH: 'app.pinHash',
	PIN_LENGTH: 'app.pinLength',
	APP_NAME: 'app.appName',
	SESSION_DURATION_HOURS: 'app.sessionDurationHours',
	LOCK_ON_CLOSE: 'app.lockOnClose',
	VAPID_PUBLIC_KEY: 'push.vapidPublicKey',
	VAPID_PRIVATE_KEY: 'push.vapidPrivateKey',
	VAPID_SUBJECT: 'push.vapidSubject',
	CRON_SECRET: 'push.cronSecret',
	NOTIFY_HOUR: 'push.notifyHour',
	NOTIFY_HOURS: 'push.notifyHours'
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

import { prisma } from './prisma.js';
import type { ConfigValueType } from '$prisma';

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getConfig(key: ConfigKey): Promise<string | null> {
	const record = await prisma.internalConfigurationValue.findUnique({ where: { key } });
	return record?.value ?? null;
}

export async function getConfigBool(key: ConfigKey): Promise<boolean> {
	const val = await getConfig(key);
	return val === 'true';
}

export async function getConfigInt(key: ConfigKey, fallback = 0): Promise<number> {
	const val = await getConfig(key);
	const n = parseInt(val ?? '', 10);
	return isNaN(n) ? fallback : n;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function setConfig(
	key: ConfigKey,
	value: string,
	meta?: {
		displayName?: string;
		description?: string;
		valueType?: ConfigValueType;
		scope?: import('$prisma').ConfigScope;
		adminOnly?: boolean;
	}
): Promise<void> {
	await prisma.internalConfigurationValue.upsert({
		where: { key },
		create: {
			key,
			value,
			displayName: meta?.displayName,
			description: meta?.description,
			valueType: meta?.valueType ?? 'STRING',
			scope: meta?.scope ?? 'SYSTEM',
			adminOnly: meta?.adminOnly ?? true
		},
		update: {
			value,
			updatedAt: new Date()
		}
	});
}

// ── Defaults (first-time apply) ───────────────────────────────────────────────

export async function applyDefaults(): Promise<void> {
	const defaults: Array<Parameters<typeof setConfig>> = [
		[
			CONFIG_KEYS.PIN_LENGTH,
			'4',
			{ displayName: 'PIN Length', valueType: 'NUMBER', scope: 'SECURITY' }
		],
		[CONFIG_KEYS.APP_NAME, 'Rotation Tracker', { displayName: 'App Name', valueType: 'STRING' }],
		[
			CONFIG_KEYS.SESSION_DURATION_HOURS,
			'24',
			{ displayName: 'Session Duration (hours)', valueType: 'NUMBER', scope: 'SECURITY' }
		],
		[
			CONFIG_KEYS.LOCK_ON_CLOSE,
			'false',
			{ displayName: 'Lock on Browser Close', valueType: 'BOOLEAN', scope: 'SECURITY' }
		]
	];

	for (const args of defaults) {
		const existing = await prisma.internalConfigurationValue.findUnique({
			where: { key: args[0] }
		});
		if (!existing) {
			await setConfig(...args);
		}
	}
}
