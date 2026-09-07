import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	ArrowRight,
	Check,
	Eye,
	Flame,
	Gamepad2,
	Layers,
	Search,
	Trophy,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Button, CatImage } from "@/shared/components/LayoutBlocks";
import { CAT_IMAGES } from "@/shared/lib/constants";
import { getRandomCatImage, MOTION_DURATIONS } from "@/shared/lib/uiUtils";
import { hapticVoteTap } from "@/shared/lib/utils";
import type { Match, MatchRecord, NameItem, Team, TournamentMode } from "@/shared/types";
import {
	calculateWinStreak,
	getBracketStageLabel,
	getFlameCount,
	getMatchSideId,
	STREAK_THRESHOLDS,
} from "./tournamentEngine";

// ============================================================================
// TYPES & INTERFACES FOR VISUAL BRACKET
// ============================================================================

interface VisualContender {
	id: string;
	name: string;
	isBye: boolean;
	isWinner: boolean;
	isLoser: boolean;
	rating?: number;
	seed?: number;
	avatarUrl?: string | null;
	isTeam?: boolean;
	members?: string[];
	description?: string;
	pronunciation?: string;
	streak?: number;
}

interface VisualMatch {
	id: string; // e.g. "r1-m0"
	overallMatchNumber?: number; // 1-based order in the tournament sequence
	roundNumber: number; // 1-based round index
	roundName: string; // e.g. "Quarterfinals"
	matchIndex: number; // 0-based match index in this round
	contender1: VisualContender | null;
	contender2: VisualContender | null;
	winnerId: string | null;
	loserId: string | null;
	status: "completed" | "active" | "upcoming" | "bye";
	isCurrentMatch: boolean;
	placeholder1Text?: string;
	placeholder2Text?: string;
	targetMatchId?: string; // which match in next round this feeds into
	targetSlot?: 0 | 1; // top or bottom slot in next match
}

interface VisualRound {
	roundNumber: number;
	roundName: string;
	matches: VisualMatch[];
	isCurrentRound: boolean;
	isCompleted: boolean;
}

interface VisualBracketTree {
	rounds: VisualRound[];
	champion: VisualContender | null;
	totalEntrants: number;
	totalRounds: number;
	totalMatches: number;
	completedMatches: number;
	activeMatch: VisualMatch | null;
}

interface TournamentBracketProps {
	bracketEntrants?: string[];
	matchHistory?: MatchRecord[];
	currentMatch?: Match | null;
	names?: NameItem[];
	teams?: Team[];
	ratings?: Record<string, number>;
	totalRounds?: number;
	tournamentMode?: TournamentMode;
	isComplete?: boolean;
	onVote?: (winnerId: string, loserId: string) => void;
	onClose?: () => void;
	isModal?: boolean;
	inline?: boolean;
	className?: string;
}

// ============================================================================
// TREE DERIVATION HELPER
// ============================================================================

const BYE_PREFIX = "__BYE__";

function isByeId(id: string | null | undefined): boolean {
	return Boolean(id?.startsWith(BYE_PREFIX));
}

function nextPowerOfTwo(value: number): number {
	if (value <= 1) {
		return 1;
	}
	return 2 ** Math.ceil(Math.log2(value));
}

function padEntrantsForRound(entrants: string[]): string[] {
	if (entrants.length <= 1) {
		return entrants;
	}
	const targetSize = nextPowerOfTwo(entrants.length);
	const padded = [...entrants];
	while (padded.length < targetSize) {
		padded.push(`${BYE_PREFIX}1_${padded.length}`);
	}
	return padded;
}

export function buildVisualContender({
	id,
	seed,
	namesMap,
	teamsMap,
	ratings,
	tournamentMode,
	isWinner = false,
	isLoser = false,
	matchHistory,
}: {
	id: string;
	seed?: number;
	namesMap: Map<string, NameItem>;
	teamsMap: Map<string, Team>;
	ratings: Record<string, number>;
	tournamentMode: TournamentMode;
	isWinner?: boolean;
	isLoser?: boolean;
	matchHistory?: MatchRecord[];
}): VisualContender {
	if (isByeId(id)) {
		return {
			id,
			name: "BYE",
			isBye: true,
			isWinner: false,
			isLoser: false,
		};
	}

	const streak = calculateWinStreak(id, matchHistory);

	if (tournamentMode === "2v2") {
		const team = teamsMap.get(id);
		const teamName = team ? team.memberNames.join(" + ") : id;
		const memberNames = team ? team.memberNames : [id];
		const rating = ratings[id] ?? 1500;

		return {
			id,
			name: teamName,
			isBye: false,
			isWinner,
			isLoser,
			rating,
			seed,
			isTeam: true,
			members: memberNames,
			avatarUrl: null,
			streak,
		};
	}

	const nameItem = namesMap.get(id);
	const catName = nameItem?.name ?? id;
	const rating = ratings[id] ?? nameItem?.rating ?? 1500;
	const avatarUrl = getRandomCatImage(id, CAT_IMAGES, catName);

	return {
		id,
		name: catName,
		isBye: false,
		isWinner,
		isLoser,
		rating,
		seed,
		isTeam: false,
		description: nameItem?.description,
		pronunciation: nameItem?.pronunciation,
		avatarUrl,
		streak,
	};
}

