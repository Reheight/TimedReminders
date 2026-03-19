import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { getConfigBool, CONFIG_KEYS } from '$lib/server/config.js';

export const load: PageServerLoad = async () => {
	const isSetup = await getConfigBool(CONFIG_KEYS.IS_SETUP);
	if (isSetup) {
		throw redirect(303, '/');
	}
	return {};
};

// Form actions are handled entirely client-side via fetch → /api/setup
export const actions: Actions = {};
