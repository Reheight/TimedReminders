import type { PageServerLoad } from './$types';
import type { RotationTracker } from '$prisma';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma.js';
import { getConfig, getConfigBool, getConfigInt, CONFIG_KEYS } from '$lib/server/config.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.authenticated) throw redirect(303, '/');

	const [
		appName,
		sessionHours,
		lockOnClose,
		pinLength,
		trackers,
		notifyHoursRaw,
		notifyHourFallback
	] = await Promise.all([
		getConfig(CONFIG_KEYS.APP_NAME),
		getConfigInt(CONFIG_KEYS.SESSION_DURATION_HOURS, 24),
		getConfigBool(CONFIG_KEYS.LOCK_ON_CLOSE),
		getConfigInt(CONFIG_KEYS.PIN_LENGTH, 4),
		prisma.rotationTracker.findMany({ orderBy: { createdAt: 'asc' } }),
		getConfig(CONFIG_KEYS.NOTIFY_HOURS),
		getConfigInt(CONFIG_KEYS.NOTIFY_HOUR, 9)
	]);

	const notifyHours: number[] = notifyHoursRaw
		? notifyHoursRaw
				.split(',')
				.map(Number)
				.filter((n) => !isNaN(n))
		: [notifyHourFallback];

	return {
		appName: appName ?? 'Rotation Tracker',
		sessionHours,
		lockOnClose,
		pinLength,
		trackers: trackers.map((t: RotationTracker) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			onWeeks: t.onWeeks,
			offWeeks: t.offWeeks,
			startDate: t.startDate.toISOString().slice(0, 10),
			startPhase: t.startPhase,
			isActive: t.isActive,
			color: t.color
		})),
		notifyHours
	};
};
