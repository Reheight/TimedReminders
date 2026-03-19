<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data } = $props();

	function fmt(iso: string) {
		return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="min-h-screen bg-linear-to-br from-slate-950 via-violet-950 to-fuchsia-950">
	<header class="sticky top-0 z-10 border-b border-white/8 bg-black/30 backdrop-blur">
		<div class="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
			<a href={resolve('/')} aria-label="Back" class="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="flex-1 text-base font-semibold text-white">About</h1>
		</div>
	</header>

	<main class="mx-auto max-w-lg space-y-6 px-4 py-6">

		<!-- App info card -->
		<section class="rounded-2xl border border-white/10 bg-white/5 p-5">
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-fuchsia-500/20">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
				</div>
				<div>
					<h2 class="text-base font-bold text-white">Rotation Tracker</h2>
					<p class="text-xs text-white/50">Track on/off rotation schedules</p>
				</div>
			</div>
			<p class="mt-4 text-sm text-white/60 leading-relaxed">
				Keep track of repeating on/off rotation schedules — see exactly where you are in each cycle, log daily check-ins, and view progress over time.
			</p>
		</section>

		<!-- Per-tracker status indicators -->
		{#if data.trackers.length > 0}
			<section>
				<h2 class="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-white/40">Current Status</h2>
				<div class="space-y-4">
					{#each data.trackers as t (t.id)}
						{@const isOn = t.current?.phase === 'ON'}
						<div class="rounded-2xl border border-white/10 bg-white/5 p-5">

							<!-- Tracker name + phase badge -->
							<div class="mb-4 flex items-center justify-between gap-3">
								<div class="flex min-w-0 items-center gap-2">
									<div class="h-3 w-3 shrink-0 rounded-full" style="background:{t.color}"></div>
									<span class="truncate font-semibold text-white">{t.name}</span>
								</div>
								{#if t.current}
									<span class="shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider {isOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}">
										{t.current.phase}
									</span>
								{:else}
									<span class="shrink-0 rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-yellow-400">
										Not started
									</span>
								{/if}
							</div>

							<!-- Indicator row -->
							<div class="mb-4 grid grid-cols-3 gap-3">
								<!-- Day in phase -->
								<div class="rounded-xl bg-white/5 px-3 py-2.5 text-center">
									<p class="text-lg font-bold text-white">
										{t.current?.dayInPhase ?? '—'}
									</p>
									<p class="text-xs text-white/40">Day</p>
								</div>
								<!-- Days remaining -->
								<div class="rounded-xl bg-white/5 px-3 py-2.5 text-center">
									<p class="text-lg font-bold text-white">
										{t.current?.daysRemaining ?? '—'}
									</p>
									<p class="text-xs text-white/40">Remaining</p>
								</div>
								<!-- Week in cycle + even/odd -->
								<div class="rounded-xl bg-white/5 px-3 py-2.5 text-center">
									<p class="text-lg font-bold text-white">
										W{t.weekInCycle}
										<span class="text-xs font-semibold {t.isEvenWeek ? 'text-sky-400' : 'text-violet-400'}">
											{t.isEvenWeek ? 'E' : 'O'}
										</span>
									</p>
									<p class="text-xs text-white/40">of {t.cycleWeeks}w cycle</p>
								</div>
							</div>

							<!-- Progress bar -->
							{#if t.current}
								<div class="mb-3">
									<div class="mb-1 flex justify-between text-xs text-white/40">
										<span>Phase progress</span>
										<span>{t.current.progressPercent ?? 0}%</span>
									</div>
									<div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
										<div
											class="h-full rounded-full transition-all {isOn ? 'bg-emerald-400' : 'bg-slate-400'}"
											style="width:{t.current.progressPercent ?? 0}%"
										></div>
									</div>
								</div>
								<p class="text-xs text-white/40">
									Phase ends <span class="text-white/60">{fmt(t.current.endDate)}</span>
								</p>
							{/if}

							<!-- Next phase -->
							{#if t.next}
								<p class="mt-2 text-xs text-white/40">
									Next: <span class="font-semibold {t.next.phase === 'ON' ? 'text-emerald-400' : 'text-slate-400'}">{t.next.phase}</span>
									starts <span class="text-white/60">{fmt(t.next.startDate)}</span>
									<span class="text-white/30">({t.next.totalDays} days)</span>
								</p>
							{/if}

							<!-- Stats row -->
							<div class="mt-4 flex items-center gap-4 border-t border-white/8 pt-4 text-xs text-white/40">
								<span><span class="font-semibold text-white/70">{t.stats.completionRate}%</span> completion</span>
								<span><span class="font-semibold text-white/70">{t.stats.currentStreak}</span> day streak</span>
								<span><span class="font-semibold text-white/70">{t.stats.totalCheckIns}</span> check-ins</span>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<!-- Legend -->
			<section class="rounded-2xl border border-white/10 bg-white/5 p-5">
				<h2 class="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Indicators</h2>
				<div class="space-y-2 text-sm text-white/60">
					<div class="flex items-center gap-3">
						<span class="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">ON</span>
						<span>Active / working phase</span>
					</div>
					<div class="flex items-center gap-3">
						<span class="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-xs font-bold text-slate-400">OFF</span>
						<span>Rest / off phase</span>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-xs font-semibold text-sky-400">E</span>
						<span>Even-numbered week in the rotation cycle</span>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-xs font-semibold text-violet-400">O</span>
						<span>Odd-numbered week in the rotation cycle</span>
					</div>
				</div>
			</section>
		{:else}
			<div class="mt-8 flex flex-col items-center gap-3 text-center">
				<p class="text-sm text-white/40">No trackers set up yet.</p>
				<a href={resolve('/settings')} class="rounded-xl bg-fuchsia-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-fuchsia-600">
					Add tracker
				</a>
			</div>
		{/if}
	</main>
</div>
