import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import {
	calculatePhases,
	getCurrentPhase,
	getNextPhase,
	computeTrackerStats,
	enrichPhasesWithData,
	localTodayMidnightUTC
} from '$lib/server/rotation';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.authenticated) {
		return { trackers: [], todayISO: '' };
	}

	const trackers = await prisma.rotationTracker.findMany({
		where: { isActive: true },
		orderBy: { createdAt: 'asc' }
	});

	const today = localTodayMidnightUTC();
	const todayISO = today.toISOString().slice(0, 10);

	const enriched = await Promise.all(
		trackers.map(async (t) => {
			const phases = calculatePhases(t, today);
			const phasesWithData = await enrichPhasesWithData(t.id, phases, today);
			const stats = await computeTrackerStats(t.id, phasesWithData);
			const current = getCurrentPhase(t);
			const next = getNextPhase(t);

			// cycleWeeks passed to client for recomputation
			const cycleWeeks = t.onWeeks + t.offWeeks;

			return {
				id: t.id,
				name: t.name,
				description: t.description,
				color: t.color,
				onWeeks: t.onWeeks,
				offWeeks: t.offWeeks,
				startDate: t.startDate.toISOString().slice(0, 10),
				cycleWeeks,
				current: current
					? {
							phase: current.phase,
							totalDays: current.totalDays,
							startDate: current.startDate.toISOString().slice(0, 10),
							endDate: current.endDate.toISOString().slice(0, 10)
						}
					: null,
				next: next
					? {
							phase: next.phase,
							startDate: next.startDate.toISOString().slice(0, 10),
							totalDays: next.totalDays
						}
					: null,
				stats
			};
		})
	);

	return { trackers: enriched, todayISO };
};
