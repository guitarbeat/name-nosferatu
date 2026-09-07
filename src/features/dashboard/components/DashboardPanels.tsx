import { motion, useReducedMotion } from "framer-motion";
import {
	Activity,
	BarChart3,
	Flame,
	Shield,
	Star,
	Target,
	TrendingUp,
	Trophy,
	User,
	Users,
} from "lucide-react";
import { memo } from "react";
import type { EngagementMetrics, LeaderboardItem, SiteStats, UserStats } from "@/shared/api";
import { Button, EmptyState, Loading, MagicToggle } from "@/shared/components";
import { MOTION_DURATIONS, MOTION_EASING, themeSurfaces } from "@/shared/lib/uiUtils";
import { handleImgError } from "@/shared/lib/utils";
import type { DashboardTimeframe } from "../hooks";
import type { QuickStat } from "../types";
import { RatingDistributionChart, RatingRadarChart, TopNamesChart, WinLossChart } from "./Charts";
import {
	ContextBadge,
	ListPanel,
	ListPanelRow,
	Panel,
	RankChip,
	SectionHeader,
	StatTile,
} from "./Common";

export function getQuickStats({
	siteStats,
	userName,
	userStats,
}: {
	siteStats: SiteStats | null;
	userName: string;
	userStats: UserStats | null;
}): QuickStat[] {
	if (userName && userStats) {
		return [
			{ label: "Ratings", value: userStats.totalRatings ?? userStats.matches, icon: BarChart3 },
			{ label: "Selected", value: userStats.totalSelections ?? userStats.matches, icon: Target },
			{
				label: "Wins",
				value: userStats.totalWins ?? userStats.wins,
				icon: Trophy,
				accent: true,
			},
			{
				label: "Win rate",
				value: `${userStats.winRate ?? (userStats.matches > 0 ? Math.round((userStats.wins / userStats.matches) * 100) : 0)}%`,
				icon: TrendingUp,
				accent: true,
			},
		];
	}

	if (siteStats) {
		return [
			{
				label: "Total names",
				value: siteStats.totalNames,
				icon: Activity,
			},
			{
				label: "Active names",
				value: siteStats.activeNames ?? siteStats.totalNames,
				icon: Target,
			},
			{ label: "Users", value: siteStats.totalUsers, icon: Users },
			{
				label: "Average rating",
				value: Math.round(siteStats.avgRating ?? 1500),
				icon: TrendingUp,
				accent: true,
			},
		];
	}

	return [];
}

export const DashboardHeader = memo(function DashboardHeader({
	isLoggedIn,
	userName,
	avatarUrl,
	isAdmin,
	quickStats,
	userStats,
}: {
	isLoggedIn: boolean;
	userName: string;
	avatarUrl?: string;
	isAdmin: boolean;
	quickStats: QuickStat[];
	userStats: UserStats | null;
}) {
	if (!isLoggedIn && quickStats.length === 0) {
		return null;
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_1fr]">
			{isLoggedIn && userName && (
				<Panel>
					<div className="flex items-center gap-4">
						<div className="relative">
							{avatarUrl ? (
								<img
									src={avatarUrl}
									alt={userName}
									className={`size-16 rounded-full object-cover ring-2 ring-primary/20 ${themeSurfaces.avatar}`}
									onError={handleImgError}
								/>
							) : (
								<div
									className={`flex size-16 items-center justify-center rounded-full ring-2 ring-primary/20 text-primary ${themeSurfaces.avatar}`}
								>
									<User size={22} />
								</div>
							)}
							{isAdmin && (
								<div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card border border-border/60 p-1 text-primary shadow-xs">
									<Shield size={12} className="fill-primary/20" />
								</div>
							)}
						</div>
						<div className="min-w-0">
							<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
								Profile
							</span>
							<h2 className="mt-2 truncate text-2xl font-semibold text-foreground">{userName}</h2>
							<p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
								<span>{isAdmin ? "Administrator" : "Tournament participant"}</span>
							</p>
						</div>
					</div>
				</Panel>
			)}

			{quickStats.length > 0 && (
				<Panel>
					<SectionHeader
						icon={BarChart3}
						title={userStats ? "Your Snapshot" : "Community Snapshot"}
						subtitle={userStats ? "Your totals." : "Pool totals."}
					/>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{quickStats.map((item) => (
							<StatTile
								key={item.label}
								label={item.label}
								value={item.value}
								icon={item.icon}
								accent={Boolean(item.accent)}
							/>
						))}
					</div>
				</Panel>
			)}
		</div>
	);
});

