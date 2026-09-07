import { ELO_RATING } from "@/shared/lib/constants";
import { applyEloMatchUpdate, calculatePairEloUpdate, getExpectedEloScore } from "@/shared/lib/elo";
import { shuffleArray } from "@/shared/lib/utils";
import type { Match, MatchRecord, NameItem, Team, TournamentMode } from "@/shared/types";

// ============================================================================
// ELO RATING SYSTEM HELPERS & CLASSES
// ============================================================================

export class EloRating {
	constructor(
		public defaultRating: number = ELO_RATING.DEFAULT_RATING,
		public kFactor: number = ELO_RATING.DEFAULT_K_FACTOR,
	) {}
	getExpectedScore(ra: number, rb: number) {
		return getExpectedEloScore(ra, rb, {
			ratingDivisor: ELO_RATING.RATING_DIVISOR,
		});
	}
	calculateNewRatings(
		ra: number,
		rb: number,
		outcome: string,
		stats?: { winsA: number; lossesA: number; winsB: number; lossesB: number },
	) {
		const result = calculatePairEloUpdate({
			leftRating: ra,
			rightRating: rb,
			outcome: outcome === "left" || outcome === "right" ? outcome : "tie",
			leftStats: {
				wins: stats?.winsA,
				losses: stats?.lossesA,
			},
			rightStats: {
				wins: stats?.winsB,
				losses: stats?.lossesB,
			},
			config: {
				kFactor: this.kFactor,
				defaultRating: this.defaultRating,
				minRating: ELO_RATING.MIN_RATING,
				maxRating: ELO_RATING.MAX_RATING,
				ratingDivisor: ELO_RATING.RATING_DIVISOR,
				newPlayerGameThreshold: ELO_RATING.NEW_PLAYER_GAME_THRESHOLD,
				newPlayerKMultiplier: ELO_RATING.NEW_PLAYER_K_MULTIPLIER,
			},
		});

		return {
			newRatingA: result.newRatingA,
			newRatingB: result.newRatingB,
			winsA: result.winsA,
			lossesA: result.lossesA,
			winsB: result.winsB,
			lossesB: result.lossesB,
		};
	}
}

export function resolveTournamentMode(selectedCount: number): TournamentMode {
	return selectedCount >= 4 && selectedCount % 4 === 0 ? "2v2" : "1v1";
}

export function generateRandomTeams(participants: Array<{ id: string; name: string }>): Team[] {
	const shuffled = shuffleArray(participants);
	const teams: Team[] = [];

	for (let i = 0; i + 1 < shuffled.length; i += 2) {
		const first = shuffled[i];
		const second = shuffled[i + 1];
		if (!first || !second) {
			continue;
		}
		teams.push({
			id: `team-${teams.length + 1}`,
			memberIds: [first.id, second.id],
			memberNames: [first.name, second.name],
		});
	}

	return teams;
}

export function getBracketStageLabel(round: number, totalRounds: number): string {
	const safeRound = Math.max(1, round);
	const safeTotal = Math.max(1, totalRounds);
	const remaining = safeTotal - safeRound;

	if (remaining <= 0) {
		return "Final";
	}
	if (remaining === 1) {
		return "Semifinal";
	}
	if (remaining === 2) {
		return "Quarterfinal";
	}
	return `Round ${safeRound}`;
}

// ============================================================================
// HEAT & STREAK VISUAL HELPERS (Consolidated from heat.ts)
// ============================================================================

export type HeatLevel = "warm" | "hot" | "blazing";

export const STREAK_THRESHOLDS = {
	warm: 3,
	hot: 5,
	blazing: 7,
} as const;

export function getHeatLevel(streak: number): HeatLevel | null {
	if (streak >= STREAK_THRESHOLDS.blazing) {
		return "blazing";
	}
	if (streak >= STREAK_THRESHOLDS.hot) {
		return "hot";
	}
	if (streak >= STREAK_THRESHOLDS.warm) {
		return "warm";
	}
	return null;
}

