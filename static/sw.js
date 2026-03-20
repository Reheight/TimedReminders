// Service Worker — handles push notifications and PWA install
const CACHE_NAME = 'rotation-tracker-v1';

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
	if (!event.data) return;

	let payload;
	try {
		payload = event.data.json();
	} catch {
		payload = { title: 'Rotation Tracker', body: event.data.text() };
	}

	const title = payload.title ?? 'Rotation Tracker';
	const options = {
		body: payload.body ?? 'Time to check in!',
		icon: '/icons/icon-192.png',
		badge: '/icons/icon-96.png',
		tag: payload.tag ?? 'checkin-reminder',
		renotify: true,
		data: { url: payload.url ?? '/' }
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url ?? '/';
	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clients) => {
				const existing = clients.find((c) => c.url.includes(self.location.origin));
				if (existing) return existing.focus();
				return self.clients.openWindow(url);
			})
	);
});
