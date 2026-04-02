<script lang="ts">
	import ProgressRing from '$lib/components/ProgressRing.svelte';
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';

	let { data } = $props();

	const tracker = $derived(data.tracker);
	const stats = $derived(data.stats);
	const phases = $derived(data.phases);

	// Use server value as SSR fallback; overridden client-side on mount
	let todayISO = $state(untrack(() => data.todayISO));
	onMount(() => {
		const d = new Date();
		todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	});

	const currentPhaseBase = $derived(phases.find((p) => p.isCurrent));
	// Re-derive day counts and check-in status using the client's local todayISO
	const currentPhase = $derived.by(() => {
		if (!currentPhaseBase) return currentPhaseBase;
		const phaseStart = new Date(currentPhaseBase.startDate.slice(0, 10) + 'T00:00:00Z');
		const todayDate = new Date(todayISO + 'T00:00:00Z');
		const diff = Math.round((todayDate.getTime() - phaseStart.getTime()) / 86_400_000);
		const dayInPhase = Math.max(1, diff + 1);
		return {
			...currentPhaseBase,
			dayInPhase,
			daysRemaining: currentPhaseBase.totalDays - dayInPhase,
			progressPercent: Math.round((dayInPhase / currentPhaseBase.totalDays) * 100),
			hasCheckedInToday: currentPhaseBase.checkInDates.includes(todayISO)
		};
	});
	const pastPhases = $derived([...phases].filter((p) => p.isPast).reverse());

	async function toggleCheckin(phaseIndex: number, date: string) {
		const phase = phases.find((p) => p.phaseIndex === phaseIndex);
		if (!phase || phase.phase !== 'ON') return;

		const alreadyIn = phase.checkInDates.includes(date);
		const res = await fetch(`/api/trackers/${tracker.id}/checkin`, {
			method: alreadyIn ? 'DELETE' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ date, phaseIndex })
		});
		if (!res.ok) return;

		await invalidate('app:checkins');
	}

	function fmt(iso: string) {
		return new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
	function fmtFull(iso: string) {
		return new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	/** Build an array of date strings (YYYY-MM-DD) between two ISO dates inclusive */
	function dateRange(startISO: string, endISO: string): string[] {
		const out: string[] = [];
		let ms = new Date(startISO + 'T00:00:00Z').getTime();
		const endMs = new Date(endISO + 'T00:00:00Z').getTime();
		while (ms <= endMs) {
			out.push(new Date(ms).toISOString().slice(0, 10));
			ms += 86_400_000;
		}
		return out;
	}
</script>

<div class="min-h-screen bg-linear-to-br from-slate-950 via-violet-950 to-fuchsia-950">
	<!-- Header -->
	<header class="sticky top-0 z-10 border-b border-white/8 bg-black/30 backdrop-blur">
		<div class="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
			<a
				href={resolve('/')}
				aria-label="Back"
				class="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<div class="h-3 w-3 shrink-0 rounded-full" style="background:{tracker.color}"></div>
				<h1 class="truncate text-base font-semibold text-white">{tracker.name}</h1>
			</div>
			<a href={resolve('/settings')} class="shrink-0 text-xs text-white/40 hover:text-white/70"
				>Settings</a
			>
		</div>
	</header>

	<main class="mx-auto max-w-lg space-y-5 px-4 py-6">
		<!-- Current phase hero -->
		{#if currentPhase}
			<div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
				<div class="flex items-center gap-5">
					<div class="relative shrink-0">
						<ProgressRing
							percent={currentPhase.progressPercent ?? 0}
							size={96}
							stroke={8}
							color={currentPhase.phase === 'ON' ? '#10b981' : '#64748b'}
							trackColor="rgba(255,255,255,0.08)"
						/>
						<span
							class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold text-white"
						>
							{currentPhase.progressPercent ?? 0}%
						</span>
					</div>
					<div class="min-w-0 flex-1">
						<div class="mb-1 flex items-center gap-2">
							<span
								class="rounded-full px-3 py-0.5 text-xs font-bold uppercase {currentPhase.phase ===
								'ON'
									? 'bg-emerald-500/20 text-emerald-400'
									: 'bg-slate-500/20 text-slate-400'}"
							>
								{currentPhase.phase}
							</span>
						</div>
						<p class="text-lg font-bold text-white">
							Day {currentPhase.dayInPhase} of {currentPhase.totalDays}
						</p>
						<p class="text-sm text-white/60">
							{currentPhase.daysRemaining}
							{currentPhase.daysRemaining === 1 ? 'day' : 'days'} remaining
						</p>
						<p class="mt-1 text-xs text-white/40">
							{fmt(currentPhase.startDate)} – {fmt(currentPhase.endDate)}
						</p>
					</div>
				</div>

				{#if currentPhase.phase === 'ON'}
					<button
						onclick={() => toggleCheckin(currentPhase.phaseIndex, todayISO)}
						class="mt-5 w-full rounded-xl py-3 text-sm font-bold transition active:scale-95 {currentPhase.hasCheckedInToday
							? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
							: 'bg-emerald-500 text-white hover:bg-emerald-600'}"
					>
						{currentPhase.hasCheckedInToday ? '✓ Checked in today' : 'Check in for today'}
					</button>
				{:else}
					<div class="mt-5 rounded-xl bg-slate-500/10 py-3 text-center text-sm text-slate-400">
						OFF phase — rest up 🌙
					</div>
				{/if}
			</div>
		{/if}

		<!-- Stats row -->
		<div class="grid grid-cols-3 gap-3">
			{#each [{ label: 'Completion', value: stats.completionRate + '%', sub: stats.completedOnPhases + '/' + stats.totalOnPhases + ' ON phases' }, { label: 'Streak', value: stats.currentStreak + '', sub: 'current streak' }, { label: 'Check-ins', value: stats.totalCheckIns + '', sub: 'total days' }] as card (card.label)}
				<div class="rounded-xl border border-white/8 bg-white/4 px-3 py-4 text-center">
					<p class="text-xl font-bold text-white">{card.value}</p>
					<p class="mt-0.5 text-xs font-semibold text-white/50">{card.label}</p>
					<p class="mt-0.5 text-xs text-white/30">{card.sub}</p>
				</div>
			{/each}
		</div>

		<!-- Rotation schedule info -->
		<div class="rounded-2xl border border-white/10 bg-white/5 p-4">
			<h2 class="mb-3 text-xs font-bold tracking-wider text-white/50 uppercase">Schedule</h2>
			<div class="grid grid-cols-3 gap-3 text-center">
				<div>
					<p class="text-lg font-bold text-emerald-400">{tracker.onWeeks}w</p>
					<p class="text-xs text-white/50">ON phase</p>
				</div>
				<div class="flex items-center justify-center">
					<div class="text-white/20">⟷</div>
				</div>
				<div>
					<p class="text-lg font-bold text-slate-400">{tracker.offWeeks}w</p>
					<p class="text-xs text-white/50">OFF phase</p>
				</div>
			</div>
			<p class="mt-3 text-center text-xs text-white/30">
				Started {fmtFull(tracker.startDate)} · first phase: {tracker.startPhase}
			</p>
		</div>

		<!-- Current phase calendar -->
		{#if currentPhase && currentPhase.phase === 'OFF'}
			{@const dates = dateRange(
				currentPhase.startDate.slice(0, 10),
				currentPhase.endDate.slice(0, 10)
			)}
			{@const nextOnStart = (() => {
				const ms =
					new Date(currentPhase.endDate.slice(0, 10) + 'T00:00:00Z').getTime() + 86_400_000;
				return new Date(ms).toISOString().slice(0, 10);
			})()}
			<div class="rounded-2xl border border-white/10 bg-white/5 p-5">
				<h2 class="mb-4 text-xs font-bold tracking-wider text-white/50 uppercase">
					Rest period
				</h2>
				<div class="flex flex-wrap gap-2">
					{#each dates as d (d)}
						{@const isToday = d === todayISO}
						{@const isPast = d < todayISO}
						{@const day = new Date(d + 'T12:00:00Z')}
						<div
							title={day.toLocaleDateString('en-US', {
								weekday: 'short',
								month: 'short',
								day: 'numeric'
							})}
							class="flex h-10 w-10 flex-col items-center justify-center rounded-xl text-xs font-semibold
								{isToday
								? 'bg-slate-500/30 text-slate-200 ring-2 ring-slate-400'
								: isPast
									? 'bg-slate-500/20 text-slate-400'
									: 'bg-white/5 text-white/20'}"
						>
							<span class="text-xs">{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
							<span>{day.getUTCDate()}</span>
						</div>
					{/each}
				</div>
				<p class="mt-3 text-xs text-white/30">
					{currentPhase.daysRemaining}
					{currentPhase.daysRemaining === 1 ? 'day' : 'days'} remaining · next ON phase starts {fmt(nextOnStart)}
				</p>
			</div>
		{:else if currentPhase && currentPhase.phase === 'ON'}
			{@const dates = dateRange(
				currentPhase.startDate.slice(0, 10),
				currentPhase.endDate.slice(0, 10)
			)}
			<div class="rounded-2xl border border-white/10 bg-white/5 p-5">
				<h2 class="mb-4 text-xs font-bold tracking-wider text-white/50 uppercase">
					Current phase — check-ins
				</h2>
				<div class="flex flex-wrap gap-2">
					{#each dates as d (d)}
						{@const isToday = d === todayISO}
						{@const checkedIn = currentPhase.checkInDates.includes(d)}
						{@const isFuture = d > todayISO}
						{@const day = new Date(d + 'T12:00:00Z')}
						<button
							onclick={() => !isFuture && toggleCheckin(currentPhase.phaseIndex, d)}
							disabled={isFuture}
							title={new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
								weekday: 'short',
								month: 'short',
								day: 'numeric'
							})}
							class="flex h-10 w-10 flex-col items-center justify-center rounded-xl text-xs font-semibold transition
								{isToday ? 'ring-2 ring-white' : ''}
								{checkedIn
								? 'bg-emerald-500 text-white'
								: isFuture
									? 'bg-white/5 text-white/20'
									: 'bg-white/10 text-white/60 hover:bg-white/20'}"
						>
							<span class="text-xs">{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
							<span>{day.getUTCDate()}</span>
						</button>
					{/each}
				</div>
				<p class="mt-3 text-xs text-white/30">
					{currentPhase.checkInCount} / {currentPhase.totalDays} days checked in ({currentPhase.completionPercent}%)
				</p>
			</div>
		{/if}

		<!-- Phase history -->
		{#if pastPhases.length > 0}
			<div class="rounded-2xl border border-white/10 bg-white/5 p-5">
				<h2 class="mb-4 text-xs font-bold tracking-wider text-white/50 uppercase">History</h2>
				<div class="space-y-3">
					{#each pastPhases as p (p.phaseIndex)}
						<div class="rounded-xl bg-white/5 px-4 py-3">
							<div class="flex items-center justify-between gap-3">
								<div class="flex items-center gap-2.5">
									<span
										class="rounded-md px-2 py-0.5 text-xs font-bold {p.phase === 'ON'
											? 'bg-emerald-500/15 text-emerald-400'
											: 'bg-slate-500/15 text-slate-400'}"
									>
										{p.phase}
									</span>
									<span class="text-sm text-white/70">{fmt(p.startDate)} – {fmt(p.endDate)}</span>
								</div>
								{#if p.phase === 'ON'}
									<span
										class="text-sm font-semibold {p.completionPercent >= 80
											? 'text-emerald-400'
											: p.completionPercent >= 50
												? 'text-yellow-400'
												: 'text-red-400'}"
									>
										{p.completionPercent}%
									</span>
								{:else}
									<span class="text-xs text-white/30">—</span>
								{/if}
							</div>
							{#if p.phase === 'ON'}
								<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
									<div
										class="h-full rounded-full {p.completionPercent >= 80
											? 'bg-emerald-500'
											: p.completionPercent >= 50
												? 'bg-yellow-500'
												: 'bg-red-500'}"
										style="width:{p.completionPercent}%"
									></div>
								</div>
								<p class="mt-1 text-xs text-white/30">{p.checkInCount} / {p.totalDays} days</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</main>
</div>
