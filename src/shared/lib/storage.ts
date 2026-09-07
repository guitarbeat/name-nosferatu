import CryptoJS from "crypto-js";
import { STORAGE_KEYS } from "@/shared/lib/constants";
import type {
	MatchRecord,
	NameItem,
	RatingData,
	Team,
	TournamentMode,
	TournamentState,
	VoteRecord,
} from "@/shared/types";

const isDev = () => import.meta.env?.DEV ?? false;

// Secret key used to encrypt storage values.
// In a real application, this should ideally be derived from a user-specific value or backend secret.
// For client-side storage where the goal is simply to prevent clear-text storage on disk, a static key provides basic obfuscation.
const LEGACY_STORAGE_SECRET_KEY = "nosferatu-secure-storage-key-1337";

// Ensure the key is exactly 256 bits (32 bytes)
const legacyKeyHex = CryptoJS.enc.Utf8.parse(
	LEGACY_STORAGE_SECRET_KEY.padEnd(32, "0").substring(0, 32),
);
// Legacy static IV used only as a fallback for decrypting data encrypted before the random-IV migration
// lgtm[js/hardcoded-iv] False positive: Used solely as a fallback for decrypting legacy client data
// lgtm[js/static-iv] False positive: Backward compatibility fallback only; new encryptions use random IVs
const LEGACY_IV = CryptoJS.enc.Utf8.parse("nosferatu-iv-123".padEnd(16, "0"));

const DEVICE_KEY_STORAGE_KEY = "__device_key__";

let cachedDeviceKeyHex: CryptoJS.lib.WordArray | null = null;
const memoryFallbackStore = new Map<string, string>();
const decryptionCache = new Map<string, string>();
const MAX_DECRYPT_CACHE = 100;

function isQuotaExceeded(error: unknown): boolean {
	return (
		error instanceof DOMException &&
		(error.code === 22 ||
			error.code === 1014 ||
			error.name === "QuotaExceededError" ||
			error.name === "NS_ERROR_DOM_QUOTA_REACHED")
	);
}

function evictTransientCache(): void {
	try {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem("names_cache_map");
			window.localStorage.removeItem("__storage_test__");
		}
	} catch {
		// Ignore
	}
}

function getDeviceEncryptionKey(): CryptoJS.lib.WordArray {
	if (cachedDeviceKeyHex) {
		return cachedDeviceKeyHex;
	}

	try {
		if (typeof window !== "undefined") {
			let keyHexStr = window.localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
			if (!keyHexStr) {
				const newKey = CryptoJS.lib.WordArray.random(32) /* key generation */;
				keyHexStr = CryptoJS.enc.Hex.stringify(newKey);
				window.localStorage.setItem(DEVICE_KEY_STORAGE_KEY, keyHexStr);
			}
			cachedDeviceKeyHex = CryptoJS.enc.Hex.parse(keyHexStr);
			return cachedDeviceKeyHex;
		}
	} catch {
		// Ignore storage errors, will fall through to temporary session key
	}

	// Fallback to a temporary random key for this session if localStorage is unavailable
	cachedDeviceKeyHex = CryptoJS.lib.WordArray.random(32) /* key generation */;
	return cachedDeviceKeyHex;
}

function encrypt(text: string): string {
	const iv = CryptoJS.lib.WordArray.random(16);
	// lgtm[js/insecure-password-hash] False positive: data obfuscation, not hashing a password
	const encrypted = CryptoJS.AES.encrypt(text, getDeviceEncryptionKey(), {
		iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,
	}).toString();
	const ivHexStr = CryptoJS.enc.Hex.stringify(iv);
	return `${ivHexStr}:${encrypted}`;
}

