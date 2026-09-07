import { memo, useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	ReferenceLine,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import { computeRatingStats } from "@/shared/lib/elo";
import { themeSurfaces } from "@/shared/lib/uiUtils";
import { cn } from "@/shared/lib/utils";
import type { LeaderboardEntry } from "../types";
import { ChartFrame } from "./Common";

export const CHART_PALETTE = {
	teal: "#3FB8B0",
	coral: "#E5764A",
	sand: "#D4B483",
	violet: "#9F7AEA",
	sky: "#5BA8E8",
	rose: "#E26E9D",
} as const;

export const CHART_SERIES = [
	CHART_PALETTE.teal,
	CHART_PALETTE.coral,
	CHART_PALETTE.sand,
	CHART_PALETTE.violet,
	CHART_PALETTE.sky,
	CHART_PALETTE.rose,
] as const;

export const CHART_TEXT_MUTED = "rgba(200, 210, 222, 0.55)";
export const CHART_GRID = "rgba(200, 210, 222, 0.12)";
export const CHART_AXIS = "rgba(200, 210, 222, 0.18)";
export const CHART_FOREGROUND = "#ebf1f7";

export const CHART_TOOLTIP_STYLE = {
	background: "var(--chart-tooltip-bg)",
	border: "1px solid var(--chart-tooltip-border)",
	borderRadius: 10,
	fontSize: 12,
	color: "var(--chart-tooltip-fg)",
	boxShadow: "var(--chart-tooltip-shadow)",
} as const;

export const CHART_CURSOR = { fill: "var(--chart-cursor-fill)" } as const;

export const COMMON_AXIS_PROPS = {
	tick: { fontSize: 10, fill: CHART_TEXT_MUTED },
	axisLine: false,
	tickLine: false,
} as const;

export function truncateChartLabel(name: string, maxLen: number): string {
	return name.length > maxLen ? `${name.slice(0, maxLen - 1)}…` : name;
}

export const BUCKET_SIZE = 25;

/* ==========================================================================
   1. Popular Naming Trends Scatter Chart
   ========================================================================== */
export const PopularNamingTrendsChart = memo(function PopularNamingTrendsChart({
	leaderboard,
}: {
	leaderboard: LeaderboardEntry[];
}) {
	const data = useMemo(() => {
		return leaderboard
			.filter((e) => e.total_ratings > 0)
			.map((e) => ({
				name: truncateChartLabel(e.name, 12),
				popularity: e.total_ratings,
				rating: Math.round(e.avg_rating),
				wins: e.wins,
				fullName: e.name,
			}))
			.sort((a, b) => b.popularity - a.popularity)
			.slice(0, 30);
	}, [leaderboard]);

	if (data.length === 0) {
		return null;
	}

	return (
		<ChartFrame>
			<ScatterChart margin={{ top: 24, right: 24, left: 4, bottom: 16 }}>
				<CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
				<XAxis
					type="number"
					dataKey="popularity"
					name="Matches Played"
					{...COMMON_AXIS_PROPS}
					label={{
						value: "Total Matches Played",
						position: "insideBottom",
						offset: -8,
						fill: CHART_TEXT_MUTED,
						fontSize: 10,
					}}
				/>
				<YAxis
					type="number"
					dataKey="rating"
					name="Average Rating"
					{...COMMON_AXIS_PROPS}
					domain={["dataMin - 15", "dataMax + 15"]}
					label={{
						value: "Rating",
						angle: -90,
						position: "insideLeft",
						offset: 12,
						fill: CHART_TEXT_MUTED,
						fontSize: 10,
					}}
				/>
				<ZAxis type="number" dataKey="wins" range={[60, 500]} name="Wins" />
				<Tooltip
					cursor={{ strokeDasharray: "3 3", stroke: CHART_AXIS }}
					contentStyle={CHART_TOOLTIP_STYLE}
					formatter={(value: number | string, name: string) => {
						if (name === "popularity") {
							return [value, "Total Matches"];
						}
						if (name === "rating") {
							return [value, "Rating"];
						}
						if (name === "wins") {
							return [value, "Wins"];
						}
						return [value, name];
					}}
					labelFormatter={(label, payloads) => {
						if (payloads && payloads.length > 0) {
							return payloads[0].payload.fullName;
						}
						return label;
					}}
				/>
				<Scatter data={data} fill={CHART_SERIES[4]}>
					{data.map((_entry, index) => (
						<Cell key={`cell-${index}`} fill={CHART_SERIES[index % CHART_SERIES.length]} />
					))}
				</Scatter>
			</ScatterChart>
		</ChartFrame>
	);
});

/* ==========================================================================
   2. Rating Distribution Bar Chart
   ========================================================================== */
function bucketLabel(bucketStart: number) {
	return `${bucketStart}–${bucketStart + BUCKET_SIZE}`;
}

export const RatingDistributionChart = memo(function RatingDistributionChart({
	leaderboard,
}: {
	leaderboard: LeaderboardEntry[];
}) {
	const ratings = useMemo(() => {
		const result: number[] = [];
		for (let i = 0; i < leaderboard.length; i++) {
			const e = leaderboard[i];
			if ((e.total_ratings ?? 0) > 0) {
				result.push(Math.round(e.avg_rating));
			}
		}
		return result;
	}, [leaderboard]);

	const stats = useMemo(() => computeRatingStats(ratings), [ratings]);

	const data = useMemo(() => {
		if (ratings.length === 0) {
			return [];
		}

		let minRating = Number.POSITIVE_INFINITY;
		let maxRating = Number.NEGATIVE_INFINITY;
		for (const r of ratings) {
			if (r < minRating) {
				minRating = r;
			}
			if (r > maxRating) {
				maxRating = r;
			}
		}

		const minBucket = Math.floor(minRating / BUCKET_SIZE) * BUCKET_SIZE;
		const maxBucket = Math.ceil(maxRating / BUCKET_SIZE) * BUCKET_SIZE;

		const buckets: Record<number, number> = {};
		for (let b = minBucket; b <= maxBucket; b += BUCKET_SIZE) {
			buckets[b] = 0;
		}
		for (const r of ratings) {
			const bucket = Math.floor(r / BUCKET_SIZE) * BUCKET_SIZE;
			buckets[bucket] = (buckets[bucket] ?? 0) + 1;
		}

		const chartData = [];
		for (const keyStr in buckets) {
			const keyNum = Number(keyStr);
			chartData.push({
				range: bucketLabel(keyNum),
				bucketStart: keyNum,
				count: buckets[keyNum],
			});
		}
		return chartData.sort((a, b) => a.bucketStart - b.bucketStart);
	}, [ratings]);

	const meanBucket = useMemo(() => {
		if (!stats) {
			return null;
		}
		return Math.floor(stats.mean / BUCKET_SIZE) * BUCKET_SIZE;
	}, [stats]);

	const stdDevBuckets = useMemo(() => {
		if (!stats || stats.stdDev <= 0) {
			return null;
		}
		const lo = Math.floor((stats.mean - stats.stdDev) / BUCKET_SIZE) * BUCKET_SIZE;
		const hi = Math.floor((stats.mean + stats.stdDev) / BUCKET_SIZE) * BUCKET_SIZE;
		return { lo: bucketLabel(lo), hi: bucketLabel(hi) };
	}, [stats]);

	if (data.length === 0) {
		return (
			<div
				className={cn(
					themeSurfaces.panelInset,
					"flex h-40 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm text-muted-foreground/70",
				)}
			>
				Not enough rated names yet to draw a distribution.
			</div>
		);
	}

	const meanRange = meanBucket === null ? null : bucketLabel(meanBucket);

	let maxCount = 0;
	for (let i = 0; i < data.length; i++) {
		if (data[i].count > maxCount) {
			maxCount = data[i].count;
		}
	}

	return (
		<div className="space-y-3">
			<ChartFrame>
				<BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
					<XAxis
						dataKey="range"
						tick={{ fontSize: 10, fill: CHART_TEXT_MUTED }}
						axisLine={{ stroke: CHART_GRID }}
						tickLine={false}
					/>
					<YAxis
						allowDecimals={false}
						tick={{ fontSize: 10, fill: CHART_TEXT_MUTED }}
						axisLine={false}
						tickLine={false}
					/>
					<Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
					<Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
						{data.map((d) => (
							<Cell
								key={d.bucketStart}
								fill={CHART_PALETTE.teal}
								fillOpacity={0.45 + (d.count / maxCount) * 0.55}
							/>
						))}
					</Bar>
					{meanRange && (
						<ReferenceLine
							x={meanRange}
							stroke={CHART_PALETTE.coral}
							strokeDasharray="4 3"
							strokeWidth={2}
							label={{
								value: "μ",
								position: "top",
								fill: CHART_PALETTE.coral,
								fontSize: 11,
								fontWeight: 700,
							}}
						/>
					)}
					{stdDevBuckets && (
						<>
							<ReferenceLine
								x={stdDevBuckets.lo}
								stroke={CHART_TEXT_MUTED}
								strokeDasharray="2 4"
								strokeWidth={1}
								label={{
									value: "−σ",
									position: "top",
									fill: CHART_TEXT_MUTED,
									fontSize: 9,
								}}
							/>
							<ReferenceLine
								x={stdDevBuckets.hi}
								stroke={CHART_TEXT_MUTED}
								strokeDasharray="2 4"
								strokeWidth={1}
								label={{
									value: "+σ",
									position: "top",
									fill: CHART_TEXT_MUTED,
									fontSize: 9,
								}}
							/>
						</>
					)}
				</BarChart>
			</ChartFrame>

			{stats && (
				<div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
					<div className="rounded-lg bg-card/40 px-2 py-1.5">
						<div className="font-semibold text-foreground">{Math.round(stats.mean)}</div>
						<div>Mean (μ)</div>
					</div>
					<div className="rounded-lg bg-card/40 px-2 py-1.5">
						<div className="font-semibold text-foreground">{Math.round(stats.median)}</div>
						<div>Median</div>
					</div>
					<div className="rounded-lg bg-card/40 px-2 py-1.5">
						<div className="font-semibold text-foreground">±{Math.round(stats.stdDev)}</div>
						<div>Std Dev (σ)</div>
					</div>
				</div>
			)}
		</div>
	);
});

/* ==========================================================================
   3. Rating Radar Chart
   ========================================================================== */
export const RatingRadarChart = memo(function RatingRadarChart({
	leaderboard,
	limit = 6,
}: {
	leaderboard: LeaderboardEntry[];
	limit?: number;
}) {
	const { data, showChart } = useMemo(() => {
		const top: LeaderboardEntry[] = [];
		let maxRating = -Infinity;
		let maxWins = -Infinity;
		let maxTotal = -Infinity;

		if (limit > 0) {
			for (let i = 0; i < leaderboard.length; i++) {
				if (top.length >= limit) {
					break;
				}
				const e = leaderboard[i];
				if ((e.total_ratings ?? 0) > 0) {
					top.push(e);
					if (e.avg_rating > maxRating) {
						maxRating = e.avg_rating;
					}
					if (e.wins > maxWins) {
						maxWins = e.wins;
					}
					if (e.total_ratings > maxTotal) {
						maxTotal = e.total_ratings;
					}
				}
			}
		}

		if (top.length < 3) {
			return { data: [], showChart: false };
		}

		maxRating = maxRating === -Infinity ? 1 : maxRating || 1;
		maxWins = maxWins === -Infinity ? 1 : maxWins || 1;
		maxTotal = maxTotal === -Infinity ? 1 : maxTotal || 1;

		const chartData = new Array(top.length);
		for (let i = 0; i < top.length; i++) {
			const e = top[i];
			chartData[i] = {
				name: truncateChartLabel(e.name, 10),
				rating: Math.round((e.avg_rating / maxRating) * 100),
				wins: Math.round((e.wins / maxWins) * 100),
				activity: Math.round((e.total_ratings / maxTotal) * 100),
			};
		}

		return { data: chartData, showChart: true };
	}, [leaderboard, limit]);

	if (!showChart) {
		return null;
	}

	return (
		<ChartFrame variant="tall">
			<RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
				<PolarGrid stroke={CHART_GRID} />
				<PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: CHART_TEXT_MUTED }} />
				<PolarRadiusAxis
					angle={30}
					domain={[0, 100]}
					tick={{ fontSize: 9, fill: CHART_TEXT_MUTED }}
					axisLine={false}
				/>
				<Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
				<Radar
					name="Rating"
					dataKey="rating"
					stroke={CHART_PALETTE.teal}
					fill={CHART_PALETTE.teal}
					fillOpacity={0.2}
					strokeWidth={2}
				/>
				<Radar
					name="Wins"
					dataKey="wins"
					stroke={CHART_PALETTE.coral}
					fill={CHART_PALETTE.coral}
					fillOpacity={0.18}
					strokeWidth={2}
				/>
				<Radar
					name="Activity"
					dataKey="activity"
					stroke={CHART_PALETTE.violet}
					fill={CHART_PALETTE.violet}
					fillOpacity={0.12}
					strokeWidth={1.5}
					strokeDasharray="4 2"
				/>
			</RadarChart>
		</ChartFrame>
	);
});

