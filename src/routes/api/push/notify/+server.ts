import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { sendPush } from '$lib/server/push.js';
import { getConfig, CONFIG_KEYS } from '$lib/server/config.js';
import { calculatePhases, localTodayMidnightUTC } from '$lib/server/rotation.js';

/**
 * POST /api/push/notify
 *
 * Intended to be called by an external cron job once per day.
 * Secured with CRON_SECRET stored in app config (Settings → Push Notifications).
 * Pass: Authorization: Bearer <secret>
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = await getConfig(CONFIG_KEYS.CRON_SECRET);
	if (secret) {
		const authHeader = request.headers.get('authorization');
		if (authHeader !== `Bearer ${secret}`) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	const today = localTodayMidnightUTC();
	const todayStr = today.toISOString().slice(0, 10);

	// Get all active trackers
	const trackers = await prisma.rotationTracker.findMany({ where: { isActive: true } });

	// Find trackers that are in an ON phase today but not yet checked in
	const needsCheckin: string[] = [];
	for (const tracker of trackers) {
		const phases = calculatePhases(tracker, today);
		const current = phases.find((p) => p.isCurrent);
		if (!current || current.phase !== 'ON') continue;

		// Check if already checked in today
		const cycle = await prisma.rotationCycle.findUnique({
			where: { trackerId_phaseIndex: { trackerId: tracker.id, phaseIndex: current.phaseIndex } },
			include: { checkIns: { where: { date: today } } }
		});

		if (!cycle || cycle.checkIns.length === 0) {
			needsCheckin.push(tracker.name);
		}
	}

	if (needsCheckin.length === 0) {
		return json({ sent: 0, message: 'All checked in already' });
	}

	const body =
		needsCheckin.length === 1
			? `Don't forget to check in for ${needsCheckin[0]} today!`
			: `Don't forget your check-ins today: ${needsCheckin.join(', ')}`;

	// Get all push subscriptions
	const subscriptions = await prisma.pushSubscription.findMany();
	if (subscriptions.length === 0) return json({ sent: 0, message: 'No subscriptions' });

	const expiredIds: string[] = [];
	let sent = 0;

	await Promise.all(
		subscriptions.map(async (sub) => {
			const result = await sendPush(sub, {
				title: 'Rotation Tracker',
				body,
				url: '/',
				tag: `checkin-${todayStr}`
			});
			if (result.gone) {
				expiredIds.push(sub.id);
			} else if (result.ok) {
				sent++;
			}
		})
	);

	// Clean up expired subscriptions
	if (expiredIds.length > 0) {
		await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
	}

	return json({ sent, expired: expiredIds.length });
};
