<script lang="ts">
	import ProgressRing from './ProgressRing.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	type Phase = {
		phase: 'ON' | 'OFF';
		isCurrent: boolean;
		isPast: boolean;
		dayInPhase?: number | null;
		daysRemaining?: number | null;
		progressPercent?: number | null;
		totalDays: number;
		startDate: Date | string;
		endDate: Date | string;
		checkInCount: number;
		completionPercent: number;
		hasCheckedInToday: boolean;
		checkInDates?: string[];
	};

	type Tracker = {
		id: string;
		name: string;
		color: string;
		description?: string | null;
		currentPhase: Phase | null;
	};

	let { tracker, onCheckin }: { tracker: Tracker; onCheckin?: (id: string) => void } = $props();

	let checking = $state(false);
	let _todayISO = $state(todayStr());
	onMount(() => {
		_todayISO = todayStr();
	});

	const phase = $derived(tracker.currentPhase);
	const isOn = $derived(phase?.phase === 'ON');
	// Override hasCheckedInToday using the browser's local date to avoid server timezone mismatch
	const hasCheckedInToday = $derived(
		phase?.checkInDates
			? phase.checkInDates.includes(_todayISO)
			: (phase?.hasCheckedInToday ?? false)
	);

	// Recompute day counts from browser's local date so server timezone doesn't skew them
	const dayInPhase = $derived.by(() => {
		if (!phase?.startDate) return phase?.dayInPhase ?? null;
		const phaseStart = new Date(
			typeof phase.startDate === 'string'
				? phase.startDate.slice(0, 10) + 'T00:00:00Z'
				: phase.startDate.toISOString().slice(0, 10) + 'T00:00:00Z'
		);
		const todayDate = new Date(_todayISO + 'T00:00:00Z');
		const diff = Math.round((todayDate.getTime() - phaseStart.getTime()) / 86_400_000);
		return Math.max(1, diff + 1);
	});
	const daysRemaining = $derived(phase ? phase.totalDays - (dayInPhase ?? 0) : null);
	const pct = $derived(phase && dayInPhase ? Math.round((dayInPhase / phase.totalDays) * 100) : 0);

	async function doCheckin() {
		if (!phase || !isOn || checking) return;
		checking = true;
		try {
			const res = await fetch(`/api/trackers/${tracker.id}/checkin`, {
				method: hasCheckedInToday ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ date: todayStr() })
			});
			if (res.ok) onCheckin?.(tracker.id);
		} finally {
			checking = false;
		}
	}

	function todayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function fmt(d: Date | string) {
		const s = typeof d === 'string' ? d : d.toISOString();
		return new Date(s.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<a
	href={resolve('/tracker/[id]', { id: String(tracker.id) })}
	class="group block rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:bg-white/8"
>
	<!-- Header row -->
	<div class="mb-4 flex items-start justify-between gap-3">
		<div class="min-w-0">
			<div class="mb-0.5 flex items-center gap-2">
				<div class="h-3 w-3 shrink-0 rounded-full" style="background:{tracker.color}"></div>
				<h3 class="truncate text-base font-semibold text-white">{tracker.name}</h3>
			</div>
			{#if tracker.description}
				<p class="truncate text-xs text-white/50">{tracker.description}</p>
			{/if}
		</div>

		<!-- Phase badge -->
		{#if phase}
			<span
				class="shrink-0 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase {isOn
					? 'bg-emerald-500/20 text-emerald-400'
					: 'bg-slate-500/20 text-slate-400'}"
			>
				{phase.phase}
			</span>
		{:else}
			<span
				class="shrink-0 rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-bold tracking-wider text-yellow-400 uppercase"
			>
				Not started
			</span>
		{/if}
	</div>

	{#if phase}
		<!-- Progress row -->
		<div class="mb-4 flex items-center gap-4">
			<div class="relative shrink-0">
				<ProgressRing
					percent={pct}
					size={64}
					stroke={6}
					color={isOn ? '#10b981' : '#64748b'}
					trackColor="rgba(255,255,255,0.08)"
				/>
				<span
					class="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-white"
				>
					{pct}%
				</span>
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-sm text-white/80">
					Day <strong class="text-white">{dayInPhase}</strong> of
					<strong class="text-white">{phase.totalDays}</strong>
				</p>
				<p class="text-xs text-white/50">
					{daysRemaining}
					{daysRemaining === 1 ? 'day' : 'days'} remaining
				</p>
				<p class="mt-0.5 text-xs text-white/40">
					{fmt(phase.startDate)} – {fmt(phase.endDate)}
				</p>
			</div>
		</div>

		<!-- Progress bar -->
		<div class="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
			<div
				class="h-full rounded-full transition-all duration-500 {isOn
					? 'bg-emerald-500'
					: 'bg-slate-500'}"
				style="width:{pct}%"
			></div>
		</div>

		<!-- Check-in button (ON phase only) -->
		{#if isOn}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				onclick={(e) => {
					e.preventDefault();
					doCheckin();
				}}
			>
				<button
					class="w-full rounded-xl py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-50 {hasCheckedInToday
						? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
						: 'bg-emerald-500 text-white hover:bg-emerald-600'}"
					disabled={checking}
					onclick={(e) => {
						e.preventDefault();
						doCheckin();
					}}
				>
					{#if checking}
						<span class="inline-flex items-center gap-1.5">
							<div
								class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
							></div>
							Saving…
						</span>
					{:else if hasCheckedInToday}
						✓ Checked in today
					{:else}
						Check in for today
					{/if}
				</button>
			</div>
		{:else}
			<div class="rounded-xl bg-slate-500/10 py-2.5 text-center text-sm text-slate-400">
				OFF phase — rest up!
			</div>
		{/if}
	{:else}
		<div class="rounded-xl bg-white/5 py-3 text-center text-sm text-white/40">
			Tap to view details
		</div>
	{/if}
</a>
