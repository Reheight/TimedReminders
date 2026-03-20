import type { PageServerLoad } from './$types';
import type { RotationTracker } from '@prisma/client';
import { prisma } from '$lib/server/prisma.js';
import {
	calculatePhases,
	enrichPhasesWithData,
	computeTrackerStats,
	getCurrentPhase
} from '$lib/server/rotation.js';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:checkins');
	if (!locals.authenticated) {
		return { trackers: [] };
	}

	const trackers = await prisma.rotationTracker.findMany({
		where: { isActive: true },
		orderBy: { createdAt: 'asc' }
	});

	const enriched = await Promise.all(
		trackers.map(async (t: RotationTracker) => {
			const phases = calculatePhases(t);
			const phasesWithData = await enrichPhasesWithData(t.id, phases);
			const stats = await computeTrackerStats(t.id, phasesWithData);
			const currentPhase = getCurrentPhase(t);

			// Enrich the current phase with today's check-in status
			const currentWithData = currentPhase
				? (phasesWithData.find((p) => p.phaseIndex === currentPhase.phaseIndex) ?? null)
				: null;

			return {
				id: t.id,
				name: t.name,
				description: t.description,
				onWeeks: t.onWeeks,
				offWeeks: t.offWeeks,
				color: t.color,
				currentPhase: currentWithData
					? {
							phase: currentWithData.phase,
							isCurrent: true,
							isPast: false,
							dayInPhase: currentWithData.dayInPhase ?? null,
							daysRemaining: currentWithData.daysRemaining ?? null,
							progressPercent: currentWithData.progressPercent ?? null,
							totalDays: currentWithData.totalDays,
							startDate: currentWithData.startDate.toISOString(),
							endDate: currentWithData.endDate.toISOString(),
							checkInCount: currentWithData.checkInCount,
							completionPercent: currentWithData.completionPercent,
							hasCheckedInToday: currentWithData.hasCheckedInToday
						}
					: null,
				stats
			};
		})
	);

	return { trackers: enriched };
};
