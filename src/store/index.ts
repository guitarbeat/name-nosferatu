import { useEffect } from "react";
import { create, type StateCreator } from "zustand";
import { CAT_IMAGES, STORAGE_KEYS } from "@/shared/lib/constants";
import {
	clearStoredTournamentFromIDB,
	getStoredTournamentFromIDB,
	saveStoredTournamentToIDB,
} from "@/shared/lib/indexedDB";
import {
	clearStoredTournamentSnapshot,
	clearStoredUserSnapshot,
	getStorageString,
	readStoredTournamentSnapshot,
	readStoredUserSnapshot,
	removeStorageItem,
	type StoredTournamentSnapshot,
	setStorageString,
	writeStoredTournamentSnapshot,
	writeStoredUserSnapshot,
} from "@/shared/lib/storage";
import { getRandomCatImage } from "@/shared/lib/uiUtils";
import { ErrorManager } from "@/shared/lib/utils";
import type {
	CatChosenName,
	ErrorLog,
	ErrorState,
	NameItem,
	RatingData,
	SiteSettingsState,
	ThemePreference,
	ThemeValue,
	TournamentState,
	UIState,
	UserState,
} from "@/shared/types";

type AppSet = Parameters<StateCreator<AppState>>[0];
type AppSliceCreator<TSlice> = StateCreator<AppState, [], [], TSlice>;

const IS_BROWSER = typeof window !== "undefined";
const _IS_DEV = import.meta.env?.DEV ?? false;

function patch<K extends keyof AppState>(set: AppSet, key: K, updates: Partial<AppState[K]>): void {
	set((state) => {
		const current = state[key];
		let hasChanged = false;
		for (const uKey in updates) {
			if (updates[uKey] !== current[uKey as unknown as keyof typeof current]) {
				hasChanged = true;
				break;
			}
		}
		if (!hasChanged) {
			return state;
		}
		return {
			...state,
			[key]: { ...state[key], ...updates },
		};
	});
}

interface TournamentActions {
	setNames: (names: NameItem[] | null) => void;
	setRatings: (
		ratings:
			| Record<string, RatingData>
			| ((prev: Record<string, RatingData>) => Record<string, RatingData>),
	) => void;
	setComplete: (isComplete: boolean) => void;
	completeTournament: (ratings: Record<string, RatingData>) => void;
	resetTournament: () => void;
	setSelection: (names: NameItem[]) => void;
	recordVote: (
		winnerId: string,
		loserId: string,
		winnerMemberIds?: string[],
		loserMemberIds?: string[],
	) => void;
	undoVote: () => void;
	syncTournamentProgress: (progress: Partial<TournamentState>) => void;
	clearVoteHistory: () => void;
	replaceTournamentState: (snapshot: TournamentState) => void;
}

interface UserActions {
	setUser: (data: Partial<UserState>) => void;
	login: (userName: string, onContext?: (name: string) => void) => void;
	logout: (onContext?: (name: null) => void) => void;
	setAdminStatus: (isAdmin: boolean) => void;
	setAvatar: (avatarUrl: string | undefined) => void;
	initializeFromStorage: (onContext?: (name: string) => void) => void;
}

interface UIActions {
	setTheme: (theme: ThemePreference) => void;
	initializeTheme: () => void;
	setBootLoading: (loading: boolean) => void;
}

interface SiteSettingsActions {
	setCatChosenName: (data: CatChosenName | null) => void;
	markSettingsLoaded: () => void;
}

interface ErrorActions {
	setError: (error: unknown | null) => void;
	clearError: () => void;
	logError: (error: unknown, context: string, metadata?: Record<string, unknown>) => void;
}

interface AppState {
	tournament: TournamentState;
	tournamentActions: TournamentActions;

	user: UserState;
	userActions: UserActions;

	ui: UIState;
	uiActions: UIActions;

	siteSettings: SiteSettingsState;
	siteSettingsActions: SiteSettingsActions;

	errors: ErrorState;
	errorActions: ErrorActions;
}

