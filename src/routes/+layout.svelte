<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import PinScreen from '$lib/components/PinScreen.svelte';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	// Authenticated state is reactive so the PIN screen hides after a successful login
	let authenticated = $state(untrack(() => data.authenticated));

	function onAuthenticated() {
		// Full navigation reload so all server loads re-run with the new session cookie
		window.location.href = window.location.pathname;
	}

	onMount(() => {
		if (!data.authenticated) return;
		tryAutoSubscribe();
	});

	async function tryAutoSubscribe() {
		if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
		if (Notification.permission === 'denied') return;
		// Only auto-prompt when already in standalone (installed to home screen)
		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
		if (!isStandalone) return;
		// Already have a subscription — nothing to do
		const reg = await navigator.serviceWorker.ready;
		const existing = await reg.pushManager.getSubscription();
		if (existing) return;

		// Request permission if not yet decided
		const permission =
			Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
		if (permission !== 'granted') return;

		// Fetch VAPID key and subscribe
		try {
			const keyRes = await fetch('/api/push');
			if (!keyRes.ok) return;
			const { publicKey } = await keyRes.json();
			if (!publicKey) return;

			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: vapidKeyToBuffer(publicKey)
			});
			await fetch('/api/push', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(sub.toJSON())
			});
		} catch {
			// Non-fatal — user can enable manually via Settings
		}
	}

	function vapidKeyToBuffer(base64String: string): ArrayBuffer {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(base64);
		const buf = new ArrayBuffer(raw.length);
		const view = new Uint8Array(buf);
		for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
		return buf;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.appName ?? 'Rotation Tracker'}</title>
</svelte:head>

{#if data.isSetup && !authenticated}
	<PinScreen appName={data.appName ?? 'Rotation Tracker'} onSuccess={onAuthenticated} />
{:else}
	{#key page.url.pathname}
		{@render children()}
	{/key}
{/if}
