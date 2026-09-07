import { max, mean, medianSorted, min, standardDeviation } from "simple-statistics";
import { ELO_RATING } from "./constants";

export interface RatingStats {
	mean: number;
	median: number;
	stdDev: number;
	min: number;
	max: number;
	count: number;
}

export interface EnrichedRating {
	rating: number;
	percentileRank: number;
	confidence: number;
	zScore: number;
}

export function computeRatingStats(ratings: number[]): RatingStats | null {
	if (!Array.isArray(ratings) || ratings.length < 2) {
		return null;
	}
	const validRatings = ratings.filter((r) => typeof r === "number" && Number.isFinite(r));
	if (validRatings.length < 2) {
		return null;
	}
	const sorted = [...validRatings].sort((a, b) => a - b);
	const calculatedStdDev = standardDeviation(validRatings);
	return {
		mean: mean(validRatings),
		median: medianSorted(sorted),
		stdDev: Number.isFinite(calculatedStdDev) ? calculatedStdDev : 0,
		min: min(sorted),
		max: max(sorted),
		count: validRatings.length,
	};
}

export function getPercentileRank(rating: number, allRatings: number[]): number {
	if (!Array.isArray(allRatings) || allRatings.length === 0) {
		return 50;
	}
	let belowCount = 0;
	let validCount = 0;
	const len = allRatings.length;
	for (let i = 0; i < len; i++) {
		const val = allRatings[i];
		if (typeof val === "number" && Number.isFinite(val)) {
			validCount++;
			if (val < rating) {
				belowCount++;
			}
		}
	}
	if (validCount <= 1) {
		return 100;
	}
	return Math.round((belowCount / (validCount - 1)) * 100);
}

export function getConfidenceScore(gamesPlayed: number, threshold = 15): number {
	if (!Number.isFinite(gamesPlayed) || gamesPlayed <= 0) {
		return 0;
	}
	if (gamesPlayed >= threshold) {
		return 1;
	}
	return Math.min(1, Math.max(0, gamesPlayed / threshold));
}

export function getZScore(rating: number, stats: RatingStats): number {
	if (!stats || !Number.isFinite(stats.stdDev) || stats.stdDev <= 0) {
		return 0;
	}
	const z = (rating - stats.mean) / stats.stdDev;
	return Number.isFinite(z) ? Math.round(z * 100) / 100 : 0;
}

export function enrichRating(
	rating: number,
	gamesPlayed: number,
	allRatings: number[],
	stats: RatingStats | null,
): EnrichedRating {
	return {
		rating,
		percentileRank: getPercentileRank(rating, allRatings),
		confidence: getConfidenceScore(gamesPlayed),
		zScore: stats ? getZScore(rating, stats) : 0,
	};
}

export interface EloConfig {
	defaultRating?: number;
	kFactor?: number;
	minRating?: number;
	maxRating?: number;
	ratingDivisor?: number;
	newPlayerGameThreshold?: number;
	newPlayerKMultiplier?: number;
}

export interface EloStats {
	wins?: number;
	losses?: number;
}

export interface EloParticipantResult {
	rating: number;
	wins: number;
	losses: number;
	delta: number;
}

export interface EloPairResult {
	newRatingA: number;
	newRatingB: number;
	winsA: number;
	lossesA: number;
	winsB: number;
	lossesB: number;
	expectedScoreA: number;
	expectedScoreB: number;
}

export interface EloMatchResult {
	ratings: Record<string, number>;
	stats: Record<string, { wins: number; losses: number }>;
	participants: Record<string, EloParticipantResult>;
	leftAverageRating: number;
	rightAverageRating: number;
}

export type EloOutcome = "left" | "right" | "tie";

const DEFAULT_ELO_CONFIG: Required<EloConfig> = {
	defaultRating: ELO_RATING.DEFAULT_RATING,
	kFactor: ELO_RATING.DEFAULT_K_FACTOR,
	minRating: ELO_RATING.MIN_RATING,
	maxRating: ELO_RATING.MAX_RATING,
	ratingDivisor: ELO_RATING.RATING_DIVISOR,
	newPlayerGameThreshold: ELO_RATING.NEW_PLAYER_GAME_THRESHOLD,
	newPlayerKMultiplier: ELO_RATING.NEW_PLAYER_K_MULTIPLIER,
};

function resolveConfig(config?: EloConfig): Required<EloConfig> {
	return {
		...DEFAULT_ELO_CONFIG,
		...config,
	};
}

function clampRating(rating: number, config: Required<EloConfig>): number {
	return Math.max(config.minRating, Math.min(config.maxRating, rating));
}

