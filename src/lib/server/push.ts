import webpush from 'web-push';
import { getConfig, CONFIG_KEYS } from './config.js';

async function getVapidConfig() {
	const [publicKey, privateKey, subject] = await Promise.all([
		getConfig(CONFIG_KEYS.VAPID_PUBLIC_KEY),
		getConfig(CONFIG_KEYS.VAPID_PRIVATE_KEY),
		getConfig(CONFIG_KEYS.VAPID_SUBJECT)
	]);
	return {
		publicKey: publicKey ?? '',
		privateKey: privateKey ?? '',
		subject: subject ?? 'mailto:admin@localhost'
	};
}

export async function getVapidPublicKey(): Promise<string> {
	return (await getConfig(CONFIG_KEYS.VAPID_PUBLIC_KEY)) ?? '';
}

export type PushPayload = {
	title: string;
	body: string;
	url?: string;
	tag?: string;
};

export async function sendPush(
	subscription: { endpoint: string; p256dhKey: string; authKey: string },
	payload: PushPayload
): Promise<{ ok: boolean; gone?: boolean }> {
	const cfg = await getVapidConfig();
	if (!cfg.publicKey || !cfg.privateKey) {
		console.warn('[push] VAPID keys not configured — push skipped.');
		return { ok: false };
	}

	try {
		webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
		await webpush.sendNotification(
			{
				endpoint: subscription.endpoint,
				keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey }
			},
			JSON.stringify(payload),
			{ TTL: 86400 }
		);
		return { ok: true };
	} catch (err: unknown) {
		const status = (err as { statusCode?: number }).statusCode;
		if (status === 404 || status === 410) return { ok: false, gone: true };
		console.error('[push] sendNotification error:', err);
		return { ok: false };
	}
}
