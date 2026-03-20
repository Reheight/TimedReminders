import type { RotationTracker, RotationCycle, CycleCheckIn } from '$prisma';
import { prisma } from './prisma.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalculatedPhase = {
	/** 0-based sequential index across all phases (ON, OFF, ON, OFF …) */
	phaseIndex: number;
	phase: 'ON' | 'OFF';
	startDate: Date;
	endDate: Date;
	totalDays: number;
	isCurrent: boolean;
	isPast: boolean;
	/** day within this phase (1-based), only set when isCurrent */
	dayInPhase?: number;
	daysRemaining?: number;
	progressPercent?: number;
};

export type PhaseWithData = CalculatedPhase & {
	dbRecord?: RotationCycle & { checkIns: CycleCheckIn[] };
	checkInCount: number;
	completionPercent: number;
	hasCheckedInToday: boolean;
};

export type TrackerStats = {
	totalOnPhases: number;
	completedOnPhases: number;
	completionRate: number;
	currentStreak: number;
	longestStreak: number;
	totalCheckIns: number;
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Return midnight UTC for a given date, interpreted in local time */
export function toMidnightUTC(d: Date): Date {
	return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Days between two midnight-UTC dates */
function daysBetween(a: Date, b: Date): number {
	return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getTime() + n * 86_400_000);
}

// ── Core rotation calculator ──────────────────────────────────────────────────

/**
 * Return all calculated phases from the tracker's startDate through `upTo` (today by default).
 * Does NOT touch the database.
 */
export function calculatePhases(
	tracker: Pick<RotationTracker, 'startDate' | 'startPhase' | 'onWeeks' | 'offWeeks'>,
	upTo: Date = new Date()
): CalculatedPhase[] {
	const start = toMidnightUTC(new Date(tracker.startDate));
	const today = toMidnightUTC(upTo);
	const totalElapsed = daysBetween(start, today);

	if (totalElapsed < 0) return [];

	const onDays = tracker.onWeeks * 7;
	const offDays = tracker.offWeeks * 7;

	const phases: CalculatedPhase[] = [];
	let cursor = 0; // days from start
	let phaseIndex = 0;
	// Alternate: first phase = startPhase, then flip
	let currentPhaseType: 'ON' | 'OFF' = tracker.startPhase as 'ON' | 'OFF';

	// Generate enough phases to cover totalElapsed days, plus 2 future ones
	while (cursor <= totalElapsed + onDays + offDays) {
		const phaseDays = currentPhaseType === 'ON' ? onDays : offDays;
		const phaseStart = addDays(start, cursor);
		const phaseEnd = addDays(start, cursor + phaseDays - 1);

		const isPast = daysBetween(today, phaseEnd) < 0; // phaseEnd < today
		const isCurrent =
			today.getTime() >= phaseStart.getTime() && today.getTime() <= phaseEnd.getTime();
		const isFuture = phaseStart.getTime() > today.getTime();

		if (isFuture && phases.length > 0) {
			// Only include one upcoming phase for "next phase" info
			if (
				phases[phases.length - 1].isCurrent ||
				(phases[phases.length - 1].isPast && phaseIndex <= totalElapsed / Math.min(onDays, offDays) + 1)
			) {
				// include this upcoming one
			} else {
				break;
			}
		}

		const phase: CalculatedPhase = {
			phaseIndex,
			phase: currentPhaseType,
			startDate: phaseStart,
			endDate: phaseEnd,
			totalDays: phaseDays,
			isCurrent,
			isPast
		};

		if (isCurrent) {
			const dayInPhase = daysBetween(phaseStart, today) + 1;
			phase.dayInPhase = dayInPhase;
			phase.daysRemaining = phaseDays - dayInPhase;
			phase.progressPercent = Math.round((dayInPhase / phaseDays) * 100);
		}

		phases.push(phase);
		cursor += phaseDays;
		phaseIndex++;
		currentPhaseType = currentPhaseType === 'ON' ? 'OFF' : 'ON';
	}

	return phases;
}

/** Just the current active phase (or null if tracker hasn't started yet) */
export function getCurrentPhase(
	tracker: Pick<RotationTracker, 'startDate' | 'startPhase' | 'onWeeks' | 'offWeeks'>
): CalculatedPhase | null {
	const phases = calculatePhases(tracker);
	return phases.find((p) => p.isCurrent) ?? null;
}

/** Next upcoming phase after the current one */
export function getNextPhase(
	tracker: Pick<RotationTracker, 'startDate' | 'startPhase' | 'onWeeks' | 'offWeeks'>
): CalculatedPhase | null {
	const phases = calculatePhases(tracker);
	const currentIdx = phases.findIndex((p) => p.isCurrent);
	if (currentIdx === -1) return phases[0] ?? null;
	return phases[currentIdx + 1] ?? null;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/** Find or create the RotationCycle DB record for a given calculated phase. */
export async function getOrCreateCycleRecord(
	trackerId: string,
	calcPhase: CalculatedPhase
): Promise<RotationCycle> {
	const existing = await prisma.rotationCycle.findUnique({
		where: { trackerId_phaseIndex: { trackerId, phaseIndex: calcPhase.phaseIndex } }
	});
	if (existing) return existing;

	return prisma.rotationCycle.create({
		data: {
			trackerId,
			phaseIndex: calcPhase.phaseIndex,
			phase: calcPhase.phase,
			startDate: calcPhase.startDate,
			endDate: calcPhase.endDate
		}
	});
}

/**
 * Enrich calculated phases with DB check-in data.
 * Also auto-completes any past ON cycles that ended without being marked.
 */
export async function enrichPhasesWithData(
	trackerId: string,
	phases: CalculatedPhase[]
): Promise<PhaseWithData[]> {
	const today = toMidnightUTC(new Date());

	// Load all DB cycles for this tracker
	const dbCycles = (await prisma.rotationCycle.findMany({
		where: { trackerId },
		include: { checkIns: true }
	})) as (RotationCycle & { checkIns: CycleCheckIn[] })[];

	const dbByIndex = new Map(dbCycles.map((c) => [c.phaseIndex, c]));

	// Auto-complete past ON cycles
	const toComplete = dbCycles.filter(
		(c) => !c.isCompleted && c.phase === 'ON' && new Date(c.endDate) < today
	);
	if (toComplete.length > 0) {
		await prisma.rotationCycle.updateMany({
			where: { id: { in: toComplete.map((c) => c.id) } },
			data: { isCompleted: true, completedAt: new Date() }
		});
		toComplete.forEach((c) => {
			c.isCompleted = true;
		});
	}

	return phases.map((phase): PhaseWithData => {
		const dbRecord = dbByIndex.get(phase.phaseIndex) as
			| (RotationCycle & { checkIns: CycleCheckIn[] })
			| undefined;

		const checkInCount = dbRecord?.checkIns.length ?? 0;
		const completionPercent =
			phase.phase === 'ON' ? Math.round((checkInCount / phase.totalDays) * 100) : 100;

		const todayStr = today.toISOString().slice(0, 10);
		const hasCheckedInToday =
			phase.isCurrent &&
			phase.phase === 'ON' &&
			(dbRecord?.checkIns.some(
				(ci: CycleCheckIn) => new Date(ci.date).toISOString().slice(0, 10) === todayStr
			) ??
				false);

		return {
			...phase,
			dbRecord,
			checkInCount,
			completionPercent,
			hasCheckedInToday
		};
	});
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function computeTrackerStats(
	trackerId: string,
	phases: PhaseWithData[]
): Promise<TrackerStats> {
	const onPhases = phases.filter((p) => p.phase === 'ON' && p.isPast);
	const completedOnPhases = onPhases.filter(
		(p) => p.completionPercent >= 80 // ≥80 % check-ins = "completed"
	);

	// Streak: consecutive completed ON phases (most recent first)
	let currentStreak = 0;
	let longestStreak = 0;
	let tmpStreak = 0;
	const reversed = [...onPhases].reverse();
	for (const phase of reversed) {
		if (phase.completionPercent >= 80) {
			tmpStreak++;
			if (currentStreak === 0) currentStreak = tmpStreak;
			longestStreak = Math.max(longestStreak, tmpStreak);
		} else {
			if (currentStreak === 0) currentStreak = 0; // broken before counting
			tmpStreak = 0;
		}
	}

	const totalCheckIns = phases.reduce((sum, p) => sum + p.checkInCount, 0);

	return {
		totalOnPhases: onPhases.length,
		completedOnPhases: completedOnPhases.length,
		completionRate: onPhases.length > 0 ? Math.round((completedOnPhases.length / onPhases.length) * 100) : 0,
		currentStreak,
		longestStreak,
		totalCheckIns
	};
}
