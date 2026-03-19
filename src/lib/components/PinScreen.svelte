<script lang="ts">
	let {
		appName = 'Rotation Tracker',
		onSuccess
	}: {
		appName?: string;
		onSuccess: () => void;
	} = $props();

	let pin = $state('');
	let pinLength = $state(4);
	let error = $state('');
	let shake = $state(false);
	let loading = $state(false);
	let lockedUntil = $state<Date | null>(null);
	let remaining = $state(0);
	let countdown = $state('');

	// Fetch the configured PIN length on mount
	$effect(() => {
		fetch('/api/config/pin-length')
			.then((r) => r.json())
			.then((d) => {
				if (d.pinLength) pinLength = d.pinLength;
			})
			.catch(() => null);
	});

	// Countdown timer when locked out
	$effect(() => {
		if (!lockedUntil) return;
		const id = setInterval(() => {
			const diff = lockedUntil!.getTime() - Date.now();
			if (diff <= 0) {
				lockedUntil = null;
				countdown = '';
				clearInterval(id);
				return;
			}
			const mins = Math.floor(diff / 60_000);
			const secs = Math.floor((diff % 60_000) / 1000);
			countdown = `${mins}:${secs.toString().padStart(2, '0')}`;
		}, 500);
		return () => clearInterval(id);
	});

	// Auto-submit when PIN is full length
	$effect(() => {
		if (pin.length === pinLength && !loading && !lockedUntil) {
			submitPin();
		}
	});

	async function submitPin() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pin })
			});
			const data = await res.json();

			if (res.ok && data.success) {
				onSuccess();
			} else if (res.status === 429) {
				lockedUntil = new Date(data.lockedUntil);
				remaining = 0;
				triggerShake('Too many attempts. Try again in ' + countdown);
			} else {
				remaining = data.remaining ?? 0;
				const msg =
					remaining > 0
						? `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
						: 'Incorrect PIN.';
				triggerShake(msg);
			}
		} catch {
			triggerShake('Network error. Please try again.');
		} finally {
			pin = '';
			loading = false;
		}
	}

	function triggerShake(msg: string) {
		error = msg;
		shake = true;
		setTimeout(() => (shake = false), 600);
	}

	function press(digit: string) {
		if (lockedUntil || loading) return;
		if (digit === 'del') {
			pin = pin.slice(0, -1);
			return;
		}
		if (digit === 'clr') {
			pin = '';
			return;
		}
		if (pin.length < pinLength) {
			pin += digit;
		}
	}

	const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'] as const;
</script>

<div
	class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-linear-to-br from-violet-950 via-purple-900 to-fuchsia-950"
>
	<!-- App name + lock icon -->
	<div class="mb-10 flex flex-col items-center gap-3">
		<div class="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-8 w-8 text-white"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
		</div>
		<h1 class="text-2xl font-bold tracking-tight text-white">{appName}</h1>
		<p class="text-sm text-purple-300">Enter your PIN to continue</p>
	</div>

	<!-- PIN dots -->
	<div class="mb-8" class:animate-shake={shake}>
		<div class="flex gap-4">
			{#each Array.from({ length: pinLength }, (_, i) => i) as i (i)}
				<div
					class="h-4 w-4 rounded-full border-2 transition-all duration-150 {pin.length > i
						? 'scale-110 border-fuchsia-400 bg-fuchsia-400'
						: 'border-white/40 bg-transparent'}"
				></div>
			{/each}
		</div>
	</div>

	<!-- Error / lockout message -->
	{#if lockedUntil}
		<p class="mb-4 text-center text-sm font-medium text-red-300">
			Too many attempts.<br />Try again in <span class="font-mono font-bold">{countdown}</span>
		</p>
	{:else if error}
		<p class="mb-4 text-sm font-medium text-red-300">{error}</p>
	{:else}
		<div class="mb-4 h-5"></div>
	{/if}

	<!-- Number pad -->
	<div class="grid grid-cols-3 gap-3">
		{#each PAD as key (key)}
			{#if key === 'clr'}
				<button
					onclick={() => press('clr')}
					disabled={!!lockedUntil || loading}
					class="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-purple-300 transition active:scale-95 disabled:opacity-40"
					aria-label="Clear"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{:else if key === 'del'}
				<button
					onclick={() => press('del')}
					disabled={!!lockedUntil || loading}
					class="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-purple-300 transition active:scale-95 disabled:opacity-40"
					aria-label="Delete"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
						/>
					</svg>
				</button>
			{:else}
				<button
					onclick={() => press(key)}
					disabled={!!lockedUntil || loading}
					class="h-16 w-16 rounded-full bg-white/10 text-xl font-semibold text-white backdrop-blur transition hover:bg-white/20 active:scale-95 active:bg-white/25 disabled:opacity-40"
				>
					{key}
				</button>
			{/if}
		{/each}
	</div>

	{#if loading}
		<div class="mt-6 flex items-center gap-2 text-sm text-purple-300">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-white"></div>
			Verifying…
		</div>
	{/if}
</div>

<style>
	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		15%       { transform: translateX(-8px); }
		30%       { transform: translateX(8px); }
		45%       { transform: translateX(-6px); }
		60%       { transform: translateX(6px); }
		75%       { transform: translateX(-3px); }
		90%       { transform: translateX(3px); }
	}
	.animate-shake {
		animation: shake 0.6s ease-in-out;
	}
</style>