const MAX_ERROR_HISTORY = 100;

const createErrorSlice: AppSliceCreator<Pick<AppState, "errors" | "errorActions">> = (
	set,
	get,
) => ({
	errors: {
		current: null,
		history: [],
	},

	errorActions: {
		setError: (error) => {
			const log: ErrorLog | null = error
				? {
						error,
						context: "setError",
						metadata: {},
						timestamp: new Date().toISOString(),
					}
				: null;

			patch(set, "errors", {
				current: error,
				history: log
					? [...get().errors.history, log].slice(-MAX_ERROR_HISTORY)
					: get().errors.history,
			});
		},

		clearError: () => patch(set, "errors", { current: null }),

		logError: (error, context, metadata = {}) => {
			const entry: ErrorLog = {
				error,
				context,
				metadata,
				timestamp: new Date().toISOString(),
			};

			patch(set, "errors", {
				history: [...get().errors.history, entry].slice(-MAX_ERROR_HISTORY),
			});

			// Defer to ErrorManager for standardized logging
			ErrorManager.handleError(error, context, metadata);
		},
	},
});

function getInitialTournamentState(): TournamentState {
	const base: TournamentState = {
		names: null,
		ratings: {},
		isComplete: false,
		isLoading: false,
		voteHistory: [],
		selectedNames: [],
	};

	if (!IS_BROWSER) {
		return base;
	}

	const stored = readStoredTournamentSnapshot();
	if (!stored) {
		return base;
	}

	return {
		...base,
		names: stored.names ?? null,
		ratings: stored.ratings ?? {},
		isComplete: Boolean(stored.isComplete),
		voteHistory: Array.isArray(stored.voteHistory) ? stored.voteHistory : [],
		selectedNames: Array.isArray(stored.selectedNames) ? stored.selectedNames : [],
		matchHistory: Array.isArray(stored.matchHistory) ? stored.matchHistory : undefined,
		currentRound: typeof stored.currentRound === "number" ? stored.currentRound : undefined,
		currentMatch: typeof stored.currentMatch === "number" ? stored.currentMatch : undefined,
		totalMatches: typeof stored.totalMatches === "number" ? stored.totalMatches : undefined,
		mode: stored.mode,
		teams: stored.teams,
		bracketEntrants: stored.bracketEntrants,
		lastUpdated: stored.lastUpdated,
	};
}

function persistTournamentState(tournament: TournamentState): void {
	if (!IS_BROWSER) {
		return;
	}

	if (
		!tournament.names &&
		(!tournament.selectedNames || tournament.selectedNames.length === 0) &&
		(!tournament.ratings || Object.keys(tournament.ratings).length === 0) &&
		(!tournament.voteHistory || tournament.voteHistory.length === 0) &&
		(!tournament.matchHistory || tournament.matchHistory.length === 0)
	) {
		clearStoredTournamentSnapshot();
		void clearStoredTournamentFromIDB();
		return;
	}

	const snapshot: StoredTournamentSnapshot = {
		names: tournament.names,
		ratings: tournament.ratings,
		isComplete: tournament.isComplete,
		voteHistory: tournament.voteHistory,
		selectedNames: tournament.selectedNames,
		matchHistory: tournament.matchHistory,
		currentRound: tournament.currentRound,
		currentMatch: tournament.currentMatch,
		totalMatches: tournament.totalMatches,
		mode: tournament.mode,
		teams: tournament.teams,
		bracketEntrants: tournament.bracketEntrants,
		lastUpdated: Date.now(),
	};

	writeStoredTournamentSnapshot(snapshot);
	void saveStoredTournamentToIDB(snapshot);
}