export const LeaderboardPanel = memo(function LeaderboardPanel({
	leaderboard,
	isLoadingLeaderboard,
	onStartNew,
}: {
	leaderboard: LeaderboardItem[];
	isLoadingLeaderboard: boolean;
	onStartNew?: () => void;
}) {
	return (
		<Panel>
			<SectionHeader
				icon={Trophy}
				title="Leaderboard"
				subtitle="Top contenders across all tournament matchups."
				action={
					<div className="flex items-center gap-2">
						<ContextBadge label="Community" />
						{onStartNew && (
							<Button variant="outline" size="small" onClick={onStartNew}>
								New Tournament
							</Button>
						)}
					</div>
				}
			/>

			{isLoadingLeaderboard ? (
				<Loading variant="skeleton" height={320} />
			) : leaderboard.length > 0 ? (
				<ListPanel>
					{leaderboard.map((entry, index) => {
						const rank = index + 1;
						return (
							<ListPanelRow
								key={entry.name}
								divided={index < leaderboard.length - 1}
								className="group transition-colors hover:bg-muted/30"
							>
								<RankChip rank={rank} />

								<div className="min-w-0 flex-1">
									<p className="truncate font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
										{entry.name}
									</p>
									<div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
										<span className="inline-flex items-center gap-1">
											<Star className="size-3 text-muted-foreground/60" />
											<span className="font-mono tabular-nums">{entry.total_ratings}</span> rating
											{entry.total_ratings === 1 ? "" : "s"}
										</span>
										<span className="inline-flex items-center gap-1">
											<Flame className="size-3 text-accent" />
											<span className="font-mono tabular-nums">{entry.wins}</span> win
											{entry.wins === 1 ? "" : "s"}
										</span>
									</div>
								</div>

								<div className="text-right flex flex-col items-end">
									<div className="inline-flex items-center justify-center rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-sm font-bold text-primary tabular-nums shadow-2xs">
										{Math.round(entry.avg_rating)}
									</div>
									<span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
										Rating
									</span>
								</div>
							</ListPanelRow>
						);
					})}
				</ListPanel>
			) : (
				<EmptyState
					title="No community ratings yet"
					description="Complete tournament battles to rank contenders and establish the community leaderboard."
				/>
			)}
		</Panel>
	);
});

export const CommunityChartsPanel = memo(function CommunityChartsPanel({
	leaderboard,
	siteStats,
}: {
	leaderboard: LeaderboardItem[];
	siteStats: SiteStats | null;
}) {
	const totalRatings =
		siteStats && "totalRatings" in siteStats
			? (siteStats as unknown as { totalRatings: number }).totalRatings
			: (siteStats?.totalMatches ?? 0);

	return (
		<Panel className="flex flex-col h-full">
			<SectionHeader
				icon={Activity}
				title="Community Insights"
				subtitle="Aggregate data across all users and matches."
				action={
					siteStats ? (
						<div className="flex items-center gap-4 text-xs font-medium">
							<span className="flex items-center gap-1.5 text-muted-foreground">
								<Users className="size-3.5 text-primary/70" />
								{siteStats.totalUsers} contributors
							</span>
							<span className="flex items-center gap-1.5 text-muted-foreground">
								<Target className="size-3.5 text-accent/70" />
								{totalRatings} ratings
							</span>
						</div>
					) : undefined
				}
			/>

			<div className="grid gap-4 flex-1">
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
							Top Contenders
						</h4>
						<TopNamesChart leaderboard={leaderboard} limit={8} />
					</div>

					<div className="space-y-2">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
							Win/Loss Head-to-Head
						</h4>
						<WinLossChart leaderboard={leaderboard} limit={8} />
					</div>
				</div>

				<div className="grid gap-4 sm:grid-cols-[1fr_minmax(0,18rem)]">
					<div className="space-y-2">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
							Rating Distribution Curve
						</h4>
						<RatingDistributionChart leaderboard={leaderboard} />
					</div>
					<div className="space-y-2">
						<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
							Metrics Radar
						</h4>
						<RatingRadarChart leaderboard={leaderboard} limit={5} />
					</div>
				</div>
			</div>
		</Panel>
	);
});

const TIMEFRAME_OPTIONS = [
	{ value: "day" as const, label: "24h" },
	{ value: "week" as const, label: "Week" },
	{ value: "month" as const, label: "Month" },
] as const;

export const EngagementPanel = memo(function EngagementPanel({
	engagementMetrics,
	timeframe,
	setTimeframe,
	refreshEngagementMetrics,
	isLoadingEngagement,
}: {
	engagementMetrics: EngagementMetrics | null;
	timeframe: DashboardTimeframe;
	setTimeframe: (tf: DashboardTimeframe) => void;
	refreshEngagementMetrics: () => void;
	isLoadingEngagement: boolean;
}) {
	const prefersReducedMotion = useReducedMotion();

	if (!engagementMetrics) {
		return null;
	}

	const peakActiveUsers =
		"peakActiveUsers" in engagementMetrics
			? (engagementMetrics as unknown as { peakActiveUsers: number }).peakActiveUsers
			: engagementMetrics.current;
	const totalMatches =
		"totalMatches" in engagementMetrics
			? (engagementMetrics as unknown as { totalMatches: number }).totalMatches
			: engagementMetrics.previous;

	return (
		<Panel>
			<SectionHeader
				icon={TrendingUp}
				title="Recent Activity"
				subtitle="Last window."
				action={
					<motion.div
						className="flex items-center gap-3"
						initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
						animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
						transition={{
							duration: MOTION_DURATIONS.base,
							ease: MOTION_EASING.easeStandard,
						}}
					>
						<MagicToggle
							options={TIMEFRAME_OPTIONS}
							value={timeframe}
							onChange={setTimeframe}
							ariaLabel="Timeframe selection"
							size="small"
						/>
						<Button
							variant="outline"
							size="small"
							onClick={() => refreshEngagementMetrics()}
							disabled={isLoadingEngagement}
							loading={isLoadingEngagement}
						>
							<Activity size={14} />
							Refresh
						</Button>
					</motion.div>
				}
			/>
			<motion.div
				className="grid gap-3 sm:grid-cols-2"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{
					duration: prefersReducedMotion
						? MOTION_DURATIONS.reducedMotionDuration
						: MOTION_DURATIONS.slow,
					delay: prefersReducedMotion ? 0 : 0.1,
				}}
			>
				<StatTile label="Active raters" value={peakActiveUsers} icon={Users} accent={true} />
				<StatTile label="Matches played" value={totalMatches} icon={Trophy} />
			</motion.div>
		</Panel>
	);
});