export function deriveVisualBracketTree({
	bracketEntrants = [],
	matchHistory = [],
	names = [],
	teams = [],
	ratings = {},
	totalRounds: passedTotalRounds,
	tournamentMode = "1v1",
}: {
	bracketEntrants?: string[];
	matchHistory?: MatchRecord[];
	currentMatch?: Match | null;
	names?: NameItem[];
	teams?: Team[];
	ratings?: Record<string, number>;
	totalRounds?: number;
	tournamentMode?: TournamentMode;
}): VisualBracketTree {
	const namesMap = new Map<string, NameItem>();
	for (const n of names) {
		namesMap.set(String(n.id), n);
	}

	const teamsMap = new Map<string, Team>();
	for (const t of teams) {
		teamsMap.set(t.id, t);
	}

	const realEntrants = bracketEntrants.filter((id) => !isByeId(id));
	const totalEntrants = realEntrants.length;

	if (totalEntrants < 2) {
		const singleContender = realEntrants[0]
			? buildVisualContender({
					id: realEntrants[0],
					seed: 1,
					namesMap,
					teamsMap,
					ratings,
					tournamentMode,
					isWinner: true,
					matchHistory,
				})
			: null;

		return {
			rounds: [],
			champion: singleContender,
			totalEntrants,
			totalRounds: 1,
			totalMatches: 0,
			completedMatches: 0,
			activeMatch: null,
		};
	}

	const calcRounds = Math.max(1, Math.ceil(Math.log2(totalEntrants)));
	const totalRounds = passedTotalRounds ?? calcRounds;
	const totalMatches = Math.max(0, totalEntrants - 1);
	const completedMatches = matchHistory.length;

	// Build seed map for round 1 entrants
	const seedMap = new Map<string, number>();
	let seedCounter = 1;
	for (const id of bracketEntrants) {
		if (!isByeId(id) && !seedMap.has(id)) {
			seedMap.set(id, seedCounter++);
		}
	}

	let currentRoundEntrants: (string | null)[] = padEntrantsForRound(bracketEntrants);
	let historyCursor = 0;
	let matchSequenceCounter = 1;
	let activeMatchNode: VisualMatch | null = null;

	const rounds: VisualRound[] = [];

	for (let r = 1; r <= totalRounds; r++) {
		const matchCount = Math.max(1, Math.floor(currentRoundEntrants.length / 2));
		const nextRoundEntrants: (string | null)[] = [];
		const roundMatches: VisualMatch[] = [];
		const stageLabel = getBracketStageLabel(r, totalRounds);

		for (let m = 0; m < matchCount; m++) {
			const leftId = currentRoundEntrants[2 * m] ?? null;
			const rightId = currentRoundEntrants[2 * m + 1] ?? null;
			const matchId = `r${r}-m${m}`;
			const targetMatchId = r < totalRounds ? `r${r + 1}-m${Math.floor(m / 2)}` : undefined;
			const targetSlot = (m % 2) as 0 | 1;

			const leftIsBye = isByeId(leftId);
			const rightIsBye = isByeId(rightId);

			let status: VisualMatch["status"] = "upcoming";
			let winnerId: string | null = null;
			let loserId: string | null = null;
			let isCurrentMatch = false;
			let overallMatchNumber: number | undefined;

			if (leftIsBye && rightIsBye) {
				// Double bye (rare)
				status = "bye";
				nextRoundEntrants.push(null);
			} else if (leftIsBye && rightId) {
				// Right advances by bye
				status = "bye";
				winnerId = rightId;
				loserId = leftId;
				nextRoundEntrants.push(rightId);
			} else if (rightIsBye && leftId) {
				// Left advances by bye
				status = "bye";
				winnerId = leftId;
				loserId = rightId;
				nextRoundEntrants.push(leftId);
			} else if (leftId && rightId) {
				// Regular head-to-head match
				overallMatchNumber = matchSequenceCounter++;

				if (historyCursor < matchHistory.length) {
					const record = matchHistory[historyCursor];
					status = "completed";
					winnerId = String(record.winner);
					loserId = String(record.loser);
					nextRoundEntrants.push(winnerId);
					historyCursor++;
				} else if (historyCursor === matchHistory.length) {
					status = "active";
					isCurrentMatch = true;
					nextRoundEntrants.push(null);
					historyCursor++;
				} else {
					status = "upcoming";
					nextRoundEntrants.push(null);
					historyCursor++;
				}
			} else {
				// Unknown contender(s) from earlier pending rounds
				status = "upcoming";
				nextRoundEntrants.push(null);
			}

			const contender1 = leftId
				? buildVisualContender({
						id: leftId,
						seed: r === 1 ? seedMap.get(leftId) : undefined,
						namesMap,
						teamsMap,
						ratings,
						tournamentMode,
						isWinner: winnerId === leftId && !leftIsBye,
						isLoser: loserId === leftId,
						matchHistory,
					})
				: null;

			const contender2 = rightId
				? buildVisualContender({
						id: rightId,
						seed: r === 1 ? seedMap.get(rightId) : undefined,
						namesMap,
						teamsMap,
						ratings,
						tournamentMode,
						isWinner: winnerId === rightId && !rightIsBye,
						isLoser: loserId === rightId,
						matchHistory,
					})
				: null;

			const placeholder1Text = contender1
				? undefined
				: r > 1
					? `Winner R${r - 1}·M${2 * m + 1}`
					: "TBD";
			const placeholder2Text = contender2
				? undefined
				: r > 1
					? `Winner R${r - 1}·M${2 * m + 2}`
					: "TBD";

			const matchNode: VisualMatch = {
				id: matchId,
				overallMatchNumber,
				roundNumber: r,
				roundName: stageLabel,
				matchIndex: m,
				contender1,
				contender2,
				winnerId,
				loserId,
				status,
				isCurrentMatch,
				placeholder1Text,
				placeholder2Text,
				targetMatchId,
				targetSlot,
			};

			if (isCurrentMatch) {
				activeMatchNode = matchNode;
			}

			roundMatches.push(matchNode);
		}

		const isRoundCompleted = roundMatches.every(
			(m) => m.status === "completed" || m.status === "bye",
		);
		const isCurrentRound = roundMatches.some((m) => m.status === "active");

		rounds.push({
			roundNumber: r,
			roundName: stageLabel,
			matches: roundMatches,
			isCurrentRound,
			isCompleted: isRoundCompleted,
		});

		currentRoundEntrants = nextRoundEntrants;
	}

	// Derive the crowned Champion if the final match is completed
	const finalRound = rounds[rounds.length - 1];
	const finalMatch = finalRound?.matches[0];
	let champion: VisualContender | null = null;

	if (finalMatch && finalMatch.status === "completed" && finalMatch.winnerId) {
		champion = buildVisualContender({
			id: finalMatch.winnerId,
			namesMap,
			teamsMap,
			ratings,
			tournamentMode,
			isWinner: true,
			matchHistory,
		});
	}

	return {
		rounds,
		champion,
		totalEntrants,
		totalRounds,
		totalMatches,
		completedMatches,
		activeMatch: activeMatchNode,
	};
}