function normalizeRating(rating: number | undefined, config: Required<EloConfig>): number {
	return typeof rating === "number" && Number.isFinite(rating) ? rating : config.defaultRating;
}

function normalizeStats(stats?: EloStats): { wins: number; losses: number } {
	return {
		wins: typeof stats?.wins === "number" && Number.isFinite(stats.wins) ? stats.wins : 0,
		losses: typeof stats?.losses === "number" && Number.isFinite(stats.losses) ? stats.losses : 0,
	};
}

function getActualScores(outcome: EloOutcome): { left: number; right: number } {
	if (outcome === "left") {
		return { left: 1, right: 0 };
	}
	if (outcome === "right") {
		return { left: 0, right: 1 };
	}
	return { left: 0.5, right: 0.5 };
}

function _average(values: number[]): number {
	if (values.length === 0) {
		throw new Error("Cannot calculate Elo for an empty side");
	}

	// ⚡ Bolt Performance Optimization: Replaced reduce with a for loop to avoid allocations
	let sum = 0;
	for (let i = 0; i < values.length; i++) {
		sum += values[i] as number;
	}
	return sum / values.length;
}

function applyParticipantUpdates(
	participantIds: string[],
	delta: number,
	outcomeScore: number,
	ratings: Record<string, number>,
	stats: Record<string, EloStats> | undefined,
	resolvedConfig: Required<EloConfig>,
	nextRatings: Record<string, number>,
	nextStats: Record<string, EloStats>,
	participants: Record<string, EloParticipantResult>,
) {
	for (const participantId of participantIds) {
		const currentRating = normalizeRating(ratings[participantId], resolvedConfig);
		const currentStats = normalizeStats(stats?.[participantId]);

		const updatedRating = clampRating(Math.round(currentRating + delta), resolvedConfig);
		nextRatings[participantId] = updatedRating;

		nextStats[participantId] = {
			wins: currentStats.wins + (outcomeScore === 1 ? 1 : 0),
			losses: currentStats.losses + (outcomeScore === 0 ? 1 : 0),
		};

		participants[participantId] = {
			rating: updatedRating,
			wins: nextStats[participantId]?.wins ?? 0,
			losses: nextStats[participantId]?.losses ?? 0,
			delta: updatedRating - currentRating,
		};
	}
}
export function getExpectedEloScore(
	currentRating: number,
	opponentRating: number,
	config?: EloConfig,
): number {
	const resolved = resolveConfig(config);
	const r1 =
		typeof currentRating === "number" && Number.isFinite(currentRating)
			? currentRating
			: resolved.defaultRating;
	const r2 =
		typeof opponentRating === "number" && Number.isFinite(opponentRating)
			? opponentRating
			: resolved.defaultRating;
	const divisor =
		typeof resolved.ratingDivisor === "number" &&
		Number.isFinite(resolved.ratingDivisor) &&
		resolved.ratingDivisor !== 0
			? resolved.ratingDivisor
			: 400;
	// Clamp exponent to prevent floating point overflow / NaN
	const exponent = Math.max(-100, Math.min(100, (r2 - r1) / divisor));
	const expected = 1 / (1 + 10 ** exponent);
	return Number.isFinite(expected) ? Math.max(0, Math.min(1, expected)) : 0.5;
}

export function updateEloRating({
	rating,
	expectedScore,
	actualScore,
	gamesPlayed = 0,
	config,
}: {
	rating: number;
	expectedScore: number;
	actualScore: number;
	gamesPlayed?: number;
	config?: EloConfig;
}): number {
	const resolved = resolveConfig(config);
	const validRating =
		typeof rating === "number" && Number.isFinite(rating) ? rating : resolved.defaultRating;
	const validExpected =
		typeof expectedScore === "number" && Number.isFinite(expectedScore) ? expectedScore : 0.5;
	const validActual =
		typeof actualScore === "number" && Number.isFinite(actualScore) ? actualScore : 0.5;
	const validGames =
		typeof gamesPlayed === "number" && Number.isFinite(gamesPlayed) && gamesPlayed >= 0
			? gamesPlayed
			: 0;

	const multiplier =
		validGames < resolved.newPlayerGameThreshold ? resolved.newPlayerKMultiplier : 1;
	const updated = Math.round(
		validRating + resolved.kFactor * multiplier * (validActual - validExpected),
	);
	return clampRating(Number.isFinite(updated) ? updated : validRating, resolved);
}

