import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ cookies }) => {
	const rawToken = cookies.get('session');
	if (rawToken) {
		await deleteSession(rawToken).catch(() => null);
		cookies.delete('session', { path: '/' });
	}
	return json({ success: true });
};
