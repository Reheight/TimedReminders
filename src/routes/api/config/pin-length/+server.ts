import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfigInt, CONFIG_KEYS } from '$lib/server/config.js';

/** Returns the configured PIN length (public — needed before auth) */
export const GET: RequestHandler = async () => {
	const pinLength = await getConfigInt(CONFIG_KEYS.PIN_LENGTH, 4);
	return json({ pinLength });
};