// ============================================================================
// SUB-COMPONENTS: MATCH NODE, CONTENDER ROW, CONNECTOR LINES, PODIUM
// ============================================================================

interface ContenderRowProps {
	contender: VisualContender | null;
	placeholderText?: string;
	isWinner?: boolean;
	isLoser?: boolean;
	isLive?: boolean;
	isHighlighted?: boolean;
	onSelectContender?: (id: string) => void;
	onVote?: () => void;
	showVoteButton?: boolean;
}

function ContenderRow({
	contender,
	placeholderText,
	isWinner,
	isLoser,
	isLive,
	isHighlighted,
	onSelectContender,
	onVote,
	showVoteButton,
}: ContenderRowProps) {
	const prefersReducedMotion = useReducedMotion();

	if (!contender) {
		return (
			<motion.div
				layout={true}
				initial={prefersReducedMotion ? false : { opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="flex h-11 items-center justify-between gap-2 px-3 py-1.5 text-xs text-muted-foreground/60 select-none"
			>
				<div className="flex items-center gap-2">
					<div className="size-6 rounded-full border border-dashed border-border/60 bg-muted/20 flex items-center justify-center text-[10px] text-muted-foreground">
						?
					</div>
					<span className="font-mono text-[11px] italic tracking-tight">
						{placeholderText || "TBD"}
					</span>
				</div>
			</motion.div>
		);
	}

	if (contender.isBye) {
		return (
			<motion.div
				layout={true}
				initial={prefersReducedMotion ? false : { opacity: 0 }}
				animate={{ opacity: 1 }}
				className="flex h-11 items-center justify-between gap-2 px-3 py-1.5 text-xs text-muted-foreground/40 italic select-none"
			>
				<div className="flex items-center gap-2">
					<span className="size-6 rounded-full bg-muted/20 flex items-center justify-center text-[9px]">
						&mdash;
					</span>
					<span className="text-[11px]">BYE (Auto-advance)</span>
				</div>
			</motion.div>
		);
	}

	const isHeat = contender.streak && contender.streak >= STREAK_THRESHOLDS.warm;
	const _flameCount = isHeat ? Math.min(getFlameCount(contender.streak ?? 0), 4) : 0;

	return (
		<motion.div
			layout={true}
			initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.25 }}
			className={`group/row relative flex h-12 items-center justify-between gap-2 px-3 py-1.5 transition-colors duration-200 ${
				isWinner
					? "bg-primary/10 text-foreground font-semibold"
					: isLoser
						? "bg-muted/15 text-muted-foreground/65 opacity-70"
						: isLive
							? "bg-primary/[0.06] text-foreground font-medium"
							: "text-foreground hover:bg-muted/30"
			} ${isHighlighted ? "bg-primary/20 ring-1 ring-primary/40" : ""}`}
		>
			<button
				type="button"
				onClick={() => onSelectContender?.(contender.id)}
				className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
				title={`Click to view stats for ${contender.name}`}
			>
				{/* Contender Avatar / Initial */}
				<div className="relative shrink-0">
					{contender.avatarUrl ? (
						<CatImage
							src={contender.avatarUrl}
							alt={contender.name}
							containerClassName="size-7 rounded-full border border-border/50 shadow-xs"
							imageClassName="size-full object-cover rounded-full"
						/>
					) : (
						<div
							className={`size-7 rounded-full flex items-center justify-center text-[10px] font-black tracking-wider uppercase border ${
								isWinner
									? "border-primary/50 bg-primary/20 text-primary"
									: "border-border/60 bg-muted/40 text-muted-foreground"
							}`}
						>
							{contender.name[0] || "?"}
						</div>
					)}

					<AnimatePresence>
						{isWinner && (
							<motion.div
								initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: -45 }}
								animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
								exit={{ scale: 0 }}
								transition={{ type: "spring", stiffness: 450, damping: 22 }}
								className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-xs"
							>
								<Check className="size-2.5 stroke-[3]" />
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{/* Contender Name & Stats */}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5 truncate">
						{contender.seed && (
							<span className="font-mono text-[10px] text-muted-foreground shrink-0 font-normal">
								#{contender.seed}
							</span>
						)}
						<span
							className={`truncate text-xs tracking-tight ${
								isWinner
									? "font-bold text-foreground"
									: isLoser
										? "line-through text-muted-foreground"
										: "font-medium"
							}`}
						>
							{contender.name}
						</span>
					</div>

					<div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
						{contender.rating && (
							<span className="tabular-nums">{Math.round(contender.rating)}</span>
						)}
						{isHeat && (
							<span className="inline-flex items-center gap-0.5 text-amber-500 dark:text-amber-400 font-sans font-bold">
								<Flame className="size-2.5 fill-amber-500 text-amber-500" />
								<span>{contender.streak}W</span>
							</span>
						)}
					</div>
				</div>
			</button>

			{/* Quick Vote Action (if live and onVote provided) */}
			{showVoteButton && onVote && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onVote();
					}}
					className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors shadow-xs active:scale-95"
					title={`Vote for ${contender.name}`}
				>
					<span>Vote</span>
					<ArrowRight className="size-2.5" />
				</button>
			)}
		</motion.div>
	);
}