/* ==========================================================================
   4. Top Names Vertical Bar Chart
   ========================================================================== */
export const TopNamesChart = memo(function TopNamesChart({
	leaderboard,
	limit = 8,
}: {
	leaderboard: LeaderboardEntry[];
	limit?: number;
}) {
	const { data, allRatings } = useMemo(() => {
		const chartLimit = Math.min(limit, leaderboard.length);
		const chartData: Array<{
			name: string;
			rating: number;
			fullName: string;
			percentile: number | null;
		}> = new Array(chartLimit);
		const ratings: number[] = new Array(leaderboard.length);

		for (let i = 0; i < leaderboard.length; i++) {
			const entry = leaderboard[i];
			ratings[i] = entry.avg_rating;
			if (i < chartLimit) {
				chartData[i] = {
					name: truncateChartLabel(entry.name, 10),
					rating: Math.round(entry.avg_rating),
					fullName: entry.name,
					percentile: entry.percentile_rank ?? null,
				};
			}
		}

		return { data: chartData, allRatings: ratings };
	}, [leaderboard, limit]);

	if (data.length === 0) {
		return null;
	}
	const stats = computeRatingStats(allRatings);
	const meanRating = stats ? Math.round(stats.mean) : null;

	return (
		<ChartFrame>
			<BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
				<CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
				<XAxis type="number" {...COMMON_AXIS_PROPS} domain={["dataMin - 50", "dataMax + 20"]} />
				<YAxis
					dataKey="name"
					type="category"
					width={72}
					tick={{ fontSize: 11, fill: CHART_FOREGROUND, fontWeight: 500 }}
					axisLine={false}
					tickLine={false}
				/>
				<Tooltip
					contentStyle={CHART_TOOLTIP_STYLE}
					formatter={(
						value: number | string,
						_: unknown,
						item?: {
							payload?: { fullName?: string; percentile?: number | null };
						},
					) => {
						const label = item?.payload?.fullName ?? "";
						const pct = item?.payload?.percentile ?? null;
						return [`${value}${pct === null ? "" : ` (top ${100 - pct}%)`}`, label];
					}}
					cursor={CHART_CURSOR}
				/>
				<Bar dataKey="rating" radius={[0, 8, 8, 0]} maxBarSize={28}>
					{data.map((_, i) => (
						<Cell key={data[i].name} fill={CHART_SERIES[i % CHART_SERIES.length]} />
					))}
				</Bar>
				{meanRating !== null && (
					<ReferenceLine
						x={meanRating}
						stroke={CHART_AXIS}
						strokeDasharray="4 3"
						strokeWidth={2}
						label={{
							value: `avg ${meanRating}`,
							position: "insideBottomRight",
							fill: CHART_TEXT_MUTED,
							fontSize: 10,
							fontWeight: 500,
							offset: 8,
						}}
					/>
				)}
			</BarChart>
		</ChartFrame>
	);
});

