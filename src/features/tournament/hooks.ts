import DOMPurify from "dompurify";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { useToast } from "@/app/Providers";
import { addName, ratingsAPI } from "@/shared/api";
import { useIndexedDB, useLocalStorage, useTournamentIndexedDB } from "@/shared/hooks";
import { ELO_RATING, TIMING } from "@/shared/lib/constants";
import { createSortedKey, ErrorManager, shuffleArray } from "@/shared/lib/utils";

import type {
	Match,
	MatchRecord,
	NameItem,
	PersistentTournamentState,
	RatingData,
	Team,
	TeamMatch,
	TournamentMode,
} from "@/shared/types";
import useAppStore from "@/store";
import {
	calculateTournamentMetrics,
	calculateWinStreak,
	computeUpdatedRatings,
	createIdToNameMap,
	createMatchRecord,
	createTeamsById,
	deriveBracketState,
	generateRandomTeams,
	getHeatLevel,
	getMatchSideId,
	type HistoryEntry,
	resolveCurrentMatch,
	resolveTournamentMode,
} from "./tournamentEngine";

// ============================================================================
// 1. useTimedState Hook (Consolidated from useTimedState.ts)
// ============================================================================

const EMPTY_OPTIONS: Record<string, never> = {};

export function useTimedState<T>(defaultValue: T) {
	const [value, setValue] = useState<T>(defaultValue);
	const timeoutRef = useRef<number | null>(null);
	const defaultRef = useRef(defaultValue);

	useEffect(() => {
		defaultRef.current = defaultValue;
	}, [defaultValue]);

	const clear = useCallback(() => {
		if (timeoutRef.current !== null) {
			window.clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	const setTimed = useCallback(
		(newValue: T, durationMs: number) => {
			clear();
			setValue(newValue);
			timeoutRef.current = window.setTimeout(() => {
				setValue(defaultRef.current);
				timeoutRef.current = null;
			}, durationMs);
		},
		[clear],
	);

	useEffect(() => clear, [clear]);

	return { value, set: setValue, setTimed, clear } as const;
}

// ============================================================================
// 2. useStreakCalculator Hook (Consolidated from useStreakCalculator.ts)
// ============================================================================

export function useStreakCalculator(currentMatch: Match | null, matchHistory: MatchRecord[]) {
	const calculateContestantStreak = useCallback(
		(contestantId: string | number | null | undefined) =>
			calculateWinStreak(contestantId, matchHistory),
		[matchHistory],
	);

	const leftStreak = useMemo(
		() => (currentMatch ? calculateContestantStreak(getMatchSideId(currentMatch, "left")) : 0),
		[currentMatch, calculateContestantStreak],
	);

	const rightStreak = useMemo(
		() => (currentMatch ? calculateContestantStreak(getMatchSideId(currentMatch, "right")) : 0),
		[currentMatch, calculateContestantStreak],
	);

	const leftHeatLevel = useMemo(() => getHeatLevel(leftStreak), [leftStreak]);
	const rightHeatLevel = useMemo(() => getHeatLevel(rightStreak), [rightStreak]);

	return {
		leftStreak,
		rightStreak,
		leftHeatLevel,
		rightHeatLevel,
		calculateWinStreak,
	};
}

// ============================================================================
// 3. useTournamentKeyboard Hook (Consolidated from useTournamentKeyboard.ts)
// ============================================================================

function isInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	const tagName = target.tagName;
	return (
		tagName === "INPUT" ||
		tagName === "TEXTAREA" ||
		tagName === "SELECT" ||
		target.isContentEditable
	);
}

interface UseTournamentKeyboardOptions {
	onVoteForSide: (side: "left" | "right") => void;
	onUndo: () => void;
	onQuit: () => void;
	canUndo: boolean;
	isVoting: boolean;
	isOpeningReveal: boolean;
}

export function useTournamentKeyboard({
	onVoteForSide,
	onUndo,
	onQuit,
	canUndo,
	isVoting,
	isOpeningReveal,
}: UseTournamentKeyboardOptions) {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>, side: "left" | "right") => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				onVoteForSide(side);
			}
		},
		[onVoteForSide],
	);

	const handleGlobalKeyDown = useCallback(
		(event: globalThis.KeyboardEvent) => {
			if (isInteractiveTarget(event.target)) {
				return;
			}
			if (isVoting || isOpeningReveal) {
				return;
			}

			const key = event.key.toLowerCase();
			if (key === "1" || key === "arrowleft") {
				event.preventDefault();
				onVoteForSide("left");
			} else if (key === "2" || key === "arrowright") {
				event.preventDefault();
				onVoteForSide("right");
			} else if (key === "u" && canUndo) {
				event.preventDefault();
				onUndo();
			} else if (key === "q") {
				event.preventDefault();
				onQuit();
			}
		},
		[isVoting, isOpeningReveal, onVoteForSide, canUndo, onUndo, onQuit],
	);

	return { handleKeyDown, handleGlobalKeyDown };
}

