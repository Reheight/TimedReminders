// One-off setup script — run once, then delete
// Usage: node scripts/setup-push.js
import webpush from 'web-push';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const keys = webpush.generateVAPIDKeys();
const cronSecret = crypto.randomBytes(32).toString('hex');

const entries = [
	{ key: 'push.vapidPublicKey',  value: keys.publicKey,  displayName: 'VAPID Public Key',  valueType: 'STRING', scope: 'SECURITY' },
	{ key: 'push.vapidPrivateKey', value: keys.privateKey, displayName: 'VAPID Private Key', valueType: 'SECRET', scope: 'SECURITY' },
	{ key: 'push.vapidSubject',    value: 'mailto:support@rustworks.org', displayName: 'VAPID Subject', valueType: 'STRING', scope: 'SECURITY' },
	{ key: 'push.cronSecret',      value: cronSecret,      displayName: 'Cron Secret',        valueType: 'SECRET', scope: 'SECURITY' },
];

for (const e of entries) {
	await prisma.internalConfigurationValue.upsert({
		where: { key: e.key },
		create: { key: e.key, value: e.value, displayName: e.displayName, valueType: e.valueType, scope: e.scope, adminOnly: true },
		update: { value: e.value },
	});
	console.log(`✓ ${e.displayName} saved`);
}

console.log('\nCron secret (save this for your cron job config):');
console.log(cronSecret);
console.log('\nVAPID public key (auto-served to clients from /api/push):');
console.log(keys.publicKey);

await prisma.$disconnect();
