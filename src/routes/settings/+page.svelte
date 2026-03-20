<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data } = $props();
	type TrackerItem = PageData['trackers'][number];

	// ── App settings state ────────────────────────────────────────────────────
	let appName = $state(untrack(() => data.appName));
	let sessionHours = $state(untrack(() => data.sessionHours));
	let lockOnClose = $state(untrack(() => data.lockOnClose));
	let savingApp = $state(false);
	let appSaved = $state(false);
	let appError = $state('');

	// ── PIN change state ──────────────────────────────────────────────────────
	let showPinChange = $state(false);
	let newPin = $state('');
	let confirmPin = $state('');
	let pinStep = $state<'set' | 'confirm'>('set');
	let pinLength = $state(untrack(() => data.pinLength));
	let savingPin = $state(false);
	let pinError = $state('');
	let pinSaved = $state(false);

	const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'] as const;

	// ── Add tracker state ─────────────────────────────────────────────────────
	let showAddTracker = $state(false);
	let tName = $state('');
	let tDesc = $state('');
	let tOnWeeks = $state(3);
	let tOffWeeks = $state(3);
	let tStartPhase = $state<'ON' | 'OFF'>('ON');
	let tStartDate = $state(todayISO());
	let tColor = $state('#8B5CF6');
	let savingTracker = $state(false);
	let trackerError = $state('');

	let trackers = $state<TrackerItem[]>(untrack(() => data.trackers));

	const COLORS = ['#8B5CF6','#EC4899','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#84CC16'];

	function todayISO() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	}

	// PIN pad
	function pressPin(key: string) {
		const cur = pinStep === 'set' ? newPin : confirmPin;
		if (key === 'del') { if (pinStep === 'set') newPin = newPin.slice(0,-1); else confirmPin = confirmPin.slice(0,-1); return; }
		if (key === 'clr') { if (pinStep === 'set') newPin = ''; else confirmPin = ''; return; }
		if (cur.length < pinLength) { if (pinStep === 'set') newPin += key; else confirmPin += key; }
	}

	$effect(() => {
		const cur = pinStep === 'set' ? newPin : confirmPin;
		if (cur.length !== pinLength) return;
		if (pinStep === 'set') { pinStep = 'confirm'; pinError = ''; }
		else {
			if (newPin !== confirmPin) { pinError = 'PINs do not match. Try again.'; newPin = ''; confirmPin = ''; pinStep = 'set'; }
			else { pinError = ''; doSavePin(); }
		}
	});

	async function saveAppSettings() {
		if (!appName.trim()) { appError = 'App name is required.'; return; }
		appError = ''; savingApp = true; appSaved = false;
		try {
			const res = await fetch('/api/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ appName: appName.trim(), sessionHours, lockOnClose })
			});
			if (res.ok) { appSaved = true; setTimeout(() => appSaved = false, 2500); }
			else { const d = await res.json(); appError = d.error ?? 'Failed to save.'; }
		} catch { appError = 'Network error.'; }
		finally { savingApp = false; }
	}

	async function doSavePin() {
		savingPin = true; pinSaved = false;
		try {
			const res = await fetch('/api/config/pin', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pin: newPin, pinLength })
			});
			if (res.ok) { pinSaved = true; showPinChange = false; newPin = ''; confirmPin = ''; pinStep = 'set'; setTimeout(() => pinSaved = false, 2500); }
			else { const d = await res.json(); pinError = d.error ?? 'Failed to update PIN.'; newPin = ''; confirmPin = ''; pinStep = 'set'; }
		} catch { pinError = 'Network error.'; newPin = ''; confirmPin = ''; pinStep = 'set'; }
		finally { savingPin = false; }
	}

	async function addTracker() {
		if (!tName.trim()) { trackerError = 'Name is required.'; return; }
		if (tOnWeeks < 1 || tOffWeeks < 1) { trackerError = 'Week counts must be at least 1.'; return; }
		trackerError = ''; savingTracker = true;
		try {
			const res = await fetch('/api/trackers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: tName.trim(), description: tDesc.trim() || null, onWeeks: tOnWeeks, offWeeks: tOffWeeks, startPhase: tStartPhase, startDate: tStartDate, color: tColor })
			});
			if (res.ok) {
				const t = await res.json();
				trackers = [...trackers, t];
				showAddTracker = false;
				tName = ''; tDesc = ''; tOnWeeks = 3; tOffWeeks = 3; tStartPhase = 'ON'; tStartDate = todayISO(); tColor = '#8B5CF6';
			} else { const d = await res.json(); trackerError = d.error ?? 'Failed to create tracker.'; }
		} catch { trackerError = 'Network error.'; }
		finally { savingTracker = false; }
	}

	async function deleteTracker(id: string) {
		if (!confirm('Delete this tracker and all its data? This cannot be undone.')) return;
		const res = await fetch(`/api/trackers/${id}`, { method: 'DELETE' });
		if (res.ok) trackers = trackers.filter((t: TrackerItem) => t.id !== id);
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/';
	}

	const curPinDisplay = $derived(pinStep === 'set' ? newPin : confirmPin);