const createTournamentSlice: AppSliceCreator<Pick<AppState, "tournament" | "tournamentActions">> = (
	set,
	get,
) => ({
	tournament: getInitialTournamentState(),

	tournamentActions: {
		setNames: (names) => {
			const currentRatings = get().tournament.ratings;
			const processedNames =
				names?.map((name) => {
					const entry = currentRatings[name.id] ?? currentRatings[name.name];
					const ratingVal =
						typeof entry === "number"
							? entry
							: typeof entry === "object" && entry !== null
								? entry.rating
								: undefined;

					return {
						...name,
						rating: ratingVal ?? name.rating ?? name.avgRating ?? name.avg_rating ?? 1500,
					};
				}) ?? null;

			const nextTournament: TournamentState = {
				...get().tournament,
				names: processedNames,
				isComplete: false,
				matchHistory: [],
				currentRound: 1,
				currentMatch: 1,
				bracketEntrants: [],
				voteHistory: [],
			};
			patch(set, "tournament", {
				names: processedNames,
				isComplete: false,
				matchHistory: [],
				currentRound: 1,
				currentMatch: 1,
				bracketEntrants: [],
				voteHistory: [],
			});
			persistTournamentState(nextTournament);
		},

		setRatings: (ratingsOrFn) => {
			const current = get().tournament.ratings;
			const nextRatings = typeof ratingsOrFn === "function" ? ratingsOrFn(current) : ratingsOrFn;
			const mergedRatings = { ...current, ...nextRatings };
			const nextTournament = {
				...get().tournament,
				ratings: mergedRatings,
			};
			patch(set, "tournament", { ratings: mergedRatings });
			persistTournamentState(nextTournament);
		},

		setComplete: (isComplete) => {
			const nextTournament = {
				...get().tournament,
				isComplete,
			};
			patch(set, "tournament", { isComplete });
			persistTournamentState(nextTournament);
		},

		completeTournament: (ratings) => {
			const current = get().tournament.ratings;
			const mergedRatings = { ...current, ...ratings };
			const nextTournament = {
				...get().tournament,
				ratings: mergedRatings,
				isComplete: true,
			};
			patch(set, "tournament", {
				ratings: mergedRatings,
				isComplete: true,
			});
			persistTournamentState(nextTournament);
		},

		resetTournament: () => {
			const nextTournament: TournamentState = {
				...get().tournament,
				names: null,
				isComplete: false,
				voteHistory: [],
				matchHistory: [],
				currentRound: 1,
				currentMatch: 1,
				bracketEntrants: [],
				ratings: {},
			};
			patch(set, "tournament", {
				names: null,
				isComplete: false,
				voteHistory: [],
				matchHistory: [],
				currentRound: 1,
				currentMatch: 1,
				bracketEntrants: [],
				ratings: {},
			});
			persistTournamentState(nextTournament);
		},

		setSelection: (selectedNames) => {
			const nextTournament = {
				...get().tournament,
				selectedNames,
			};
			patch(set, "tournament", { selectedNames });
			persistTournamentState(nextTournament);
		},

		recordVote: (winnerId, loserId, winnerMemberIds, loserMemberIds) => {
			const prev = get().tournament.voteHistory;
			const newVote = {
				winnerId,
				loserId,
				timestamp: Date.now(),
				...(winnerMemberIds ? { winnerMemberIds } : {}),
				...(loserMemberIds ? { loserMemberIds } : {}),
			};
			const nextHistory = [...prev, newVote];
			const nextTournament = {
				...get().tournament,
				voteHistory: nextHistory,
			};
			patch(set, "tournament", {
				voteHistory: nextHistory,
			});
			persistTournamentState(nextTournament);
		},

		undoVote: () => {
			const prev = get().tournament.voteHistory;
			const nextHistory = prev.slice(0, -1);
			const prevMatchHistory = get().tournament.matchHistory;
			const nextMatchHistory = prevMatchHistory ? prevMatchHistory.slice(0, -1) : undefined;
			const nextTournament = {
				...get().tournament,
				voteHistory: nextHistory,
				matchHistory: nextMatchHistory,
			};
			patch(set, "tournament", {
				voteHistory: nextHistory,
				matchHistory: nextMatchHistory,
			});
			persistTournamentState(nextTournament);
		},

		syncTournamentProgress: (progressUpdates) => {
			const current = get().tournament;
			const nextRatings = progressUpdates.ratings
				? { ...current.ratings, ...progressUpdates.ratings }
				: current.ratings;
			const nextTournament: TournamentState = {
				...current,
				...progressUpdates,
				ratings: nextRatings,
				lastUpdated: Date.now(),
			};
			patch(set, "tournament", {
				...progressUpdates,
				ratings: nextRatings,
				lastUpdated: nextTournament.lastUpdated,
			});
			persistTournamentState(nextTournament);
		},

		clearVoteHistory: () => {
			const nextTournament = {
				...get().tournament,
				voteHistory: [],
			};
			patch(set, "tournament", { voteHistory: [] });
			persistTournamentState(nextTournament);
		},

		replaceTournamentState: (snapshot: TournamentState) => {
			set({ tournament: { ...snapshot } });
			persistTournamentState(snapshot);
		},
	},
});

