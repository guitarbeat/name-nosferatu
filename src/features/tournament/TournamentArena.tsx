import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Gamepad2, Layers, LogOut, Trophy, Undo2, X } from "lucide-react";
import { type KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/app/Providers";
import { Button, CatImage, ErrorComponent } from "@/shared/components/LayoutBlocks";
import { CAT_IMAGES } from "@/shared/lib/constants";
import { getVisibleNames } from "@/shared/lib/names";
import { getRandomCatImage, MOTION_DURATIONS } from "@/shared/lib/uiUtils";
import { hapticVoteTap } from "@/shared/lib/utils";
import type { MatchRecord, NameItem, Team, TournamentMode, TournamentProps } from "@/shared/types";
import useAppStore from "@/store";
import { useTimedState, useTournamentState } from "./hooks";
import { TournamentBracket, TournamentBracketModal } from "./TournamentBracket";
import {
	calculateWinStreak,
	extractMatchData,
	getFlameCount,
	getHeatCardClasses,
	getHeatGradientClasses,
	getHeatLevel,
	getHeatTextClasses,
	getMatchSideId,
	type HeatLevel,
	normalizeParticipant,
	STREAK_THRESHOLDS,
} from "./tournamentEngine";

interface MatchSideCardProps {
	side: "left" | "right";
	name: string;
	img: string | null;
	heatLevel: HeatLevel | null;
	streak: number;
	rating: number;
	winOdds?: number;
	isFavored: boolean;
	isVoting: boolean;
	isSelected: boolean;
	hasSelectionFeedback: boolean;
	isTeam: boolean;
	members: string[];
	description?: string;
	pronunciation?: string;
	onVote: () => void;
	onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
	shortcutHint?: string;
	animationDelay?: string;
}

/**
 * Animated ember markers showing active win-streak intensity.
 */
function StreakEmbers({
	count,
	side,
	name,
	streak,
}: {
	count: number;
	side: string;
	name: string;
	streak: number;
}) {
	return (
		<div className="flex items-center gap-1" aria-hidden="true">
			{Array.from({ length: count }).map((_, i) => (
				<span
					key={`${side}-flame-${name}-${streak}-${i}`}
					className="h-1.5 w-3.5 rounded-full bg-accent/90 shadow-[0_0_8px_hsl(var(--pw-coral-hsl)/0.6)] sm:w-4"
					style={{ animationDelay: `${i * 60}ms` }}
				/>
			))}
		</div>
	);
}

/**
 * Top floating badges for streak momentum and Elo rating.
 */
function ContenderBadges({
	side,
	name,
	streak,
	rating,
	winOdds,
	isFavored,
	isRight,
}: {
	side: "left" | "right";
	name: string;
	streak: number;
	rating: number;
	winOdds?: number;
	isFavored: boolean;
	isRight: boolean;
}) {
	const showStreak = streak >= STREAK_THRESHOLDS.warm;
	const streakBadgeCount = Math.min(getFlameCount(streak), 4);
	const ratingSideClass = isRight ? "left-3 sm:left-4" : "right-3 sm:right-4";
	const streakSideClass = isRight ? "right-3 sm:right-4" : "left-3 sm:left-4";

	return (
		<>
			{showStreak && (
				<div
					className={`absolute top-3 sm:top-4 z-20 ${streakSideClass} inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-sm backdrop-blur-md transition-transform`}
				>
					<StreakEmbers count={streakBadgeCount} side={side} name={name} streak={streak} />
					<span className="text-[10px] font-bold tracking-wide text-foreground/90">
						{streak} in a row
					</span>
				</div>
			)}

			<div
				className={`absolute top-3 sm:top-4 z-20 inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-border/50 bg-background/70 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] font-semibold tracking-wide text-foreground/80 shadow-sm backdrop-blur-md ${ratingSideClass}`}
			>
				<span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
				<span className="font-mono tabular-nums">{Math.round(rating)}</span>
				{winOdds !== undefined && (
					<>
						<span className="h-1 w-1 rounded-full bg-foreground/30" />
						<span className="font-mono text-muted-foreground tabular-nums">
							{Math.round(winOdds * 100)}%
						</span>
					</>
				)}
				{isFavored && (
					<>
						<span className="h-1.5 w-1.5 rounded-full bg-primary" />
						<span className="font-bold text-primary">Favored</span>
					</>
				)}
			</div>
		</>
	);
}

/**
 * Bottom overlay containing contender title, backstory, pronunciation, and team roster.
 */
function ContenderFooter({
	name,
	isTeam,
	members,
	description,
	pronunciation,
	shortcutHint,
	textAlign,
	bodyAlignment,
	isRight,
	side,
}: {
	name: string;
	isTeam: boolean;
	members: string[];
	description?: string;
	pronunciation?: string;
	shortcutHint?: string;
	textAlign: string;
	bodyAlignment: string;
	isRight: boolean;
	side: string;
}) {
	return (
		<div
			className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-gradient-to-t from-background/98 via-background/75 to-transparent p-4 sm:p-5 lg:p-6 ${bodyAlignment} ${textAlign}`}
		>
			<div className="flex items-center gap-2">
				<span className="text-[10px] font-bold tracking-wide text-muted-foreground">
					{isTeam ? "Team Contender" : "Cat Contender"}
				</span>
				{shortcutHint && (
					<span className="inline-flex items-center rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wide text-muted-foreground shadow-sm">
						{shortcutHint}
					</span>
				)}
			</div>

			<h3
				id={`contender-name-${side}`}
				className={`w-full break-words font-display text-2xl font-bold leading-tight text-foreground transition-colors group-hover:text-primary sm:text-3xl lg:text-4xl ${textAlign}`}
			>
				{name}
			</h3>

			{pronunciation && (
				<span className="font-sans text-[11px] font-medium tracking-wide text-muted-foreground">
					/{pronunciation}/
				</span>
			)}

			{isTeam ? (
				<div
					className={`mt-1 flex flex-wrap gap-1.5 ${
						isRight ? "justify-start sm:justify-end" : "justify-start"
					}`}
				>
					{members.map((member) => (
						<span
							key={`${side}-member-${member}`}
							className="rounded-full border border-border/50 bg-secondary/60 px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground shadow-sm"
						>
							{member}
						</span>
					))}
				</div>
			) : description ? (
				<p
					className={`mt-1 max-w-full sm:max-w-[28rem] line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:text-sm ${textAlign}`}
				>
					{description}
				</p>
			) : null}
		</div>
	);
}

/**
 * Nature-inspired tactile battle card for tournament matchups.
 */
const MatchSideCard = memo(function MatchSideCard({
	side,
	name,
	img,
	heatLevel,
	streak,
	rating,
	winOdds,
	isFavored,
	isVoting,
	isSelected,
	hasSelectionFeedback,
	isTeam,
	members,
	description,
	pronunciation,
	onVote,
	onKeyDown,
	shortcutHint,
	animationDelay,
}: MatchSideCardProps) {
	const isRight = side === "right";
	const textAlign = isRight ? "text-left sm:text-right" : "text-left";
	const bodyAlignment = isRight ? "items-start sm:items-end" : "items-start";

	const selectionClass = isSelected
		? "ring-2 ring-primary shadow-[0_0_40px_hsl(var(--pw-sage-hsl)/0.35)] scale-[1.01]"
		: hasSelectionFeedback
			? "scale-[0.985] opacity-50 blur-[0.5px]"
			: "";

	return (
		<div className="flex min-h-[22rem] flex-1 flex-col sm:min-h-[26rem] lg:min-h-[30rem]">
			<button
				type="button"
				id={`match-card-${side}`}
				className={`group relative flex h-full flex-1 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/40 bg-card/60 shadow-lg backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985] hover:border-border/80 hover:bg-card/85 hover:shadow-2xl hover:-translate-y-1.5 ${
					isVoting ? "pointer-events-none" : "cursor-pointer"
				} ${getHeatCardClasses(heatLevel)} ${selectionClass}`}
				style={animationDelay ? { animationDelay } : undefined}
				aria-label={`Vote for ${isTeam ? "team" : "name"} ${name}`}
				aria-disabled={isVoting}
				onClick={onVote}
				onKeyDown={onKeyDown}
			>
				<div className="relative flex h-full w-full items-center justify-center bg-muted/20">
					{img ? (
						<CatImage
							src={img}
							alt={name}
							containerClassName="h-full w-full"
							imageClassName="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card/80 via-card/40 to-muted/30">
							<span className="select-none font-display text-7xl font-extrabold text-muted-foreground sm:text-8xl">
								{name[0]?.toUpperCase() || "?"}
							</span>
						</div>
					)}

					{heatLevel && (
						<div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
							<div className={`absolute inset-0 ${getHeatGradientClasses(heatLevel)}`} />
						</div>
					)}

					<ContenderBadges
						side={side}
						name={name}
						streak={streak}
						rating={rating}
						winOdds={winOdds}
						isFavored={isFavored}
						isRight={isRight}
					/>

					<ContenderFooter
						name={name}
						isTeam={isTeam}
						members={members}
						description={description}
						pronunciation={pronunciation}
						shortcutHint={shortcutHint}
						textAlign={textAlign}
						bodyAlignment={bodyAlignment}
						isRight={isRight}
						side={side}
					/>
				</div>
			</button>
		</div>
	);
});

interface BracketTreeProps {
	round: number;
	totalRounds: number;
}

function getRoundCaption(stageRound: number, totalRounds: number): string {
	if (stageRound === totalRounds) {
		return "Final";
	}
	if (stageRound === totalRounds - 1) {
		return "Semi";
	}
	if (stageRound === totalRounds - 2) {
		return "Quarter";
	}
	return `R${stageRound}`;
}

function getStageFlavor(round: number, totalRounds: number): string {
	if (round >= totalRounds) {
		return "Crown Fight";
	}
	if (totalRounds - round === 1) {
		return "Final Four Chaos";
	}
	if (round <= 2) {
		return "Chaos Ladder";
	}
	return "Bracket Grind";
}

function BracketTree({
	round,
	totalRounds,
	onOpenBracket,
}: BracketTreeProps & { onOpenBracket?: () => void }) {
	const rounds = useMemo(
		() => Array.from({ length: Math.max(1, totalRounds) }, (_, i) => i + 1),
		[totalRounds],
	);
	const stageFlavor = useMemo(() => getStageFlavor(round, totalRounds), [round, totalRounds]);

	if (onOpenBracket) {
		return (
			<button
				type="button"
				onClick={onOpenBracket}
				className="w-full text-left rounded-xl border border-border/15 bg-foreground/[0.03] px-3 py-2 transition-all cursor-pointer hover:border-primary/40 hover:bg-foreground/[0.06] group/bracket focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
				title="Click to view full interactive tournament bracket"
			>
				<div className="mb-2 flex items-center justify-between text-[10px] tracking-wide text-muted-foreground">
					<span className="flex items-center gap-1">
						<Layers className="size-3 text-primary" />
						<span>Bracket Path</span>
						<span className="text-[9px] text-primary underline underline-offset-2 opacity-0 group-hover/bracket:opacity-100 transition-opacity">
							(Click to expand)
						</span>
					</span>
					<span>{stageFlavor}</span>
				</div>
				<div className="flex items-center gap-1 overflow-x-auto pb-1">
					{rounds.map((stageRound, index) => {
						const isDone = stageRound < round;
						const isActive = stageRound === round;
						const tone = isActive
							? "border-primary/70 bg-primary/20 text-primary shadow-[0_0_18px_rgba(166,94,237,0.45)]"
							: isDone
								? "border-chart-2/45 bg-chart-2/10 text-chart-2"
								: "border-border/20 bg-foreground/5 text-muted-foreground";

						return (
							<div key={`bracket-round-${stageRound}`} className="flex items-center gap-1">
								<div
									className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${tone}`}
								>
									{getRoundCaption(stageRound, totalRounds)}
									{isActive ? " ✦" : ""}
								</div>
								{index < rounds.length - 1 && (
									<div
										className={`h-[1px] w-4 sm:w-6 ${
											isDone ? "bg-chart-2/70" : isActive ? "bg-primary/70" : "bg-border/20"
										}`}
									/>
								)}
							</div>
						);
					})}
				</div>
			</button>
		);
	}

	return (
		<div className="rounded-xl border border-border/15 bg-foreground/[0.03] px-3 py-2 transition-all">
			<div className="mb-2 flex items-center justify-between text-[10px] tracking-wide text-muted-foreground">
				<span className="flex items-center gap-1">
					<Layers className="size-3 text-primary" />
					<span>Bracket Path</span>
				</span>
				<span>{stageFlavor}</span>
			</div>
			<div className="flex items-center gap-1 overflow-x-auto pb-1">
				{rounds.map((stageRound, index) => {
					const isDone = stageRound < round;
					const isActive = stageRound === round;
					const tone = isActive
						? "border-primary/70 bg-primary/20 text-primary shadow-[0_0_18px_rgba(166,94,237,0.45)]"
						: isDone
							? "border-chart-2/45 bg-chart-2/10 text-chart-2"
							: "border-border/20 bg-foreground/5 text-muted-foreground";

					return (
						<div key={`bracket-round-${stageRound}`} className="flex items-center gap-1">
							<div
								className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${tone}`}
							>
								{getRoundCaption(stageRound, totalRounds)}
								{isActive ? " ✦" : ""}
							</div>
							{index < rounds.length - 1 && (
								<div
									className={`h-[1px] w-4 sm:w-6 ${
										isDone ? "bg-chart-2/70" : isActive ? "bg-primary/70" : "bg-border/20"
									}`}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

interface TournamentHeaderProps {
	roundNumber: number;
	totalRounds: number;
	bracketStage: string;
	tournamentMode: string;
	currentMatchNumber: number;
	totalMatches: number;
	etaMinutes: number;
	canUndo: boolean;
	handleUndo: () => void;
	quitTournament: () => void;
	onOpenBracket?: () => void;
	progressWidth: number;
	stageHeadline: string;
	dominantStreak: { name: string; streak: number; heatLevel: HeatLevel } | null;
	matchupTone: string;
	pressureCopy: string;
	matchesRemaining: number;
	roundMatchesLeft: number;
}

/**
 * Top title section with round info and match counter.
 */
function HeaderTitle({
	roundNumber,
	bracketStage,
	tournamentMode,
	currentMatchNumber,
	totalMatches,
	etaMinutes,
}: Pick<
	TournamentHeaderProps,
	| "roundNumber"
	| "bracketStage"
	| "tournamentMode"
	| "currentMatchNumber"
	| "totalMatches"
	| "totalRounds"
	| "etaMinutes"
>) {
	return (
		<div className="flex items-center gap-3">
			<div className="flex size-10 items-center justify-center rounded-xl border border-border/50 bg-secondary/40 text-primary shadow-xs">
				<Gamepad2 className="size-4" />
			</div>
			<div className="space-y-0.5">
				<div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
					<span>Round {roundNumber}</span>
					<span className="text-muted-foreground" aria-hidden="true">
						&middot;
					</span>
					<span>{bracketStage}</span>
					<span className="text-muted-foreground" aria-hidden="true">
						&middot;
					</span>
					<span>{tournamentMode === "2v2" ? "2v2 Teams" : "1v1 Head-to-Head"}</span>
				</div>
				<div className="flex items-baseline gap-2">
					<h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
						Match <span className="font-mono tabular-nums text-primary">{currentMatchNumber}</span>{" "}
						of <span className="font-mono tabular-nums">{totalMatches}</span>
					</h2>
					{etaMinutes > 0 && (
						<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
							<Clock className="size-3" />
							<span className="font-mono tabular-nums">{etaMinutes}m</span> left
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

/**
 * Tactical control buttons (Undo, Exit) with unified nature-inspired tactile styling.
 */
function HeaderControls({
	canUndo,
	handleUndo,
	quitTournament,
	onOpenBracket,
}: Pick<TournamentHeaderProps, "canUndo" | "handleUndo" | "quitTournament" | "onOpenBracket">) {
	return (
		<div className="flex items-center gap-1.5 sm:gap-2">
			{onOpenBracket && (
				<button
					type="button"
					onClick={onOpenBracket}
					className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition-all hover:bg-primary/20 active:scale-[0.95] shadow-xs cursor-pointer"
					aria-label="View tournament bracket tree"
					title="View tournament bracket (Press B)"
				>
					<Layers className="size-3.5" />
					<span>Bracket</span>
				</button>
			)}

			<button
				type="button"
				onClick={() => handleUndo()}
				disabled={!canUndo}
				className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all active:scale-[0.95] ${
					canUndo
						? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
						: "cursor-not-allowed border-border/30 bg-secondary/10 text-muted-foreground opacity-60"
				}`}
				aria-label="Undo last vote"
				title={canUndo ? "Undo last vote (Press U)" : "No votes to undo"}
			>
				<Undo2 className="size-3.5" />
				<span className="hidden sm:inline">Undo</span>
			</button>

			<button
				type="button"
				onClick={quitTournament}
				className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 text-xs font-medium text-destructive transition-all hover:bg-destructive/20 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer disabled:cursor-not-allowed"
				aria-label="Exit tournament"
				title="Exit tournament"
			>
				<X className="size-3.5" />
				<span className="hidden sm:inline">Exit</span>
			</button>
		</div>
	);
}

/**
 * Fluid progress bar indicating tournament progress.
 */
function ProgressBar({ progressWidth }: Pick<TournamentHeaderProps, "progressWidth">) {
	return (
		<div
			className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/50"
			role="progressbar"
			aria-label="Tournament progress"
			aria-valuenow={Math.round(progressWidth)}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<div
				className="h-full rounded-full bg-primary transition-all duration-500 ease-out shadow-[0_0_12px_hsl(var(--pw-sage-hsl)/0.5)]"
				style={{ width: `${progressWidth}%` }}
			/>
		</div>
	);
}

/**
 * Contextual matchup pulse ribbon giving quick situational context without cluttering the screen.
 */
function ContextRibbon({
	matchupTone,
	pressureCopy,
	dominantStreak,
}: Pick<
	TournamentHeaderProps,
	"stageHeadline" | "matchupTone" | "pressureCopy" | "dominantStreak"
>) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
			<div className="flex flex-wrap items-center gap-2 text-muted-foreground">
				<span className="inline-flex items-center rounded-full border border-border/40 bg-secondary/30 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
					{matchupTone}
				</span>
				<span className="hidden md:inline text-muted-foreground">&middot;</span>
				<span className="hidden md:inline text-muted-foreground">{pressureCopy}</span>
			</div>

			{dominantStreak && (
				<span
					className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${getHeatTextClasses(
						dominantStreak.heatLevel,
					)}`}
				>
					<span className="rounded-full bg-foreground/10 px-1 py-0.2 text-[9px]">HOT</span>
					<span>
						{dominantStreak.name} &times;{dominantStreak.streak}
					</span>
				</span>
			)}
		</div>
	);
}

/**
 * Refactored nature-inspired Tournament Header component.
 */
const TournamentHeader = memo(function TournamentHeader({
	roundNumber,
	totalRounds,
	bracketStage,
	tournamentMode,
	currentMatchNumber,
	totalMatches,
	etaMinutes,
	canUndo,
	handleUndo,
	quitTournament,
	onOpenBracket,
	progressWidth,
	stageHeadline,
	dominantStreak,
	matchupTone,
	pressureCopy,
}: TournamentHeaderProps) {
	return (
		<header className="px-2 pt-2 sm:px-4 sm:pt-4">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-border/40 bg-card/75 p-3.5 sm:p-4 shadow-lg backdrop-blur-xl">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<HeaderTitle
						roundNumber={roundNumber}
						bracketStage={bracketStage}
						tournamentMode={tournamentMode}
						currentMatchNumber={currentMatchNumber}
						totalMatches={totalMatches}
						totalRounds={totalRounds}
						etaMinutes={etaMinutes}
					/>
					<HeaderControls
						canUndo={canUndo}
						handleUndo={handleUndo}
						quitTournament={quitTournament}
						onOpenBracket={onOpenBracket}
					/>
				</div>

				<div className="space-y-2">
					<ProgressBar progressWidth={progressWidth} />
					<ContextRibbon
						stageHeadline={stageHeadline}
						matchupTone={matchupTone}
						pressureCopy={pressureCopy}
						dominantStreak={dominantStreak}
					/>
					<div className="hidden sm:block pt-1">
						<BracketTree
							round={roundNumber}
							totalRounds={totalRounds}
							onOpenBracket={onOpenBracket}
						/>
					</div>
				</div>
			</div>
		</header>
	);
});

interface StreakBurst {
	key: number;
	side: "left" | "right";
	winnerName: string;
	streak: number;
	heatLevel: HeatLevel;
}

interface TournamentAnnouncementsProps {
	prefersReducedMotion: boolean | null;
	openingBracketReveal: boolean;
	openingEntrants: Array<{ id: string; label: string }>;
	tournamentMode: string;
	totalRounds: number;
	voteAnnouncement: string | null;
	currentMatchKey: string;
	streakBurst: StreakBurst | null;
	roundAnnouncement: number | null;
}

// ⚡ Bolt Performance Optimization: Wrapped TournamentAnnouncements in React.memo()
// Prevents unnecessary re-renders of complex Framer Motion animations when parent tournament states
// (like timers or user input events) change without affecting announcement states.
const TournamentAnnouncements = memo(function TournamentAnnouncements({
	prefersReducedMotion,
	openingBracketReveal,
	openingEntrants,
	tournamentMode,
	totalRounds,
	voteAnnouncement,
	currentMatchKey,
	streakBurst,
	roundAnnouncement,
}: TournamentAnnouncementsProps) {
	return (
		<>
			<div className="sr-only" aria-live="polite">
				{openingBracketReveal && "The bracket is set. First match begins now."}
				{roundAnnouncement !== null && `Round ${roundAnnouncement} begins.`}
				{voteAnnouncement && `${voteAnnouncement} advances.`}
				{streakBurst && `${streakBurst.winnerName} is on a ${streakBurst.streak} win streak.`}
			</div>

			<AnimatePresence>
				{openingBracketReveal && openingEntrants.length > 1 && (
					<motion.div
						initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
						animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
						exit={
							prefersReducedMotion
								? { opacity: 0 }
								: { opacity: 0, scale: 1.03, filter: "blur(6px)" }
						}
						transition={{
							duration: prefersReducedMotion ? MOTION_DURATIONS.reducedMotionDuration : 0.42,
						}}
						className="absolute inset-0 z-40 flex items-center justify-center px-3 sm:px-6"
					>
						<div className="absolute inset-0 bg-slate-950/82 backdrop-blur-md" />
						<motion.div
							initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
							animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
							exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -16 }}
							transition={{
								duration: prefersReducedMotion
									? MOTION_DURATIONS.reducedMotionDuration
									: MOTION_DURATIONS.moderate,
							}}
							className="relative mx-auto flex w-full max-w-5xl flex-col gap-5 overflow-hidden rounded-[2rem] border border-primary/20 bg-[radial-gradient(circle_at_top,rgba(57,189,216,0.18),rgba(2,6,23,0.96)_46%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-8"
						>
							<div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.05),transparent)]" />
							<div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
								<div>
									<p className="text-[10px] font-semibold tracking-wide text-primary/70">
										Bracket Reveal
									</p>
									<h3 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
										The field is set
									</h3>
									<p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
										{tournamentMode === "2v2"
											? "Teams enter the night bracket. Watch the path lock in before Match 1 ignites."
											: "Every contender is seeded. The opening duel begins as soon as the bracket settles."}
									</p>
								</div>
								<div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white/85">
									<Trophy className="size-3.5 text-primary" />
									<span>{openingEntrants.length} contenders</span>
									<span className="h-1 w-1 rounded-full bg-white/25" />
									<span>{totalRounds} rounds</span>
								</div>
							</div>

							<div className="relative">
								<div className="mb-4">
									<BracketTree round={1} totalRounds={totalRounds} />
								</div>
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									{openingEntrants.slice(0, 8).map((entrant, index) => (
										<motion.div
											key={`opening-entrant-${entrant.id}`}
											initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
											animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
											transition={{
												duration: prefersReducedMotion
													? MOTION_DURATIONS.reducedMotionDuration
													: MOTION_DURATIONS.base,
												delay: prefersReducedMotion ? 0 : 0.12 + index * 0.06,
											}}
											className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4"
										>
											<div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-accent to-chart-4" />
											<p className="pl-2 text-[10px] font-semibold tracking-wide text-white/65">
												Seed {index + 1}
											</p>
											<p className="pl-2 pt-2 font-display text-xl leading-tight text-white sm:text-2xl">
												{entrant.label}
											</p>
										</motion.div>
									))}
								</div>
								{openingEntrants.length > 8 && (
									<p className="mt-4 text-center text-xs tracking-wide text-white/65">
										+ {openingEntrants.length - 8} more contenders in the shadows
									</p>
								)}
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{voteAnnouncement && (
					<motion.div
						key={`${voteAnnouncement}-${currentMatchKey}`}
						initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.95 }}
						animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
						exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.98 }}
						transition={{
							duration: prefersReducedMotion
								? MOTION_DURATIONS.reducedMotionDuration
								: MOTION_DURATIONS.base,
						}}
						className="pointer-events-none absolute left-1/2 top-2 z-30 w-[calc(100%-1.5rem)] max-w-full -translate-x-1/2 sm:w-auto"
					>
						<div className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 shadow-[0_0_40px_rgba(16,185,129,0.35)] backdrop-blur-md sm:px-4">
							<div className="flex items-center gap-2 text-emerald-100">
								<Trophy className="size-4 text-emerald-300" />
								<span className="truncate text-xs font-bold tracking-wide sm:text-sm">
									{voteAnnouncement} advances
								</span>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{streakBurst && (
					<motion.div
						key={`streak-burst-${streakBurst.key}`}
						initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
						animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
						exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -18, scale: 1.03 }}
						transition={{
							duration: prefersReducedMotion
								? MOTION_DURATIONS.reducedMotionDuration
								: MOTION_DURATIONS.base,
						}}
						className={`pointer-events-none absolute top-[20%] z-30 ${
							streakBurst.side === "left" ? "left-3 sm:left-6" : "right-3 text-right sm:right-6"
						}`}
					>
						<div
							className={`rounded-2xl border px-4 py-3 shadow-[0_0_40px_rgba(249,115,22,0.35)] backdrop-blur-lg ${getHeatTextClasses(streakBurst.heatLevel)}`}
						>
							<p className="text-[10px] tracking-wide opacity-80 sm:text-xs">Hot streak</p>
							<p className="text-base font-black tracking-tight sm:text-lg">
								{streakBurst.winnerName} x{streakBurst.streak}
							</p>
							<div className="mt-2 flex gap-1.5">
								{Array.from({
									length: getFlameCount(streakBurst.streak, 9),
								}).map((_, i) => (
									<span
										key={`streak-flame-${streakBurst.key}-${i}`}
										className="h-1.5 w-5 animate-pulse rounded-full bg-current opacity-80 sm:h-2 sm:w-6"
										style={{ animationDelay: `${i * 80}ms` }}
									/>
								))}
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{roundAnnouncement !== null && (
					<motion.div
						key={`round-announcement-${roundAnnouncement}`}
						initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
						animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
						exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
						transition={{
							duration: prefersReducedMotion
								? MOTION_DURATIONS.reducedMotionDuration
								: MOTION_DURATIONS.moderate,
						}}
						className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4"
					>
						<motion.div
							initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.85, y: 8 }}
							animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
							exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.7, y: -6 }}
							transition={{
								duration: prefersReducedMotion
									? MOTION_DURATIONS.reducedMotionDuration
									: MOTION_DURATIONS.base,
							}}
							className="relative overflow-hidden rounded-2xl border border-primary/35 bg-slate-900/80 px-5 py-5 text-center shadow-[0_0_80px_rgba(39,135,153,0.25)] backdrop-blur-xl sm:px-8 sm:py-6"
						>
							<div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/10 to-chart-4/20" />
							<div className="relative">
								<p className="mb-2 text-[11px] tracking-wide text-primary/70 sm:text-xs sm:tracking-[0.3em]">
									Next stage
								</p>
								<p className="text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
									Round {roundAnnouncement}
								</p>
								<p className="mt-1 text-xs text-white/85 sm:text-sm">
									New head-to-head matchups ready
								</p>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
});

interface TournamentCompleteProps {
	totalMatches: number;
	participantCount: number;
	onNewTournament: () => void;
	bracketEntrants?: string[];
	matchHistory?: MatchRecord[];
	names?: NameItem[];
	teams?: Team[];
	ratings?: Record<string, number>;
	totalRounds?: number;
	tournamentMode?: TournamentMode;
}

function TournamentComplete({
	totalMatches,
	participantCount,
	onNewTournament,
	bracketEntrants = [],
	matchHistory = [],
	names = [],
	teams = [],
	ratings = {},
	totalRounds,
	tournamentMode = "1v1",
}: TournamentCompleteProps) {
	return (
		<div className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden py-12 text-foreground">
			<div
				className="pointer-events-none absolute inset-0"
				aria-hidden="true"
				style={{
					background: `
						radial-gradient(ellipse 70% 55% at 15% 15%, hsl(280 80% 40% / 0.60) 0%, transparent 65%),
						radial-gradient(ellipse 60% 50% at 85% 20%, hsl(190 90% 35% / 0.55) 0%, transparent 60%),
						radial-gradient(ellipse 65% 55% at 50% 90%, hsl(340 75% 38% / 0.50) 0%, transparent 65%),
						radial-gradient(ellipse 50% 45% at 80% 70%, hsl(25 85% 40% / 0.45) 0%, transparent 55%),
						radial-gradient(ellipse 55% 50% at 20% 75%, hsl(150 70% 30% / 0.45) 0%, transparent 60%)
					`,
				}}
			/>
			<div
				className="pointer-events-none absolute inset-0"
				aria-hidden="true"
				style={{
					background:
						"radial-gradient(ellipse 80% 70% at 50% 50%, transparent 10%, hsl(230 30% 6% / 0.50) 100%)",
				}}
			/>

			<div className="relative z-10 flex w-full max-w-5xl flex-col items-center px-4 text-center sm:px-6">
				<div className="mb-6 flex size-20 items-center justify-center rounded-[1.75rem] border border-white/25 bg-white/10 shadow-[0_0_60px_rgba(180,120,255,0.55)] backdrop-blur-xl">
					<Trophy className="size-9 text-yellow-300" />
				</div>

				<p className="text-[11px] font-semibold tracking-wide text-white/85">Tournament finished</p>

				<h1 className="mt-2 max-w-4xl text-pretty font-display text-[clamp(2.5rem,8vw,5.5rem)] font-black uppercase leading-[0.9] tracking-[-0.05em] text-white drop-shadow-[0_2px_32px_rgba(180,120,255,0.55)]">
					Tournament Complete
				</h1>

				<p className="mt-3 max-w-xl text-balance text-sm leading-relaxed text-white/80 sm:text-base">
					Your results are ready to review below. Inspect the final bracket tree and champion
					pathway!
				</p>

				<div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="rounded-[1.5rem] border border-white/20 bg-white/[0.08] px-6 py-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm">
						<p className="text-[10px] font-semibold tracking-wide text-white/80">Total matches</p>
						<p className="mt-2 text-3xl font-black leading-none text-white">{totalMatches}</p>
					</div>
					<div className="rounded-[1.5rem] border border-white/20 bg-white/[0.08] px-6 py-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm">
						<p className="text-[10px] font-semibold tracking-wide text-white/80">Participants</p>
						<p className="mt-2 text-3xl font-black leading-none text-white">{participantCount}</p>
					</div>
				</div>

				{/* Full Visual Bracket Component in Post-Game State */}
				{bracketEntrants.length > 0 && (
					<div className="mt-10 w-full text-left">
						<TournamentBracket
							inline={true}
							isComplete={true}
							bracketEntrants={bracketEntrants}
							matchHistory={matchHistory}
							names={names}
							teams={teams}
							ratings={ratings}
							totalRounds={totalRounds}
							tournamentMode={tournamentMode}
							className="shadow-2xl border-white/20 bg-slate-950/70"
						/>
					</div>
				)}

				<div className="mt-8 flex w-full max-w-xl flex-col sm:flex-row gap-3">
					<Button
						variant="glass"
						size="large"
						onClick={() =>
							document
								.getElementById("analysis")
								?.scrollIntoView({ behavior: "smooth", block: "start" })
						}
						className="flex-1 flex justify-center gap-2.5 rounded-2xl border-white/30 bg-white/15 shadow-[0_0_30px_rgba(180,120,255,0.35)] hover:bg-white/22 hover:shadow-[0_0_40px_rgba(180,120,255,0.55)] text-white transition-all duration-300"
					>
						<Trophy size={15} />
						View Leaderboard Analysis
					</Button>

					<Button
						variant="glass"
						size="large"
						onClick={onNewTournament}
						className="flex-1 flex justify-center gap-2.5 rounded-2xl border-white/15 bg-white/[0.05] text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white transition-all duration-300"
					>
						<LogOut size={15} />
						Start New Tournament
					</Button>
				</div>
			</div>
		</div>
	);
}

const OPENING_BRACKET_REVEAL_MS = 2200;

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

function getStageHeadline(round: number, totalRounds: number): string {
	if (round >= totalRounds) {
		return "Championship pick";
	}
	if (totalRounds - round === 1) {
		return "Final four pressure";
	}
	if (round <= 1) {
		return "Opening chaos";
	}
	return "Bracket pressure";
}

function getPressureCopy({
	round,
	totalRounds,
	currentMatchNumber,
	totalMatches,
	ratingGap,
}: {
	round: number;
	totalRounds: number;
	currentMatchNumber: number;
	totalMatches: number;
	ratingGap: number;
}): string {
	if (round >= totalRounds) {
		return "Last decision. Winner takes the crown.";
	}
	if (ratingGap <= 24) {
		return "Too close to call. Go with the name that survives on vibe alone.";
	}
	if (currentMatchNumber >= totalMatches - 1) {
		return "The bracket is nearly locked. Every pick now reshapes the podium.";
	}
	if (round <= 1) {
		return "Set the tone early. One upset can warp the whole tournament path.";
	}
	return "Momentum matters now. Protect a streak or torch the favorite.";
}

const EMPTY_NAMES: NameItem[] = [];

function TournamentContent({ onComplete, names = EMPTY_NAMES, onVote }: TournamentProps) {
	const navigate = useNavigate();
	const toast = useToast();
	const userName = useAppStore((state) => state.user.name);
	const tournamentActions = useAppStore((state) => state.tournamentActions);
	const visibleNames = useMemo(() => getVisibleNames(names), [names]);
	const prefersReducedMotion = useReducedMotion();

	const tournament = useTournamentState(visibleNames, userName);
	const {
		currentMatch,
		ratings,
		openingEntrants,
		isComplete,
		tournamentMode,
		round: roundNumber,
		totalRounds,
		bracketStage,
		matchNumber: currentMatchNumber,
		totalMatches,
		handleUndo,
		canUndo,
		handleQuit,
		progress,
		etaMinutes = 0,
		handleVoteWithAnimation,
		isVoting,
		matchHistory,
		bracketEntrants,
		teams,
	} = tournament;

	const [selectedSide, setSelectedSide] = useState<"left" | "right" | null>(null);
	const [isBracketModalOpen, setIsBracketModalOpen] = useState(false);
	const voteAnnouncement = useTimedState<string | null>(null);
	const roundAnnouncement = useTimedState<number | null>(null);
	const streakBurst = useTimedState<StreakBurst | null>(null);
	const openingBracketReveal = useTimedState(false);
	const previousRoundRef = useRef(roundNumber);
	const openingRevealSignatureRef = useRef<string | null>(null);

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

	const handleVoteAdapter = useCallback(
		async (winnerId: string, _loserId: string) => {
			if (!onVote || !currentMatch) {
				return;
			}
			const left = normalizeParticipant(currentMatch.left);
			const right = normalizeParticipant(currentMatch.right);
			const isLeft = winnerId === left.id || left.memberIds.includes(winnerId);
			const leftData = {
				name: left.name,
				id: left.id,
				description: left.description ?? "",
				outcome: isLeft ? "winner" : "loser",
			};
			const rightData = {
				name: right.name,
				id: right.id,
				description: right.description ?? "",
				outcome: isLeft ? "loser" : "winner",
			};
			try {
				await Promise.resolve(
					onVote({
						match: { left: leftData, right: rightData },
						result: isLeft ? 1 : 0,
						ratings,
						timestamp: new Date().toISOString(),
					}),
				);
			} catch (error) {
				console.warn("Tournament vote callback did not persist:", error);
				toast.showError("Tournament vote did not save. Please check your connection.");
			}
		},
		[onVote, currentMatch, ratings, toast],
	);

	const completionHandledRef = useRef(false);

	useEffect(() => {
		if (!isComplete || !onComplete || completionHandledRef.current) {
			if (!isComplete) {
				completionHandledRef.current = false;
			}
			return;
		}
		completionHandledRef.current = true;

		const winsByName: Record<string, number> = {};
		const lossesByName: Record<string, number> = {};

		for (const record of matchHistory) {
			if (!record?.match) {
				continue;
			}

			const left = normalizeParticipant(record.match.left);
			const right = normalizeParticipant(record.match.right);

			const isLeftWinner =
				left.memberIds.includes(String(record.winner)) || left.id === String(record.winner);
			const winnerIds = isLeftWinner ? left.memberIds : right.memberIds;
			const loserIds = isLeftWinner ? right.memberIds : left.memberIds;

			for (const id of winnerIds) {
				if (id) {
					winsByName[id] = (winsByName[id] ?? 0) + 1;
				}
			}
			for (const id of loserIds) {
				if (id) {
					lossesByName[id] = (lossesByName[id] ?? 0) + 1;
				}
			}
		}

		const results: Record<string, { rating: number; wins: number; losses: number }> = {};
		for (const [id, rating] of Object.entries(ratings)) {
			results[id] = {
				rating,
				wins: winsByName[id] ?? 0,
				losses: lossesByName[id] ?? 0,
			};
		}
		onComplete(results);
	}, [isComplete, ratings, onComplete, matchHistory]);

	const matchData = useMemo(
		() => (currentMatch ? extractMatchData(currentMatch) : null),
		[currentMatch],
	);

	useEffect(() => {
		if (!currentMatch) {
			setSelectedSide(null);
			streakBurst.set(null);
			return;
		}
		setSelectedSide(null);
	}, [currentMatch, streakBurst.set]);

	useEffect(() => {
		if (isComplete) {
			previousRoundRef.current = roundNumber;
			return;
		}
		if (roundNumber > previousRoundRef.current) {
			roundAnnouncement.setTimed(roundNumber, prefersReducedMotion ? 350 : 1200);
		}
		previousRoundRef.current = roundNumber;
	}, [roundNumber, isComplete, roundAnnouncement, prefersReducedMotion]);

	const openingRevealSignature =
		currentMatch && currentMatchNumber === 1 && matchHistory.length === 0
			? `${tournamentMode}:${openingEntrants.map((entrant) => entrant.id).join("|")}`
			: null;

	useEffect(() => {
		if (!openingRevealSignature) {
			return;
		}
		if (openingRevealSignatureRef.current === openingRevealSignature) {
			return;
		}

		openingRevealSignatureRef.current = openingRevealSignature;
		openingBracketReveal.setTimed(true, prefersReducedMotion ? 700 : OPENING_BRACKET_REVEAL_MS);
	}, [openingRevealSignature, openingBracketReveal, prefersReducedMotion]);

	const handleVoteForSide = useCallback(
		(side: "left" | "right") => {
			if (isVoting || openingBracketReveal.value || !matchData) {
				return;
			}

			// Subtle haptic vibration feedback on vote selection
			hapticVoteTap();

			const winnerId = side === "left" ? matchData.leftId : matchData.rightId;
			const loserId = side === "left" ? matchData.rightId : matchData.leftId;
			const winnerName = side === "left" ? matchData.leftName : matchData.rightName;
			const expectedStreak = (side === "left" ? leftStreak : rightStreak) + 1;
			const heatLevel = getHeatLevel(expectedStreak);

			if (heatLevel) {
				streakBurst.setTimed(
					{
						key: Date.now(),
						side,
						winnerName,
						streak: expectedStreak,
						heatLevel,
					},
					prefersReducedMotion ? 280 : 950,
				);
			}

			setSelectedSide(side);
			voteAnnouncement.setTimed(winnerName, prefersReducedMotion ? 250 : 900);
			handleVoteWithAnimation(winnerId, loserId);
			if (onVote) {
				handleVoteAdapter(winnerId, loserId);
			}
		},
		[
			isVoting,
			openingBracketReveal.value,
			matchData,
			leftStreak,
			rightStreak,
			streakBurst,
			prefersReducedMotion,
			voteAnnouncement,
			handleVoteWithAnimation,
			onVote,
			handleVoteAdapter,
		],
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLElement>, side: "left" | "right") => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				handleVoteForSide(side);
			}
		},
		[handleVoteForSide],
	);

	const leftImg = matchData
		? getRandomCatImage(matchData.leftId, CAT_IMAGES, matchData.leftName)
		: null;
	const rightImg = matchData
		? getRandomCatImage(matchData.rightId, CAT_IMAGES, matchData.rightName)
		: null;
	const hasSelectionFeedback = selectedSide !== null;
	const currentMatchKey = matchData
		? `${roundNumber}-${currentMatchNumber}-${matchData.leftId}-${matchData.rightId}`
		: `${roundNumber}-${currentMatchNumber}`;

	const touchStartRef = useRef<{ x: number; y: number } | null>(null);

	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0];
		if (touch) {
			touchStartRef.current = { x: touch.clientX, y: touch.clientY };
		}
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		const start = touchStartRef.current;
		const touch = e.changedTouches[0];
		touchStartRef.current = null;
		if (!start || !touch || isVoting || openingBracketReveal.value || !matchData) {
			return;
		}
		const dx = touch.clientX - start.x;
		const dy = touch.clientY - start.y;
		if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
			if (dx > 0) {
				handleVoteForSide("left");
			} else {
				handleVoteForSide("right");
			}
		}
	};

	const quitTournament = useCallback(() => {
		handleQuit();
		tournamentActions.resetTournament();
		navigate("/");
	}, [handleQuit, tournamentActions, navigate]);

	useEffect(() => {
		if (isComplete || !matchData) {
			return;
		}

		const handleWindowKeydown = (event: globalThis.KeyboardEvent) => {
			if (
				isVoting ||
				openingBracketReveal.value ||
				isInteractiveTarget(event.target) ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey
			) {
				return;
			}

			const key = event.key.toLowerCase();
			if (key === "b") {
				event.preventDefault();
				setIsBracketModalOpen((prev) => !prev);
				return;
			}
			if (key === "arrowleft" || key === "a" || key === "1" || key === "arrowup") {
				event.preventDefault();
				handleVoteForSide("left");
				return;
			}
			if (key === "arrowright" || key === "d" || key === "2" || key === "arrowdown") {
				event.preventDefault();
				handleVoteForSide("right");
				return;
			}
			if ((key === "u" || key === "z" || key === "backspace") && canUndo) {
				event.preventDefault();
				handleUndo();
			}
		};

		window.addEventListener("keydown", handleWindowKeydown);
		return () => window.removeEventListener("keydown", handleWindowKeydown);
	}, [
		canUndo,
		handleUndo,
		handleVoteForSide,
		isComplete,
		isVoting,
		matchData,
		openingBracketReveal.value,
	]);

	if (isComplete) {
		return (
			<TournamentComplete
				totalMatches={totalMatches}
				participantCount={visibleNames.length}
				onNewTournament={quitTournament}
				bracketEntrants={bracketEntrants}
				matchHistory={matchHistory}
				names={visibleNames}
				teams={teams}
				ratings={ratings}
				totalRounds={totalRounds}
				tournamentMode={tournamentMode}
			/>
		);
	}

	if (!matchData) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<div className="text-muted-foreground">Loading tournament...</div>
			</div>
		);
	}

	const dominantStreak =
		leftStreak >= rightStreak
			? leftStreak >= STREAK_THRESHOLDS.warm
				? {
						name: matchData.leftName,
						streak: leftStreak,
						heatLevel: leftHeatLevel ?? ("warm" as HeatLevel),
					}
				: null
			: rightStreak >= STREAK_THRESHOLDS.warm
				? {
						name: matchData.rightName,
						streak: rightStreak,
						heatLevel: rightHeatLevel ?? ("warm" as HeatLevel),
					}
				: null;

	const progressWidth = progress || (currentMatchNumber / totalMatches) * 100;
	const leftRating = ratings[matchData.leftId] ?? 1500;
	const rightRating = ratings[matchData.rightId] ?? 1500;
	const leftWinOdds = 1 / (1 + 10 ** ((rightRating - leftRating) / 400));
	const rightWinOdds = 1 - leftWinOdds;
	const ratingGap = Math.abs(leftRating - rightRating);
	const leftIsFavored = leftRating > rightRating;
	const rightIsFavored = rightRating > leftRating;
	const matchesRemaining = Math.max(0, totalMatches - currentMatchNumber);
	const roundMatchesLeft = Math.max(0, Math.ceil((totalMatches - currentMatchNumber) / 2));
	const stageHeadline = getStageHeadline(roundNumber, totalRounds);
	const pressureCopy = getPressureCopy({
		round: roundNumber,
		totalRounds,
		currentMatchNumber,
		totalMatches,
		ratingGap,
	});
	const matchupTone =
		ratingGap <= 24
			? "Dead heat"
			: leftIsFavored
				? `${matchData.leftName} leads by ${Math.round(ratingGap)}`
				: `${matchData.rightName} leads by ${Math.round(ratingGap)}`;

	return (
		<div className="relative flex w-full flex-col font-display text-foreground selection:bg-primary/30">
			<TournamentHeader
				roundNumber={roundNumber}
				totalRounds={totalRounds}
				bracketStage={bracketStage}
				tournamentMode={tournamentMode}
				currentMatchNumber={currentMatchNumber}
				totalMatches={totalMatches}
				etaMinutes={etaMinutes}
				canUndo={canUndo}
				handleUndo={handleUndo}
				quitTournament={quitTournament}
				onOpenBracket={() => setIsBracketModalOpen(true)}
				progressWidth={progressWidth}
				stageHeadline={stageHeadline}
				dominantStreak={dominantStreak}
				matchupTone={matchupTone}
				pressureCopy={pressureCopy}
				matchesRemaining={matchesRemaining}
				roundMatchesLeft={roundMatchesLeft}
			/>

			<main className="relative flex w-full flex-col items-center justify-center px-2 py-3 sm:px-4 sm:py-5">
				<TournamentAnnouncements
					prefersReducedMotion={prefersReducedMotion}
					openingBracketReveal={openingBracketReveal.value}
					openingEntrants={openingEntrants}
					tournamentMode={tournamentMode}
					totalRounds={totalRounds}
					voteAnnouncement={voteAnnouncement.value}
					currentMatchKey={currentMatchKey}
					streakBurst={streakBurst.value}
					roundAnnouncement={roundAnnouncement.value}
				/>

				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={currentMatchKey}
						initial={
							prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }
						}
						animate={
							prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }
						}
						exit={
							prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(6px)" }
						}
						transition={{
							duration: prefersReducedMotion
								? MOTION_DURATIONS.reducedMotionDuration
								: MOTION_DURATIONS.moderate,
						}}
						onTouchStart={handleTouchStart}
						onTouchEnd={handleTouchEnd}
						className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-stretch gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:items-center touch-pan-y"
					>
						<MatchSideCard
							side="left"
							name={matchData.leftName}
							img={leftImg}
							heatLevel={leftHeatLevel}
							streak={leftStreak}
							rating={leftRating}
							winOdds={leftWinOdds}
							isFavored={leftIsFavored}
							shortcutHint="1 / A / ←"
							isVoting={isVoting || openingBracketReveal.value}
							isSelected={selectedSide === "left"}
							hasSelectionFeedback={hasSelectionFeedback}
							isTeam={matchData.leftIsTeam}
							members={matchData.leftMembers}
							description={matchData.leftDescription}
							pronunciation={matchData.leftPronunciation}
							onKeyDown={(event) => handleKeyDown(event, "left")}
							onVote={() => handleVoteForSide("left")}
						/>

						<div
							className="flex w-full flex-row items-center justify-center gap-3 py-1 sm:w-20 sm:flex-col sm:gap-2.5"
							aria-hidden="true"
						>
							<div className="flex size-11 sm:size-14 items-center justify-center rounded-full border border-border/50 bg-card/80 text-foreground font-display font-black tracking-wider text-xs sm:text-base shadow-md backdrop-blur-md">
								VS
							</div>
							<span className="hidden sm:block text-center font-mono text-[9px] font-bold tracking-wide text-muted-foreground">
								{dominantStreak ? `Streak ×${dominantStreak.streak}` : "Vote"}
							</span>
						</div>

						<MatchSideCard
							side="right"
							name={matchData.rightName}
							img={rightImg}
							heatLevel={rightHeatLevel}
							streak={rightStreak}
							rating={rightRating}
							winOdds={rightWinOdds}
							isFavored={rightIsFavored}
							shortcutHint="2 / D / →"
							isVoting={isVoting || openingBracketReveal.value}
							isSelected={selectedSide === "right"}
							hasSelectionFeedback={hasSelectionFeedback}
							isTeam={matchData.rightIsTeam}
							members={matchData.rightMembers}
							description={matchData.rightDescription}
							pronunciation={matchData.rightPronunciation}
							onKeyDown={(event) => handleKeyDown(event, "right")}
							onVote={() => handleVoteForSide("right")}
							animationDelay="2s"
						/>
					</motion.div>
				</AnimatePresence>
			</main>

			{/* Interactive Tournament Bracket Modal */}
			<TournamentBracketModal
				isOpen={isBracketModalOpen}
				onClose={() => setIsBracketModalOpen(false)}
				bracketEntrants={bracketEntrants}
				matchHistory={matchHistory}
				currentMatch={currentMatch}
				names={visibleNames}
				teams={teams}
				ratings={ratings}
				totalRounds={totalRounds}
				tournamentMode={tournamentMode}
				onVote={(winnerId, loserId) => {
					hapticVoteTap();
					handleVoteWithAnimation(winnerId, loserId);
					if (onVote) {
						handleVoteAdapter(winnerId, loserId);
					}
					setIsBracketModalOpen(false);
				}}
			/>

			<div className="pointer-events-none absolute left-0 top-0 -z-10 size-96 rounded-full bg-primary/[0.04] blur-3xl" />
			<div className="pointer-events-none absolute bottom-0 right-0 -z-10 size-96 rounded-full bg-accent/[0.04] blur-3xl" />
		</div>
	);
}

const MemoizedTournament = memo(TournamentContent);

export function TournamentArena(props: TournamentProps) {
	return (
		<ErrorComponent variant="boundary">
			<MemoizedTournament {...props} />
		</ErrorComponent>
	);
}
