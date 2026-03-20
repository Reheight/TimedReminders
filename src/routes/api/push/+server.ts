import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';
import { getVapidPublicKey } from '$lib/server/push.js';

/** GET /api/push — return the VAPID public key for the client to subscribe with */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });
	const publicKey = await getVapidPublicKey();
	return json({ publicKey });
};

/** POST /api/push — save a new push subscription */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const b = body as Record<string, unknown>;
	const endpoint = b.endpoint;
	const p256dh = (b.keys as Record<string, string>)?.p256dh;
	const auth = (b.keys as Record<string, string>)?.auth;

	if (typeof endpoint !== 'string' || !p256dh || !auth) {
		return json({ error: 'Invalid subscription object' }, { status: 422 });
	}

	const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

	await prisma.pushSubscription.upsert({
		where: { endpoint },
		create: { endpoint, p256dhKey: p256dh, authKey: auth, userAgent },
		update: { p256dhKey: p256dh, authKey: auth, userAgent }
	});

	return json({ ok: true });
};

/** DELETE /api/push — remove a push subscription */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.authenticated) return json({ error: 'Unauthorized' }, { status: 401 });

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const endpoint = (body as Record<string, unknown>).endpoint;
	if (typeof endpoint !== 'string') return json({ error: 'Missing endpoint' }, { status: 422 });

	await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => null);
	return json({ ok: true });
};
