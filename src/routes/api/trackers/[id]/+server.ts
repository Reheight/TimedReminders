import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import {
	calculatePhases,
	enrichPhasesWithData,
	getCurrentPhase
} from '$lib/server/rotation.js';

/** GET /api/trackers/[id] — return tracker with current phase (used by dashboard after check-in) */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	const tracker = await prisma.rotationTracker.findUnique({ where: { id: params.id } });
	if (!tracker) return json({ error: 'Not found' }, { status: 404 });

	const phases = calculatePhases(tracker);
	const phasesWithData = await enrichPhasesWithData(tracker.id, phases);
	const currentPhase = getCurrentPhase(tracker);
	const currentWithData = currentPhase
		? phasesWithData.find((p) => p.phaseIndex === currentPhase.phaseIndex) ?? null
		: null;

	return json({
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
	});
};

/** PATCH /api/trackers/[id] — update tracker settings */
export const PATCH: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	if (typeof body !== 'object' || body === null) return json({ error: 'Invalid body' }, { status: 400 });

	const b = body as Record<string, unknown>;
	const data: Record<string, unknown> = {};

	if (b.name !== undefined) {
		if (typeof b.name !== 'string' || !b.name.trim()) return json({ error: 'Invalid name' }, { status: 422 });
		data.name = b.name.trim().slice(0, 100);
	}
	if (b.description !== undefined) data.description = typeof b.description === 'string' ? b.description.slice(0, 200) : null;
	if (b.isActive !== undefined) data.isActive = Boolean(b.isActive);
	if (b.color !== undefined && typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color)) data.color = b.color;

	const tracker = await prisma.rotationTracker.update({
		where: { id: params.id },
		data: { ...data, updatedAt: new Date() }
	});

	return json(tracker);
};

/** DELETE /api/trackers/[id] — delete tracker and all related data */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	await prisma.rotationTracker.delete({ where: { id: params.id } });
	return json({ success: true });
};