let systemThemeCleanup: (() => void) | null = null;

function getInitialUserState(): UserState {
	const base: UserState = {
		id: null,
		name: "",
		isLoggedIn: false,
		isAdmin: false,
		preferences: {},
	};

	if (!IS_BROWSER) {
		return base;
	}

	const storedSnapshot = readStoredUserSnapshot();
	if (!storedSnapshot) {
		return base;
	}

	return {
		...base,
		id: storedSnapshot.id ?? null,
		name: storedSnapshot.name,
		isLoggedIn: true,
		isAdmin: Boolean(storedSnapshot.isAdmin),
		avatarUrl: storedSnapshot.avatarUrl,
	};
}

function getInitialTheme(): Pick<UIState, "theme" | "themePreference"> {
	if (!IS_BROWSER) {
		return { theme: "dark", themePreference: "dark" };
	}

	const stored = getStorageString(STORAGE_KEYS.THEME);
	if (stored === "light" || stored === "dark" || stored === "system") {
		let prefersDark = true;
		try {
			if (typeof window.matchMedia === "function") {
				prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			}
		} catch {
			prefersDark = true;
		}

		const resolved: ThemeValue = stored === "system" ? (prefersDark ? "dark" : "light") : stored;

		return { theme: resolved, themePreference: stored };
	}

	return { theme: "dark", themePreference: "dark" };
}

function persistOptionalString(key: string, value: string | undefined): void {
	if (value) {
		setStorageString(key, value);
		return;
	}

	removeStorageItem(key);
}

function readThemePreferenceFromStorage(): ThemePreference {
	const stored = getStorageString(STORAGE_KEYS.THEME) ?? "dark";
	return ["light", "dark", "system"].includes(stored) ? (stored as ThemePreference) : "dark";
}

function persistUserState(user: UserState): void {
	if (!user.name.trim()) {
		clearStoredUserSnapshot();
		return;
	}

	writeStoredUserSnapshot({
		id: user.id,
		name: user.name,
		isAdmin: user.isAdmin,
		avatarUrl: user.avatarUrl,
	});
}

const createUserAndSettingsSlice: AppSliceCreator<
	Pick<
		AppState,
		"user" | "userActions" | "ui" | "uiActions" | "siteSettings" | "siteSettingsActions"
	>
