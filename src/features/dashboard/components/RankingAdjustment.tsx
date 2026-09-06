import {
	DragDropContext,
	Draggable,
	type DraggableProvided,
	type DraggableStateSnapshot,
	Droppable,
	type DroppableProvided,
	type DropResult,
} from "@hello-pangea/dnd";
import { CardBody, CardHeader, Chip, Divider } from "@heroui/react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical, Loader2, Save } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components";
import { cn, ErrorManager } from "@/shared/lib/utils";
import type { NameItem } from "@/shared/types";

function haveRankingsChanged(newItems: NameItem[], oldRankings: NameItem[]): boolean {
	if (newItems === oldRankings) {
		return false;
	}
	const len = newItems.length;
	if (len !== oldRankings.length) {
		return true;
	}
	for (let i = 0; i < len; i++) {
		const newItem = newItems[i] as NameItem;
		const oldItem = oldRankings[i] as NameItem;
		if (newItem === oldItem) {
			continue;
		}
		if (!oldItem || newItem.name !== oldItem.name || newItem.rating !== oldItem.rating) {
			return true;
		}
	}
	return false;
}

interface RankingItemContentProps {
	item: NameItem;
	index: number;
	totalItems: number;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
}

const TOP_MEDAL_STYLES: Record<number, { bg: string; border: string; text: string }> = {
	0: {
		bg: "from-yellow-500 to-amber-600",
		border: "border-yellow-600/50",
		text: "text-white",
	},
	1: {
		bg: "from-slate-300 to-slate-500",
		border: "border-yellow-600/50",
		text: "text-white",
	},
	2: {
		bg: "from-amber-700 to-orange-800",
		border: "border-yellow-600/50",
		text: "text-white",
	},
};

const DEFAULT_MEDAL_STYLE = {
	bg: "from-primary/20 to-accent/20",
	border: "border-primary/30",
	text: "text-foreground",
};

