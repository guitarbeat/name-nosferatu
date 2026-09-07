import { type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { CRITICAL_SHELL_IMAGES, INDEXED_DB_CONFIG } from "@/shared/lib/constants";
import { deleteRecordFromDB, getRecordFromDB, setRecordInDB } from "@/shared/lib/indexedDB";
import {
	decryptValue,
	getStorageString,
	parseJsonValue,
	removeStorageItem,
	type StoredTournamentSnapshot,
	writeStorageJson,
} from "@/shared/lib/storage";
import type { NameItem } from "@/shared/types";
import useAppStore from "@/store";

const IS_BROWSER = typeof window !== "undefined";
const IS_DEV = import.meta.env?.DEV ?? false;

// Helper debounce for useLocalStorage
function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return function (this: unknown, ...args: Parameters<T>) {
		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(() => func.apply(this, args), wait);
	} as T;
}

// ============================================================================
// 1. usePrefersReducedMotion
// ============================================================================
const EMPTY_OPTIONS: Record<string, never> = {};
const EMPTY_ARRAY: never[] = [];

export function usePrefersReducedMotion() {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
			return;
		}

		try {
			const media = window.matchMedia("(prefers-reduced-motion: reduce)");
			setMatches(media.matches);
			const handleChange = () => setMatches(media.matches);
			if (media.addEventListener) {
				media.addEventListener("change", handleChange);
				return () => media.removeEventListener("change", handleChange);
			} else if (media.addListener) {
				media.addListener(handleChange);
				return () => media.removeListener(handleChange);
			}
		} catch {
			// Ignore unsupported matchMedia errors
		}
	}, []);

	return matches;
}

