<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const COLORS = [
		'#8B5CF6',
		'#EC4899',
		'#06B6D4',
		'#10B981',
		'#F59E0B',
		'#EF4444',
		'#3B82F6',
		'#84CC16'
	];

	let name = $state('');
	let description = $state('');
	let onWeeks = $state(3);
	let offWeeks = $state(3);
	let startPhase = $state<'ON' | 'OFF'>('ON');
	let startDate = $state(
		(() => {
			const d = new Date();
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		})()
	);
	let color = $state('#8B5CF6');
	let saving = $state(false);
	let error = $state('');

	async function submit() {
		if (!name.trim()) {
			error = 'Name is required.';
			return;
		}
		if (onWeeks < 1 || offWeeks < 1) {
			error = 'Week counts must be at least 1.';
			return;
		}
		error = '';
		saving = true;
		try {
			const res = await fetch('/api/trackers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
					onWeeks,
					offWeeks,
					startPhase,
					startDate,
					color
				})
			});
			if (res.ok) {
				await goto(resolve('/'));
			} else {
				const d = await res.json();
				error = d.error ?? 'Failed to create tracker.';
			}
		} catch {
			error = 'Network error.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="min-h-screen bg-linear-to-br from-slate-950 via-violet-950 to-fuchsia-950">
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
			<h1 class="flex-1 text-base font-semibold text-white">New Tracker</h1>
		</div>
	</header>

	<main class="mx-auto max-w-lg px-4 py-6">
		<div class="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
			<!-- Name -->
			<div>
				<label class="mb-1.5 block text-xs font-semibold text-white/70" for="tName">Name *</label>
				<input
					id="tName"
					type="text"
					bind:value={name}
					maxlength="100"
					placeholder="Tracker name"
					class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none"
				/>
			</div>

			<!-- Description -->
			<div>
				<label class="mb-1.5 block text-xs font-semibold text-white/70" for="tDesc"
					>Description</label
				>
				<input
					id="tDesc"
					type="text"
					bind:value={description}
					maxlength="200"
					placeholder="Optional"
					class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none"
				/>
			</div>

			<!-- ON / OFF weeks -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-white/70" for="tOn">ON weeks</label>
					<input
						id="tOn"
						type="number"
						bind:value={onWeeks}
						min="1"
						max="52"
						class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-fuchsia-400 focus:outline-none"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-white/70" for="tOff"
						>OFF weeks</label
					>
					<input
						id="tOff"
						type="number"
						bind:value={offWeeks}
						min="1"
						max="52"
						class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-fuchsia-400 focus:outline-none"
					/>
				</div>
			</div>

			<!-- Start date / Start phase -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-white/70" for="tDate"
						>Start date</label
					>
					<input
						id="tDate"
						type="date"
						bind:value={startDate}
						class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white scheme-dark focus:border-fuchsia-400 focus:outline-none"
					/>
				</div>
				<div>
					<p class="mb-1.5 text-xs font-semibold text-white/70">Start phase</p>
					<div class="flex gap-2 pt-0.5">
						<button
							onclick={() => (startPhase = 'ON')}
							class="flex-1 rounded-xl py-2.5 text-xs font-bold {startPhase === 'ON'
								? 'bg-emerald-500 text-white'
								: 'bg-white/10 text-white/50 hover:bg-white/20'}">ON</button
						>
						<button
							onclick={() => (startPhase = 'OFF')}
							class="flex-1 rounded-xl py-2.5 text-xs font-bold {startPhase === 'OFF'
								? 'bg-slate-500 text-white'
								: 'bg-white/10 text-white/50 hover:bg-white/20'}">OFF</button
						>
					</div>
				</div>
			</div>

			<!-- Color -->
			<div>
				<p class="mb-2 text-xs font-semibold text-white/70">Color</p>
				<div class="flex flex-wrap gap-2">
					{#each COLORS as c (c)}
						<button
							onclick={() => (color = c)}
							style="background:{c}"
							aria-label={c}
							class="h-7 w-7 rounded-full transition {color === c
								? 'scale-110 ring-2 ring-white ring-offset-1 ring-offset-transparent'
								: ''}"
						></button>
					{/each}
				</div>
			</div>

			<!-- Color preview -->
			{#if name.trim()}
				<div class="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-4 py-3">
					<div class="h-3 w-3 shrink-0 rounded-full" style="background:{color}"></div>
					<span class="text-sm font-semibold text-white">{name.trim()}</span>
					<span class="ml-auto text-xs text-white/40">{onWeeks}w ON / {offWeeks}w OFF</span>
				</div>
			{/if}

			{#if error}<p class="text-xs text-red-300">{error}</p>{/if}

			<button
				onclick={submit}
				disabled={saving}
				class="w-full rounded-xl bg-fuchsia-500 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-600 active:scale-95 disabled:opacity-50"
			>
				{saving ? 'Creating…' : 'Create tracker'}
			</button>
		</div>
	</main>
</div>