> = (set, get) => ({
	user: getInitialUserState(),

	userActions: {
		setUser: (data) => {
			const nextUser = { ...get().user, ...data };
			patch(set, "user", data);
			persistUserState(nextUser);
		},

		login: (userName, onContext) => {
			const id = `user_${Math.random().toString(36).substring(2, 9)}`;
			const avatarUrl = getRandomCatImage(id, CAT_IMAGES, userName);
			const nextUser = {
				...get().user,
				id,
				name: userName,
				isLoggedIn: true,
				isAdmin: false,
				avatarUrl,
			};
			patch(set, "user", nextUser);
			persistUserState(nextUser);
			onContext?.(userName);
		},

		logout: (onContext) => {
			clearStoredUserSnapshot();
			clearStoredTournamentSnapshot();
			onContext?.(null);
			set((state) => ({
				...state,
				user: { ...state.user, name: "", isLoggedIn: false, isAdmin: false },
				tournament: {
					...state.tournament,
					names: null,
					isComplete: false,
					voteHistory: [],
				},
			}));
		},

		setAdminStatus: (isAdmin) => {
			const nextUser = { ...get().user, isAdmin };
			patch(set, "user", { isAdmin });
			persistUserState(nextUser);
		},

		setAvatar: (avatarUrl) => {
			const nextUser = { ...get().user, avatarUrl };
			patch(set, "user", { avatarUrl });
			persistOptionalString(STORAGE_KEYS.USER_AVATAR, avatarUrl);
			persistUserState(nextUser);
		},

		initializeFromStorage: (onContext) => {
			const storedUser = readStoredUserSnapshot();
			const updates: Partial<UserState> = {};

			if (storedUser && get().user.name !== storedUser.name) {
				onContext?.(storedUser.name);
				updates.name = storedUser.name;
				updates.isLoggedIn = true;
			}

			if (storedUser?.id && get().user.id !== storedUser.id) {
				updates.id = storedUser.id;
			}

			if (storedUser && get().user.isAdmin !== Boolean(storedUser.isAdmin)) {
				updates.isAdmin = Boolean(storedUser.isAdmin);
			}

			if (storedUser?.avatarUrl && get().user.avatarUrl !== storedUser.avatarUrl) {
				updates.avatarUrl = storedUser.avatarUrl;
			}

			if (Object.keys(updates).length > 0) {
				patch(set, "user", updates);
			}
		},
	},

	ui: {
		...getInitialTheme(),
		isBootLoading: true,
	},

	uiActions: {
		setTheme: (preference) => {
			systemThemeCleanup?.();
			systemThemeCleanup = null;

			if (preference !== "system" || !IS_BROWSER) {
				const resolved = preference === "light" ? "light" : "dark";
				patch(set, "ui", { theme: resolved, themePreference: preference });
				setStorageString(STORAGE_KEYS.THEME, preference);
				return;
			}

			let resolved: ThemeValue = "dark";
			try {
				if (typeof window.matchMedia === "function") {
					const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
					resolved = mediaQuery.matches ? "dark" : "light";

					const handleChange = (event: MediaQueryListEvent) => {
						if (get().ui.themePreference === "system") {
							patch(set, "ui", { theme: event.matches ? "dark" : "light" });
						}
					};

					if (mediaQuery.addEventListener) {
						mediaQuery.addEventListener("change", handleChange);
						systemThemeCleanup = () => mediaQuery.removeEventListener("change", handleChange);
					} else if (mediaQuery.addListener) {
						mediaQuery.addListener(handleChange);
						systemThemeCleanup = () => mediaQuery.removeListener(handleChange);
					}
				}
			} catch {
				resolved = "dark";
			}

			patch(set, "ui", { theme: resolved, themePreference: preference });
			setStorageString(STORAGE_KEYS.THEME, preference);
		},

		initializeTheme: () => {
			if (!IS_BROWSER) {
				return;
			}

			get().uiActions.setTheme(readThemePreferenceFromStorage());
		},

		setBootLoading: (loading) => patch(set, "ui", { isBootLoading: loading }),
	},

	siteSettings: {
		catChosenName: null,
		isLoaded: false,
	},

	siteSettingsActions: {
		setCatChosenName: (data) => patch(set, "siteSettings", { catChosenName: data }),
		markSettingsLoaded: () => patch(set, "siteSettings", { isLoaded: true }),
	},
});

const useAppStore = create<AppState>()((...args) => ({
	...createTournamentSlice(...args),
	...createUserAndSettingsSlice(...args),
	...createErrorSlice(...args),
}));

export default useAppStore;

/**
 * Hydrates tournament state from IndexedDB if in-memory state is empty or IndexedDB snapshot is newer.
 */