interface MatchNodeCardProps {
	match: VisualMatch;
	highlightedContenderId: string | null;
	onSelectMatch?: (match: VisualMatch) => void;
	onSelectContender?: (id: string) => void;
	onVoteForSide?: (side: "left" | "right") => void;
}

export const MatchNodeCard = memo(function MatchNodeCard({
	match,
	highlightedContenderId,
	onSelectMatch,
	onSelectContender,
	onVoteForSide,
}: MatchNodeCardProps) {
	const isLive = match.status === "active";
	const isCompleted = match.status === "completed";
	const isBye = match.status === "bye";

	const hasHighlight =
		highlightedContenderId &&
		(match.contender1?.id === highlightedContenderId ||
			match.contender2?.id === highlightedContenderId);

	return (
		<motion.div
			layout="position"
			id={`match-node-${match.id}`}
			className={`group/card relative w-64 sm:w-72 flex flex-col rounded-2xl border transition-colors duration-300 backdrop-blur-md shadow-md ${
				isLive
					? "border-primary shadow-[0_0_24px_hsl(var(--primary)/0.25)] ring-2 ring-primary/40 bg-card/95"
					: isCompleted
						? "border-border/60 bg-card/75 hover:border-border/90 hover:bg-card/90"
						: isBye
							? "border-border/30 bg-card/40 opacity-70"
							: "border-border/40 bg-card/50 hover:bg-card/70"
			} ${hasHighlight ? "ring-2 ring-primary/60 shadow-lg scale-[1.02]" : ""}`}
		>
			{/* Match Header Bar */}
			<div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<span className="font-mono">
						{match.overallMatchNumber ? `M${match.overallMatchNumber}` : match.roundName}
					</span>
					{isLive && (
						<span className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 font-bold animate-pulse">
							<span className="size-1.5 rounded-full bg-primary" />
							LIVE VOTE
						</span>
					)}
					{isCompleted && <span className="text-muted-foreground/75 font-normal">Final</span>}
					{isBye && <span className="text-muted-foreground/60 font-normal">Bye</span>}
				</div>

				<button
					type="button"
					onClick={() => onSelectMatch?.(match)}
					className="text-muted-foreground/60 hover:text-foreground transition-colors"
					title="View match details"
				>
					<Eye className="size-3" />
				</button>
			</div>

			{/* Match Contenders Body */}
			<div className="flex flex-col divide-y divide-border/30 overflow-hidden rounded-b-2xl">
				{/* Contender 1 (Top slot) */}
				<ContenderRow
					contender={match.contender1}
					placeholderText={match.placeholder1Text}
					isWinner={match.winnerId === match.contender1?.id}
					isLoser={match.loserId === match.contender1?.id}
					isLive={isLive}
					isHighlighted={highlightedContenderId === match.contender1?.id}
					onSelectContender={onSelectContender}
					showVoteButton={isLive && Boolean(match.contender1)}
					onVote={() => onVoteForSide?.("left")}
				/>

				{/* Contender 2 (Bottom slot) */}
				<ContenderRow
					contender={match.contender2}
					placeholderText={match.placeholder2Text}
					isWinner={match.winnerId === match.contender2?.id}
					isLoser={match.loserId === match.contender2?.id}
					isLive={isLive}
					isHighlighted={highlightedContenderId === match.contender2?.id}
					onSelectContender={onSelectContender}
					showVoteButton={isLive && Boolean(match.contender2)}
					onVote={() => onVoteForSide?.("right")}
				/>
			</div>
		</motion.div>
	);
});

// ============================================================================
// CHAMPION SPOTLIGHT PODIUM
// ============================================================================

interface ChampionPodiumProps {
	champion: VisualContender | null;
	isComplete: boolean;
	onSelectContender?: (id: string) => void;
}

