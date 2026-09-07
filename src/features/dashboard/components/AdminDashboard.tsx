import { BarChart3, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import { memo } from "react";
import { Button, Loading, SearchFilterBar } from "@/shared/components";
import { isNameHidden, isNameLocked } from "@/shared/lib/names";
import { useAdminDashboard } from "../hooks";
import type { AdminStatsGridProps, NameWithStats } from "../types";
import { FILTER_OPTIONS } from "../utils";

interface AdminStatCardConfig {
	key: keyof AdminStatsGridProps["stats"];
	icon: typeof BarChart3;
	accentColor: string;
	bgColor: string;
	borderColor: string;
	label: string;
}

const ADMIN_STAT_CARDS: readonly AdminStatCardConfig[] = [
	{
		key: "totalNames",
		icon: BarChart3,
		accentColor: "text-primary",
		bgColor: "bg-primary/10",
		borderColor: "border-primary/20",
		label: "Total Pool",
	},
	{
		key: "activeNames",
		icon: Eye,
		accentColor: "text-accent",
		bgColor: "bg-accent/10",
		borderColor: "border-accent/20",
		label: "Active In Pool",
	},
	{
		key: "lockedInNames",
		icon: Lock,
		accentColor: "text-amber-400",
		bgColor: "bg-amber-400/10",
		borderColor: "border-amber-400/20",
		label: "Locked In",
	},
	{
		key: "hiddenNames",
		icon: EyeOff,
		accentColor: "text-destructive",
		bgColor: "bg-destructive/10",
		borderColor: "border-destructive/20",
		label: "Hidden From Public",
	},
] as const;

// ⚡ Bolt Performance Optimization: Wrapped AdminStatsGrid in React.memo()
// Prevents unnecessary re-renders of the stats grid during search input
const AdminStatsGrid = memo(function AdminStatsGrid({ stats }: AdminStatsGridProps) {
	return (
		<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
			{ADMIN_STAT_CARDS.map(({ key, icon: Icon, accentColor, bgColor, borderColor, label }) => (
				<div
					key={label}
					className={`group relative overflow-hidden rounded-2xl border ${borderColor} bg-card/70 p-4 sm:p-5 shadow-sm backdrop-blur-sm transition-all hover:border-border hover:shadow-md`}
				>
					<div className="flex items-center justify-between gap-2 mb-2">
						<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{label}
						</span>
						<div
							className={`flex size-8 items-center justify-center rounded-lg ${bgColor} ${accentColor}`}
						>
							<Icon size={16} />
						</div>
					</div>
					<p className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
						{stats[key]}
					</p>
				</div>
			))}
		</div>
	);
});

// ⚡ Bolt Performance Optimization: Wrapped AdminNameItem in React.memo()
// Prevents unnecessary re-renders of all list items when search input changes or a single item is toggled
const AdminNameItem = memo(function AdminNameItem({
	name,
	onToggleHidden,
	onToggleLocked,
	onDelete,
}: {
	name: NameWithStats;
	onToggleHidden: (nameId: string | number, isHidden: boolean) => void;
	onToggleLocked: (nameId: string | number, isLocked: boolean) => void;
	onDelete: (nameId: string | number) => void;
}) {
	const hidden = isNameHidden(name);
	const locked = isNameLocked(name);

	return (
		<div className="group flex items-center justify-between gap-3 p-3 sm:p-4 transition-colors hover:bg-muted/30">
			<div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<h4 className="font-display text-sm sm:text-base font-bold text-foreground truncate">
							{name.name}
						</h4>
						{locked && (
							<span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
								<Lock size={10} /> Locked
							</span>
						)}
						{hidden && (
							<span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
								<EyeOff size={10} /> Hidden
							</span>
						)}
					</div>
					{name.description && (
						<p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{name.description}</p>
					)}
					<div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground/70">
						<span>
							Votes: <strong className="text-foreground/80">{name.votes ?? 0}</strong>
						</span>
						<span>&middot;</span>
						<span>
							Score:{" "}
							<strong className="text-foreground/80">
								{name.popularityScore == null ? "—" : name.popularityScore.toFixed(1)}
							</strong>
						</span>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-1 shrink-0">
				<Button
					onClick={() => onToggleHidden(name.id, hidden)}
					variant="ghost"
					size="small"
					iconOnly={true}
					aria-label={hidden ? "Unhide name" : "Hide name"}
					title={hidden ? "Unhide name" : "Hide name"}
				>
					{hidden ? <Eye size={15} /> : <EyeOff size={15} />}
				</Button>
				<Button
					onClick={() => onToggleLocked(name.id, locked)}
					variant="ghost"
					size="small"
					iconOnly={true}
					aria-label={locked ? "Unlock name" : "Lock name"}
					title={locked ? "Unlock name" : "Lock name"}
				>
					{locked ? <Unlock size={15} /> : <Lock size={15} />}
				</Button>
				<Button
					onClick={() => onDelete(name.id)}
					variant="ghost"
					size="small"
					iconOnly={true}
					aria-label="Delete name"
					title="Delete name"
					className="text-destructive hover:text-destructive hover:bg-destructive/10"
				>
					<Trash2 size={15} />
				</Button>
			</div>
		</div>
	);
});

export function AdminDashboard() {
	const {
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
	} = useAdminDashboard();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loading variant="spinner" text="Loading admin dashboard..." />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background text-foreground p-3 sm:p-6">
			<div className="mb-4 sm:mb-8">
				<h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
					Admin Dashboard
				</h1>
				<p className="text-sm text-muted-foreground">Manage names and monitor activity</p>
			</div>

			{stats && <AdminStatsGrid stats={stats} />}

			<div className="space-y-4">
				<SearchFilterBar
					searchTerm={searchTerm}
					onSearchTermChange={setSearchTerm}
					filterStatus={filterStatus}
					filterOptions={FILTER_OPTIONS}
					onFilterChange={handleFilterChange}
					onRefresh={handleRefresh}
				/>

				<div className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 divide-y divide-border/20 shadow-sm backdrop-blur-sm">
					{filteredNames.length > 0 ? (
						filteredNames.map((name) => (
							<AdminNameItem
								key={name.id}
								name={name}
								onToggleHidden={handleToggleHidden}
								onToggleLocked={handleToggleLocked}
								onDelete={handleSoftDelete}
							/>
						))
					) : (
						<div className="p-8 text-center text-sm text-muted-foreground">
							No cat names match the selected filter.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