export function getHeatCardClasses(heatLevel: HeatLevel | null): string {
	switch (heatLevel) {
		case "blazing":
			return "ring-2 ring-orange-500/80 shadow-lg";
		case "hot":
			return "ring-2 ring-amber-500/70 shadow-md";
		case "warm":
			return "ring-1 ring-orange-400/50 shadow-sm";
		default:
			return "";
	}
}

export function getHeatTextClasses(heatLevel: HeatLevel): string {
	switch (heatLevel) {
		case "blazing":
			return "text-orange-200 border-orange-300/45 bg-orange-500/15";
		case "hot":
			return "text-amber-200 border-amber-300/45 bg-amber-500/15";
		default:
			return "text-orange-100 border-orange-300/35 bg-orange-500/10";
	}
}

export function getHeatGradientClasses(heatLevel: HeatLevel): string {
	switch (heatLevel) {
		case "blazing":
			return "bg-gradient-to-t from-orange-500/45 via-amber-400/25 to-transparent";
		case "hot":
			return "bg-gradient-to-t from-orange-500/35 via-amber-300/20 to-transparent";
		default:
			return "bg-gradient-to-t from-orange-500/20 via-amber-200/10 to-transparent";
	}
}

export function getFlameCount(streak: number, max = 8): number {
	return Math.min(max, Math.max(3, Math.round(streak * 1.2)));
}

// ============================================================================
// MATCH NORMALIZATION & DATA EXTRACTION (Consolidated from matchHelpers.ts)
// ============================================================================

interface NormalizedParticipant {
	id: string;
	name: string;
	memberIds: string[];
	memberNames: string[];
	isTeam: boolean;
	description?: string;
	pronunciation?: string;
}

export function normalizeParticipant(
	participant: Match["left"] | Match["right"],
): NormalizedParticipant {
	if (typeof participant === "object" && participant !== null) {
		if ("memberNames" in participant) {
			return {
				id: String(participant.id),
				name: (participant.memberNames ?? []).join(" + ") || String(participant.id),
				memberIds: participant.memberIds?.map(String) ?? [String(participant.id)],
				memberNames: participant.memberNames ?? [],
				isTeam: true,
			};
		}
		return {
			id: String(participant.id),
			name: participant.name,
			memberIds: [String(participant.id)],
			memberNames: [participant.name],
			isTeam: false,
			description: participant.description,
			pronunciation: (participant as NameItem).pronunciation,
		};
	}
	return {
		id: String(participant),
		name: String(participant),
		memberIds: [String(participant)],
		memberNames: [String(participant)],
		isTeam: false,
	};
}

function getFastParticipantId(participant: Match["left"] | Match["right"]): string {
	if (typeof participant === "object" && participant !== null) {
		return String(participant.id);
	}
	return String(participant);
}

export function getMatchSideId(match: Match, side: "left" | "right"): string {
	return getFastParticipantId(match[side]);
}

