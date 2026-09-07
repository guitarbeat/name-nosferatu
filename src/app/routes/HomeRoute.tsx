import { RotateCcw, Trophy } from "lucide-react";
import { Suspense, useCallback, useEffect } from "react";
import { Dashboard as DashboardLazy } from "@/features/dashboard/Dashboard";
import { TournamentSetup } from "@/features/tournament/TournamentSetup";
import { Button, ErrorBoundary, Loading } from "@/shared/components/LayoutBlocks";
import { SectionHeading } from "@/shared/components/UIBlocks";
import { useSectionScroll } from "@/shared/hooks";
import useAppStore, { errorContexts } from "@/store";

export default function HomeRoute() {
	const user = useAppStore((s) => s.user);
	const tournament = useAppStore((s) => s.tournament);
	const tournamentActions = useAppStore((s) => s.tournamentActions);
	const { scrollToSection, scheduleSectionScroll, clearPendingScroll } = useSectionScroll();

	useEffect(() => {
		const handleTabChange = (e: Event) => {
			const customEvent = e as CustomEvent<string>;
			if (customEvent.detail) {
				scrollToSection(customEvent.detail);
			}
		};
		window.addEventListener("nav-tab-change", handleTabChange);
		return () => window.removeEventListener("nav-tab-change", handleTabChange);
	}, [scrollToSection]);

	const handleStartNewTournament = useCallback(() => {
		clearPendingScroll();
		tournamentActions.resetTournament();
		scheduleSectionScroll("pick");
	}, [clearPendingScroll, tournamentActions, scheduleSectionScroll]);

	useEffect(() => clearPendingScroll, [clearPendingScroll]);

	const hasActiveInProgressTournament = Boolean(
		tournament.names && tournament.names.length >= 2 && !tournament.isComplete,
	);

	return (
		<div className="w-full flex flex-col items-center">
			<div
				id="app-flow"
				className="w-full flex flex-col items-center gap-10 sm:gap-14 py-4 sm:py-6 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto"
			>
				{/* 1. Pick Contenders / Tournament Arena */}
				<section id="pick" className="w-full scroll-mt-20 sm:scroll-mt-24">
					<div id="tournament" className="scroll-mt-20 sm:scroll-mt-24" />
					<div id="contenders" className="scroll-mt-20 sm:scroll-mt-24" />
					{hasActiveInProgressTournament && (
						<div className="mx-auto mb-6 flex w-full max-w-4xl flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border/70 bg-card/80 p-3.5 sm:p-4 shadow-sm">
							<div className="flex items-center gap-3 text-left w-full sm:w-auto">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
									<Trophy size={18} />
								</div>
								<div>
									<h4 className="text-sm font-semibold text-foreground">Tournament in Progress</h4>
									<p className="text-xs text-muted-foreground">
										{tournament.names?.length} contenders seeded
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
								<Button
									variant="ghost"
									size="small"
									onClick={handleStartNewTournament}
									className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1.5"
								>
									<RotateCcw size={13} />
									Start Fresh
								</Button>
							</div>
						</div>
					)}
					<div className="w-full min-h-[480px] flex flex-col flex-1">
						<Suspense fallback={<Loading variant="skeleton" height={400} />}>
							<TournamentSetup />
						</Suspense>
					</div>
				</section>

				{/* 2. Results & Leaderboards */}
				<section
					id="analysis"
					className="w-full scroll-mt-20 sm:scroll-mt-24 pt-8 border-t border-border/20"
				>
					<div id="results" className="scroll-mt-20 sm:scroll-mt-24" />
					<div id="stats" className="scroll-mt-20 sm:scroll-mt-24" />
					<SectionHeading
						id="section-heading-analysis"
						title="Results & Leaderboards"
						subtitle="See how all the contenders ranked across tournaments."
					/>
					<div className="w-full mt-4 sm:mt-6">
						<Suspense fallback={<Loading variant="skeleton" height={600} />}>
							<ErrorBoundary context={errorContexts.analysisDashboard}>
								<DashboardLazy
									personalRatings={tournament.ratings}
									currentTournamentNames={tournament.names ?? undefined}
									onStartNew={handleStartNewTournament}
									onUpdateRatings={tournamentActions.setRatings}
									userName={user.name ?? ""}
									isAdmin={user.isAdmin}
									isLoggedIn={user.isLoggedIn}
									avatarUrl={user.avatarUrl}
								/>
							</ErrorBoundary>
						</Suspense>
					</div>
				</section>
			</div>
		</div>
	);
}
