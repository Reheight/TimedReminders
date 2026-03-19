import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { calculatePhases, getCurrentPhase, getNextPhase, computeTrackerStats, enrichPhasesWithData } from '$lib/server/rotation';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.authenticated) {
		return { trackers: [] };
	}

	const trackers = await prisma.rotationTracker.findMany({
		where: { isActive: true },
		orderBy: { createdAt: 'asc' }
	});

	const today = new Date();
	const todayISO = today.toISOString().slice(0, 10);

	const enriched = await Promise.all(
		trackers.map(async (t) => {
			const phases = calculatePhases(t);
			const phasesWithData = await enrichPhasesWithData(t.id, phases);
			const stats = await computeTrackerStats(t.id, phasesWithData);
			const current = getCurrentPhase(t);
			const next = getNextPhase(t);

			// Current week number in the full cycle (ON+OFF weeks combined)
			const cycleWeeks = t.onWeeks + t.offWeeks;
			const startMs = new Date(t.startDate).getTime();
			const daysSinceStart = Math.floor((today.getTime() - startMs) / 86_400_000);
			const weekInCycle = daysSinceStart < 0 ? 0 : (Math.floor(daysSinceStart / 7) % cycleWeeks) + 1;
			const isEvenWeek = weekInCycle % 2 === 0;

			return {
				id: t.id,
				name: t.name,
				description: t.description,
				color: t.color,
				onWeeks: t.onWeeks,
				offWeeks: t.offWeeks,
				startDate: t.startDate.toISOString().slice(0, 10),
				cycleWeeks,
				weekInCycle,
				isEvenWeek,
				current: current
					? {
							phase: current.phase,
							dayInPhase: current.dayInPhase ?? null,
							daysRemaining: current.daysRemaining ?? null,
							progressPercent: current.progressPercent ?? null,
							totalDays: current.totalDays,
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
