import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getConfigBool, getConfig, CONFIG_KEYS } from '$lib/server/config.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isSetup = await getConfigBool(CONFIG_KEYS.IS_SETUP);

	// Always allow the setup route when app is not configured
	if (!isSetup) {
		if (!url.pathname.startsWith('/setup')) {
			throw redirect(303, '/setup');
		}
		return { isSetup: false, authenticated: false, appName: 'Rotation Tracker' };
	}

	const appName = (await getConfig(CONFIG_KEYS.APP_NAME)) ?? 'Rotation Tracker';

	return {
		isSetup: true,
		authenticated: locals.authenticated,
		appName
	};
};
