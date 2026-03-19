import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import {
	calculatePhases,
	getOrCreateCycleRecord
} from '$lib/server/rotation.js';

function parseDate(dateStr: unknown): Date | null {
	if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
	const d = new Date(dateStr + 'T00:00:00Z');
	return isNaN(d.getTime()) ? null : d;
}

/** POST /api/trackers/[id]/checkin — add a check-in */
export const POST: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	if (typeof body !== 'object' || body === null) return json({ error: 'Invalid body' }, { status: 400 });

	const b = body as Record<string, unknown>;
	const date = parseDate(b.date);
	if (!date) return json({ error: 'Invalid date (YYYY-MM-DD required)' }, { status: 422 });

	const tracker = await prisma.rotationTracker.findUnique({ where: { id: params.id } });
	if (!tracker) return json({ error: 'Tracker not found' }, { status: 404 });

	// Find which phase this date belongs to
	const phases = calculatePhases(tracker, date);
	const matchingPhase = phases.find(
		(p) => date >= p.startDate && date <= p.endDate
	);

	if (!matchingPhase) return json({ error: 'Date is outside tracker range' }, { status: 422 });
	if (matchingPhase.phase !== 'ON') return json({ error: 'Check-ins only allowed during ON phase' }, { status: 422 });

	// Get or create the DB cycle record
	const cycleRecord = await getOrCreateCycleRecord(params.id, matchingPhase);

	// Upsert the check-in
	await prisma.cycleCheckIn.upsert({
		where: { cycleId_date: { cycleId: cycleRecord.id, date } },
		create: { cycleId: cycleRecord.id, date },
		update: {} // no-op if it already exists
	});

	return json({ success: true });
};

/** DELETE /api/trackers/[id]/checkin — remove a check-in */
export const DELETE: RequestHandler = async ({ request, locals, params }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
	if (typeof body !== 'object' || body === null) return json({ error: 'Invalid body' }, { status: 400 });

	const b = body as Record<string, unknown>;
	const date = parseDate(b.date);
	if (!date) return json({ error: 'Invalid date' }, { status: 422 });

	const tracker = await prisma.rotationTracker.findUnique({ where: { id: params.id } });
	if (!tracker) return json({ error: 'Tracker not found' }, { status: 404 });

	// Find the DB cycle record for this date's phase
	const phases = calculatePhases(tracker, date);
	const matchingPhase = phases.find((p) => date >= p.startDate && date <= p.endDate);
	if (!matchingPhase) return json({ error: 'Date is outside tracker range' }, { status: 422 });

	const cycleRecord = await prisma.rotationCycle.findUnique({
		where: { trackerId_phaseIndex: { trackerId: params.id, phaseIndex: matchingPhase.phaseIndex } }
	});
	if (!cycleRecord) return json({ success: true }); // nothing to delete

	await prisma.cycleCheckIn
		.delete({ where: { cycleId_date: { cycleId: cycleRecord.id, date } } })
		.catch(() => null); // ignore if it doesn't exist

	return json({ success: true });
};
