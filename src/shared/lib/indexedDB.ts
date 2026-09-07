import { INDEXED_DB_CONFIG } from "@/shared/lib/constants";
import type { StoredTournamentSnapshot } from "@/shared/lib/storage";

const DEFAULT_DB_NAME = INDEXED_DB_CONFIG.DB_NAME;
const _DEFAULT_VERSION = INDEXED_DB_CONFIG.DB_VERSION;
const TOURNAMENT_STORE = INDEXED_DB_CONFIG.STORES.TOURNAMENTS;
const _KEYVAL_STORE = INDEXED_DB_CONFIG.STORES.KEYVAL;
const ACTIVE_TOURNAMENT_KEY = INDEXED_DB_CONFIG.KEYS.ACTIVE_TOURNAMENT;

let _cachedDbPromise: Promise<IDBDatabase> | null = null;
let _cachedDbInstance: IDBDatabase | null = null;

// In-memory fallback store when IndexedDB is unavailable (e.g. SSR, unsupported browsers, private browsing limits, or Node test environments)
const fallbackMemoryStores = new Map<string, Map<IDBValidKey, unknown>>();

function getMemoryStore(storeName: string): Map<IDBValidKey, unknown> {
	let store = fallbackMemoryStores.get(storeName);
	if (!store) {
		store = new Map<IDBValidKey, unknown>();
		fallbackMemoryStores.set(storeName, store);
	}
	return store;
}

/**
 * Check whether IndexedDB is accessible and usable in current environment.
 */
export function isIndexedDBAvailable(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	try {
		return (
			"indexedDB" in window &&
			window.indexedDB !== null &&
			typeof window.indexedDB.open === "function"
		);
	} catch {
		return false;
	}
}

/**
 * Opens (or returns the cached) connection to the application IndexedDB database.
 */

/**
 * Closes the active IndexedDB connection and clears cached references.
 */

/**
 * Resets any in-memory fallback stores (useful for test suites).
 */
export function clearMemoryFallbackStores(): void {
	fallbackMemoryStores.clear();
}

/**
 * Retrieves a record by key from a specific object store.
 */
export async function getRecordFromDB<T>(
	storeName: string = TOURNAMENT_STORE,
	key: IDBValidKey = ACTIVE_TOURNAMENT_KEY,
	dbName: string = DEFAULT_DB_NAME,
): Promise<T | null> {
	if (!isIndexedDBAvailable()) {
		const memStore = getMemoryStore(storeName);
		const val = memStore.get(key);
		return val === undefined ? null : (val as T);
	}

	try {
		const db = await openDatabase(dbName);
		return await new Promise<T | null>((resolve, reject) => {
			try {
				const tx = db.transaction(storeName, "readonly");
				const store = tx.objectStore(storeName);
				const request = store.get(key);

				request.onsuccess = () => {
					const result = request.result;
					resolve(result === undefined ? null : (result as T));
				};

				request.onerror = () => {
					reject(
						request.error || new Error(`Failed to read key "${String(key)}" from ${storeName}`),
					);
				};
			} catch (err) {
				reject(err);
			}
		});
	} catch {
		// Fallback to memory store if IndexedDB throws (e.g. security restrictions or corrupt DB)
		const memStore = getMemoryStore(storeName);
		const val = memStore.get(key);
		return val === undefined ? null : (val as T);
	}
}

/**
 * Writes or updates a record by key in a specific object store.
 */
export async function setRecordInDB<T>(
	storeName: string,
	key: IDBValidKey,
	value: T,
	dbName: string = DEFAULT_DB_NAME,
): Promise<void> {
	// Always keep fallback memory store updated in case of mid-session disconnect
	getMemoryStore(storeName).set(key, value);

	if (!isIndexedDBAvailable()) {
		return;
	}

	try {
		const db = await openDatabase(dbName);
		await new Promise<void>((resolve, reject) => {
			try {
				const tx = db.transaction(storeName, "readwrite");
				const store = tx.objectStore(storeName);
				const request = store.put(value, key);

				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error || request.error || new Error("Transaction error"));
				tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
			} catch (err) {
				reject(err);
			}
		});
	} catch {
		// Data is already safely in memory store
	}
}

/**
 * Deletes a record by key from a specific object store.
 */
export async function deleteRecordFromDB(
	storeName: string = TOURNAMENT_STORE,
	key: IDBValidKey = ACTIVE_TOURNAMENT_KEY,
	dbName: string = DEFAULT_DB_NAME,
): Promise<void> {
	getMemoryStore(storeName).delete(key);

	if (!isIndexedDBAvailable()) {
		return;
	}

	try {
		const db = await openDatabase(dbName);
		await new Promise<void>((resolve, reject) => {
			try {
				const tx = db.transaction(storeName, "readwrite");
				const store = tx.objectStore(storeName);
				store.delete(key);

				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error || new Error("Transaction error"));
				tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
			} catch (err) {
				reject(err);
			}
		});
	} catch {
		// Memory store was already updated
	}
}

