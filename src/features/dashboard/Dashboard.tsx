import { BarChart3, Settings, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminDashboard } from "./components/AdminDashboard";
import { ContextBadge, Panel, SectionHeader } from "./components/Common";
import {
	CommunityChartsPanel,
	DashboardHeader,
	EngagementPanel,
	getQuickStats,
	LeaderboardPanel,
} from "./components/DashboardPanels";
import { PersonalResults } from "./components/PersonalResults";
import { useDashboardData } from "./hooks";
import type { DashboardProps } from "./types";

export type DashboardView = "analytics" | "admin";

export function AnalyticsDashboard({
	userName = "",
	isAdmin = false,
	isLoggedIn = false,
	avatarUrl,
	onStartNew,
	onUpdateRatings,
	personalRatings,
	currentTournamentNames,
}: DashboardProps) {
	const handleStartNew = onStartNew ?? (() => undefined);
	const {
		engagementMetrics,
		isLoadingEngagement,
		isLoadingLeaderboard,
		leaderboard,
		refreshEngagementMetrics,
		setTimeframe,
		siteStats,
		timeframe,
		userStats,
	} = useDashboardData({ userName });
	const quickStats = useMemo(
		() => getQuickStats({ siteStats, userName, userStats }),
		[siteStats, userName, userStats],
	);
	const hasPersonalRatings = Boolean(personalRatings && Object.keys(personalRatings).length > 0);

	return (
		<div className="w-full space-y-8 sm:space-y-10">
			<DashboardHeader
				isLoggedIn={isLoggedIn}
				userName={userName}
				avatarUrl={avatarUrl}
				isAdmin={isAdmin}
				quickStats={quickStats}
				userStats={userStats}
			/>

			{hasPersonalRatings && onUpdateRatings && (
				<Panel>
					<SectionHeader
						icon={Trophy}
						title="Your Rankings"
						subtitle="Your saved order."
						action={<ContextBadge label="Personal" tone="accent" />}
					/>
					<PersonalResults
						personalRatings={personalRatings}
						currentTournamentNames={currentTournamentNames}
						onStartNew={handleStartNew}
						onUpdateRatings={onUpdateRatings}
						userName={userName}
					/>
				</Panel>
			)}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_1fr]">
				<LeaderboardPanel
					leaderboard={leaderboard}
					isLoadingLeaderboard={isLoadingLeaderboard}
					onStartNew={onStartNew}
				/>

				<CommunityChartsPanel leaderboard={leaderboard} siteStats={siteStats} />
			</div>

			<EngagementPanel
				engagementMetrics={engagementMetrics}
				timeframe={timeframe}
				setTimeframe={setTimeframe}
				refreshEngagementMetrics={refreshEngagementMetrics}
				isLoadingEngagement={isLoadingEngagement}
			/>
		</div>
	);
}

const DASHBOARD_VIEW_OPTIONS = [
	{
		value: "analytics" as const,
		label: "Analytics",
		icon: <BarChart3 className="h-4 w-4" />,
	},
	{
		value: "admin" as const,
		label: "Admin",
		icon: <Settings className="h-4 w-4" />,
	},
];

export interface UnifiedDashboardProps extends DashboardProps {
	isAdmin?: boolean;
}

export function Dashboard(props: UnifiedDashboardProps) {
	const [activeView, setActiveView] = useState<DashboardView>("analytics");

	if (!props.isAdmin) {
		return (
			<div className="w-full space-y-6">
				<AnalyticsDashboard {...props} />
			</div>
		);
	}

	return (
		<div className="w-full space-y-6">
			<div className="flex items-center gap-4 border-b border-border pb-4">
				<div className="flex gap-2" role="group" aria-label="Dashboard views">
					{DASHBOARD_VIEW_OPTIONS.map((opt) => (
						<button
							key={opt.value}
							type="button"
							onClick={() => setActiveView(opt.value)}
							aria-pressed={activeView === opt.value}
							className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								activeView === opt.value
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:bg-muted/80"
							}`}
						>
							{opt.icon}
							{opt.label}
						</button>
					))}
				</div>
			</div>

			{activeView === "analytics" ? <AnalyticsDashboard {...props} /> : <AdminDashboard />}
		</div>
	);
}
