import type { PageServerLoad } from './$types';
import type { CycleCheckIn } from '@prisma/client';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma.js';
import {
	calculatePhases,
	enrichPhasesWithData,
	computeTrackerStats,
	toMidnightUTC
} from '$lib/server/rotation.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.authenticated) throw redirect(303, '/');

	const tracker = await prisma.rotationTracker.findUnique({ where: { id: params.id } });
	if (!tracker) throw error(404, 'Tracker not found');

	const phases = calculatePhases(tracker);
	const phasesWithData = await enrichPhasesWithData(tracker.id, phases);
	const stats = await computeTrackerStats(tracker.id, phasesWithData);

	const today = toMidnightUTC(new Date());

	return {
		tracker: {
			id: tracker.id,
			name: tracker.name,
			description: tracker.description,
			onWeeks: tracker.onWeeks,
			offWeeks: tracker.offWeeks,
			color: tracker.color,
			startDate: tracker.startDate.toISOString().slice(0, 10),
			startPhase: tracker.startPhase,
			isActive: tracker.isActive
		},
		phases: phasesWithData.map((p) => ({
			phaseIndex: p.phaseIndex,
			phase: p.phase,
			startDate: p.startDate.toISOString(),
			endDate: p.endDate.toISOString(),
			totalDays: p.totalDays,
			isCurrent: p.isCurrent,
			isPast: p.isPast,
			dayInPhase: p.dayInPhase ?? null,
			daysRemaining: p.daysRemaining ?? null,
			progressPercent: p.progressPercent ?? null,
			checkInCount: p.checkInCount,
			completionPercent: p.completionPercent,
			hasCheckedInToday: p.hasCheckedInToday,
			isCompleted: p.dbRecord?.isCompleted ?? false,
			// Pass check-in dates as strings for the calendar
			checkInDates: (p.dbRecord?.checkIns ?? []).map((ci: CycleCheckIn) =>
				toMidnightUTC(new Date(ci.date)).toISOString().slice(0, 10)
			),
			notes: p.dbRecord?.notes ?? null
		})),
		stats,
		todayISO: today.toISOString().slice(0, 10)
	};
};