function ChampionPodium({ champion, isComplete, onSelectContender }: ChampionPodiumProps) {
	if (!champion && !isComplete) {
		return (
			<div className="w-56 sm:w-64 flex flex-col items-center justify-center p-6 rounded-3xl border border-dashed border-border/50 bg-card/30 text-center gap-3">
				<div className="size-14 rounded-2xl border border-border/40 bg-muted/20 flex items-center justify-center text-muted-foreground/60 shadow-inner">
					<Trophy className="size-6 text-muted-foreground/40" />
				</div>
				<div className="space-y-1">
					<p className="text-xs font-bold text-muted-foreground">The Crown</p>
					<p className="text-[11px] text-muted-foreground/70">Awaiting final match champion</p>
				</div>
			</div>
		);
	}

	if (!champion) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.92, y: 10 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			transition={{ duration: MOTION_DURATIONS.gentle }}
			className="group/champion relative w-60 sm:w-72 flex flex-col items-center overflow-hidden rounded-3xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-500/15 via-card/90 to-card p-5 text-center shadow-[0_0_40px_rgba(245,158,11,0.25)] backdrop-blur-xl"
		>
			<div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.2),transparent_70%)]" />

			{/* Trophy Badge */}
			<div className="relative mb-3 flex size-16 items-center justify-center rounded-2xl border border-amber-400/60 bg-amber-500/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
				<Trophy
					className="size-8 text-amber-400 animate-bounce"
					style={{ animationDuration: "3s" }}
				/>
			</div>

			<span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500 dark:text-amber-400">
				Tournament Champion
			</span>

			{/* Champion Avatar */}
			<button
				type="button"
				onClick={() => onSelectContender?.(champion.id)}
				className="group mt-3 flex flex-col items-center gap-2 focus-visible:outline-none"
			>
				{champion.avatarUrl ? (
					<div className="relative size-20 sm:size-24 rounded-full p-1 border-2 border-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.35)]">
						<CatImage
							src={champion.avatarUrl}
							alt={champion.name}
							containerClassName="size-full rounded-full overflow-hidden"
							imageClassName="size-full object-cover transition-transform duration-500 group-hover:scale-110"
						/>
					</div>
				) : (
					<div className="size-20 rounded-full border-2 border-amber-400/80 bg-amber-500/20 flex items-center justify-center text-2xl font-black text-amber-300">
						{champion.name[0] || "★"}
					</div>
				)}

				<h3 className="text-lg sm:text-xl font-display font-extrabold tracking-tight text-foreground group-hover:text-amber-500 transition-colors">
					{champion.name}
				</h3>
			</button>

			{champion.description && (
				<p className="mt-1 line-clamp-2 text-xs text-muted-foreground px-2">
					{champion.description}
				</p>
			)}

			<div className="mt-3 flex items-center justify-center gap-3 text-xs font-mono">
				{champion.rating && (
					<span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[11px] text-foreground font-semibold">
						Elo: {Math.round(champion.rating)}
					</span>
				)}
				{champion.streak && champion.streak > 0 && (
					<span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-500 font-bold">
						<Flame className="size-3 fill-amber-500" />
						{champion.streak}W Streak
					</span>
				)}
			</div>
		</motion.div>
	);
}

// ============================================================================
// CONTENDER DETAIL MODAL / DRAWER
// ============================================================================

interface ContenderDetailModalProps {
	contenderId: string | null;
	namesMap: Map<string, NameItem>;
	teamsMap: Map<string, Team>;
	ratings: Record<string, number>;
	matchHistory: MatchRecord[];
	tournamentMode: TournamentMode;
	onClose: () => void;
}

function ContenderDetailModal({
	contenderId,
	namesMap,
	teamsMap,
	ratings,
	matchHistory,
	tournamentMode,
	onClose,
}: ContenderDetailModalProps) {
	if (!contenderId) {
		return null;
	}

	const contender = buildVisualContender({
		id: contenderId,
		namesMap,
		teamsMap,
		ratings,
		tournamentMode,
		matchHistory,
	});

	// Compute tournament stats for this contestant
	const matchesInvolved = matchHistory.filter((m) => {
		const leftId = getMatchSideId(m.match, "left");
		const rightId = getMatchSideId(m.match, "right");
		return leftId === contenderId || rightId === contenderId;
	});

	const wins = matchesInvolved.filter((m) => String(m.winner) === contenderId).length;
	const losses = matchesInvolved.length - wins;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.94, y: 16 }}
				animate={{ scale: 1, y: 0 }}
				exit={{ scale: 0.94, y: 16 }}
				transition={{ duration: MOTION_DURATIONS.base }}
				onClick={(e) => e.stopPropagation()}
				className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl"
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					aria-label="Close contender details"
				>
					<X className="size-4" />
				</button>

				<div className="flex flex-col items-center text-center">
					{contender.avatarUrl ? (
						<CatImage
							src={contender.avatarUrl}
							alt={contender.name}
							containerClassName="size-24 rounded-2xl border border-border/60 overflow-hidden shadow-lg mb-4"
							imageClassName="size-full object-cover"
						/>
					) : (
						<div className="size-24 rounded-2xl border border-border/60 bg-muted/40 flex items-center justify-center text-3xl font-bold text-muted-foreground mb-4">
							{contender.name[0] || "?"}
						</div>
					)}

					<h3 className="text-2xl font-display font-black text-foreground">{contender.name}</h3>
					{contender.pronunciation && (
						<p className="text-xs font-mono text-muted-foreground mt-0.5">
							/{contender.pronunciation}/
						</p>
					)}
					{contender.description && (
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-xs">
							{contender.description}
						</p>
					)}

					{/* Roster if 2v2 team */}
					{contender.isTeam && contender.members && (
						<div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
							{contender.members.map((member) => (
								<span
									key={`team-member-${member}`}
									className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-foreground font-medium"
								>
									{member}
								</span>
							))}
						</div>
					)}

					{/* Stats Grid */}
					<div className="mt-6 grid w-full grid-cols-3 gap-2.5 rounded-2xl border border-border/50 bg-muted/20 p-3">
						<div className="text-center">
							<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Elo Rating
							</p>
							<p className="mt-1 font-mono text-lg font-bold text-foreground">
								{Math.round(contender.rating ?? 1500)}
							</p>
						</div>
						<div className="text-center border-x border-border/40">
							<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Tourney W/L
							</p>
							<p className="mt-1 font-mono text-lg font-bold text-primary">
								{wins} <span className="text-xs text-muted-foreground">/ {losses}</span>
							</p>
						</div>
						<div className="text-center">
							<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Streak
							</p>
							<p className="mt-1 font-mono text-lg font-bold text-amber-500">
								{contender.streak ?? 0}W
							</p>
						</div>
					</div>

					<Button
						variant="glass"
						size="medium"
						onClick={onClose}
						className="mt-6 w-full rounded-xl"
					>
						Close
					</Button>
				</div>
			</motion.div>
		</motion.div>
	);
}

