import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";
import { memo, useCallback, useEffect, useMemo } from "react";
import { namesQueryOptions, SUPABASE_UNAVAILABLE_MSG } from "@/shared/api";
import { Button, DriftWall, type DriftWallItem, Loading } from "@/shared/components";
import {
	DEFAULT_SAMPLE_NAMES,
	getLockedNames,
	getVisibleNames,
	isNameLocked,
} from "@/shared/lib/names";
import { hapticNavTap, hapticTournamentStart } from "@/shared/lib/utils";
import type { IdType, NameItem } from "@/shared/types";
import useAppStore from "@/store";

/**
 * Accessible cat name contender selection via 3D Drift Wall.
 */
export const NameSelector = memo(function NameSelector() {
	const prefersReducedMotion = useReducedMotion() ?? false;
	const isAdmin = useAppStore((state) => state.user.isAdmin);
	const storeSelectedNames = useAppStore((state) => state.tournament.selectedNames);
	const tournamentActions = useAppStore((state) => state.tournamentActions);

	const namesQuery = useQuery({
		...namesQueryOptions(isAdmin),
		retry: 2,
	});

	const error =
		namesQuery.error instanceof Error
			? namesQuery.error.message
			: namesQuery.error
				? "Failed to load names"
				: null;
	const isSupabaseUnavailable = error === SUPABASE_UNAVAILABLE_MSG;
	const names =
		namesQuery.data?.names && namesQuery.data.names.length > 0
			? namesQuery.data.names
			: DEFAULT_SAMPLE_NAMES;
	const isLoading = namesQuery.isPending && !namesQuery.data;

	const selectedIds = useMemo(
		() => new Set(storeSelectedNames.map((item) => item.id)),
		[storeSelectedNames],
	);

	const namesById = useMemo(() => {
		const map = new Map<IdType, NameItem>();
		for (let i = 0; i < names.length; i++) {
			const nameItem = names[i];
			map.set(nameItem.id, nameItem);
		}
		return map;
	}, [names]);

	useEffect(() => {
		if (names.length === 0) {
			return;
		}

		const lockedInNames = getLockedNames(names);
		if (lockedInNames.length === 0) {
			return;
		}

		const missingLocked = lockedInNames.filter((n) => !selectedIds.has(n.id));
		if (missingLocked.length > 0) {
			tournamentActions.setSelection([...storeSelectedNames, ...missingLocked]);
		}
	}, [names, storeSelectedNames, tournamentActions, selectedIds]);

	const handleToggleName = useCallback(
		(nameId: IdType) => {
			const nameItem = namesById.get(nameId);
			if (!nameItem || isNameLocked(nameItem)) {
				return;
			}

			hapticNavTap();
			const isCurrentlySelected = selectedIds.has(nameId);
			const nextSelection = isCurrentlySelected
				? storeSelectedNames.filter((n) => n.id !== nameId)
				: [...storeSelectedNames, nameItem];

			tournamentActions.setSelection(nextSelection);
		},
		[namesById, selectedIds, storeSelectedNames, tournamentActions],
	);

	const availableNames = useMemo(() => getVisibleNames(names), [names]);

	const driftWallItems = useMemo<DriftWallItem[]>(() => {
		return availableNames.map((nameItem) => {
			const isSelected = selectedIds.has(nameItem.id);
			const locked = isNameLocked(nameItem);
			return {
				id: String(nameItem.id),
				title: nameItem.name,
				subtitle: nameItem.description
					? nameItem.description
					: nameItem.pronunciation
						? `/${nameItem.pronunciation}/`
						: undefined,
				selected: isSelected,
				locked,
				onClick: () => handleToggleName(nameItem.id),
			};
		});
	}, [availableNames, selectedIds, handleToggleName]);

	const handleStartTournament = useCallback(() => {
		hapticTournamentStart();
		if (storeSelectedNames.length >= 2) {
			tournamentActions.setNames(storeSelectedNames);
			window.dispatchEvent(new CustomEvent("nav-tab-change", { detail: "tournament" }));
			const tournamentEl = document.getElementById("tournament");
			if (tournamentEl) {
				tournamentEl.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
			}
		}
	}, [prefersReducedMotion, storeSelectedNames, tournamentActions]);

	if (isLoading) {
		return (
			<div className="mx-auto w-full py-16 flex items-center justify-center">
				<Loading variant="spinner" text="Loading cat pool..." />
			</div>
		);
	}

	if (error && !isSupabaseUnavailable && availableNames.length === 0) {
		return (
			<div className="mx-auto w-full py-12 flex flex-col items-center justify-center text-center">
				<div className="p-6 rounded-3xl bg-destructive/10 border border-destructive/20 max-w-md space-y-4">
					<p className="size-10 rounded-2xl bg-destructive/20 text-destructive flex items-center justify-center mx-auto text-lg font-bold">
						!
					</p>
					<div className="space-y-1.5">
						<h3 className="font-display text-xl font-bold text-foreground">
							Could not load shortlist
						</h3>
						<p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
					</div>
					<Button onClick={() => void namesQuery.refetch()} variant="outline" size="small">
						Try Again
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full flex flex-col">
			{availableNames.length > 0 && (
				<>
					{/* Header Controls Bar */}
					<div className="flex items-center justify-between gap-3 px-1 py-1.5 sm:px-2 mb-2">
						<div className="flex items-center gap-2">
							<h2 className="font-display text-sm sm:text-base font-bold tracking-tight text-foreground">
								Choose Contenders
							</h2>
							<span className="text-xs text-muted-foreground font-medium">
								({storeSelectedNames.length} selected)
							</span>
						</div>

						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="small"
								className="h-8 text-xs px-3"
								onClick={() => {
									hapticNavTap();
									tournamentActions.setSelection(
										storeSelectedNames.length > 0 ? [] : availableNames.slice(0, 8),
									);
								}}
							>
								<RotateCcw className="size-3.5 mr-1.5" />
								{storeSelectedNames.length > 0 ? "Clear" : "Select Top 8"}
							</Button>
							<Button
								type="button"
								variant="primary"
								size="small"
								className="h-8 text-xs px-3.5"
								onClick={handleStartTournament}
								disabled={storeSelectedNames.length < 2}
							>
								<Play className="size-3.5 mr-1.5 fill-current" />
								Start Tournament
							</Button>
						</div>
					</div>

					{/* Drift Wall Canvas - unboxed, expansive, centered */}
					<div className="relative min-h-[540px] h-[clamp(540px,72vh,820px)] w-full overflow-hidden">
						<DriftWall
							items={driftWallItems}
							columns={6}
							tileWidth={156}
							tileHeight={156}
							gap={24}
							radius={9999}
							tilt={0}
							turn={0}
							roll={0}
							perspective={1200}
							depth={140}
							speed={26}
							direction="up"
							variance={0.45}
							parallax={0.6}
							lift={36}
							fade={0}
							dim={0.96}
							pauseOnHover={true}
							grayscale={false}
							className="w-full h-full"
						/>
					</div>
				</>
			)}
		</div>
	);
});