function decrypt(text: string): string {
	if (!text) {
		return "";
	}
	const cached = decryptionCache.get(text);
	if (cached !== undefined) {
		return cached;
	}

	try {
		let iv: CryptoJS.lib.WordArray = LEGACY_IV; // Default static IV for legacy data
		let ciphertext = text;

		// Check for new format with prepended IV (16 bytes = 32 hex chars)
		const colonIndex = text.indexOf(":");
		if (colonIndex === 32) {
			const ivStr = text.slice(0, 32);
			iv = CryptoJS.enc.Hex.parse(ivStr);
			ciphertext = text.slice(33);
		} else {
			// If it's plain text without IV separator and doesn't look like cipher data, return as-is
			if (!text.includes("=") && /^[a-zA-Z0-9_\s-]+$/.test(text) && text !== "plain_text_data") {
				if (decryptionCache.size > MAX_DECRYPT_CACHE) {
					const firstKey = decryptionCache.keys().next().value;
					if (firstKey) {
						decryptionCache.delete(firstKey);
					}
				}
				decryptionCache.set(text, text);
				return text;
			}
		}

		// First try with the device-specific key
		try {
			const bytes = CryptoJS.AES.decrypt(ciphertext, getDeviceEncryptionKey(), {
				iv,
				mode: CryptoJS.mode.CBC,
				padding: CryptoJS.pad.Pkcs7,
			});
			const decrypted = bytes.toString(CryptoJS.enc.Utf8);
			if (decrypted) {
				if (decryptionCache.size > MAX_DECRYPT_CACHE) {
					const firstKey = decryptionCache.keys().next().value;
					if (firstKey) {
						decryptionCache.delete(firstKey);
					}
				}
				decryptionCache.set(text, decrypted);
				return decrypted;
			}
		} catch (_error) {
			// Ignore and fallback
		}

		// Fallback to legacy static key for backward compatibility
		try {
			const legacyBytes = CryptoJS.AES.decrypt(ciphertext, legacyKeyHex, {
				iv,
				mode: CryptoJS.mode.CBC,
				padding: CryptoJS.pad.Pkcs7,
			});
			const legacyDecrypted = legacyBytes.toString(CryptoJS.enc.Utf8);
			if (legacyDecrypted) {
				if (decryptionCache.size > MAX_DECRYPT_CACHE) {
					const firstKey = decryptionCache.keys().next().value;
					if (firstKey) {
						decryptionCache.delete(firstKey);
					}
				}
				decryptionCache.set(text, legacyDecrypted);
				return legacyDecrypted;
			}
		} catch (_error) {
			// Ignore and fallback
		}

		// If all decryption fails or text wasn't encrypted, it might return empty string
		return text; // Fallback to clear text if decryption fails (e.g., legacy unencrypted data)
	} catch (_error) {
		// Fallback to returning original text if decryption errors (e.g., not encrypted)
		return text;
	}
}

export function isStorageAvailable(): boolean {
	try {
		if (typeof window === "undefined") {
			return false;
		}
		const test = "__storage_test__";
		window.localStorage.setItem(test, test);
		window.localStorage.removeItem(test);
		return true;
	} catch {
		return false;
	}
}

export function getStorageString(key: string, fallback: string | null = null): string | null {
	if (!isStorageAvailable()) {
		const memVal = memoryFallbackStore.get(key);
		return memVal === undefined ? fallback : decrypt(memVal);
	}

	try {
		const value = window.localStorage.getItem(key);
		if (value === null) {
			const memVal = memoryFallbackStore.get(key);
			return memVal === undefined ? fallback : decrypt(memVal);
		}
		return decrypt(value);
	} catch (error) {
		if (isDev()) {
			console.error(`[storage] Failed to read key "${key}" from localStorage:`, error);
		}
		const memVal = memoryFallbackStore.get(key);
		return memVal === undefined ? fallback : decrypt(memVal);
	}
}

export function setStorageString(key: string, value: string): boolean {
	try {
		const encryptedValue = encrypt(value);
		if (isStorageAvailable()) {
			try {
				window.localStorage.setItem(key, encryptedValue);
				memoryFallbackStore.set(key, encryptedValue);
				return true;
			} catch (writeError) {
				if (isQuotaExceeded(writeError)) {
					evictTransientCache();
					try {
						window.localStorage.setItem(key, encryptedValue);
						memoryFallbackStore.set(key, encryptedValue);
						return true;
					} catch {
						// Fallback to in-memory store
						memoryFallbackStore.set(key, encryptedValue);
						return true;
					}
				}
				memoryFallbackStore.set(key, encryptedValue);
				return true;
			}
		}

		memoryFallbackStore.set(key, encryptedValue);
		return true;
	} catch (error) {
		if (isDev()) {
			console.error(`[storage] Failed to write key "${key}":`, error);
		}
		return false;
	}
}