export function calculateWinStreak(
	contestantId: string | number | null | undefined,
	matchHistory?: MatchRecord[] | null,
): number {
	if (!contestantId || !matchHistory || matchHistory.length === 0) {
		return 0;
	}
	const targetId = String(contestantId);
	let streak = 0;
	for (let i = matchHistory.length - 1; i >= 0; i--) {
		const record = matchHistory[i];
		if (!record?.match) {
			continue;
		}
		const leftId = getFastParticipantId(record.match.left);
		const rightId = getFastParticipantId(record.match.right);
		if (leftId !== targetId && rightId !== targetId) {
			continue;
		}
		if (String(record.winner) === targetId) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}

interface MatchSideData {
	leftId: string;
	rightId: string;
	leftName: string;
	rightName: string;
	leftMembers: string[];
	rightMembers: string[];
	leftIsTeam: boolean;
	rightIsTeam: boolean;
	leftDescription?: string;
	rightDescription?: string;
	leftPronunciation?: string;
	rightPronunciation?: string;
}

export function extractMatchData(match: Match): MatchSideData {
	const left = normalizeParticipant(match.left);
	const right = normalizeParticipant(match.right);

	return {
		leftId: left.id,
		rightId: right.id,
		leftName: left.name,
		rightName: right.name,
		leftMembers: left.memberNames,
		rightMembers: right.memberNames,
		leftIsTeam: left.isTeam,
		rightIsTeam: right.isTeam,
		leftDescription: left.description,
		rightDescription: right.description,
		leftPronunciation: left.pronunciation,
		rightPronunciation: right.pronunciation,
	};
}

// ============================================================================
// BRACKET DERIVATION ENGINE & METRICS (Consolidated from tournamentLogic.ts)
// ============================================================================

export interface HistoryEntry {
	match: Match;
	ratings: Record<string, number>;
	round: number;
	matchNumber: number;
}

interface TournamentMetrics {
	totalMatches: number;
	completedMatches: number;
	matchNumber: number;
	roundSize: number;
	round: number;
	totalRounds: number;
	stageLabel: string;
	progress: number;
	etaMinutes: number;
}

interface BracketDerivation {
	isComplete: boolean;
	totalMatches: number;
	completedMatches: number;
	round: number;
	totalRounds: number;
	stageLabel: string;
	roundSize: number;
	pendingMatchIds: { leftId: string; rightId: string } | null;
}

// Cache for bracket state calculations - enhanced with round-based caching
const bracketStateCache = new Map<string, BracketDerivation>();
const roundCache = new Map<string, number>(); // Cache round calculations by entrants count
const MAX_CACHE_SIZE = 100;

function evictIfNeeded<V>(cache: Map<string, V>, limit: number): void {
	while (cache.size > limit) {
		const firstKey = cache.keys().next().value;
		if (firstKey) {
			cache.delete(firstKey);
		} else {
			break;
		}
	}
}

function setBracketCache(key: string, result: BracketDerivation): BracketDerivation {
	bracketStateCache.set(key, result);
	evictIfNeeded(bracketStateCache, MAX_CACHE_SIZE);
	return result;
}

function makePendingResult(
	totalMatches: number,
	cursor: number,
	round: number,
	totalRounds: number,
	activeRoundSize: number,
	left: string,
	right: string,
	cacheKey?: string,
): BracketDerivation {
	const result = {
		isComplete: false,
		totalMatches,
		completedMatches: cursor,
		round,
		totalRounds,
		stageLabel: getBracketStageLabel(round, totalRounds),
		roundSize: activeRoundSize,
		pendingMatchIds: { leftId: left, rightId: right },
	};
	if (cacheKey) {
		return setBracketCache(cacheKey, result);
	}
	return result;
}

function getCacheKey(bracketEntrants: string[], matchHistory: MatchRecord[]): string {
	const entrantsLen = bracketEntrants.length;
	let entrantsKey = "";
	for (let i = 0; i < entrantsLen; i++) {
		const str = bracketEntrants[i];
		if (str) {
			if (entrantsKey) {
				entrantsKey += ",";
			}
			entrantsKey += str;
		}
	}

	let historyKey = "";
	const historyLen = matchHistory.length;
	for (let i = 0; i < historyLen; i++) {
		const rec = matchHistory[i];
		if (rec) {
			if (i > 0) {
				historyKey += "|";
			}
			historyKey += `${rec.winner}-${rec.loser}`;
		}
	}

	return `${entrantsKey}:${historyKey}`;
}

function getCachedRound(entrantsCount: number): number {
	if (!Number.isFinite(entrantsCount) || entrantsCount <= 1) {
		return 1;
	}
	const cacheKey = `round_${entrantsCount}`;
	const cached = roundCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	const round = Math.max(1, Math.ceil(Math.log2(Math.max(2, entrantsCount))));
	roundCache.set(cacheKey, round);
	evictIfNeeded(roundCache, 50);

	return round;
}

const BYE_PREFIX = "__BYE__";

function nextPowerOfTwo(value: number): number {
	if (value <= 1) {
		return 1;
	}
	return 2 ** Math.ceil(Math.log2(value));
}

function isBye(id: string): boolean {
	return id.startsWith(BYE_PREFIX);
}

function createBye(round: number, index: number): string {
	return `${BYE_PREFIX}${round}_${index}`;
}

function padForRound(entrants: string[], round: number): string[] {
	if (entrants.length <= 1) {
		return entrants;
	}
	const targetSize = nextPowerOfTwo(entrants.length);
	const padded = [...entrants];
	while (padded.length < targetSize) {
		padded.push(createBye(round, padded.length));
	}
	return padded;
}

export function createIdToNameMap(names: NameItem[]): Map<string, NameItem> {
	const map = new Map<string, NameItem>();
	// ⚡ Bolt Performance Optimization: Replace callback-based forEach with native for..of loop
	for (const n of names) {
		map.set(String(n.id), n);
	}
	return map;
}

export function createTeamsById(teams: Team[]): Map<string, Team> {
	const map = new Map<string, Team>();
	for (const team of teams) {
		map.set(team.id, team);
	}
	return map;
}

export function deriveBracketState(
	bracketEntrants: string[],
	matchHistory: MatchRecord[],
): BracketDerivation {
	const cacheKey = getCacheKey(bracketEntrants, matchHistory);
	const cached = bracketStateCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const entrants: string[] = [];
	let totalEntrants = 0;
	for (const rawId of bracketEntrants) {
		const id = String(rawId);
		if (id) {
			entrants.push(id);
			if (!isBye(id)) {
				totalEntrants++;
			}
		}
	}

	if (totalEntrants < 2) {
		const result = {
			isComplete: true,
			totalMatches: 0,
			completedMatches: 0,
			round: 1,
			totalRounds: 1,
			stageLabel: "Final",
			roundSize: totalEntrants,
			pendingMatchIds: null,
		};

		return setBracketCache(cacheKey, result);
	}

	const totalMatches = Math.max(0, totalEntrants - 1);
	const totalRounds = getCachedRound(totalEntrants);
	let round = 1;
	let cursor = 0;
	let currentRoundEntrants = padForRound(entrants, round);

	while (currentRoundEntrants.length > 1) {
		const winners: string[] = [];
		const activeRoundSize = currentRoundEntrants.filter((id) => !isBye(id)).length;

		for (let i = 0; i < currentRoundEntrants.length; i += 2) {
			const left = currentRoundEntrants[i];
			const right = currentRoundEntrants[i + 1];
			const leftBye = !left || isBye(left);
			const rightBye = !right || isBye(right);

			if (leftBye && rightBye) {
				continue;
			}
			if (leftBye) {
				winners.push(right as string);
				continue;
			}
			if (rightBye) {
				winners.push(left as string);
				continue;
			}

			const record = matchHistory[cursor];
			if (!record?.winner) {
				return makePendingResult(
					totalMatches,
					cursor,
					round,
					totalRounds,
					activeRoundSize,
					left,
					right,
					cacheKey,
				);
			}

			if (record.winner === left || record.winner === right) {
				winners.push(record.winner);
				cursor += 1;
			} else {
				cursor += 1;
				bracketStateCache.delete(cacheKey);
				return makePendingResult(
					totalMatches,
					cursor - 1,
					round,
					totalRounds,
					activeRoundSize,
					left,
					right,
				);
			}
		}

		if (winners.length <= 1) {
			break;
		}

		round += 1;
		currentRoundEntrants = padForRound(winners, round);
	}

	const result = {
		isComplete: true,
		totalMatches,
		completedMatches: Math.min(cursor, totalMatches),
		round: totalRounds,
		totalRounds,
		stageLabel: getBracketStageLabel(totalRounds, totalRounds),
		roundSize: 1,
		pendingMatchIds: null,
	};

	return setBracketCache(cacheKey, result);
}

export function resolveCurrentMatch({
	tournamentMode,
	pendingMatchIds,
	teamsById,
	idToNameMap,
}: {
	tournamentMode: TournamentMode;
	pendingMatchIds: { leftId: string; rightId: string } | null;
	teamsById: Map<string, Team>;
	idToNameMap: Map<string, NameItem>;
}): Match | null {
	if (!pendingMatchIds) {
		return null;
	}

	if (tournamentMode === "2v2") {
		const leftTeam = teamsById.get(pendingMatchIds.leftId);
		const rightTeam = teamsById.get(pendingMatchIds.rightId);
		if (!leftTeam || !rightTeam) {
			return null;
		}
		return {
			mode: "2v2",
			left: leftTeam,
			right: rightTeam,
		};
	}

	return {
		mode: "1v1",
		left: idToNameMap.get(pendingMatchIds.leftId) || {
			id: pendingMatchIds.leftId,
			name: pendingMatchIds.leftId,
		},
		right: idToNameMap.get(pendingMatchIds.rightId) || {
			id: pendingMatchIds.rightId,
			name: pendingMatchIds.rightId,
		},
	};
}

export function calculateTournamentMetrics({
	derived,
}: {
	derived: BracketDerivation;
}): TournamentMetrics {
	const { totalMatches, completedMatches, round, totalRounds, stageLabel, roundSize, isComplete } =
		derived;
	const matchNumber = isComplete ? completedMatches : completedMatches + 1;
	const progress =
		totalMatches > 0
			? Math.min(
					100,
					Math.max(0, Math.round((Math.min(completedMatches, totalMatches) / totalMatches) * 100)),
				)
			: 0;
	const etaMinutes =
		!totalMatches || completedMatches >= totalMatches
			? 0
			: Math.max(0, Math.ceil(((totalMatches - completedMatches) * 3) / 60));

	return {
		totalMatches,
		completedMatches,
		matchNumber,
		roundSize,
		round,
		totalRounds,
		stageLabel,
		progress,
		etaMinutes,
	};
}

export function computeUpdatedRatings({
	currentMatch,
	ratingsSnapshot,
	winnerId,
}: {
	currentMatch: Match;
	ratingsSnapshot: Record<string, number>;
	winnerId: string;
}): Record<string, number> {
	const leftParticipantIds =
		currentMatch.mode === "2v2"
			? currentMatch.left.memberIds
			: [String(typeof currentMatch.left === "string" ? currentMatch.left : currentMatch.left.id)];
	const rightParticipantIds =
		currentMatch.mode === "2v2"
			? currentMatch.right.memberIds
			: [
					String(
						typeof currentMatch.right === "string" ? currentMatch.right : currentMatch.right.id,
					),
				];
	const isLeftWinner =
		leftParticipantIds.includes(winnerId) ||
		(currentMatch.mode === "2v2" && currentMatch.left.id === winnerId);
	const winnerSide = isLeftWinner ? "left" : "right";

	return applyEloMatchUpdate({
		ratings: ratingsSnapshot,
		leftParticipantIds,
		rightParticipantIds,
		winnerSide,
	}).ratings;
}

export function createMatchRecord({
	currentMatch,
	winnerId,
	loserId,
	matchNumber,
	round,
}: {
	currentMatch: Match;
	winnerId: string;
	loserId: string;
	matchNumber: number;
	round: number;
}): MatchRecord {
	return {
		match: currentMatch,
		winner: winnerId,
		loser: loserId,
		voteType: "normal",
		matchNumber,
		roundNumber: round,
		timestamp: Date.now(),
	};
}
