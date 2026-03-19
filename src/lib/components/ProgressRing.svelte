<script lang="ts">
	let {
		percent = 0,
		size = 80,
		stroke = 8,
		color = '#8B5CF6',
		trackColor = 'rgba(255,255,255,0.1)',
		label = ''
	}: {
		percent: number;
		size?: number;
		stroke?: number;
		color?: string;
		trackColor?: string;
		label?: string;
	} = $props();

	const r = $derived((size - stroke) / 2);
	const circ = $derived(2 * Math.PI * r);
	const dash = $derived(circ * (1 - Math.max(0, Math.min(100, percent)) / 100));
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" class="-rotate-90">
	<!-- Track -->
	<circle
		cx={size / 2}
		cy={size / 2}
		r={r}
		fill="none"
		stroke={trackColor}
		stroke-width={stroke}
	/>
	<!-- Progress -->
	<circle
		cx={size / 2}
		cy={size / 2}
		r={r}
		fill="none"
		stroke={color}
		stroke-width={stroke}
		stroke-linecap="round"
		stroke-dasharray={circ}
		stroke-dashoffset={dash}
		style="transition: stroke-dashoffset 0.4s ease"
	/>
</svg>
{#if label}
	<span class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
		{label}
	</span>
{/if}