/* ==========================================================================
   5. Win/Loss Stacked Bar Chart
   ========================================================================== */
export const WinLossChart = memo(function WinLossChart({
	leaderboard,
	limit = 8,
}: {
	leaderboard: LeaderboardEntry[];
	limit?: number;
}) {
	const data = useMemo(() => {
		const result: Array<{ name: string; wins: number; losses: number }> = [];
		if (limit > 0) {
			for (let i = 0; i < leaderboard.length; i++) {
				const e = leaderboard[i];
				const wins = e.wins ?? 0;
				const losses = e.losses ?? 0;
				if (wins + losses > 0) {
					result.push({
						name: truncateChartLabel(e.name, 8),
						wins,
						losses,
					});
					if (result.length >= limit) {
						break;
					}
				}
			}
		}
		return result;
	}, [leaderboard, limit]);

	if (data.length === 0) {
		return (
			<div
				className={cn(
					themeSurfaces.panelInset,
					"flex h-40 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm text-muted-foreground/70",
				)}
			>
				No head-to-head matches recorded yet. Run a tournament to populate this chart.
			</div>
		);
	}

	return (
		<ChartFrame>
			<BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
				<XAxis dataKey="name" {...COMMON_AXIS_PROPS} axisLine={{ stroke: CHART_GRID }} />
				<YAxis allowDecimals={false} {...COMMON_AXIS_PROPS} />
				<Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
				<Legend wrapperStyle={{ fontSize: 11, color: CHART_TEXT_MUTED }} />
				<Bar
					dataKey="wins"
					stackId="a"
					fill={CHART_PALETTE.teal}
					radius={[0, 0, 0, 0]}
					maxBarSize={32}
				/>
				<Bar
					dataKey="losses"
					stackId="a"
					fill={CHART_PALETTE.coral}
					fillOpacity={0.75}
					radius={[4, 4, 0, 0]}
					maxBarSize={32}
				/>
			</BarChart>
		</ChartFrame>
	);
});