// ============================================================================
// 4. useNameSuggestion Hook (Consolidated from useNameSuggestion.ts)
// ============================================================================

interface UseNameSuggestionProps {
	onSuccess?: () => void;
}

interface UseNameSuggestionResult {
	values: { name: string; description: string };
	errors: { name?: string; description?: string };
	touched: { name?: boolean; description?: boolean };
	isSubmitting: boolean;
	isValid: boolean;
	handleChange: (field: "name" | "description", value: string) => void;
	handleBlur: (field: "name" | "description") => void;
	handleSubmit: () => Promise<void>;
	reset: () => void;
	globalError: string;
	successMessage: string;
	setGlobalError: (error: string) => void;
}

export function useNameSuggestion(
	props: UseNameSuggestionProps = EMPTY_OPTIONS,
): UseNameSuggestionResult {
	const [values, setValues] = useState({ name: "", description: "" });
	const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
	const [touched, setTouched] = useState<{
		name?: boolean;
		description?: boolean;
	}>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [globalError, setGlobalError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	const handleChange = useCallback((field: "name" | "description", value: string) => {
		setValues((previous) => ({ ...previous, [field]: value }));
		setErrors((previous) => ({ ...previous, [field]: undefined }));
		setGlobalError("");
	}, []);

	const handleBlur = useCallback((field: "name" | "description") => {
		setTouched((previous) => ({ ...previous, [field]: true }));
	}, []);

	const validate = useCallback(() => {
		const nextErrors: { name?: string; description?: string } = {};

		if (!values.name.trim()) {
			nextErrors.name = "Name is required";
		}
		if (!values.description.trim()) {
			nextErrors.description = "Description is required";
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	}, [values]);

	const handleSubmit = useCallback(async () => {
		if (!validate()) {
			return;
		}

		setIsSubmitting(true);
		setGlobalError("");
		setSuccessMessage("");

		try {
			const sanitizedName = DOMPurify.sanitize(values.name, {
				ALLOWED_TAGS: [],
			}).trim();
			const sanitizedDescription = DOMPurify.sanitize(values.description, {
				ALLOWED_TAGS: [],
			}).trim();

			await addName({ name: sanitizedName, description: sanitizedDescription });

			setSuccessMessage("Name suggestion submitted successfully!");
			setValues({ name: "", description: "" });
			setTouched({});
			props.onSuccess?.();
		} catch (submitError) {
			setGlobalError(
				submitError instanceof Error ? submitError.message : "Failed to submit suggestion",
			);
		} finally {
			setIsSubmitting(false);
		}
	}, [props, validate, values.description, values.name]);

	const reset = useCallback(() => {
		setValues({ name: "", description: "" });
		setErrors({});
		setTouched({});
		setGlobalError("");
		setSuccessMessage("");
	}, []);

	const isValid = !errors.name && !errors.description && values.name.trim() !== "";

	return {
		values,
		errors,
		touched,
		isSubmitting,
		isValid,
		handleChange,
		handleBlur,
		handleSubmit,
		reset,
		globalError,
		successMessage,
		setGlobalError,
	};
}

// ============================================================================
// 5. useTournamentRealtime Hook & WebSocket Service (Consolidated from useTournamentRealtime.ts)
// ============================================================================

export interface TournamentUpdate {
	tournamentId: string;
	round: number;
	matchNumber: number;
	currentMatch: {
		leftId: string | null;
		rightId: string | null;
	};
	status: "in_progress" | "completed";
}

export interface MatchResult {
	tournamentId: string;
	matchId: string;
	winnerId: string;
	loserId: string;
	newRatings: Record<string, number>;
}

export interface UserActivity {
	userId: string;
	action: "joined" | "left";
	timestamp: number;
}

class TournamentRealtimeService {
	subscribeToTournament(
		_tournamentId: string,
		_callback: (update: TournamentUpdate) => void,
	): () => void {
		return () => {
			/* no-op realtime subscription */
		};
	}
	subscribeToMatches(_callback: (result: MatchResult) => void): () => void {
		return () => {
			/* no-op match subscription */
		};
	}
	subscribeToUserActivity(_callback: (activity: UserActivity) => void): () => void {
		return () => {
			/* no-op user activity subscription */
		};
	}
	cleanup(): void {
		/* no-op */
	}
	acquire(): void {
		/* no-op */
	}
	release(): void {
		/* no-op */
	}
}
let serviceInstance: TournamentRealtimeService | null = null;

function getTournamentRealtimeService(): TournamentRealtimeService {
	if (!serviceInstance) {
		serviceInstance = new TournamentRealtimeService();
	}
	return serviceInstance;
}

interface UseTournamentRealtimeOptions {
	autoConnect?: boolean;
}

export function useTournamentRealtime(options: UseTournamentRealtimeOptions = EMPTY_OPTIONS) {
	const serviceRef = useRef<TournamentRealtimeService | null>(null);

	useEffect(() => {
		if (!serviceRef.current) {
			serviceRef.current = getTournamentRealtimeService();
		}

		if (options.autoConnect) {
			serviceRef.current.acquire();
		}

		return () => {
			if (options.autoConnect) {
				serviceRef.current?.release();
			}
			serviceRef.current = null;
		};
	}, [options.autoConnect]);

	const subscribeToTournament = useCallback(
		(tournamentId: string, callback: (update: TournamentUpdate) => void) => {
			return (
				serviceRef.current?.subscribeToTournament(tournamentId, callback) ??
				(() => {
					/* no-op */
				})
			);
		},
		[],
	);

	const subscribeToMatches = useCallback((callback: (result: MatchResult) => void) => {
		return (
			serviceRef.current?.subscribeToMatches(callback) ??
			(() => {
				/* no-op */
			})
		);
	}, []);

	const subscribeToUserActivity = useCallback((callback: (activity: UserActivity) => void) => {
		return (
			serviceRef.current?.subscribeToUserActivity(callback) ??
			(() => {
				/* no-op */
			})
		);
	}, []);

	const cleanup = useCallback(() => {
		serviceRef.current?.cleanup();
	}, []);

	return {
		subscribeToTournament,
		subscribeToMatches,
		subscribeToUserActivity,
		cleanup,
	};
}

// ============================================================================
// 6. Tournament State persistence helpers (Consolidated from tournamentPersistence.ts)
// ============================================================================

export function createDefaultPersistentState(userName: string): PersistentTournamentState {
	return {
		matchHistory: [],
		currentRound: 1,
		currentMatch: 1,
		totalMatches: 0,
		userName: userName || "anonymous",
		lastUpdated: Date.now(),
		namesKey: "",
		ratings: {},
		mode: "1v1",
		teams: [],
		teamMatches: [],
		teamMatchIndex: 0,
		bracketEntrants: [],
	};
}

export function buildInitialRatings(names: NameItem[]): Record<string, number> {
	const initial: Record<string, number> = {};
	for (const name of names) {
		initial[String(name.id)] = name.rating || ELO_RATING.DEFAULT_RATING;
	}
	return initial;
}

export function createNamesKey(names: NameItem[]): string {
	return createSortedKey(names.map((n) => n?.id || ""));
}

export function createTournamentId(names: NameItem[], userName?: string): string {
	const sortedIds = names
		.map((n) => String(n.id))
		.sort()
		.join(",");
	const prefix = userName || "anonymous";
	let hash = 0;
	for (let i = 0; i < sortedIds.length; i++) {
		hash = ((hash << 5) - hash + sortedIds.charCodeAt(i)) | 0;
	}
	return `tournament-${prefix}-${Math.abs(hash).toString(36)}-${names.length}`;
}

export function createBracketEntrants(participantIds: string[]): string[] {
	return shuffleArray(participantIds);
}

function isValidTeam(value: unknown): value is Team {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Team;
	return (
		typeof candidate.id === "string" &&
		Array.isArray(candidate.memberIds) &&
		candidate.memberIds.length === 2 &&
		Array.isArray(candidate.memberNames) &&
		candidate.memberNames.length === 2
	);
}

function isValidTeamMatch(value: unknown): value is TeamMatch {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as TeamMatch;
	return typeof candidate.leftTeamId === "string" && typeof candidate.rightTeamId === "string";
}

export function sanitizePersistentState(
	persistentStateRaw: unknown,
	userName: string,
): PersistentTournamentState {
	if (
		!persistentStateRaw ||
		typeof persistentStateRaw !== "object" ||
		Array.isArray(persistentStateRaw)
	) {
		return createDefaultPersistentState(userName || "anonymous");
	}

	const merged = {
		...createDefaultPersistentState(userName || "anonymous"),
		...(persistentStateRaw as Record<string, unknown>),
	};

	const mode: TournamentMode = merged.mode === "2v2" ? "2v2" : "1v1";
	const teams = Array.isArray(merged.teams) ? merged.teams.filter(isValidTeam) : [];
	const teamMatches = Array.isArray(merged.teamMatches)
		? merged.teamMatches.filter(isValidTeamMatch)
		: [];

	return {
		...merged,
		mode,
		matchHistory: Array.isArray(merged.matchHistory) ? merged.matchHistory : [],
		ratings: merged.ratings && typeof merged.ratings === "object" ? merged.ratings : {},
		namesKey: typeof merged.namesKey === "string" ? merged.namesKey : "",
		teams,
		teamMatches,
		teamMatchIndex:
			typeof merged.teamMatchIndex === "number" && merged.teamMatchIndex >= 0
				? merged.teamMatchIndex
				: 0,
		bracketEntrants: Array.isArray(merged.bracketEntrants)
			? merged.bracketEntrants.map(String)
			: [],
	} as PersistentTournamentState;
}

// ============================================================================
// 7. Tournament State Reducer & Actions (Consolidated from tournamentReducer.ts)
// ============================================================================

export type TournamentAction =
	| {
			type: "INIT";
			payload: {
				ratings: Record<string, number>;
				persistentState: PersistentTournamentState;
			};
	  }
	| {
			type: "VOTE";
			payload: {
				currentMatch: Match;
				winnerId: string;
				loserId: string;
				matchNumber: number;
				round: number;
				voteTimestamp: number;
				userName: string;
			};
	  }
	| {
			type: "UNDO";
			payload: {
				lastEntry: HistoryEntry;
			};
	  }
	| {
			type: "QUIT";
			payload: {
				defaultState: PersistentTournamentState;
			};
	  };

export interface TournamentReducerState {
	ratings: Record<string, number>;
	history: HistoryEntry[];
	persistentState: PersistentTournamentState;
	refreshKey: number;
}

export function tournamentReducer(
	state: TournamentReducerState,
	action: TournamentAction,
): TournamentReducerState {
	switch (action.type) {
		case "INIT": {
			return {
				ratings: action.payload.ratings,
				history: [],
				persistentState: action.payload.persistentState,
				refreshKey: state.refreshKey + 1,
			};
		}
		case "VOTE": {
			const { currentMatch, winnerId, loserId, matchNumber, round, voteTimestamp } = action.payload;

			const newRatings = computeUpdatedRatings({
				currentMatch,
				ratingsSnapshot: state.ratings,
				winnerId,
			});

			const matchRecord: MatchRecord = createMatchRecord({
				currentMatch,
				winnerId,
				loserId,
				matchNumber,
				round,
			});

			const newHistoryEntry: HistoryEntry = {
				match: currentMatch,
				ratings: { ...state.ratings },
				round,
				matchNumber,
			};

			return {
				...state,
				ratings: newRatings,
				history: [...state.history, newHistoryEntry],
				persistentState: {
					...state.persistentState,
					matchHistory: [...(state.persistentState.matchHistory || []), matchRecord],
					currentMatch: matchNumber + 1,
					currentRound: round,
					ratings: newRatings,
					lastUpdated: voteTimestamp,
				},
				refreshKey: state.refreshKey + 1,
			};
		}
		case "UNDO": {
			const { lastEntry } = action.payload;
			const newHistory = state.history.slice(0, -1);
			const newMatchHistory = (state.persistentState.matchHistory || []).slice(0, -1);

			return {
				...state,
				ratings: lastEntry.ratings,
				history: newHistory,
				persistentState: {
					...state.persistentState,
					matchHistory: newMatchHistory,
					ratings: lastEntry.ratings,
					currentMatch: lastEntry.matchNumber,
					currentRound: lastEntry.round,
				},
				refreshKey: state.refreshKey + 1,
			};
		}
		case "QUIT": {
			return {
				ratings: {},
				history: [],
				persistentState: action.payload.defaultState,
				refreshKey: state.refreshKey + 1,
			};
		}
		default:
			return state;
	}
}

// ============================================================================
// 8. useTournamentState Main Hook (Consolidated from useTournamentState.ts)
// ============================================================================

interface UseTournamentStateResult {
	currentMatch: Match | null;
	ratings: Record<string, number>;
	openingEntrants: Array<{ id: string; label: string }>;
	round: number;
	totalRounds: number;
	bracketStage: string;
	matchNumber: number;
	totalMatches: number;
	isComplete: boolean;
	tournamentMode: TournamentMode;
	handleVote: (winnerId: string, loserId: string) => void;
	handleUndo: () => void;
	canUndo: boolean;
	handleQuit: () => void;
	progress: number;
	etaMinutes: number;
	isVoting: boolean;
	handleVoteWithAnimation: (winnerId: string, loserId: string) => void;
	matchHistory: MatchRecord[];
	bracketEntrants?: string[];
	teams?: Team[];
	subscribeToTournamentUpdates?: (
		tournamentId: string,
		callback: (update: TournamentUpdate) => void,
	) => void;
	subscribeToMatchResults?: (callback: (result: MatchResult) => void) => void;
	subscribeToUserActivity?: (callback: (activity: UserActivity) => void) => void;
}

const VOTE_COOLDOWN = TIMING.VOTE_COOLDOWN_MS;

export function haveSameIds(a: string[], b: string[]): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let match = true;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			match = false;
			break;
		}
	}
	if (match) {
		return true;
	}

	const map = new Map<string, number>();
	for (let i = 0; i < a.length; i++) {
		const val = a[i];
		if (val != null) {
			map.set(val, (map.get(val) || 0) + 1);
		}
	}
	for (let i = 0; i < b.length; i++) {
		const val = b[i];
		if (val != null) {
			const count = map.get(val);
			if (!count) {
				return false;
			}
			map.set(val, count - 1);
		}
	}

	return true;
}

