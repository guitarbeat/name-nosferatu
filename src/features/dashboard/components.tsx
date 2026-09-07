import { ReactNode } from "react";
import type { DashboardProps } from "./types";
import { useAdminDashboard } from "./hooks";
import { Button, Loading, SearchFilterBar } from "@/shared/components";
import { Trophy, Shield, User, Clock, TrendingUp, BarChart3, Settings } from "lucide-react";

export function AdminDashboard() {
    const { stats, isLoading, filteredNames } = useAdminDashboard();
    if (isLoading) return <Loading />;
    return <div className="p-4 bg-card rounded-xl">Admin Dashboard: {filteredNames.length} names</div>;
}

export function ContextBadge({ label, tone = "accent" }: { label: string, tone?: string }) {
    return <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent">{label}</span>;
}

export function Panel({ children, className = "" }: { children: ReactNode, className?: string }) {
    return <div className={`p-4 sm:p-6 bg-card border border-border/50 rounded-xl shadow-sm ${className}`}>{children}</div>;
}

export function SectionHeader({ icon: Icon, title, subtitle, action }: { icon: any, title: string, subtitle?: string, action?: ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="w-5 h-5 text-primary" />}
                <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

export function CommunityChartsPanel({ leaderboard, siteStats }: any) {
    return (
        <Panel className="flex flex-col gap-4">
            <SectionHeader icon={BarChart3} title="Community Charts" />
            <div className="h-64 flex items-center justify-center text-muted-foreground">Charts data</div>
        </Panel>
    );
}

export function DashboardHeader({ isLoggedIn, userName, avatarUrl, isAdmin, quickStats, userStats }: any) {
    return (
        <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="flex gap-4">
                {quickStats?.map((stat: any, i: number) => (
                    <div key={i} className="text-sm text-muted-foreground">{stat.label}: {stat.value}</div>
                ))}
            </div>
        </div>
    );
}

export function EngagementPanel({ engagementMetrics, timeframe, setTimeframe, refreshEngagementMetrics, isLoadingEngagement }: any) {
    return (
        <Panel>
            <SectionHeader icon={TrendingUp} title="Engagement" />
            <div className="h-40 flex items-center justify-center">Engagement metrics</div>
        </Panel>
    );
}

export function getQuickStats({ siteStats, userName, userStats }: any) {
    return [
        { label: "Total Ratings", value: siteStats?.totalRatings || 0 },
        { label: "Your Ratings", value: userStats?.totalRatings || 0 }
    ];
}

export function LeaderboardPanel({ leaderboard, isLoadingLeaderboard, onStartNew }: any) {
    return (
        <Panel>
            <SectionHeader icon={Trophy} title="Global Leaderboard" />
            {isLoadingLeaderboard ? <Loading /> : (
                <div className="space-y-2">
                    {leaderboard?.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between p-2 bg-muted/50 rounded">
                            <span>{l.name}</span>
                            <span className="font-bold">{l.avg_rating}</span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}

export function PersonalResults({ personalRatings, currentTournamentNames, onStartNew, onUpdateRatings, userName }: any) {
    return (
        <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Your personal tier list based on previous choices.</div>
            <div className="space-y-2">
                {Object.entries(personalRatings || {}).map(([name, data]: any, i) => (
                    <div key={i} className="flex justify-between p-2 bg-muted/50 rounded">
                        <span>{name}</span>
                        <span>{data.rating}</span>
                    </div>
                ))}
            </div>
            <Button onClick={onStartNew}>Start New Tournament</Button>
        </div>
    );
}