/**
 * Retrieves all records from an object store.
 */

/**
 * Clears all records from an object store.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Dedicated Tournament Persistence Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retrieves the persisted tournament snapshot from IndexedDB.
 */
export async function getStoredTournamentFromIDB(
	key: IDBValidKey = ACTIVE_TOURNAMENT_KEY,
): Promise<StoredTournamentSnapshot | null> {
	return getRecordFromDB<StoredTournamentSnapshot>(TOURNAMENT_STORE, key);
}

/**
 * Persists the tournament snapshot to IndexedDB.
 */
export async function saveStoredTournamentToIDB(
	snapshot: StoredTournamentSnapshot,
	key: IDBValidKey = ACTIVE_TOURNAMENT_KEY,
): Promise<void> {
	return setRecordInDB<StoredTournamentSnapshot>(TOURNAMENT_STORE, key, snapshot);
}

/**
 * Clears the persisted tournament snapshot from IndexedDB.
 */
export async function clearStoredTournamentFromIDB(
	key: IDBValidKey = ACTIVE_TOURNAMENT_KEY,
): Promise<void> {
	return deleteRecordFromDB(TOURNAMENT_STORE, key);
}

/**
 * Retrieves all saved tournaments from IndexedDB.
 */

function openDatabase(dbName: string = DEFAULT_DB_NAME): Promise<IDBDatabase> {
	if (_cachedDbPromise) {
		return _cachedDbPromise;
	}

	_cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		try {
			const request = indexedDB.open(dbName, _DEFAULT_VERSION);

			request.onerror = () => {
				_cachedDbPromise = null;
				reject(request.error || new Error("Failed to open IndexedDB"));
			};

			request.onsuccess = () => {
				const db = request.result;
				_cachedDbInstance = db;
				db.onversionchange = () => {
					db.close();
					_cachedDbInstance = null;
					_cachedDbPromise = null;
				};
				resolve(db);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(TOURNAMENT_STORE)) {
					db.createObjectStore(TOURNAMENT_STORE, { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains(_KEYVAL_STORE)) {
					db.createObjectStore(_KEYVAL_STORE, { keyPath: "id" });
				}
			};
		} catch (err) {
			_cachedDbPromise = null;
			reject(err);
		}
	});

	return _cachedDbPromise;
}

function _closeDatabase(): void {
	if (_cachedDbInstance) {
		_cachedDbInstance.close();
		_cachedDbInstance = null;
		_cachedDbPromise = null;
	}
}

async function getAllRecordsFromDB<T>(
	storeName: string = TOURNAMENT_STORE,
	dbName: string = DEFAULT_DB_NAME,
): Promise<T[]> {
	if (!isIndexedDBAvailable()) {
		const memStore = getMemoryStore(storeName);
		return Array.from(memStore.values()) as T[];
	}

	try {
		const db = await openDatabase(dbName);
		return await new Promise<T[]>((resolve, reject) => {
			try {
				const tx = db.transaction(storeName, "readonly");
				const store = tx.objectStore(storeName);
				const request = store.getAll();

				request.onsuccess = () => resolve(request.result as T[]);
				request.onerror = () =>
					reject(request.error || new Error(`Failed to read all from ${storeName}`));
			} catch (err) {
				reject(err);
			}
		});
	} catch {
		const memStore = getMemoryStore(storeName);
		return Array.from(memStore.values()) as T[];
	}
}

async function _clearStoreInDB(
	storeName: string = TOURNAMENT_STORE,
	dbName: string = DEFAULT_DB_NAME,
): Promise<void> {
	if (!isIndexedDBAvailable()) {
		getMemoryStore(storeName).clear();
		return;
	}

	try {
		const db = await openDatabase(dbName);
		await new Promise<void>((resolve, reject) => {
			try {
				const tx = db.transaction(storeName, "readwrite");
				const store = tx.objectStore(storeName);
				const request = store.clear();

				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error || new Error(`Failed to clear ${storeName}`));
			} catch (err) {
				reject(err);
			}
		});
	} catch {
		getMemoryStore(storeName).clear();
	}
}

async function _getAllStoredTournamentsFromIDB(): Promise<StoredTournamentSnapshot[]> {
	return getAllRecordsFromDB<StoredTournamentSnapshot>(TOURNAMENT_STORE);
}