const RankingItemContent = memo(
	({ item, index, totalItems, onMoveUp, onMoveDown }: RankingItemContentProps) => {
		const medal = TOP_MEDAL_STYLES[index] ?? DEFAULT_MEDAL_STYLE;

		const winRate =
			item.wins || item.losses
				? Math.round(((item.wins || 0) / ((item.wins || 0) + (item.losses || 0))) * 100)
				: null;

		return (
			<div className="flex items-center gap-3 sm:gap-4 w-full">
				{/* Drag Handle */}
				<div
					className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors cursor-grab active:cursor-grabbing p-1 rounded-md"
					title="Drag to reorder"
				>
					<GripVertical size={18} />
				</div>

				{/* Rank Badge */}
				<Chip
					className={`flex-shrink-0 bg-gradient-to-br ${medal.bg} border ${medal.border} ${medal.text} font-bold min-w-[2.75rem] shadow-sm`}
					size="lg"
					variant="flat"
				>
					{`#${index + 1}`}
				</Chip>

				{/* Name and Stats */}
				<div className="flex-1 min-w-0">
					<h3 className="text-base sm:text-lg font-bold text-foreground truncate">{item.name}</h3>
					<div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm mt-0.5">
						<div className="flex items-center gap-1">
							<span className="text-muted-foreground text-[11px]">Score:</span>
							<span className="inline-flex items-center justify-center rounded-md bg-primary/15 px-1.5 py-0.5 font-bold text-primary tabular-nums">
								{Math.round(item.rating as number)}
							</span>
						</div>
						{item.wins !== undefined && item.losses !== undefined && (
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<span className="text-accent font-semibold">{item.wins}W</span>
								<span>-</span>
								<span className="text-destructive/80 font-semibold">{item.losses}L</span>
								{winRate !== null && (
									<span className="hidden sm:inline-block text-[11px] text-muted-foreground/80 tabular-nums">
										({winRate}%)
									</span>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Accessible Nudge Buttons */}
				{(onMoveUp || onMoveDown) && (
					<div className="flex items-center gap-1 shrink-0">
						<button
							type="button"
							onClick={onMoveUp}
							disabled={index === 0}
							className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-20 disabled:pointer-events-none transition-colors"
							aria-label={`Move ${item.name} up`}
							title="Move up"
						>
							<ChevronUp size={16} />
						</button>
						<button
							type="button"
							onClick={onMoveDown}
							disabled={index === totalItems - 1}
							className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-20 disabled:pointer-events-none transition-colors"
							aria-label={`Move ${item.name} down`}
							title="Move down"
						>
							<ChevronDown size={16} />
						</button>
					</div>
				)}
			</div>
		);
	},
);
RankingItemContent.displayName = "RankingItemContent";

export const RankingAdjustment = memo(
	({
		rankings,
		onSave,
		onCancel,
	}: {
		rankings: NameItem[];
		onSave: (items: NameItem[]) => Promise<void>;
		onCancel: () => void;
	}) => {
		const [items, setItems] = useState(rankings || []);
		const [saveStatus, setSaveStatus] = useState("");
		const [isDragging, setIsDragging] = useState(false);
		const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
		const isMountedRef = useRef(true);
		const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const onSaveRef = useRef(onSave);

		useEffect(() => {
			onSaveRef.current = onSave;
		}, [onSave]);

		useEffect(() => {
			isMountedRef.current = true;

			return () => {
				isMountedRef.current = false;
				if (saveTimerRef.current) {
					clearTimeout(saveTimerRef.current);
					saveTimerRef.current = null;
				}
				if (saveStatusTimerRef.current) {
					clearTimeout(saveStatusTimerRef.current);
					saveStatusTimerRef.current = null;
				}
			};
		}, []);

		useEffect(() => {
			if (hasUnsavedChanges) {
				return;
			}
			if (!haveRankingsChanged(rankings, items)) {
				return;
			}
			const sorted = [...rankings].sort((a, b) => (b.rating as number) - (a.rating as number));
			if (haveRankingsChanged(sorted, items)) {
				setItems(sorted);
			}
		}, [rankings, hasUnsavedChanges, items]);

		useEffect(() => {
			if (!hasUnsavedChanges) {
				return;
			}
			if (items && rankings && haveRankingsChanged(items, rankings)) {
				setSaveStatus("saving");
				if (saveTimerRef.current) {
					clearTimeout(saveTimerRef.current);
					saveTimerRef.current = null;
				}
				if (saveStatusTimerRef.current) {
					clearTimeout(saveStatusTimerRef.current);
					saveStatusTimerRef.current = null;
				}
				saveTimerRef.current = setTimeout(() => {
					onSaveRef
						.current(items)
						.then(() => {
							if (!isMountedRef.current) {
								return;
							}
							setHasUnsavedChanges(false);
							setSaveStatus("success");
							saveStatusTimerRef.current = setTimeout(() => {
								if (isMountedRef.current) {
									setSaveStatus("");
								}
								saveStatusTimerRef.current = null;
							}, 2000);
						})
						.catch((e: unknown) => {
							if (!isMountedRef.current) {
								return;
							}
							setSaveStatus("error");
							ErrorManager.handleError(e, "Save Rankings");
						});
				}, 1000);
			}
			return () => {
				if (saveTimerRef.current) {
					clearTimeout(saveTimerRef.current);
					saveTimerRef.current = null;
				}
				if (saveStatusTimerRef.current) {
					clearTimeout(saveStatusTimerRef.current);
					saveStatusTimerRef.current = null;
				}
			};
		}, [items, rankings, hasUnsavedChanges]);

		const handleReorder = (newItems: NameItem[]) => {
			const len = newItems.length;
			const adjusted = new Array(len);
			for (let i = 0; i < len; i++) {
				adjusted[i] = {
					...(newItems[i] as NameItem),
					rating: Math.round(1000 + (1000 * (len - i)) / len),
				};
			}
			setHasUnsavedChanges(true);
			setItems(adjusted);
		};

		const handleMove = (index: number, direction: "up" | "down") => {
			const targetIndex = direction === "up" ? index - 1 : index + 1;
			if (targetIndex < 0 || targetIndex >= items.length) {
				return;
			}
			const newItems = Array.from(items);
			const [moved] = newItems.splice(index, 1);
			if (moved) {
				newItems.splice(targetIndex, 0, moved);
			}
			handleReorder(newItems);
		};

		const handleDragEnd = (result: DropResult) => {
			setIsDragging(false);
			if (!result.destination) {
				return;
			}
			const newItems = Array.from(items);
			const [reordered] = newItems.splice(result.source.index, 1);
			if (reordered) {
				newItems.splice(result.destination.index, 0, reordered);
			}
			handleReorder(newItems);
		};

		return (
			<div className={cn("w-full max-w-4xl mx-auto", isDragging && "ring-2 ring-primary/50")}>
				<CardHeader className="flex flex-col gap-3 pb-4">
					<div className="flex items-center justify-between w-full">
						<h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
							Your Cat Name Rankings
						</h2>
						{saveStatus && (
							<Chip
								className={cn(
									"transition-all duration-300",
									saveStatus === "saving" &&
										"bg-chart-5/20 border-chart-5/30 text-chart-5 animate-pulse",
									saveStatus === "success" && "bg-chart-2/20 border-chart-2/30 text-chart-2",
									saveStatus === "error" &&
										"bg-destructive/20 border-destructive/30 text-destructive",
								)}
								variant="flat"
								startContent={
									saveStatus === "saving" ? (
										<Loader2 size={14} className="animate-spin" />
									) : saveStatus === "success" ? (
										<Save size={14} />
									) : null
								}
							>
								{saveStatus === "saving"
									? "Saving..."
									: saveStatus === "success"
										? "Saved!"
										: "Error saving"}
							</Chip>
						)}
					</div>
					<p className="text-muted-foreground text-sm">
						Drag and drop or use arrow buttons to reorder your favorite cat names
					</p>
				</CardHeader>

				<Divider className="bg-border/10" />

				<CardBody className="gap-3 p-6">
					<DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
						<Droppable droppableId="rankings">
							{(provided: DroppableProvided) => (
								<div
									{...provided.droppableProps}
									ref={provided.innerRef}
									className="flex flex-col gap-3"
								>
									{items.map((item: NameItem, index: number) => (
										<Draggable
											key={item.id || item.name}
											draggableId={String(item.id || item.name)}
											index={index}
										>
											{(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
												<div
													ref={provided.innerRef}
													{...provided.draggableProps}
													{...provided.dragHandleProps}
												>
													<motion.div
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, scale: 0.95 }}
														className={cn(
															"py-3 px-2 rounded-xl transition-all duration-200 border border-border/10 hover:border-border/30 bg-card/40",
															snapshot.isDragging && "bg-foreground/5 scale-105 rotate-1 shadow-lg",
														)}
													>
														<RankingItemContent
															item={item}
															index={index}
															totalItems={items.length}
															onMoveUp={() => handleMove(index, "up")}
															onMoveDown={() => handleMove(index, "down")}
														/>
													</motion.div>
												</div>
											)}
										</Draggable>
									))}
									{provided.placeholder}
								</div>
							)}
						</Droppable>
					</DragDropContext>
				</CardBody>

				<Divider className="bg-border/10" />

				<div className="p-6 flex justify-end">
					<Button
						onClick={onCancel}
						variant="flat"
						className="bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border/10"
					>
						Back to Tournament
					</Button>
				</div>
			</div>
		);
	},
);
RankingAdjustment.displayName = "RankingAdjustment";
