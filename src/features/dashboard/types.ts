import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { NameItem, RatingData } from "@/shared/types";

export interface LeaderboardEntry {
	name: string;
	total_ratings: number;
	wins: number;
	avg_rating: number;
	losses?: number;
	percentile_rank?: number;
}

export interface QuickStat {
	accent?: boolean;
	icon: LucideIcon | ComponentType<{ size?: number; className?: string }>;
	label: string;
	value: string | number;
}

export interface DashboardProps {
	personalRatings?: Record<string, RatingData>;
	currentTournamentNames?: NameItem[];
	onStartNew?: () => void;
	onUpdateRatings?: (
		ratings:
			| Record<string, RatingData>
			| ((prev: Record<string, RatingData>) => Record<string, RatingData>),
	) => void;
	userName?: string;
	isAdmin?: boolean;
	isLoggedIn?: boolean;
	avatarUrl?: string;
	canHideNames?: boolean;
	onNameHidden?: (nameId: string) => void;
}

export type NameFilter = "all" | "active" | "hidden" | "locked";

export interface AdminStats {
	totalNames: number;
	activeNames: number;
	hiddenNames: number;
	lockedInNames: number;
	totalUsers: number;
	recentVotes: number;
}

export interface NameWithStats extends NameItem {
	votes?: number;
	lastVoted?: string;
	popularityScore?: number;
}

export interface SiteStatsLike {
	totalUsers?: unknown;
	totalRatings?: unknown;
}

export interface AdminStatsGridProps {
	stats: AdminStats;
}