// ============================================================================
// MAIN VISUAL TOURNAMENT BRACKET COMPONENT
// ============================================================================

export function TournamentBracket({
	bracketEntrants = [],
	matchHistory = [],
	currentMatch = null,
	names = [],
	teams = [],
	ratings = {},
	totalRounds: passedTotalRounds,
	tournamentMode = "1v1",
	isComplete = false,
	onVote,
	onClose,
	isModal = false,
	inline = false,
	className = "",
}: TournamentBracketProps) {
	const _prefersReducedMotion = useReducedMotion();
	const containerRef = useRef<HTMLDivElement>(null);

	// Visual Modes: "tree" (visual diagram with connector flows) or "cards" (round tab list)
	const [viewMode, setViewMode] = useState<"tree" | "cards">("tree");
	const [activeRoundTab, setActiveRoundTabState] = useState<number>(1);
	const [roundDirection, setRoundDirection] = useState<number>(0);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedContenderId, setSelectedContenderId] = useState<string | null>(null);
	const [_selectedMatch, setSelectedMatch] = useState<VisualMatch | null>(null);
	const [zoomLevel, setZoomLevel] = useState<number>(1);

	const setActiveRoundTab = useCallback(
		(newTab: number) => {
			setRoundDirection(newTab >= activeRoundTab ? 1 : -1);
			setActiveRoundTabState(newTab);
		},
		[activeRoundTab],
	);

	// Derive the rich visual tree
	const bracketTree = useMemo(() => {
		return deriveVisualBracketTree({
			bracketEntrants,
			matchHistory,
			currentMatch,
			names,
			teams,
			ratings,
			totalRounds: passedTotalRounds,
			tournamentMode,
		});
	}, [
		bracketEntrants,
		matchHistory,
		currentMatch,
		names,
		teams,
		ratings,
		passedTotalRounds,
		tournamentMode,
	]);

	const { rounds, champion, totalMatches, completedMatches, activeMatch } = bracketTree;

	// Maps for quick detail lookup
	const namesMap = useMemo(() => {
		const map = new Map<string, NameItem>();
		for (const n of names) {
			map.set(String(n.id), n);
		}
		return map;
	}, [names]);

	const teamsMap = useMemo(() => {
		const map = new Map<string, Team>();
		for (const t of teams) {
			map.set(t.id, t);
		}
		return map;
	}, [teams]);

	// Highlight match / contestant based on search query
	const highlightedContenderId = useMemo(() => {
		if (!searchQuery.trim()) {
			return null;
		}
		const query = searchQuery.toLowerCase().trim();
		for (const [id, item] of namesMap) {
			if (item.name.toLowerCase().includes(query)) {
				return id;
			}
		}
		for (const [id, team] of teamsMap) {
			if (team.memberNames.some((m) => m.toLowerCase().includes(query))) {
				return id;
			}
		}
		return null;
	}, [searchQuery, namesMap, teamsMap]);

	// Zoom handlers
	const handleZoomIn = useCallback(() => {
		setZoomLevel((prev) => Math.min(prev + 0.15, 1.6));
	}, []);

	const handleZoomOut = useCallback(() => {
		setZoomLevel((prev) => Math.max(prev - 0.15, 0.65));
	}, []);

	const handleResetZoom = useCallback(() => {
		setZoomLevel(1);
	}, []);

	// Vote from bracket handler
	const handleVoteForSide = useCallback(
		(side: "left" | "right") => {
			if (!activeMatch || !onVote) {
				return;
			}
			hapticVoteTap();
			const winnerId = side === "left" ? activeMatch.contender1?.id : activeMatch.contender2?.id;
			const loserId = side === "left" ? activeMatch.contender2?.id : activeMatch.contender1?.id;
			if (winnerId && loserId) {
				onVote(winnerId, loserId);
			}
		},
		[activeMatch, onVote],
	);

	const progressPct = totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0;

	// Accessible ARIA live status announcement for screen readers
	const liveAnnouncement = useMemo(() => {
		if (isComplete && champion) {
			return `Tournament completed! Champion is ${champion.name}.`;
		}
		if (activeMatch) {
			const c1 = activeMatch.contender1?.name || "TBD";
			const c2 = activeMatch.contender2?.name || "TBD";
			return `Current active match in ${activeMatch.roundName}: ${c1} versus ${c2}. Progress: ${completedMatches} of ${totalMatches} matches completed (${progressPct}%).`;
		}
		return `Viewing tournament bracket with ${rounds.length} rounds. Progress: ${progressPct}%.`;
	}, [
		isComplete,
		champion,
		activeMatch,
		completedMatches,
		totalMatches,
		progressPct,
		rounds.length,
	]);

	return (
		<div
			role="region"
			aria-label="Tournament Bracket Interactive Visualizer"
			className={`relative flex flex-col w-full rounded-3xl border border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl overflow-hidden font-display text-foreground ${
				isModal ? "max-h-[90vh]" : ""
			} ${className}`}
		>
			{/* Accessible Screen Reader Live Announcement */}
			<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
				{liveAnnouncement}
			</div>

			{/* Top Header & Toolbar */}
			<div className="flex flex-col gap-3 border-b border-border/40 p-4 sm:p-5 bg-card/90">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="size-10 rounded-2xl border border-primary/40 bg-primary/15 text-primary flex items-center justify-center shadow-xs">
							<Layers className="size-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
									Tournament Bracket
								</h2>
								<span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
									{tournamentMode === "2v2" ? "2v2 Teams" : "1v1 Single Elimination"}
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Live tree of match progress, bracket paths, and cat contender seedings.
							</p>
						</div>
					</div>

					{/* Right Side Controls */}
					<div className="flex items-center gap-2">
						{/* View Switcher Tabs */}
						<div className="inline-flex rounded-xl border border-border/50 bg-muted/30 p-0.5 text-xs">
							<button
								type="button"
								onClick={() => setViewMode("tree")}
								className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
									viewMode === "tree"
										? "bg-card text-foreground shadow-xs font-semibold"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<Layers className="size-3.5" />
								<span>Tree Flow</span>
							</button>
							<button
								type="button"
								onClick={() => setViewMode("cards")}
								className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
									viewMode === "cards"
										? "bg-card text-foreground shadow-xs font-semibold"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<Gamepad2 className="size-3.5" />
								<span>Rounds List</span>
							</button>
						</div>

						{/* Close button if in modal mode */}
						{onClose && (
							<button
								type="button"
								onClick={onClose}
								className="rounded-xl border border-border/50 bg-muted/30 p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
								aria-label="Close bracket view"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
				</div>

				{/* Progress & Search Ribbon */}
				<div className="flex flex-wrap items-center justify-between gap-3 pt-1">
					{/* Progress Pill */}
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
							<span>
								Matches: <strong className="text-primary font-bold">{completedMatches}</strong> /{" "}
								{totalMatches}
							</span>
							<span className="text-muted-foreground/40">&middot;</span>
							<span>{progressPct}% Completed</span>
						</div>

						<div className="h-2 w-28 sm:w-36 overflow-hidden rounded-full bg-muted/40">
							<div
								className="h-full rounded-full bg-primary transition-all duration-500 shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
								style={{ width: `${progressPct}%` }}
							/>
						</div>
					</div>

					{/* Search & Zoom Actions */}
					<div className="flex items-center gap-2">
						{/* Search Input */}
						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Find cat in bracket..."
								className="h-8 w-36 sm:w-48 rounded-xl border border-border/50 bg-muted/30 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							{searchQuery && (
								<button
									type="button"
									onClick={() => setSearchQuery("")}
									className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									<X className="size-3" />
								</button>
							)}
						</div>

						{/* Zoom Buttons (Tree Mode only) */}
						{viewMode === "tree" && (
							<div className="hidden sm:flex items-center rounded-xl border border-border/50 bg-muted/30 p-0.5 text-xs">
								<button
									type="button"
									onClick={handleZoomOut}
									className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
									title="Zoom out"
								>
									<ZoomOut className="size-3.5" />
								</button>
								<button
									type="button"
									onClick={handleResetZoom}
									className="px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground"
									title="Reset zoom"
								>
									{Math.round(zoomLevel * 100)}%
								</button>
								<button
									type="button"
									onClick={handleZoomIn}
									className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
									title="Zoom in"
								>
									<ZoomIn className="size-3.5" />
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Bracket Content Body */}
			<div
				ref={containerRef}
				className="relative flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6 select-none"
				style={{ minHeight: inline ? "420px" : "540px" }}
			>
				{rounds.length === 0 ? (
					<div className="flex h-64 flex-col items-center justify-center text-center gap-2 text-muted-foreground">
						<Layers className="size-8 text-muted-foreground/40" />
						<p className="text-sm">No bracket data available yet.</p>
						<p className="text-xs text-muted-foreground/70">
							Select cat names in the tournament setup to initialize the field.
						</p>
					</div>
				) : viewMode === "tree" ? (
					/* ==========================================================
					   1. TREE FLOW DIAGRAM (Horizontal multi-column layout)
					   ========================================================== */
					<motion.div
						layout={true}
						className="flex items-center gap-8 sm:gap-12 min-w-max pb-8 transition-transform duration-200 origin-top-left"
						style={{ transform: `scale(${zoomLevel})` }}
					>
						{rounds.map((round, rIndex) => (
							<motion.div
								layout={true}
								initial={_prefersReducedMotion ? false : { opacity: 0, y: 15 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: rIndex * 0.05 }}
								key={`round-col-${round.roundNumber}`}
								className="flex flex-col gap-4 items-center shrink-0"
							>
								{/* Round Column Header */}
								<div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3.5 py-1.5 text-xs font-bold text-foreground shadow-xs">
									<span>{round.roundName}</span>
									{round.isCurrentRound && (
										<span className="size-2 rounded-full bg-primary animate-ping" />
									)}
								</div>

								{/* Matches in this Round Column */}
								<div className="flex flex-col justify-around gap-6 sm:gap-8 flex-1">
									{round.matches.map((match) => (
										<div key={`tree-node-${match.id}`} className="relative flex items-center">
											<MatchNodeCard
												match={match}
												highlightedContenderId={highlightedContenderId}
												onSelectMatch={setSelectedMatch}
												onSelectContender={setSelectedContenderId}
												onVoteForSide={handleVoteForSide}
											/>

											{/* Visual Branch Connectors (if not the last round) */}
											{round.roundNumber < rounds.length && (
												<div
													className="pointer-events-none absolute left-full top-1/2 w-8 sm:w-12 h-[2px] bg-border/40 group-hover/card:bg-primary/50 transition-colors"
													aria-hidden="true"
												/>
											)}
										</div>
									))}
								</div>
							</motion.div>
						))}

						{/* Final Championship Podium Pillar */}
						<motion.div
							layout={true}
							initial={_prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.35, delay: rounds.length * 0.05 }}
							className="flex flex-col items-center justify-center shrink-0 pl-4"
						>
							<div className="mb-4 flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-500 shadow-xs">
								<Trophy className="size-3.5 text-amber-400" />
								<span>Championship Crown</span>
							</div>

							<ChampionPodium
								champion={champion}
								isComplete={isComplete}
								onSelectContender={setSelectedContenderId}
							/>
						</motion.div>
					</motion.div>
				) : (
					/* ==========================================================
					   2. ROUND-BY-ROUND CARDS VIEW (Tabbed segmented view)
					   ========================================================== */
					<div className="flex flex-col gap-6 max-w-4xl mx-auto overflow-hidden">
						{/* Round Switcher Pills */}
						<div className="flex items-center gap-2 overflow-x-auto pb-2">
							{rounds.map((round) => {
								const isActive = activeRoundTab === round.roundNumber;
								return (
									<button
										key={`round-tab-${round.roundNumber}`}
										type="button"
										onClick={() => setActiveRoundTab(round.roundNumber)}
										className={`shrink-0 flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
											isActive
												? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
												: round.isCompleted
													? "border-border/60 bg-card/60 text-foreground hover:bg-card"
													: "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground"
										}`}
									>
										<span>{round.roundName}</span>
										{round.isCurrentRound && (
											<span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
										)}
									</button>
								);
							})}

							<button
								type="button"
								onClick={() => setActiveRoundTab(rounds.length + 1)}
								className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
									activeRoundTab === rounds.length + 1
										? "border-amber-400 bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20 scale-105"
										: "border-amber-400/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
								}`}
							>
								<Trophy className="size-3.5" />
								<span>Champion Podium</span>
							</button>
						</div>

						{/* Matches Grid for Selected Round with Slide and Fade Transitions */}
						<AnimatePresence mode="wait" custom={roundDirection} initial={false}>
							{activeRoundTab <= rounds.length ? (
								<motion.div
									key={`tab-round-grid-${activeRoundTab}`}
									custom={roundDirection}
									initial={
										_prefersReducedMotion
											? { opacity: 0 }
											: {
													x: roundDirection > 0 ? 36 : -36,
													opacity: 0,
													scale: 0.98,
													filter: "blur(4px)",
												}
									}
									animate={
										_prefersReducedMotion
											? { opacity: 1 }
											: {
													x: 0,
													opacity: 1,
													scale: 1,
													filter: "blur(0px)",
													transition: {
														x: { type: "spring", stiffness: 320, damping: 30 },
														opacity: { duration: 0.22 },
														scale: { duration: 0.22 },
														filter: { duration: 0.22 },
														staggerChildren: 0.04,
													},
												}
									}
									exit={
										_prefersReducedMotion
											? { opacity: 0 }
											: {
													x: roundDirection < 0 ? 36 : -36,
													opacity: 0,
													scale: 0.98,
													filter: "blur(4px)",
													transition: {
														x: { type: "spring", stiffness: 320, damping: 30 },
														opacity: { duration: 0.18 },
														scale: { duration: 0.18 },
														filter: { duration: 0.18 },
													},
												}
									}
									className="grid gap-4 sm:grid-cols-2"
								>
									{rounds[activeRoundTab - 1]?.matches.map((match, mIdx) => (
										<motion.div
											key={`tab-match-${match.id}`}
											initial={_prefersReducedMotion ? false : { opacity: 0, y: 14 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.25, delay: mIdx * 0.03 }}
										>
											<MatchNodeCard
												match={match}
												highlightedContenderId={highlightedContenderId}
												onSelectMatch={setSelectedMatch}
												onSelectContender={setSelectedContenderId}
												onVoteForSide={handleVoteForSide}
											/>
										</motion.div>
									))}
								</motion.div>
							) : (
								<motion.div
									key="tab-podium"
									custom={roundDirection}
									initial={
										_prefersReducedMotion
											? { opacity: 0 }
											: {
													x: roundDirection > 0 ? 36 : -36,
													opacity: 0,
													scale: 0.96,
												}
									}
									animate={
										_prefersReducedMotion
											? { opacity: 1 }
											: {
													x: 0,
													opacity: 1,
													scale: 1,
													transition: {
														x: { type: "spring", stiffness: 320, damping: 30 },
														opacity: { duration: 0.25 },
													},
												}
									}
									exit={
										_prefersReducedMotion
											? { opacity: 0 }
											: {
													x: roundDirection < 0 ? 36 : -36,
													opacity: 0,
													scale: 0.96,
													transition: { duration: 0.2 },
												}
									}
									className="flex flex-col items-center justify-center py-8"
								>
									<ChampionPodium
										champion={champion}
										isComplete={isComplete}
										onSelectContender={setSelectedContenderId}
									/>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				)}
			</div>

			{/* Contender Detail Modal Popover */}
			<AnimatePresence>
				{selectedContenderId && (
					<ContenderDetailModal
						contenderId={selectedContenderId}
						namesMap={namesMap}
						teamsMap={teamsMap}
						ratings={ratings}
						matchHistory={matchHistory}
						tournamentMode={tournamentMode}
						onClose={() => setSelectedContenderId(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

// ============================================================================
// MODAL WRAPPER FOR POPUP BRACKET VIEWER
// ============================================================================

interface TournamentBracketModalProps extends TournamentBracketProps {
	isOpen: boolean;
	onClose: () => void;
}

export function TournamentBracketModal({ isOpen, onClose, ...props }: TournamentBracketModalProps) {
	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md"
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.95, y: 20 }}
				animate={{ scale: 1, y: 0 }}
				exit={{ scale: 0.95, y: 20 }}
				transition={{ duration: MOTION_DURATIONS.moderate }}
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-6xl max-h-[92vh] flex flex-col"
			>
				<TournamentBracket isModal={true} onClose={onClose} {...props} />
			</motion.div>
		</motion.div>
	);
}
