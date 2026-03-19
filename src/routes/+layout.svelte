<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import PinScreen from '$lib/components/PinScreen.svelte';
	import { untrack } from 'svelte';

	let { children, data } = $props();

	// Authenticated state is reactive so the PIN screen hides after a successful login
	let authenticated = $state(untrack(() => data.authenticated));

	function onAuthenticated() {
		// Full navigation reload so all server loads re-run with the new session cookie
		window.location.href = window.location.pathname;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{data.appName ?? 'Rotation Tracker'}</title>
</svelte:head>

{#if data.isSetup && !authenticated}
	<PinScreen appName={data.appName ?? 'Rotation Tracker'} onSuccess={onAuthenticated} />
{:else}
	{@render children()}
{/if}
