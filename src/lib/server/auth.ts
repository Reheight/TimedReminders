import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { prisma } from './prisma.js';
import { CONFIG_KEYS, getConfigBool, getConfigInt } from './config.js';

const scryptAsync = promisify(scrypt);

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ── PIN hashing (scrypt) ──────────────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
	return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
	const [salt, key] = storedHash.split(':');
	if (!salt || !key) return false;
	const keyBuffer = Buffer.from(key, 'hex');
	const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
	return timingSafeEqual(keyBuffer, derived);
}

// ── Session tokens ────────────────────────────────────────────────────────────

/** Returns the raw token to set in the cookie. DB stores only SHA-256(token). */
export function generateSessionToken(): string {
	return randomBytes(48).toString('hex'); // 96-char hex
}

function hashToken(raw: string): string {
	return createHash('sha256').update(raw).digest('hex');
}

export async function createSession(rawToken: string): Promise<void> {
	const lockOnClose = await getConfigBool(CONFIG_KEYS.LOCK_ON_CLOSE);
	const durationHours = await getConfigInt(CONFIG_KEYS.SESSION_DURATION_HOURS, 24);

	// If lockOnClose, we still store a DB record but the cookie won't persist
	const expiresAt = lockOnClose
		? new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 h max for browser-session cookies
		: new Date(Date.now() + durationHours * 60 * 60 * 1000);

	await prisma.session.create({
		data: {
			tokenHash: hashToken(rawToken),
			expiresAt
		}
	});
}

export async function validateSession(rawToken: string): Promise<boolean> {
	const session = await prisma.session.findUnique({
		where: { tokenHash: hashToken(rawToken) }
	});
	if (!session) return false;
	if (session.expiresAt <= new Date()) {
		await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
		return false;
	}
	return true;
}

export async function deleteSession(rawToken: string): Promise<void> {
	await prisma.session
		.delete({ where: { tokenHash: hashToken(rawToken) } })
		.catch(() => null);
}

/** Prune expired sessions (call periodically). */
export async function pruneExpiredSessions(): Promise<void> {
	await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

// ── PIN attempt rate-limiting ─────────────────────────────────────────────────

export async function checkRateLimit(
	ip: string
): Promise<{ allowed: boolean; remaining: number; lockedUntil?: Date }> {
	const record = await prisma.pinAttempt.findUnique({ where: { ip } });
	if (!record) return { allowed: true, remaining: MAX_ATTEMPTS };

	if (record.lockedUntil && record.lockedUntil > new Date()) {
		return { allowed: false, remaining: 0, lockedUntil: record.lockedUntil };
	}

	// Lockout expired — reset
	if (record.lockedUntil && record.lockedUntil <= new Date()) {
		await prisma.pinAttempt.update({
			where: { ip },
			data: { attempts: 0, lockedUntil: null }
		});
		return { allowed: true, remaining: MAX_ATTEMPTS };
	}

	const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
	return { allowed: remaining > 0, remaining };
}

export async function recordFailedAttempt(
	ip: string
): Promise<{ remaining: number; lockedUntil?: Date }> {
	const existing = await prisma.pinAttempt.findUnique({ where: { ip } });
	const newAttempts = (existing?.attempts ?? 0) + 1;
	const lockedUntil =
		newAttempts >= MAX_ATTEMPTS
			? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
			: null;

	await prisma.pinAttempt.upsert({
		where: { ip },
		create: { ip, attempts: newAttempts, lockedUntil },
		update: { attempts: newAttempts, lockedUntil, updatedAt: new Date() }
	});

	return { remaining: Math.max(0, MAX_ATTEMPTS - newAttempts), lockedUntil: lockedUntil ?? undefined };
}

export async function resetAttempts(ip: string): Promise<void> {
	await prisma.pinAttempt.updateMany({
		where: { ip },
		data: { attempts: 0, lockedUntil: null }
	});
}