export function useTournamentState(names: NameItem[], userName?: string): UseTournamentStateResult {
	const toast = useToast();
	const [isVoting, setIsVoting] = useState(false);

	const tournamentMode = useMemo(() => resolveTournamentMode(names.length), [names.length]);
	const tournamentActions = useAppStore((state) => state.tournamentActions);

	const namesKey = useMemo(() => createNamesKey(names), [names]);
	const tournamentId = useMemo(() => createTournamentId(names, userName), [names, userName]);

	const realtime = useTournamentRealtime({ autoConnect: true });

	const defaultPersistentState = useMemo(
		() => createDefaultPersistentState(userName || "anonymous"),
		[userName],
	);

	const [persistentStateRaw, setPersistentState] = useLocalStorage<PersistentTournamentState>(
		tournamentId,
		defaultPersistentState,
		{
			onError: () => {
				toast.showWarning(
					"Your progress could not be saved locally. Voting will continue but may not persist after a page refresh.",
				);
			},
		},
	);

	const persistentState = useMemo(
		(): PersistentTournamentState =>
			sanitizePersistentState(persistentStateRaw, userName || "anonymous"),
		[persistentStateRaw, userName],
	);

	const [state, dispatch] = useReducer(tournamentReducer, {
		ratings: {},
		history: [],
		persistentState: defaultPersistentState,
		refreshKey: 0,
	});

	const ratingsRef = useRef(state.ratings);
	const initializedRef = useRef(false);
	const lastNamesKeyRef = useRef("");
	const lastRatingsUpdateRef = useRef(0);

	useEffect(() => {
		if (initializedRef.current) {
			setPersistentState(state.persistentState);

			const ratingsData: Record<string, RatingData> = {};
			for (const [id, ratingVal] of Object.entries(state.ratings)) {
				ratingsData[id] = {
					rating: ratingVal,
					wins: 0,
					losses: 0,
				};
			}
			tournamentActions.syncTournamentProgress({
				ratings: ratingsData,
				matchHistory: state.persistentState.matchHistory,
				currentRound: state.persistentState.currentRound,
				currentMatch: state.persistentState.currentMatch,
				totalMatches: state.persistentState.totalMatches,
				mode: state.persistentState.mode,
				teams: state.persistentState.teams,
				bracketEntrants: state.persistentState.bracketEntrants,
				lastUpdated: state.persistentState.lastUpdated,
			});
		}
	}, [state.persistentState, state.ratings, setPersistentState, tournamentActions]);

	useEffect(() => {
		return () => {
			if (realtime && typeof realtime.cleanup === "function") {
				realtime.cleanup();
			}
		};
	}, [realtime]);

	useEffect(() => {
		ratingsRef.current = state.ratings;
	}, [state.ratings]);

	useEffect(() => {
		if (lastNamesKeyRef.current !== namesKey) {
			initializedRef.current = false;
			lastNamesKeyRef.current = namesKey;
		}
	}, [namesKey]);

	useEffect(() => {
		if (initializedRef.current) {
			return;
		}

		if (!Array.isArray(names) || names.length < 2) {
			return;
		}

		const initializeTournament = () => {
			const storeTournament = useAppStore.getState().tournament;
			const effectivePersistentState: PersistentTournamentState =
				persistentState.bracketEntrants && persistentState.bracketEntrants.length > 0
					? persistentState
					: {
							...persistentState,
							matchHistory: storeTournament.matchHistory ?? persistentState.matchHistory,
							currentRound: storeTournament.currentRound ?? persistentState.currentRound,
							currentMatch: storeTournament.currentMatch ?? persistentState.currentMatch,
							totalMatches: storeTournament.totalMatches ?? persistentState.totalMatches,
							teams: storeTournament.teams ?? persistentState.teams,
							bracketEntrants: storeTournament.bracketEntrants ?? persistentState.bracketEntrants,
							mode: (storeTournament.mode ?? tournamentMode) as TournamentMode,
						};

			const hasValidPersistence =
				(persistentState.namesKey === namesKey && persistentState.mode === tournamentMode) ||
				(Boolean(
					effectivePersistentState.bracketEntrants &&
						effectivePersistentState.bracketEntrants.length > 0,
				) &&
					storeTournament.names?.length === names.length);
			const initialRatings = buildInitialRatings(names);

			let teams = effectivePersistentState.teams;
			if (tournamentMode === "2v2" && teams.length < 2) {
				teams = generateRandomTeams(
					names.map((name) => ({ id: String(name.id), name: name.name })),
				);
			}

			const participantIds =
				tournamentMode === "2v2"
					? teams.map((team) => team.id)
					: names.map((name) => String(name.id));
			const shouldResetBracket =
				!hasValidPersistence ||
				effectivePersistentState.bracketEntrants.length === 0 ||
				!haveSameIds(
					effectivePersistentState.bracketEntrants.filter((id) => !id.startsWith("__BYE__")),
					participantIds,
				);
			const bracketEntrants = shouldResetBracket
				? createBracketEntrants(participantIds)
				: effectivePersistentState.bracketEntrants;

			const stateUpdates: Partial<PersistentTournamentState> = {
				matchHistory: shouldResetBracket ? [] : effectivePersistentState.matchHistory,
				currentRound: shouldResetBracket ? 1 : effectivePersistentState.currentRound,
				currentMatch: shouldResetBracket ? 1 : effectivePersistentState.currentMatch,
				totalMatches: Math.max(0, participantIds.length - 1),
				teams,
				bracketEntrants,
			};

			if (!hasValidPersistence) {
				Object.assign(stateUpdates, {
					namesKey,
					ratings: initialRatings,
					mode: tournamentMode,
					teamMatches: [],
					teamMatchIndex: 0,
				});
			} else if (
				shouldResetBracket ||
				(tournamentMode === "2v2" && teams !== effectivePersistentState.teams)
			) {
				stateUpdates.ratings = shouldResetBracket
					? initialRatings
					: effectivePersistentState.ratings;
			}

			const storedRatingsAreFresh =
				(effectivePersistentState.lastUpdated ?? 0) >= lastRatingsUpdateRef.current;

			let activeRatings = initialRatings;
			if (
				hasValidPersistence &&
				effectivePersistentState.ratings &&
				Object.keys(effectivePersistentState.ratings).length > 0 &&
				storedRatingsAreFresh
			) {
				activeRatings = effectivePersistentState.ratings;
			} else if (lastRatingsUpdateRef.current > 0) {
				activeRatings = ratingsRef.current;
			} else {
				if (!stateUpdates.ratings) {
					stateUpdates.ratings = initialRatings;
				}
			}

			dispatch({
				type: "INIT",
				payload: {
					ratings: activeRatings,
					persistentState: { ...effectivePersistentState, ...stateUpdates },
				},
			});

			initializedRef.current = true;
		};

		let frameId: number | null = null;
		frameId = requestAnimationFrame(initializeTournament);

		return () => {
			if (frameId !== null) {
				cancelAnimationFrame(frameId);
			}
		};
	}, [names, namesKey, tournamentMode, persistentState]);

	const idToNameMap = useMemo(() => createIdToNameMap(names), [names]);
	const teamsById = useMemo(
		() => createTeamsById(state.persistentState.teams),
		[state.persistentState.teams],
	);
	const bracketDerived = useMemo(
		() =>
			deriveBracketState(state.persistentState.bracketEntrants, state.persistentState.matchHistory),
		[state.persistentState.bracketEntrants, state.persistentState.matchHistory],
	);

	const currentMatch = useMemo(() => {
		void state.refreshKey;
		return resolveCurrentMatch({
			tournamentMode,
			pendingMatchIds: bracketDerived.pendingMatchIds,
			teamsById,
			idToNameMap,
		});
	}, [state.refreshKey, idToNameMap, tournamentMode, bracketDerived.pendingMatchIds, teamsById]);

	const openingEntrants = useMemo(() => {
		// ⚡ Bolt Performance Optimization: Replaced reduce with a for loop to avoid allocations
		const entrants = state.persistentState.bracketEntrants;
		const acc: { id: string; label: string }[] = [];
		for (let i = 0; i < entrants.length; i++) {
			const entrantKey = String(entrants[i]);
			if (!entrantKey.startsWith("__BYE__")) {
				if (tournamentMode === "2v2") {
					const team = teamsById.get(entrantKey);
					acc.push({
						id: entrantKey,
						label: team ? team.memberNames.join(" + ") : entrantKey,
					});
				} else {
					const name = idToNameMap.get(entrantKey);
					acc.push({
						id: entrantKey,
						label: name?.name ?? entrantKey,
					});
				}
			}
		}
		return acc;
	}, [state.persistentState.bracketEntrants, tournamentMode, teamsById, idToNameMap]);

	const isComplete = bracketDerived.isComplete;
	const metrics = useMemo(
		() =>
			calculateTournamentMetrics({
				derived: bracketDerived,
			}),
		[bracketDerived],
	);
	const { totalMatches, matchNumber, round, totalRounds, stageLabel, progress, etaMinutes } =
		metrics;

	const handleVote = useCallback(
		(winnerId: string, loserId: string) => {
			if (!currentMatch) {
				return;
			}

			const voteTimestamp = Date.now();
			lastRatingsUpdateRef.current = voteTimestamp;

			const leftIds =
				currentMatch.mode === "2v2"
					? currentMatch.left.memberIds
					: [
							String(
								typeof currentMatch.left === "string" ? currentMatch.left : currentMatch.left.id,
							),
						];
			const rightIds =
				currentMatch.mode === "2v2"
					? currentMatch.right.memberIds
					: [
							String(
								typeof currentMatch.right === "string" ? currentMatch.right : currentMatch.right.id,
							),
						];

			const isLeftWinner =
				leftIds.includes(winnerId) ||
				(currentMatch.mode === "2v2" && currentMatch.left.id === winnerId);

			const winnerSideIds = isLeftWinner ? leftIds : rightIds;
			const loserSideIds = isLeftWinner ? rightIds : leftIds;

			tournamentActions.recordVote(
				winnerId,
				loserId,
				winnerSideIds.length > 1 ? winnerSideIds : undefined,
				loserSideIds.length > 1 ? loserSideIds : undefined,
			);

			const winnerSide = isLeftWinner ? "left" : "right";
			ratingsAPI
				.applyTournamentMatch({
					userName: userName ?? "anonymous",
					leftNameIds: leftIds,
					rightNameIds: rightIds,
					winnerSide,
				})
				.catch((err: unknown) => {
					ErrorManager.handleError(err, "useTournamentState.applyTournamentMatch");
				});

			dispatch({
				type: "VOTE",
				payload: {
					currentMatch,
					winnerId,
					loserId,
					matchNumber,
					round,
					voteTimestamp,
					userName: userName || "anonymous",
				},
			});
		},
		[currentMatch, matchNumber, round, userName, tournamentActions.recordVote],
	);

	const voteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const currentMatchRef = useRef(currentMatch);

	useEffect(() => {
		currentMatchRef.current = currentMatch;
	}, [currentMatch]);

	const handleVoteWithAnimation = useCallback(
		(winnerId: string, loserId: string) => {
			if (isVoting) {
				return;
			}
			const matchAtVoteTime = currentMatchRef.current;
			setIsVoting(true);
			voteTimeoutRef.current = setTimeout(() => {
				if (currentMatchRef.current === matchAtVoteTime) {
					handleVote(winnerId, loserId);
				} else {
					toast.showWarning("Match changed, vote not counted");
				}
				setIsVoting(false);
			}, VOTE_COOLDOWN);
		},
		[handleVote, isVoting, toast],
	);

	useEffect(() => {
		return () => {
			if (voteTimeoutRef.current) {
				clearTimeout(voteTimeoutRef.current);
			}
		};
	}, []);

	const handleUndo = useCallback(() => {
		if (state.history.length === 0) {
			toast.showWarning("No more moves to undo");
			return;
		}

		const lastEntry = state.history[state.history.length - 1];
		if (!lastEntry) {
			return;
		}

		dispatch({
			type: "UNDO",
			payload: { lastEntry },
		});
		tournamentActions.undoVote();
	}, [state.history, toast, tournamentActions]);

	const handleQuit = useCallback(() => {
		const emptyState = createDefaultPersistentState(userName);
		dispatch({
			type: "QUIT",
			payload: {
				defaultState: emptyState,
			},
		});
		setPersistentState(emptyState);
		tournamentActions.clearVoteHistory();
		tournamentActions.resetTournament();
	}, [setPersistentState, tournamentActions, userName]);

	return {
		currentMatch,
		ratings: state.ratings,
		openingEntrants,
		round,
		totalRounds,
		bracketStage: stageLabel,
		matchNumber,
		totalMatches,
		isComplete,
		tournamentMode,
		handleVote,
		handleUndo,
		canUndo: state.history.length > 0,
		handleQuit,
		progress,
		etaMinutes,
		isVoting,
		handleVoteWithAnimation,
		matchHistory: state.persistentState.matchHistory,
		bracketEntrants: state.persistentState.bracketEntrants,
		teams: state.persistentState.teams,
		subscribeToTournamentUpdates: realtime.subscribeToTournament,
		subscribeToMatchResults: realtime.subscribeToMatches,
		subscribeToUserActivity: realtime.subscribeToUserActivity,
	};
}

export { useIndexedDB, useTournamentIndexedDB };