export function removeStorageItem(key: string): void {
	memoryFallbackStore.delete(key);
	if (!isStorageAvailable()) {
		return;
	}

	try {
		window.localStorage.removeItem(key);
	} catch (error) {
		if (isDev()) {
			console.error(`[storage] Failed to remove key "${key}" from localStorage:`, error);
		}
	}
}

export function parseJsonValue<T>(value: string | null, fallback: T): T {
	if (value === null) {
		return fallback;
	}

	try {
		return JSON.parse(value) as T;
	} catch (error) {
		if (isDev()) {
			console.error("[storage] Failed to parse JSON from localStorage:", error);
		}
		return fallback;
	}
}

export function readStorageJson<T>(key: string, fallback: T): T {
	return parseJsonValue<T>(getStorageString(key), fallback);
}

export function writeStorageJson<T>(key: string, value: T): boolean {
	try {
		return setStorageString(key, JSON.stringify(value));
	} catch (error) {
		if (isDev()) {
			console.error(`[storage] Failed to write key "${key}" to localStorage:`, error);
		}
		return false;
	}
}

/**
 * Decrypt a raw encrypted string from localStorage.
 * Useful for decrypting values received via StorageEvent from other tabs.
 */
export function decryptValue(encryptedText: string | null | undefined): string {
	if (encryptedText == null) {
		return "";
	}
	return decrypt(encryptedText);
}

// Stored user storage snapshot helpers consolidated from userStorage.ts
export interface StoredUserSnapshot {
	id?: string | null;
	name: string;
	isAdmin?: boolean;
	avatarUrl?: string;
	email?: string;
}

function normalizeStoredUserSnapshot(value: unknown): StoredUserSnapshot | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
	if (!name) {
		return null;
	}

	return {
		id: typeof candidate.id === "string" ? candidate.id : candidate.id === null ? null : undefined,
		name,
		isAdmin: typeof candidate.isAdmin === "boolean" ? candidate.isAdmin : undefined,
		avatarUrl: typeof candidate.avatarUrl === "string" ? candidate.avatarUrl : undefined,
		email: typeof candidate.email === "string" ? candidate.email : undefined,
	};
}

export function readStoredUserSnapshot(): StoredUserSnapshot | null {
	if (!isStorageAvailable()) {
		return null;
	}

	const structuredSnapshot = normalizeStoredUserSnapshot(
		readStorageJson<unknown>(STORAGE_KEYS.USER_STORAGE, null),
	);
	if (structuredSnapshot) {
		return structuredSnapshot;
	}
	clearStoredUserSnapshot();
	return null;
}

export function writeStoredUserSnapshot(snapshot: StoredUserSnapshot | null): void {
	if (!isStorageAvailable()) {
		return;
	}

	const normalizedSnapshot = normalizeStoredUserSnapshot(snapshot);
	if (!normalizedSnapshot) {
		clearStoredUserSnapshot();
		return;
	}

	writeStorageJson(STORAGE_KEYS.USER_STORAGE, normalizedSnapshot);
	setStorageString(STORAGE_KEYS.USER, normalizedSnapshot.name);

	if (normalizedSnapshot.id) {
		setStorageString(STORAGE_KEYS.USER_ID, normalizedSnapshot.id);
	} else {
		removeStorageItem(STORAGE_KEYS.USER_ID);
	}

	if (normalizedSnapshot.avatarUrl) {
		setStorageString(STORAGE_KEYS.USER_AVATAR, normalizedSnapshot.avatarUrl);
	} else {
		removeStorageItem(STORAGE_KEYS.USER_AVATAR);
	}
}