export function calculatePairEloUpdate({
	leftRating,
	rightRating,
	outcome,
	leftStats,
	rightStats,
	config,
}: {
	leftRating: number;
	rightRating: number;
	outcome: EloOutcome;
	leftStats?: EloStats;
	rightStats?: EloStats;
	config?: EloConfig;
}): EloPairResult {
	const resolved = resolveConfig(config);
	const normalizedLeftStats = normalizeStats(leftStats);
	const normalizedRightStats = normalizeStats(rightStats);
	const expectedScoreA = getExpectedEloScore(leftRating, rightRating, resolved);
	const expectedScoreB = getExpectedEloScore(rightRating, leftRating, resolved);
	const actualScores = getActualScores(outcome);

	return {
		newRatingA: updateEloRating({
			rating: leftRating,
			expectedScore: expectedScoreA,
			actualScore: actualScores.left,
			gamesPlayed: normalizedLeftStats.wins + normalizedLeftStats.losses,
			config: resolved,
		}),
		newRatingB: updateEloRating({
			rating: rightRating,
			expectedScore: expectedScoreB,
			actualScore: actualScores.right,
			gamesPlayed: normalizedRightStats.wins + normalizedRightStats.losses,
			config: resolved,
		}),
		winsA: normalizedLeftStats.wins + (actualScores.left === 1 ? 1 : 0),
		lossesA: normalizedLeftStats.losses + (actualScores.left === 0 ? 1 : 0),
		winsB: normalizedRightStats.wins + (actualScores.right === 1 ? 1 : 0),
		lossesB: normalizedRightStats.losses + (actualScores.right === 0 ? 1 : 0),
		expectedScoreA,
		expectedScoreB,
	};
}

function calculateSideAggregate(
	participantIds: string[],
	ratings: Record<string, number>,
	stats?: Record<string, EloStats>,
	defaultRating = DEFAULT_ELO_CONFIG.defaultRating,
): { averageRating: number; aggregateStats: EloStats } {
	if (participantIds.length === 0) {
		throw new Error("Cannot calculate Elo for an empty side");
	}
	// ⚡ Bolt Performance Optimization: Single-pass for loop to avoid callback overhead and allocations
	let ratingSum = 0;
	let winsSum = 0;
	let lossesSum = 0;
	for (let i = 0, len = participantIds.length; i < len; i++) {
		const id = participantIds[i];
		const r = ratings[id];
		ratingSum += typeof r === "number" && Number.isFinite(r) ? r : defaultRating;

		const pStats = stats?.[id];
		if (pStats) {
			const w = pStats.wins;
			const l = pStats.losses;
			winsSum += typeof w === "number" && Number.isFinite(w) ? w : 0;
			lossesSum += typeof l === "number" && Number.isFinite(l) ? l : 0;
		}
	}
	return {
		averageRating: ratingSum / participantIds.length,
		aggregateStats: { wins: winsSum, losses: lossesSum },
	};
}

export function applyEloMatchUpdate({
	ratings,
	leftParticipantIds,
	rightParticipantIds,
	winnerSide,
	stats,
	config,
}: {
	ratings: Record<string, number>;
	leftParticipantIds: string[];
	rightParticipantIds: string[];
	winnerSide: EloOutcome;
	stats?: Record<string, EloStats>;
	config?: EloConfig;
}): EloMatchResult {
	const resolved = resolveConfig(config);
	const { averageRating: leftAverageRating, aggregateStats: leftAggregateStats } =
		calculateSideAggregate(leftParticipantIds, ratings, stats, resolved.defaultRating);
	const { averageRating: rightAverageRating, aggregateStats: rightAggregateStats } =
		calculateSideAggregate(rightParticipantIds, ratings, stats, resolved.defaultRating);
	const pairUpdate = calculatePairEloUpdate({
		leftRating: leftAverageRating,
		rightRating: rightAverageRating,
		outcome: winnerSide,
		leftStats: leftAggregateStats,
		rightStats: rightAggregateStats,
		config: resolved,
	});
	const leftDelta = pairUpdate.newRatingA - leftAverageRating;
	const rightDelta = pairUpdate.newRatingB - rightAverageRating;
	const nextRatings = { ...ratings };
	const nextStats = { ...(stats ?? {}) };
	const participants: Record<string, EloParticipantResult> = {};
	const actualScores = getActualScores(winnerSide);
	const leftOutcome = actualScores.left;
	const rightOutcome = actualScores.right;

	applyParticipantUpdates(
		leftParticipantIds,
		leftDelta,
		leftOutcome,
		ratings,
		stats,
		resolved,
		nextRatings,
		nextStats,
		participants,
	);
	applyParticipantUpdates(
		rightParticipantIds,
		rightDelta,
		rightOutcome,
		ratings,
		stats,
		resolved,
		nextRatings,
		nextStats,
		participants,
	);

	return {
		ratings: nextRatings,
		stats: nextStats as Record<string, { wins: number; losses: number }>,
		participants,
		leftAverageRating,
		rightAverageRating,
	};
}
