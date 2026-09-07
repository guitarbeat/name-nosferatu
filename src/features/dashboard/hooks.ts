import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
	type EngagementMetrics,
	type LeaderboardItem,
	leaderboardAPI,
	namesQueryOptions,
	type SiteStats,
	statsAPI,
	type UserStats,
	useNameAdminActions,
} from "@/shared/api";
import { useAsyncData } from "@/shared/hooks";
import useAppStore from "@/store";
import type { NameFilter } from "./types";
import {
	buildAdminStats,
	FILTER_OPTIONS,
	filterNamesByStatusAndSearch,
	mapNameToDisplay,
} from "./utils";

export function useAdminDashboard() {
	const user = useAppStore((s) => s.user);
	const actorName = user.name.trim();
	const { deleteName, toggleHidden, toggleLocked } = useNameAdminActions(actorName);

	const [searchTerm, setSearchTerm] = useState("");
	const [filterStatus, setFilterStatus] = useState<NameFilter>("all");
	const namesQuery = useQuery(namesQueryOptions(true));
	const siteStatsQuery = useQuery({
		queryKey: ["site-stats"],
		queryFn: () => statsAPI.getSiteStats(),
		staleTime: 30_000,
	});
	const names = useMemo(
		() => (namesQuery.data?.names ?? []).map(mapNameToDisplay),
		[namesQuery.data?.names],
	);
	const stats = useMemo(
		() => buildAdminStats(names, siteStatsQuery.data ?? null),
		[names, siteStatsQuery.data],
	);
	const isLoading = namesQuery.isPending || siteStatsQuery.isPending;

	const filteredNames = useMemo(
		() => filterNamesByStatusAndSearch(names, filterStatus, searchTerm),
		[names, filterStatus, searchTerm],
	);

	const handleToggleHidden = useCallback(
		async (nameId: string | number, isHidden: boolean) => {
			await toggleHidden({
				nameId: String(nameId),
				isCurrentlyHidden: isHidden,
			});
		},
		[toggleHidden],
	);

	const handleToggleLocked = useCallback(
		async (nameId: string | number, isLocked: boolean) => {
			await toggleLocked({
				nameId: String(nameId),
				isCurrentlyLocked: isLocked,
			});
		},
		[toggleLocked],
	);

	const handleSoftDelete = useCallback(
		async (nameId: string | number) => {
			if (!window.confirm("Permanently delete this name? This cannot be undone.")) {
				return;
			}
			await deleteName({ nameId: String(nameId) });
		},
		[deleteName],
	);

	const handleFilterChange = useCallback((value: string) => {
		// ⚡ Bolt Performance Optimization: Replace Array.prototype.find with a for-of loop to eliminate callback function allocation
		let option: (typeof FILTER_OPTIONS)[number] | undefined;
		for (const item of FILTER_OPTIONS) {
			if (item.value === value) {
				option = item;
				break;
			}
		}
		if (option) {
			setFilterStatus(option.value);
		}
	}, []);

	const handleRefresh = useCallback(() => {
		void Promise.all([namesQuery.refetch(), siteStatsQuery.refetch()]);
	}, [namesQuery, siteStatsQuery]);

	return {
		searchTerm,
		setSearchTerm,
		filterStatus,
		stats,
		isLoading,
		filteredNames,
		handleToggleHidden,
		handleToggleLocked,
		handleSoftDelete,
		handleFilterChange,
		handleRefresh,
	};
}

export type DashboardTimeframe = "day" | "week" | "month";

interface UseDashboardDataParams {
	userName?: string;
}

export function useDashboardData({ userName = "" }: UseDashboardDataParams) {
	const normalizedUserName = userName.trim();

	const [timeframe, setTimeframe] = useState<DashboardTimeframe>("week");

	const {
		data: leaderboard,
		isLoading: isLoadingLeaderboard,
		error: errorLeaderboard,
		refresh: refreshLeaderboard,
	} = useAsyncData<LeaderboardItem[]>(() => leaderboardAPI.getLeaderboard(10), []);

	const {
		data: engagementMetrics,
		isLoading: isLoadingEngagement,
		error: errorEngagement,
		refresh: refreshEngagementMetrics,
	} = useAsyncData<EngagementMetrics | null>(() => statsAPI.getEngagementMetrics(timeframe), null, {
		deps: [timeframe],
	});

	const { data: siteStats, error: errorSiteStats } = useAsyncData<SiteStats | null>(
		() => statsAPI.getSiteStats(),
		null,
	);

	const { data: userStats, error: errorUserStats } = useAsyncData<UserStats | null>(
		() => (normalizedUserName ? statsAPI.getUserStats(normalizedUserName) : Promise.resolve(null)),
		null,
		{ deps: [normalizedUserName] },
	);

	return {
		engagementMetrics,
		errorEngagement,
		errorLeaderboard,
		errorSiteStats,
		errorUserStats,
		isLoadingEngagement,
		isLoadingLeaderboard,
		leaderboard,
		refreshEngagementMetrics,
		refreshLeaderboard,
		setTimeframe,
		siteStats,
		timeframe,
		userStats,
	};
}