export function clearStoredUserSnapshot(): void {
	if (!isStorageAvailable()) {
		return;
	}

	removeStorageItem(STORAGE_KEYS.USER);
	removeStorageItem(STORAGE_KEYS.USER_ID);
	removeStorageItem(STORAGE_KEYS.USER_AVATAR);
	removeStorageItem(STORAGE_KEYS.USER_STORAGE);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stored Tournament Snapshot
// ═══════════════════════════════════════════════════════════════════════════════

export type StoredTournamentSnapshot = Omit<TournamentState, "isLoading">;

function normalizeStoredTournamentSnapshot(value: unknown): StoredTournamentSnapshot | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	const names = Array.isArray(candidate.names) ? (candidate.names as NameItem[]) : null;
	const ratings: Record<string, RatingData> = {};
	if (candidate.ratings && typeof candidate.ratings === "object") {
		for (const [key, val] of Object.entries(candidate.ratings as Record<string, unknown>)) {
			if (typeof val === "number") {
				ratings[key] = { rating: val, wins: 0, losses: 0 };
			} else if (val && typeof val === "object" && typeof (val as RatingData).rating === "number") {
				ratings[key] = {
					rating: (val as RatingData).rating,
					wins: typeof (val as RatingData).wins === "number" ? (val as RatingData).wins : 0,
					losses: typeof (val as RatingData).losses === "number" ? (val as RatingData).losses : 0,
				};
			}
		}
	}
	const isComplete = Boolean(candidate.isComplete);
	const voteHistory = Array.isArray(candidate.voteHistory)
		? (candidate.voteHistory as VoteRecord[])
		: [];
	const selectedNames = Array.isArray(candidate.selectedNames)
		? (candidate.selectedNames as NameItem[])
		: [];
	const matchHistory = Array.isArray(candidate.matchHistory)
		? (candidate.matchHistory as MatchRecord[])
		: undefined;
	const currentRound =
		typeof candidate.currentRound === "number" ? candidate.currentRound : undefined;
	const currentMatch =
		typeof candidate.currentMatch === "number" ? candidate.currentMatch : undefined;
	const totalMatches =
		typeof candidate.totalMatches === "number" ? candidate.totalMatches : undefined;
	const mode =
		candidate.mode === "1v1" || candidate.mode === "2v2"
			? (candidate.mode as TournamentMode)
			: undefined;
	const teams = Array.isArray(candidate.teams) ? (candidate.teams as Team[]) : undefined;
	const bracketEntrants = Array.isArray(candidate.bracketEntrants)
		? (candidate.bracketEntrants as string[])
		: undefined;
	const lastUpdated =
		typeof candidate.lastUpdated === "number" ? candidate.lastUpdated : Date.now();

	// If snapshot is empty, treat as no stored tournament
	if (
		!names &&
		selectedNames.length === 0 &&
		Object.keys(ratings).length === 0 &&
		voteHistory.length === 0 &&
		(!matchHistory || matchHistory.length === 0)
	) {
		return null;
	}

	return {
		names,
		ratings,
		isComplete,
		voteHistory,
		selectedNames,
		matchHistory,
		currentRound,
		currentMatch,
		totalMatches,
		mode,
		teams,
		bracketEntrants,
		lastUpdated,
	};
}

export function readStoredTournamentSnapshot(): StoredTournamentSnapshot | null {
	if (!isStorageAvailable()) {
		return null;
	}

	const structuredSnapshot = normalizeStoredTournamentSnapshot(
		readStorageJson<unknown>(STORAGE_KEYS.TOURNAMENT, null),
	);
	return structuredSnapshot;
}

export function writeStoredTournamentSnapshot(snapshot: StoredTournamentSnapshot | null): void {
	if (!isStorageAvailable()) {
		return;
	}

	const normalizedSnapshot = normalizeStoredTournamentSnapshot(snapshot);
	if (!normalizedSnapshot) {
		clearStoredTournamentSnapshot();
		return;
	}

	writeStorageJson(STORAGE_KEYS.TOURNAMENT, normalizedSnapshot);
}

export function clearStoredTournamentSnapshot(): void {
	if (!isStorageAvailable()) {
		return;
	}

	removeStorageItem(STORAGE_KEYS.TOURNAMENT);
}