// ============================================================================
// 2. useLocalStorage
// ============================================================================
export function useLocalStorage<T>(
	key: string,
	initialValue: T,
	options: {
		debounceWait?: number;
		onError?: (error: unknown) => void;
	} = EMPTY_OPTIONS,
): [T, (value: SetStateAction<T>) => void, () => void] {
	const initialRef = useRef(initialValue);
	const onErrorRef = useRef(options.onError);

	useEffect(() => {
		onErrorRef.current = options.onError;
	}, [options.onError]);

	const readValue = useCallback((): T => {
		if (!IS_BROWSER) {
			return initialRef.current;
		}

		const raw = getStorageString(key, null);
		return raw === null ? initialRef.current : parseJsonValue(raw, initialRef.current);
	}, [key]);

	const [stored, setStored] = useState<T>(readValue);
	const valueRef = useRef(stored);
	const currentKeyRef = useRef(key);

	// Safe sync of refs outside of render
	useEffect(() => {
		valueRef.current = stored;
		currentKeyRef.current = key;
	}, [stored, key]);
	const isUnmountingRef = useRef(false);

	const debouncedSetItemRef = useRef<ReturnType<typeof debounce> | null>(null);

	useEffect(() => {
		if (options.debounceWait && options.debounceWait > 0) {
			debouncedSetItemRef.current = debounce(
				((value: T) => {
					if (!IS_BROWSER) {
						return;
					}

					const success = writeStorageJson(key, value);
					if (!success) {
						onErrorRef.current?.(new Error(`localStorage write failed for key "${key}"`));
					}
				}) as (...args: unknown[]) => void,
				options.debounceWait,
			);
			return;
		}

		debouncedSetItemRef.current = null;
	}, [key, options.debounceWait]);

	// Track true unmount (not key changes)
	useEffect(() => {
		isUnmountingRef.current = false; // Reset on (re)mount (handles strict mode)
		return () => {
			isUnmountingRef.current = true;
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: key is needed to re-register cleanup when key changes
	useEffect(() => {
		return () => {
			if (!isUnmountingRef.current || !options.debounceWait || !IS_BROWSER) {
				return;
			}

			const success = writeStorageJson(currentKeyRef.current, valueRef.current);
			if (!success) {
				if (IS_DEV) {
					console.error(
						`[useLocalStorage] Unmount flush failed for key "${currentKeyRef.current}".`,
					);
				}
			}
		};
	}, [key, options.debounceWait]);

	const setValue = useCallback(
		(next: SetStateAction<T>) => {
			try {
				const resolved =
					typeof next === "function" ? (next as (previous: T) => T)(valueRef.current) : next;

				setStored(resolved);
				valueRef.current = resolved;

				if (debouncedSetItemRef.current) {
					debouncedSetItemRef.current(resolved);
					return;
				}

				if (!IS_BROWSER) {
					return;
				}

				const success = writeStorageJson(key, resolved);
				if (!success) {
					onErrorRef.current?.(new Error(`localStorage write failed for key "${key}"`));
				}
			} catch (error) {
				if (IS_DEV) {
					console.error(`[useLocalStorage] Unexpected error for key "${key}":`, error);
				}
				onErrorRef.current?.(error);
			}
		},
		[key],
	);

	const removeValue = useCallback(() => {
		const fallback = initialRef.current;
		setStored(fallback);
		valueRef.current = fallback;

		if (IS_BROWSER) {
			removeStorageItem(key);
		}
	}, [key]);

	useEffect(() => {
		if (!IS_BROWSER) {
			return;
		}

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== key) {
				return;
			}

			if (event.newValue === null) {
				setStored(initialRef.current);
				valueRef.current = initialRef.current;
				return;
			}

			const decrypted = decryptValue(event.newValue);
			const parsed = parseJsonValue<T>(decrypted, initialRef.current);
			setStored(parsed);
			valueRef.current = parsed;
		};

		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [key]);

	return [stored, setValue, removeValue];
}

// ============================================================================
// 3. useIndexedDB & useTournamentIndexedDB (Offline-first persistence)
// ============================================================================

type IDBSyncStatus = "idle" | "loading" | "saving" | "synced" | "error";

interface UseIndexedDBOptions<T> {
	dbName?: string;
	storeName?: string;
	key?: IDBValidKey;
	initialValue?: T | null;
	syncWithStore?: boolean;
	debounceMs?: number;
	onHydrate?: (data: T) => void;
	onError?: (error: Error) => void;
}

interface UseIndexedDBResult<T> {
	data: T | null;
	isLoading: boolean;
	isReady: boolean;
	error: Error | null;
	syncStatus: IDBSyncStatus;
	save: (value: T) => Promise<boolean>;
	load: () => Promise<T | null>;
	clear: () => Promise<boolean>;
}

export function useIndexedDB<T = StoredTournamentSnapshot>(
	options: UseIndexedDBOptions<T> = {},
): UseIndexedDBResult<T> {
	const {
		dbName = INDEXED_DB_CONFIG.DB_NAME,
		storeName = INDEXED_DB_CONFIG.STORES.TOURNAMENTS,
		key = INDEXED_DB_CONFIG.KEYS.ACTIVE_TOURNAMENT,
		initialValue = null,
		syncWithStore = false,
		debounceMs = 300,
		onHydrate,
		onError,
	} = options;

	const [data, setData] = useState<T | null>(initialValue);
	const [isLoading, setIsLoading] = useState(true);
	const [isReady, setIsReady] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [syncStatus, setSyncStatus] = useState<IDBSyncStatus>("idle");

	const isMountedRef = useRef(true);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onHydrateRef = useRef(onHydrate);
	onHydrateRef.current = onHydrate;
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	// Load data from IndexedDB
	const load = useCallback(async (): Promise<T | null> => {
		if (!IS_BROWSER) {
			return null;
		}
		try {
			setIsLoading(true);
			setSyncStatus("loading");
			const record = await getRecordFromDB<T>(storeName, key, dbName);
			if (!isMountedRef.current) {
				return record;
			}
			setData(record);
			setError(null);
			setSyncStatus(record ? "synced" : "idle");
			setIsReady(true);
			if (record !== null && onHydrateRef.current) {
				onHydrateRef.current(record);
			}

			// If syncWithStore is enabled and record is a tournament snapshot, sync into useAppStore
			if (syncWithStore && record) {
				const snapshot = record as unknown as StoredTournamentSnapshot;
				const current = useAppStore.getState().tournament;
				const isCurrentEmpty =
					!current.names &&
					(!current.selectedNames || current.selectedNames.length === 0) &&
					(!current.ratings || Object.keys(current.ratings).length === 0);

				if (
					isCurrentEmpty ||
					(snapshot.lastUpdated &&
						(!current.lastUpdated || snapshot.lastUpdated > current.lastUpdated))
				) {
					useAppStore.getState().tournamentActions.replaceTournamentState({
						...current,
						names: snapshot.names ?? null,
						ratings: snapshot.ratings ?? {},
						isComplete: Boolean(snapshot.isComplete),
						voteHistory: Array.isArray(snapshot.voteHistory) ? snapshot.voteHistory : [],
						selectedNames: Array.isArray(snapshot.selectedNames) ? snapshot.selectedNames : [],
						matchHistory: Array.isArray(snapshot.matchHistory) ? snapshot.matchHistory : undefined,
						currentRound:
							typeof snapshot.currentRound === "number" ? snapshot.currentRound : undefined,
						currentMatch:
							typeof snapshot.currentMatch === "number" ? snapshot.currentMatch : undefined,
						totalMatches:
							typeof snapshot.totalMatches === "number" ? snapshot.totalMatches : undefined,
						mode: snapshot.mode,
						teams: snapshot.teams,
						bracketEntrants: snapshot.bracketEntrants,
						lastUpdated: snapshot.lastUpdated,
					});
				}
			}

			return record;
		} catch (err) {
			const wrapped = err instanceof Error ? err : new Error(String(err));
			if (isMountedRef.current) {
				setError(wrapped);
				setSyncStatus("error");
				onErrorRef.current?.(wrapped);
			}
			return null;
		} finally {
			if (isMountedRef.current) {
				setIsLoading(false);
			}
		}
	}, [dbName, key, storeName, syncWithStore]);

	// Save data to IndexedDB
	const save = useCallback(
		async (value: T): Promise<boolean> => {
			if (!IS_BROWSER) {
				return false;
			}
			try {
				setSyncStatus("saving");
				await setRecordInDB<T>(storeName, key, value, dbName);
				if (isMountedRef.current) {
					setData(value);
					setError(null);
					setSyncStatus("synced");
				}
				return true;
			} catch (err) {
				const wrapped = err instanceof Error ? err : new Error(String(err));
				if (isMountedRef.current) {
					setError(wrapped);
					setSyncStatus("error");
					onErrorRef.current?.(wrapped);
				}
				return false;
			}
		},
		[dbName, key, storeName],
	);

	// Clear data from IndexedDB
	const clear = useCallback(async (): Promise<boolean> => {
		if (!IS_BROWSER) {
			return false;
		}
		try {
			await deleteRecordFromDB(storeName, key, dbName);
			if (isMountedRef.current) {
				setData(null);
				setError(null);
				setSyncStatus("idle");
			}
			return true;
		} catch (err) {
			const wrapped = err instanceof Error ? err : new Error(String(err));
			if (isMountedRef.current) {
				setError(wrapped);
				setSyncStatus("error");
				onErrorRef.current?.(wrapped);
			}
			return false;
		}
	}, [dbName, key, storeName]);

	// Initial load on mount
	useEffect(() => {
		isMountedRef.current = true;
		void load();

		return () => {
			isMountedRef.current = false;
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [load]);

	// Automatic bidirectional synchronization with useAppStore if requested
	useEffect(() => {
		if (!syncWithStore || !IS_BROWSER) {
			return;
		}

		// Subscribe to tournament changes in useAppStore
		const unsubscribe = useAppStore.subscribe((state) => {
			const t = state.tournament;
			const isEmpty =
				!t.names &&
				(!t.selectedNames || t.selectedNames.length === 0) &&
				(!t.ratings || Object.keys(t.ratings).length === 0) &&
				(!t.voteHistory || t.voteHistory.length === 0) &&
				(!t.matchHistory || t.matchHistory.length === 0);

			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			if (isEmpty) {
				void clear();
				return;
			}

			setSyncStatus("saving");
			debounceTimerRef.current = setTimeout(() => {
				const snapshot: StoredTournamentSnapshot = {
					names: t.names,
					ratings: t.ratings,
					isComplete: t.isComplete,
					voteHistory: t.voteHistory,
					selectedNames: t.selectedNames,
					matchHistory: t.matchHistory,
					currentRound: t.currentRound,
					currentMatch: t.currentMatch,
					totalMatches: t.totalMatches,
					mode: t.mode,
					teams: t.teams,
					bracketEntrants: t.bracketEntrants,
					lastUpdated: t.lastUpdated ?? Date.now(),
				};
				void save(snapshot as unknown as T);
			}, debounceMs);
		});

		return () => {
			unsubscribe();
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [clear, debounceMs, save, syncWithStore]);

	return {
		data,
		isLoading,
		isReady,
		error,
		syncStatus,
		save,
		load,
		clear,
	};
}

/**
 * Specialized hook for offline-first tournament persistence with IndexedDB and useAppStore.
 */
export function useTournamentIndexedDB(
	options?: Omit<UseIndexedDBOptions<StoredTournamentSnapshot>, "storeName" | "key">,
): UseIndexedDBResult<StoredTournamentSnapshot> {
	return useIndexedDB<StoredTournamentSnapshot>({
		storeName: INDEXED_DB_CONFIG.STORES.TOURNAMENTS,
		key: INDEXED_DB_CONFIG.KEYS.ACTIVE_TOURNAMENT,
		syncWithStore: true,
		...options,
	});
}

// ============================================================================
// 4. useSectionScroll
// ============================================================================
export function useSectionScroll() {
	const prefersReducedMotion = usePrefersReducedMotion();
	const pendingScrollRef = useRef<number | null>(null);

	const clearPendingScroll = useCallback(() => {
		if (pendingScrollRef.current === null) {
			return;
		}
		window.clearTimeout(pendingScrollRef.current);
		pendingScrollRef.current = null;
	}, []);

	const scrollToSection = useCallback(
		(id: string) => {
			clearPendingScroll();
			pendingScrollRef.current = window.setTimeout(() => {
				const targetId =
					id === "stats" || id === "stats-section" || id === "results"
						? "analysis"
						: id === "pick-names-section" ||
								id === "tournament" ||
								id === "tournament-section" ||
								id === "contenders"
							? "pick"
							: id;
				const element = document.getElementById(targetId) || document.getElementById(id);
				if (element) {
					element.scrollIntoView?.({
						behavior: prefersReducedMotion ? "auto" : "smooth",
						block: "start",
					});
				} else if (id === "landing" || id === "top") {
					window.scrollTo({
						top: 0,
						behavior: prefersReducedMotion ? "auto" : "smooth",
					});
				}
				pendingScrollRef.current = null;
			}, 10);
		},
		[clearPendingScroll, prefersReducedMotion],
	);

	const scheduleSectionScroll = useCallback(
		(id: string, delay: number = 800) => {
			clearPendingScroll();
			pendingScrollRef.current = window.setTimeout(() => {
				pendingScrollRef.current = null;
				scrollToSection(id);
			}, delay);
		},
		[clearPendingScroll, scrollToSection],
	);

	return { scrollToSection, scheduleSectionScroll, clearPendingScroll };
}

// ============================================================================
// 4. useAsyncData
// ============================================================================
interface UseAsyncDataOptions {
	deps?: unknown[];
}

interface UseAsyncDataResult<T> {
	data: T;
	isLoading: boolean;
	error: Error | null;
	refresh: () => Promise<void>;
}

export function useAsyncData<T>(
	fetcher: (signal?: AbortSignal) => Promise<T>,
	initialValue: T,
	options: UseAsyncDataOptions = EMPTY_OPTIONS,
): UseAsyncDataResult<T> {
	const { deps = EMPTY_ARRAY } = options;
	const [data, setData] = useState<T>(initialValue);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const fetcherRef = useRef(fetcher);
	useEffect(() => {
		fetcherRef.current = fetcher;
	}, [fetcher]);

	const abortRef = useRef<AbortController | null>(null);

	const run = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setIsLoading(true);
		setError(null);
		try {
			const result = await fetcherRef.current(controller.signal);
			if (!controller.signal.aborted) {
				setData(result);
			}
		} catch (error) {
			if (!controller.signal.aborted) {
				setError(error instanceof Error ? error : new Error(String(error)));
			}
		} finally {
			if (!controller.signal.aborted) {
				setIsLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		let isActive = true;
		const controller = new AbortController();
		setIsLoading(true);
		setError(null);

		fetcherRef
			.current(controller.signal)
			.then((result) => {
				if (isActive) {
					setData(result);
				}
			})
			.catch((error) => {
				if (isActive && error?.name !== "AbortError") {
					setError(error instanceof Error ? error : new Error(String(error)));
				}
			})
			.finally(() => {
				if (isActive) {
					setIsLoading(false);
				}
			});

		return () => {
			isActive = false;
			controller.abort();
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: caller supplies dependency list
	}, deps);

	return { data, isLoading, error, refresh: run };
}

// ============================================================================
// 5. useNamesCache
// ============================================================================
interface CacheEntry {
	data: NameItem[];
	timestamp: number;
}

const _CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const _CACHE_KEY = "names_cache_v2";

function isNameItemArray(value: unknown): value is NameItem[] {
	return Array.isArray(value);
}

function _isCacheEntry(value: unknown): value is CacheEntry {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<CacheEntry>;
	return typeof candidate.timestamp === "number" && isNameItemArray(candidate.data);
}

// ============================================================================
// 6. usePreloadImages (Critical Shell Image Preloader)
// ============================================================================

interface UsePreloadImagesOptions {
	enabled?: boolean;
	crossOrigin?: "anonymous" | "use-credentials";
	onComplete?: (loadedUrls: string[], failedUrls: string[]) => void;
	onError?: (failedUrl: string) => void;
}

interface UsePreloadImagesResult {
	isLoading: boolean;
	isLoaded: boolean;
	progress: number; // 0.0 to 1.0
	loadedCount: number;
	totalCount: number;
	loadedUrls: string[];
	failedUrls: string[];
}

// Module-level cache of successfully preloaded URLs across component lifecycles
const globalPreloadedImageCache = new Set<string>();

/**
 * Preload a single image URL into memory/browser cache.
 */
export function preloadImage(
	src: string,
	crossOrigin?: "anonymous" | "use-credentials",
): Promise<boolean> {
	if (!src || !IS_BROWSER) {
		return Promise.resolve(false);
	}
	if (globalPreloadedImageCache.has(src)) {
		return Promise.resolve(true);
	}

	return new Promise((resolve) => {
		const img = new Image();
		if (crossOrigin && !src.startsWith("data:") && !src.startsWith("blob:")) {
			img.crossOrigin = crossOrigin;
		}

		img.onload = () => {
			globalPreloadedImageCache.add(src);
			resolve(true);
		};

		img.onerror = () => {
			resolve(false);
		};

		img.src = src;
	});
}

/**
 * Preload a list of image URLs in parallel.
 */
export async function preloadImages(
	srcs: readonly string[],
	crossOrigin?: "anonymous" | "use-credentials",
): Promise<boolean[]> {
	if (!IS_BROWSER || !srcs.length) {
		return [];
	}
	return Promise.all(srcs.map((src) => preloadImage(src, crossOrigin)));
}

/**
 * React hook to pre-load critical images defined in the app shell or passed as arguments.
 */
export function usePreloadImages(
	images: readonly string[] = CRITICAL_SHELL_IMAGES,
	options: UsePreloadImagesOptions = EMPTY_OPTIONS,
): UsePreloadImagesResult {
	const { enabled = true, crossOrigin, onComplete, onError } = options;

	const [loadedUrls, setLoadedUrls] = useState<string[]>(() => {
		if (!IS_BROWSER) {
			return [];
		}
		return images.filter((img) => globalPreloadedImageCache.has(img));
	});
	const [failedUrls, setFailedUrls] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(() => {
		if (!enabled || !IS_BROWSER || images.length === 0) {
			return false;
		}
		return !images.every((img) => globalPreloadedImageCache.has(img));
	});

	const onCompleteRef = useRef(onComplete);
	const onErrorRef = useRef(onError);

	useEffect(() => {
		onCompleteRef.current = onComplete;
		onErrorRef.current = onError;
	}, [onComplete, onError]);

	useEffect(() => {
		if (!enabled || !IS_BROWSER || images.length === 0) {
			setIsLoading(false);
			return;
		}

		let isCancelled = false;
		const activeImages = Array.from(new Set(images.filter(Boolean)));
		const total = activeImages.length;

		if (total === 0) {
			setIsLoading(false);
			return;
		}

		const alreadyLoaded = activeImages.filter((src) => globalPreloadedImageCache.has(src));
		if (alreadyLoaded.length === total) {
			setLoadedUrls(alreadyLoaded);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		let completedCount = 0;
		const currentLoaded: string[] = [...alreadyLoaded];
		const currentFailed: string[] = [];

		const checkFinish = () => {
			if (isCancelled) {
				return;
			}
			if (completedCount >= total) {
				setIsLoading(false);
				onCompleteRef.current?.(currentLoaded, currentFailed);
			}
		};

		for (const src of activeImages) {
			if (globalPreloadedImageCache.has(src)) {
				completedCount++;
				checkFinish();
				continue;
			}

			const img = new Image();
			if (crossOrigin && !src.startsWith("data:") && !src.startsWith("blob:")) {
				img.crossOrigin = crossOrigin;
			}

			img.onload = () => {
				if (isCancelled) {
					return;
				}
				globalPreloadedImageCache.add(src);
				currentLoaded.push(src);
				setLoadedUrls((prev) => (prev.includes(src) ? prev : [...prev, src]));
				completedCount++;
				checkFinish();
			};

			img.onerror = () => {
				if (isCancelled) {
					return;
				}
				currentFailed.push(src);
				setFailedUrls((prev) => (prev.includes(src) ? prev : [...prev, src]));
				onErrorRef.current?.(src);
				completedCount++;
				checkFinish();
			};

			img.src = src;
		}

		return () => {
			isCancelled = true;
		};
	}, [images, enabled, crossOrigin]);

	const totalCount = images.length;
	const loadedCount = loadedUrls.length;
	const isLoaded =
		!isLoading && (totalCount === 0 || loadedCount + failedUrls.length >= totalCount);
	const progress =
		totalCount === 0 ? 1 : Math.min(1, (loadedCount + failedUrls.length) / totalCount);

	return {
		isLoading,
		isLoaded,
		progress,
		loadedCount,
		totalCount,
		loadedUrls,
		failedUrls,
	};
}