export async function hydrateTournamentFromIndexedDB(): Promise<StoredTournamentSnapshot | null> {
	if (!IS_BROWSER) {
		return null;
	}

	try {
		const stored = await getStoredTournamentFromIDB();
		if (!stored) {
			return null;
		}

		const current = useAppStore.getState().tournament;
		const isCurrentEmpty =
			!current.names &&
			(!current.selectedNames || current.selectedNames.length === 0) &&
			(!current.ratings || Object.keys(current.ratings).length === 0);

		if (
			isCurrentEmpty ||
			(stored.lastUpdated && (!current.lastUpdated || stored.lastUpdated > current.lastUpdated))
		) {
			useAppStore.getState().tournamentActions.replaceTournamentState({
				...current,
				names: stored.names ?? null,
				ratings: stored.ratings ?? {},
				isComplete: Boolean(stored.isComplete),
				voteHistory: Array.isArray(stored.voteHistory) ? stored.voteHistory : [],
				selectedNames: Array.isArray(stored.selectedNames) ? stored.selectedNames : [],
				matchHistory: Array.isArray(stored.matchHistory) ? stored.matchHistory : undefined,
				currentRound: typeof stored.currentRound === "number" ? stored.currentRound : undefined,
				currentMatch: typeof stored.currentMatch === "number" ? stored.currentMatch : undefined,
				totalMatches: typeof stored.totalMatches === "number" ? stored.totalMatches : undefined,
				mode: stored.mode,
				teams: stored.teams,
				bracketEntrants: stored.bracketEntrants,
				lastUpdated: stored.lastUpdated,
			});
		}
		return stored;
	} catch (err) {
		ErrorManager.handleError(err, "hydrateTournamentFromIndexedDB");
		return null;
	}
}

export function useAppStoreInitialization(onUserContext?: (name: string) => void): void {
	const initializeUser = useAppStore((state) => state.userActions.initializeFromStorage);
	const initializeTheme = useAppStore((state) => state.uiActions.initializeTheme);

	useEffect(() => {
		initializeUser(onUserContext);
		initializeTheme();
		void hydrateTournamentFromIndexedDB();
	}, [initializeTheme, initializeUser, onUserContext]);
}

export const errorContexts = {
	tournamentFlow: "Tournament Flow",
	analysisDashboard: "Analysis Dashboard",
	mainLayout: "Main Application Layout",
} as const;

// Atomic selector hooks to eliminate unnecessary component re-renders
export const useTournament = () => useAppStore((state) => state.tournament);
export const useTournamentActions = () => useAppStore((state) => state.tournamentActions);
export const useTournamentIsComplete = () => useAppStore((state) => state.tournament.isComplete);
export const useTournamentNames = () => useAppStore((state) => state.tournament.names);
export const useTournamentRatings = () => useAppStore((state) => state.tournament.ratings);
export const useTournamentSelectedNames = () =>
	useAppStore((state) => state.tournament.selectedNames);

export const useUser = () => useAppStore((state) => state.user);
export const useUserName = () => useAppStore((state) => state.user.name);
export const useIsLoggedIn = () => useAppStore((state) => state.user.isLoggedIn);
export const useIsAdmin = () => useAppStore((state) => state.user.isAdmin);
export const useUserAvatar = () => useAppStore((state) => state.user.avatarUrl);
export const useUserActions = () => useAppStore((state) => state.userActions);

export const useTheme = () => useAppStore((state) => state.ui.theme);
export const useThemePreference = () => useAppStore((state) => state.ui.themePreference);
export const useIsBootLoading = () => useAppStore((state) => state.ui.isBootLoading);
export const useUIActions = () => useAppStore((state) => state.uiActions);

export const useSiteSettings = () => useAppStore((state) => state.siteSettings);
export const useCatChosenName = () => useAppStore((state) => state.siteSettings.catChosenName);
export const useSiteSettingsActions = () => useAppStore((state) => state.siteSettingsActions);

export const useErrorState = () => useAppStore((state) => state.errors);
export const useErrorActions = () => useAppStore((state) => state.errorActions);
