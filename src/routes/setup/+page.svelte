<script lang="ts">
	import { resolve } from '$app/paths';
	// ── State ──────────────────────────────────────────────────────────────────
	let step = $state(1); // 1 = PIN, 2 = App name, 3 = First tracker, 4 = Done

	// Step 1 – PIN
	let pin = $state('');
	let confirmPin = $state('');
	let pinLength = $state(4);
	let pinError = $state('');
	let entryPhase = $state<'set' | 'confirm'>('set'); // first enter, then re-enter to confirm

	// Step 2 – App settings
	let appName = $state('Rotation Tracker');
	let sessionHours = $state(24);
	let lockOnClose = $state(false);

	// Step 3 – First tracker
	let trackerName = $state('');
	let trackerDesc = $state('');
	let onWeeks = $state(3);
	let offWeeks = $state(3);
	let startPhase = $state<'ON' | 'OFF'>('ON');
	let startDate = $state(todayISO());
	let trackerColor = $state('#8B5CF6');

	let submitting = $state(false);
	let globalError = $state('');

	const COLORS = [
		'#8B5CF6', // violet
		'#EC4899', // pink
		'#06B6D4', // cyan
		'#10B981', // emerald
		'#F59E0B', // amber
		'#EF4444', // red
		'#3B82F6', // blue
		'#84CC16'  // lime
	];

	const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'] as const;

	function todayISO() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// ── PIN pad logic ──────────────────────────────────────────────────────────
	function pressPin(key: string) {
		const target = entryPhase === 'set' ? pin : confirmPin;
		if (key === 'del') {
			if (entryPhase === 'set') pin = pin.slice(0, -1);
			else confirmPin = confirmPin.slice(0, -1);
			return;
		}
		if (key === 'clr') {
			if (entryPhase === 'set') pin = '';
			else confirmPin = '';
			return;
		}
		if (target.length < pinLength) {
			if (entryPhase === 'set') pin += key;
			else confirmPin += key;
		}
	}

	$effect(() => {
		const cur = entryPhase === 'set' ? pin : confirmPin;
		if (cur.length !== pinLength) return;

		if (entryPhase === 'set') {
			entryPhase = 'confirm';
			pinError = '';
		} else {
			// Validate match
			if (pin !== confirmPin) {
				pinError = 'PINs do not match. Start over.';
				pin = '';
				confirmPin = '';
				entryPhase = 'set';
			} else {
				pinError = '';
				step = 2;
			}
		}
	});

	function nextStep() {
		if (step === 2) {
			if (!appName.trim()) { globalError = 'App name is required.'; return; }
			globalError = '';
			step = 3;
		}
	}

	async function finish() {
		if (!trackerName.trim()) { globalError = 'Tracker name is required.'; return; }
		if (onWeeks < 1 || offWeeks < 1) { globalError = 'Week counts must be at least 1.'; return; }
		globalError = '';
		submitting = true;
		try {
			const res = await fetch('/api/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pin,
					pinLength,
					appName: appName.trim(),
					sessionHours,
					lockOnClose,
					tracker: {
						name: trackerName.trim(),
						description: trackerDesc.trim() || null,
						onWeeks,
						offWeeks,
						startPhase,
						startDate,
						color: trackerColor
					}
				})
			});
			const data = await res.json();
			if (res.ok) {
				step = 4;
			} else {
				globalError = data.error ?? 'Setup failed. Please try again.';
			}
		} catch {
			globalError = 'Network error. Please try again.';
		} finally {
			submitting = false;
		}
	}

	const currentPin = $derived(entryPhase === 'set' ? pin : confirmPin);
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-violet-950 via-purple-900 to-fuchsia-950 p-4">
	<div class="w-full max-w-sm">
		<!-- Logo / title -->
		<div class="mb-8 text-center">
			<div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-white">Rotation Tracker</h1>
			<p class="mt-1 text-sm text-purple-300">Let's get you set up</p>
		</div>

		<!-- Step indicator -->
		<div class="mb-8 flex items-center justify-center gap-2">
			{#each [1,2,3] as s (s)}
				<div class="h-2 w-2 rounded-full transition-all {step > s ? 'bg-fuchsia-400' : step === s ? 'w-6 bg-white' : 'bg-white/20'}"></div>
			{/each}
		</div>

		<!-- ─── Step 1: Set PIN ─────────────────────────────────────────── -->
		{#if step === 1}
			<div class="rounded-2xl bg-white/8 p-6 backdrop-blur">
				<h2 class="mb-1 text-center text-lg font-bold text-white">
					{entryPhase === 'set' ? 'Create your PIN' : 'Confirm your PIN'}
				</h2>
				<p class="mb-5 text-center text-xs text-purple-300">
					{entryPhase === 'set' ? 'Choose a ' + pinLength + '-digit PIN to protect the app.' : 'Enter the same PIN again to confirm.'}
				</p>

				<!-- PIN length selector -->
				{#if entryPhase === 'set'}
					<div class="mb-5 flex items-center justify-center gap-2">
						<span class="text-xs text-white/60">PIN length:</span>
						{#each [4, 5, 6] as len (len)}
							<button
								onclick={() => { pinLength = len; pin = ''; }}
								class="rounded-lg px-3 py-1 text-xs font-semibold transition {pinLength === len ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}"
							>{len}</button>
						{/each}
					</div>
				{/if}

				<!-- Dots -->
				<div class="mb-5 flex justify-center gap-3">
					{#each Array.from({ length: pinLength }, (_, i) => i) as i (i)}
						<div class="h-4 w-4 rounded-full border-2 transition-all {currentPin.length > i ? 'scale-110 border-fuchsia-400 bg-fuchsia-400' : 'border-white/30 bg-transparent'}"></div>
					{/each}
				</div>

				{#if pinError}
					<p class="mb-3 text-center text-xs font-medium text-red-300">{pinError}</p>
				{/if}

				<!-- Numpad -->
				<div class="grid grid-cols-3 gap-2.5 place-items-center">
					{#each PAD as key (key)}
						{#if key === 'clr'}
						<button onclick={() => pressPin('clr')} aria-label="Clear" class="flex h-14 w-14 items-center justify-center rounded-full text-purple-300 transition active:scale-95">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{:else if key === 'del'}
						<button onclick={() => pressPin('del')} aria-label="Delete" class="flex h-14 w-14 items-center justify-center rounded-full text-purple-300 transition active:scale-95">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
								</svg>
							</button>
						{:else}
							<button onclick={() => pressPin(key)} class="h-14 w-14 rounded-full bg-white/10 text-lg font-semibold text-white transition hover:bg-white/20 active:scale-95">
								{key}
							</button>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- ─── Step 2: App settings ───────────────────────────────────── -->
		{#if step === 2}
			<div class="rounded-2xl bg-white/8 p-6 backdrop-blur">
				<h2 class="mb-1 text-center text-lg font-bold text-white">App settings</h2>
				<p class="mb-5 text-center text-xs text-purple-300">Personalise the app to your liking.</p>

				<div class="space-y-4">
					<div>
						<label class="mb-1.5 block text-xs font-semibold text-white/70" for="appName">App name</label>
						<input
							id="appName"
							type="text"
							bind:value={appName}
							maxlength="50"
							class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none"
							placeholder="Rotation Tracker"
						/>
					</div>

					<div>
						<label class="mb-1.5 block text-xs font-semibold text-white/70" for="sessionHours">Session duration</label>
						<select
							id="sessionHours"
							bind:value={sessionHours}
							class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-fuchsia-400 focus:outline-none"
						>
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

				{#if globalError}
					<p class="mt-3 text-xs text-red-300">{globalError}</p>
				{/if}

				<button
					onclick={nextStep}
					class="mt-6 w-full rounded-xl bg-fuchsia-500 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-600 active:scale-95"
				>
					Next →
				</button>
			</div>
		{/if}

		<!-- ─── Step 3: First tracker ─────────────────────────────────── -->
		{#if step === 3}
			<div class="rounded-2xl bg-white/8 p-6 backdrop-blur">
				<h2 class="mb-1 text-center text-lg font-bold text-white">Create your first tracker</h2>
				<p class="mb-5 text-center text-xs text-purple-300">You can add more later.</p>

				<div class="space-y-4">
					<div>
						<label class="mb-1.5 block text-xs font-semibold text-white/70" for="tName">Tracker name *</label>
						<input
							id="tName"
							type="text"
							bind:value={trackerName}
							maxlength="100"
							class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none"
							placeholder="e.g. Medication, Exercise, Supplement"
						/>
					</div>

					<div>
						<label class="mb-1.5 block text-xs font-semibold text-white/70" for="tDesc">Description (optional)</label>
						<input
							id="tDesc"
							type="text"
							bind:value={trackerDesc}
							maxlength="200"
							class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-fuchsia-400 focus:outline-none"
							placeholder="Short description"
						/>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1.5 block text-xs font-semibold text-white/70" for="onWks">ON weeks</label>
							<input
								id="onWks"
								type="number"
								bind:value={onWeeks}
								min="1" max="52"
								class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-fuchsia-400 focus:outline-none"
							/>
						</div>
						<div>
							<label class="mb-1.5 block text-xs font-semibold text-white/70" for="offWks">OFF weeks</label>
							<input
								id="offWks"
								type="number"
								bind:value={offWeeks}
								min="1" max="52"
								class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-fuchsia-400 focus:outline-none"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="mb-1.5 block text-xs font-semibold text-white/70" for="sDate">Start date</label>
							<input
								id="sDate"
								type="date"
								bind:value={startDate}
								class="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-fuchsia-400 focus:outline-none scheme-dark"
							/>
						</div>
						<div>
							<p class="mb-1.5 block text-xs font-semibold text-white/70">Start phase</p>
							<div class="flex gap-2 pt-1">
								<button
									onclick={() => (startPhase = 'ON')}
									class="flex-1 rounded-xl py-2 text-xs font-bold transition {startPhase === 'ON' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}"
								>ON</button>
								<button
									onclick={() => (startPhase = 'OFF')}
									class="flex-1 rounded-xl py-2 text-xs font-bold transition {startPhase === 'OFF' ? 'bg-slate-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}"
								>OFF</button>
							</div>
						</div>
					</div>

					<div>
						<p class="mb-2 text-xs font-semibold text-white/70">Color</p>
						<div class="flex gap-2">
						{#each COLORS as c (c)}
								<button
									onclick={() => (trackerColor = c)}
									style="background:{c}"
									class="h-7 w-7 rounded-full transition active:scale-95 {trackerColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110' : ''}"
									aria-label={c}
								></button>
							{/each}
						</div>
					</div>
				</div>

				{#if globalError}
					<p class="mt-3 text-xs text-red-300">{globalError}</p>
				{/if}

				<button
					onclick={finish}
					disabled={submitting}
					class="mt-6 w-full rounded-xl bg-fuchsia-500 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-600 active:scale-95 disabled:opacity-50"
				>
					{submitting ? 'Setting up…' : 'Finish setup →'}
				</button>
			</div>
		{/if}

		<!-- ─── Step 4: Done ──────────────────────────────────────────── -->
		{#if step === 4}
			<div class="rounded-2xl bg-white/8 p-6 text-center backdrop-blur">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h2 class="mb-2 text-lg font-bold text-white">You're all set! 🎉</h2>
				<p class="mb-6 text-sm text-purple-300">Your app is ready to use. You'll need to enter your PIN each time you open it.</p>
				<a
					href={resolve('/')}
					class="block w-full rounded-xl bg-fuchsia-500 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-600"
				>
					Open app →
				</a>
			</div>
		{/if}
	</div>
</div>