</script>

<div class="safe-bottom min-h-screen bg-linear-to-br from-slate-950 via-violet-950 to-fuchsia-950">
	<!-- Header -->
	<header class="sticky top-0 z-10 border-b border-white/8 bg-black/30 backdrop-blur">
		<div class="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
			<a href={resolve('/')} aria-label="Back" class="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<h1 class="flex-1 text-base font-semibold text-white">Settings</h1>
		</div>
	</header>

	<main class="mx-auto max-w-lg space-y-6 px-4 py-6">

		<!-- App settings -->
		<section class="rounded-2xl border border-white/10 bg-white/5 p-5">
			<h2 class="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">App Settings</h2>
			<div class="space-y-4">
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-white/70" for="appNameInput">App name</label>
					<input id="appNameInput" type="text" bind:value={appName} maxlength="50" class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none" />
				</div>
				<div>
					<label class="mb-1.5 block text-xs font-semibold text-white/70" for="sessHours">Session duration</label>
					<select id="sessHours" bind:value={sessionHours} class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-fuchsia-400 focus:outline-none scheme-dark">
						<option value={1}>1 hour</option>
						<option value={4}>4 hours</option>
						<option value={8}>8 hours</option>
						<option value={24}>24 hours</option>
						<option value={72}>3 days</option>
						<option value={168}>1 week</option>
					</select>
				</div>
				<label class="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/10 px-4 py-3">
					<span class="text-sm text-white/80">Lock when browser closes</span>
					<input type="checkbox" bind:checked={lockOnClose} class="h-4 w-4 rounded accent-fuchsia-500" />
				</label>
			</div>
			{#if appError}<p class="mt-2 text-xs text-red-300">{appError}</p>{/if}
			<button onclick={saveAppSettings} disabled={savingApp} class="mt-4 w-full rounded-xl bg-fuchsia-500 py-2.5 text-sm font-bold text-white transition hover:bg-fuchsia-600 active:scale-95 disabled:opacity-50">
				{savingApp ? 'Saving…' : appSaved ? '✓ Saved' : 'Save settings'}
			</button>
		</section>

		<!-- PIN settings -->
		<section class="rounded-2xl border border-white/10 bg-white/5 p-5">
			<h2 class="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">Security</h2>
			{#if pinSaved}
				<p class="mb-3 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">✓ PIN updated successfully</p>
			{/if}
			{#if !showPinChange}
				<button onclick={() => { showPinChange = true; newPin = ''; confirmPin = ''; pinStep = 'set'; pinError = ''; }} class="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10">
					Change PIN
				</button>
			{:else}
				<div class="rounded-xl border border-white/10 bg-white/5 p-4">
					<p class="mb-3 text-center text-sm font-semibold text-white">{pinStep === 'set' ? 'Enter new PIN' : 'Confirm new PIN'}</p>

					<!-- PIN length -->
					{#if pinStep === 'set'}
						<div class="mb-4 flex items-center justify-center gap-2">
							<span class="text-xs text-white/50">Length:</span>
							{#each [4,5,6] as n (n)}
								<button onclick={() => { pinLength = n; newPin = ''; }} class="rounded-lg px-3 py-1 text-xs font-semibold {pinLength === n ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}">{n}</button>
							{/each}
						</div>
					{/if}

					<div class="mb-4 flex justify-center gap-3">
					{#each Array.from({ length: pinLength }, (_, i) => i) as i (i)}
							<div class="h-4 w-4 rounded-full border-2 transition-all {curPinDisplay.length > i ? 'border-fuchsia-400 bg-fuchsia-400 scale-110' : 'border-white/30'}"></div>
						{/each}
					</div>
					{#if pinError}<p class="mb-3 text-center text-xs text-red-300">{pinError}</p>{/if}

					<div class="grid grid-cols-3 gap-2 place-items-center">
					{#each PAD as key (key)}
						{#if key === 'clr'}
							<button onclick={() => pressPin('clr')} aria-label="Clear" class="flex h-12 w-12 items-center justify-center rounded-full text-purple-300 active:scale-95">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
								</button>
							{:else if key === 'del'}
							<button onclick={() => pressPin('del')} aria-label="Delete" class="flex h-12 w-12 items-center justify-center rounded-full text-purple-300 active:scale-95">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>
								</button>
							{:else}
								<button onclick={() => pressPin(key)} class="h-12 w-12 rounded-full bg-white/10 text-base font-semibold text-white hover:bg-white/20 active:scale-95">{key}</button>
							{/if}
						{/each}
					</div>
					{#if savingPin}<p class="mt-3 text-center text-xs text-purple-300">Saving…</p>{/if}
					<button onclick={() => { showPinChange = false; pinError = ''; }} class="mt-3 w-full text-center text-xs text-white/40 hover:text-white/60">Cancel</button>
				</div>
			{/if}
		</section>

		<!-- Trackers -->
		<section id="add-tracker" class="rounded-2xl border border-white/10 bg-white/5 p-5">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-sm font-bold uppercase tracking-wider text-white/50">Trackers</h2>
				<button onclick={() => { showAddTracker = !showAddTracker; trackerError = ''; }} class="rounded-lg bg-fuchsia-500/20 px-3 py-1 text-xs font-bold text-fuchsia-400 transition hover:bg-fuchsia-500/30">
					{showAddTracker ? 'Cancel' : '+ Add'}
				</button>
			</div>

			<!-- Existing trackers list -->
			<div class="mb-4 space-y-2">
				{#each trackers as t (t.id)}
					<div class="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
					<div class="h-3 w-3 shrink-0 rounded-full" style="background:{t.color}"></div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-white">{t.name}</p>
							<p class="text-xs text-white/40">{t.onWeeks}w ON / {t.offWeeks}w OFF</p>
						</div>
					<a href={resolve('/tracker/[id]', { id: String(t.id) })} class="shrink-0 text-xs text-fuchsia-400 hover:underline">View</a>
					<button onclick={() => deleteTracker(t.id)} class="shrink-0 text-white/30 transition hover:text-red-400" aria-label="Delete tracker">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</div>
				{:else}
					<p class="text-sm text-white/30">No trackers yet.</p>
				{/each}
			</div>

			<!-- Add tracker form -->
			{#if showAddTracker}
				<div class="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4 space-y-3">
					<h3 class="text-sm font-bold text-white">New tracker</h3>
					<div>
						<label class="mb-1 block text-xs text-white/60" for="newTName">Name *</label>
						<input id="newTName" type="text" bind:value={tName} maxlength="100" class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none" placeholder="Tracker name" />
					</div>
					<div>
						<label class="mb-1 block text-xs text-white/60" for="newTDesc">Description</label>
						<input id="newTDesc" type="text" bind:value={tDesc} maxlength="200" class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none" placeholder="Optional" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs text-white/60" for="newTOn">ON weeks</label>
							<input id="newTOn" type="number" bind:value={tOnWeeks} min="1" max="52" class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white focus:border-fuchsia-400 focus:outline-none" />
						</div>
						<div>
							<label class="mb-1 block text-xs text-white/60" for="newTOff">OFF weeks</label>
							<input id="newTOff" type="number" bind:value={tOffWeeks} min="1" max="52" class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white focus:border-fuchsia-400 focus:outline-none" />
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1 block text-xs text-white/60" for="newTDate">Start date</label>
							<input id="newTDate" type="date" bind:value={tStartDate} class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white focus:border-fuchsia-400 focus:outline-none scheme-dark" />
						</div>
						<div>
							<p class="mb-1 text-xs text-white/60">Start phase</p>
							<div class="flex gap-2 pt-0.5">
								<button onclick={() => tStartPhase = 'ON'} class="flex-1 rounded-xl py-2 text-xs font-bold {tStartPhase === 'ON' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'}">ON</button>
								<button onclick={() => tStartPhase = 'OFF'} class="flex-1 rounded-xl py-2 text-xs font-bold {tStartPhase === 'OFF' ? 'bg-slate-500 text-white' : 'bg-white/10 text-white/50'}">OFF</button>
							</div>
						</div>
					</div>
					<div>
						<p class="mb-1.5 text-xs text-white/60">Color</p>
						<div class="flex flex-wrap gap-2">
					{#each COLORS as c (c)}
						<button onclick={() => tColor = c} style="background:{c}" aria-label={c} class="h-6 w-6 rounded-full {tColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent scale-110' : ''} transition"></button>
							{/each}
						</div>
					</div>
					{#if trackerError}<p class="text-xs text-red-300">{trackerError}</p>{/if}
					<button onclick={addTracker} disabled={savingTracker} class="w-full rounded-xl bg-fuchsia-500 py-2.5 text-sm font-bold text-white transition hover:bg-fuchsia-600 disabled:opacity-50">
						{savingTracker ? 'Creating…' : 'Create tracker'}
					</button>
				</div>
			{/if}
		</section>

		<!-- Logout -->
		<section class="rounded-2xl border border-white/10 bg-white/5 p-5">
			<h2 class="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">Session</h2>
			<button onclick={logout} class="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20">
				Lock app / Log out
			</button>
		</section>
	</main>
</div>
