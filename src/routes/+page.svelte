<script lang="ts">
	import TrackerCard from '$lib/components/TrackerCard.svelte';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data } = $props();
	type TrackerItem = PageData['trackers'][number];

	let trackers = $state<TrackerItem[]>(untrack(() => data.trackers));

	async function refreshTracker(id: string) {
		// Re-fetch a single tracker's current phase after a check-in
		const res = await fetch(`/api/trackers/${id}`);
		if (!res.ok) return;
		const updated = await res.json();
		trackers = trackers.map((t: TrackerItem) => (t.id === id ? { ...t, ...updated } : t));
	}
</script>

<div class="min-h-screen bg-linear-to-br from-slate-950 via-violet-950 to-fuchsia-950">
	<!-- Nav bar -->
	<header class="sticky top-0 z-10 border-b border-white/8 bg-black/30 backdrop-blur">
		<div class="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
			<div class="flex items-center gap-2.5">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/20">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 text-fuchsia-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				</div>
				<span class="font-semibold text-white">Rotation Tracker</span>
			</div>
			<div class="flex items-center gap-2">
				<a
					href={resolve('/about')}
					class="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
					aria-label="About"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</a>
				<a
					href={resolve('/settings')}
					class="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
					aria-label="Settings"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-lg px-4 py-6">
		{#if trackers.length === 0}
			<!-- Empty state -->
			<div class="mt-12 flex flex-col items-center gap-4 text-center">
				<div class="flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-10 w-10 text-white/30"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-lg font-semibold text-white">No trackers yet</h2>
					<p class="mt-1 text-sm text-white/50">Add a rotation tracker to get started.</p>
				</div>
				<a
					href={resolve('/trackers/new')}
					class="rounded-xl bg-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-fuchsia-600"
				>
					Add tracker
				</a>
			</div>
		{:else}
			<!-- Tracker grid -->
			<div class="space-y-4">
				{#each trackers as tracker (tracker.id)}
					<TrackerCard {tracker} onCheckin={refreshTracker} />
				{/each}
			</div>

			<!-- Add tracker button -->
			<div class="mt-6">
				<a
					href={resolve('/trackers/new')}
					class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 py-4 text-sm font-semibold text-white/40 transition hover:border-fuchsia-400/40 hover:text-fuchsia-400"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
					Add another tracker
				</a>
			</div>
		{/if}
	</main>
</div>
