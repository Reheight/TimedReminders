import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import {
	calculatePhases,
	enrichPhasesWithData,
	getCurrentPhase
} from '$lib/server/rotation.js';

/** GET /api/trackers — list all active trackers */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	const trackers = await prisma.rotationTracker.findMany({
		where: { isActive: true },
		orderBy: { createdAt: 'asc' }
	});
	return json(trackers);
};

/** POST /api/trackers — create a new tracker */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	if (typeof body !== 'object' || body === null) return json({ error: 'Invalid body' }, { status: 400 });

	const b = body as Record<string, unknown>;

	// Validate
	if (typeof b.name !== 'string' || !b.name.trim()) return json({ error: 'Name is required' }, { status: 422 });
	if (b.name.trim().length > 100) return json({ error: 'Name too long' }, { status: 422 });
	const onWeeks = Number(b.onWeeks);
	const offWeeks = Number(b.offWeeks);
	if (!Number.isInteger(onWeeks) || onWeeks < 1 || onWeeks > 52) return json({ error: 'onWeeks must be 1–52' }, { status: 422 });
	if (!Number.isInteger(offWeeks) || offWeeks < 1 || offWeeks > 52) return json({ error: 'offWeeks must be 1–52' }, { status: 422 });
	if (b.startPhase !== 'ON' && b.startPhase !== 'OFF') return json({ error: 'startPhase must be ON or OFF' }, { status: 422 });

	// Parse and validate start date (YYYY-MM-DD)
	if (typeof b.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.startDate)) {
		return json({ error: 'Invalid startDate format (YYYY-MM-DD required)' }, { status: 422 });
	}
	const startDate = new Date(b.startDate + 'T00:00:00Z');
	if (isNaN(startDate.getTime())) return json({ error: 'Invalid startDate' }, { status: 422 });

	// Validate color (#rrggbb)
	const color = typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#8B5CF6';
	const description = typeof b.description === 'string' ? b.description.slice(0, 200) : null;

	const tracker = await prisma.rotationTracker.create({
		data: {
			name: b.name.trim(),
			description,
			onWeeks,
			offWeeks,
			startDate,
			startPhase: b.startPhase,
			color
		}
	});

	// Return the tracker with current phase info (same shape as dashboard)
	const phases = calculatePhases(tracker);
	const phasesWithData = await enrichPhasesWithData(tracker.id, phases);
	const currentPhase = getCurrentPhase(tracker);
	const currentWithData = currentPhase
		? phasesWithData.find((p) => p.phaseIndex === currentPhase.phaseIndex) ?? null
		: null;

	return json(
		{
			id: tracker.id,
			name: tracker.name,
			description: tracker.description,
			onWeeks: tracker.onWeeks,
			offWeeks: tracker.offWeeks,
			color: tracker.color,
			startDate: tracker.startDate.toISOString().slice(0, 10),
			startPhase: tracker.startPhase,
			isActive: tracker.isActive,
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
				: null
		},
		{ status: 201 }
	);
};
