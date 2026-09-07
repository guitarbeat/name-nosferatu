import { type LucideIcon, Medal } from "lucide-react";
import type React from "react";
import {
	type ComponentType,
	cloneElement,
	isValidElement,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { Card } from "@/shared/components";
import { themeSurfaces, themeText } from "@/shared/lib/uiUtils";
import { cn } from "@/shared/lib/utils";

export function ChartFrame({
	children,
	variant = "default",
}: {
	children: ReactNode;
	variant?: "default" | "tall";
}) {
	const frameRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const element = frameRef.current;
		if (!element) {
			return;
		}

		const updateSize = () => {
			const { width, height } = element.getBoundingClientRect();
			setSize({
				width: Math.max(0, Math.floor(width)),
				height: Math.max(0, Math.floor(height)),
			});
		};

		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	const chart =
		size.width > 0 && size.height > 0 && isValidElement(children)
			? cloneElement(children as React.ReactElement<{ width?: number; height?: number }>, {
					width: size.width,
					height: size.height,
				})
			: null;

	return (
		<div ref={frameRef} className={`chart-frame ${variant === "tall" ? "chart-frame--tall" : ""}`}>
			{chart}
		</div>
	);
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<Card variant="default" shadow="large" className={className}>
			{children}
		</Card>
	);
}

export function ListPanel({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn(themeSurfaces.panelInset, className)}>{children}</div>;
}

export function ListPanelRow({
	children,
	divided = true,
	className,
}: {
	children: ReactNode;
	divided?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 px-4 py-3",
				divided && themeSurfaces.rowDivider,
				className,
			)}
		>
			{children}
		</div>
	);
}

export function StatTile({
	label,
	value,
	icon: Icon,
	accent = false,
}: {
	label: string;
	value: string | number;
	icon?: LucideIcon | ComponentType<{ size?: number; className?: string }>;
	accent?: boolean;
}) {
	return (
		<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/50 p-4 transition-all hover:border-primary/30 hover:shadow-md">
			<div className="absolute -top-6 -right-6 size-12 rounded-full bg-primary/5 blur-xl transition-transform group-hover:scale-110" />
			<div className="relative space-y-2">
				<div className="flex items-center justify-between">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{label}
					</p>
					{Icon && (
						<div
							className={cn(
								"rounded-lg p-2 transition-colors",
								accent ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
							)}
						>
							<Icon size={14} />
						</div>
					)}
				</div>
				<p className={cn("text-2xl font-bold tracking-tight", accent && "text-primary")}>{value}</p>
			</div>
		</div>
	);
}

export function ContextBadge({
	label,
	tone = "default",
}: {
	label: string;
	tone?: "default" | "accent";
}) {
	return (
		<span className={tone === "accent" ? themeSurfaces.badgeAccent : themeSurfaces.badge}>
			{label}
		</span>
	);
}

export function SectionHeader({
	icon: Icon,
	title,
	subtitle,
	action,
}: {
	icon: LucideIcon | ComponentType<{ size?: number; className?: string }>;
	title: string;
	subtitle?: string;
	action?: ReactNode;
}) {
	return (
		<div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
			<div className="space-y-1.5">
				<div className="flex items-center gap-2">
					<Icon size={13} className="text-primary/70 shrink-0" />
					<span className={themeText.sectionLabel}>{title}</span>
				</div>
				{subtitle && <p className={cn("max-w-2xl", themeText.subtitle)}>{subtitle}</p>}
			</div>
			{action}
		</div>
	);
}

const TOP_RANK_STYLES: Record<number, { style: string; title: string }> = {
	1: {
		style: "border-amber-500/40 bg-amber-500/15 text-amber-300",
		title: "Rank 1: Champion",
	},
	2: {
		style: "border-slate-300/30 bg-slate-300/10 text-slate-200",
		title: "Rank 2: Runner-up",
	},
	3: {
		style: "border-amber-700/30 bg-amber-700/15 text-amber-500",
		title: "Rank 3: Third Place",
	},
};

export function RankChip({ rank }: { rank: number }) {
	const topRank = TOP_RANK_STYLES[rank];
	if (topRank) {
		return (
			<div
				className={cn(
					"flex size-8 items-center justify-center rounded-lg border font-mono text-xs font-black shadow-xs",
					topRank.style,
				)}
				title={topRank.title}
			>
				<Medal className="size-4" />
			</div>
		);
	}

	return (
		<div className="flex size-8 items-center justify-center rounded-lg border border-border/40 bg-secondary/30 font-mono text-xs font-bold text-muted-foreground">
			{rank}
		</div>
	);
}
