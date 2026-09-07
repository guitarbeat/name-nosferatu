import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { ratingsAPI } from "@/shared/api";
import { normalizeRatingsWithStats } from "@/shared/lib/names";
import { fadeMotionPreset } from "@/shared/lib/uiUtils";
import type { RatingData } from "@/shared/types";
import useAppStore from "@/store";
import { NameSelector } from "./NameSelector";
import { TournamentArena } from "./TournamentArena";

export function TournamentSetup() {
	const user = useAppStore((s) => s.user);
	const tournament = useAppStore((s) => s.tournament);
	const tournamentActions = useAppStore((s) => s.tournamentActions);

	const saveRatingsMutation = useMutation({
		mutationFn: ({ userId, ratings }: { userId: string; ratings: Record<string, RatingData> }) =>
			ratingsAPI.saveRatings(userId, ratings),
		onError: (error) => {
			console.error("Tournament ratings save failed — ratings were not persisted", error);
		},
	});

	useEffect(() => {
		if (tournament.isComplete && Object.keys(tournament.ratings).length > 0) {
			const userId = user.id || user.name || "anonymous";
			const ratingsWithStats = normalizeRatingsWithStats(tournament.ratings);
			saveRatingsMutation.mutate({ userId, ratings: ratingsWithStats });
		}
	}, [tournament.isComplete, tournament.ratings, user.id, user.name, saveRatingsMutation.mutate]);

	return (
		<div className="w-full flex flex-col flex-1 min-h-[520px] gap-2">
			<AnimatePresence mode="wait">
				{tournament.names && tournament.names.length >= 2 && !tournament.isComplete ? (
					<motion.div
						key="arena"
						{...fadeMotionPreset}
						className="w-full flex flex-col flex-1 min-h-[520px] py-0"
					>
						<TournamentArena
							names={tournament.names}
							onComplete={(ratings) => {
								tournamentActions.completeTournament(ratings);
							}}
							userName={user.name ?? undefined}
						/>
					</motion.div>
				) : (
					<motion.div
						key="setup"
						{...fadeMotionPreset}
						className="w-full flex flex-col flex-1 min-h-[520px] py-0"
					>
						<NameSelector />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
