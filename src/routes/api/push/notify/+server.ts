import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { sendPush } from '$lib/server/push.js';
import { getConfig, getConfigInt, CONFIG_KEYS } from '$lib/server/config.js';
import { calculatePhases, localTodayMidnightUTC } from '$lib/server/rotation.js';

/**
 * POST /api/push/notify
 *
 * Designed to be called frequently (every minute or second) by a cron job.
 * - Checks whether the current local hour matches the configured notify hour.
 * - Uses an atomic DB INSERT on PushNotificationLog as an optimistic lock so
 *   only one call per day ever sends, even under concurrent/repeated hits.
 * - Secured with CRON_SECRET stored in app config (Settings → Push Notifications).
 *   Pass: Authorization: Bearer <secret>
 */
export const POST: RequestHandler = async ({ request }) => {
	// ── Auth ────────────────────────────────────────────────────────────────────
	const secret = await getConfig(CONFIG_KEYS.CRON_SECRET);
	if (secret) {
		const authHeader = request.headers.get('authorization');
		if (authHeader !== `Bearer ${secret}`) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	const payload = await request.json().catch(() => ({}));
	const force = payload?.force === true;

	const now = new Date();
	const currentHour = now.getUTCHours();

	// ── Time window check (skipped when force=true) ─────────────────────────
	if (!force) {
		const hoursRaw = await getConfig(CONFIG_KEYS.NOTIFY_HOURS);
		const notifyHours = hoursRaw
			? hoursRaw
					.split(',')
					.map(Number)
					.filter((n) => !isNaN(n))
			: [await getConfigInt(CONFIG_KEYS.NOTIFY_HOUR, 9)];
		if (!notifyHours.includes(currentHour)) {
			return json({ skipped: 'outside notification window' });
		}
	}

	// ── Optimistic lock via unique INSERT (skipped when force=true) ─────────────
	const today = localTodayMidnightUTC();
	const todayStr = today.toISOString().slice(0, 10);
	const logKey = { date: todayStr, hour: currentHour };

	if (!force) {
		try {
			await prisma.pushNotificationLog.create({ data: logKey });
		} catch {
			// Unique constraint violation = this hour already sent
			return json({ skipped: 'already sent today' });
		}
	}

	// ── Find trackers that need a reminder ───────────────────────────────────────
	const trackers = await prisma.rotationTracker.findMany({ where: { isActive: true } });

	const needsCheckin: string[] = [];
	for (const tracker of trackers) {
		const phases = calculatePhases(tracker, today);
		const current = phases.find((p) => p.isCurrent);
		if (!current || current.phase !== 'ON') continue;

		const cycle = await prisma.rotationCycle.findUnique({
			where: { trackerId_phaseIndex: { trackerId: tracker.id, phaseIndex: current.phaseIndex } },
			include: { checkIns: { where: { date: today } } }
		});

		if (!cycle || cycle.checkIns.length === 0) {
			needsCheckin.push(tracker.name);
		}
	}

	if (needsCheckin.length === 0) {
		if (!force)
			await prisma.pushNotificationLog.update({ where: { date_hour: logKey }, data: { count: 0 } });
		return json({ sent: 0, message: 'All checked in already' });
	}

	const body =
		needsCheckin.length === 1
			? `Don't forget to check in for ${needsCheckin[0]} today!`
			: `Don't forget your check-ins today: ${needsCheckin.join(', ')}`;

	// ── Send to all subscriptions ────────────────────────────────────────────────
	const subscriptions = await prisma.pushSubscription.findMany();
	if (subscriptions.length === 0) {
		if (!force)
			await prisma.pushNotificationLog.update({ where: { date_hour: logKey }, data: { count: 0 } });
		return json({ sent: 0, message: 'No subscriptions' });
	}

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

	// Update log with actual send count
	if (!force)
		await prisma.pushNotificationLog.update({
			where: { date_hour: logKey },
			data: { count: sent }
		});

	// Clean up expired subscriptions
	if (expiredIds.length > 0) {
		await prisma.pushSubscription.deleteMany({ where: { id: { in: expiredIds } } });
	}

	return json({ sent, expired: expiredIds.length });
};
