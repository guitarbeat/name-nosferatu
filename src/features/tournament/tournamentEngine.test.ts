import { describe, expect, it } from "vitest";
import {
	calculateTournamentMetrics,
	deriveBracketState,
	EloRating,
	generateRandomTeams,
	getHeatCardClasses,
	getHeatGradientClasses,
	getHeatLevel,
	getHeatTextClasses,
	resolveTournamentMode,
} from "./tournamentEngine";

describe("tournamentEngine", () => {
	describe("EloRating", () => {
		it("calculates expected score correctly for equal ratings", () => {
			const elo = new EloRating();
			const expected = elo.getExpectedScore(1200, 1200);
			expect(expected).toBeCloseTo(0.5, 2);
		});

		it("calculates new ratings when left wins", () => {
			const elo = new EloRating();
			const result = elo.calculateNewRatings(1200, 1200, "left");
			expect(result.newRatingA).toBeGreaterThan(1200);
			expect(result.newRatingB).toBeLessThan(1200);
			expect(result.winsA).toBe(1);
			expect(result.lossesB).toBe(1);
		});
	});

	describe("resolveTournamentMode", () => {
		it("returns 2v2 when count is divisible by 4 (>=4)", () => {
			expect(resolveTournamentMode(4)).toBe("2v2");
			expect(resolveTournamentMode(8)).toBe("2v2");
			expect(resolveTournamentMode(16)).toBe("2v2");
		});

		it("returns 1v1 when count is not divisible by 4", () => {
			expect(resolveTournamentMode(2)).toBe("1v1");
			expect(resolveTournamentMode(3)).toBe("1v1");
			expect(resolveTournamentMode(5)).toBe("1v1");
			expect(resolveTournamentMode(6)).toBe("1v1");
		});
	});

	describe("generateRandomTeams", () => {
		it("pairs items into teams of 2", () => {
			const items = [
				{ id: "1", name: "Cat A" },
				{ id: "2", name: "Cat B" },
				{ id: "3", name: "Cat C" },
				{ id: "4", name: "Cat D" },
			];
			const teams = generateRandomTeams(items);
			expect(teams).toHaveLength(2);
			expect(teams[0]?.memberIds).toHaveLength(2);
			expect(teams[1]?.memberIds).toHaveLength(2);
		});
	});

	describe("deriveBracketState and calculateTournamentMetrics", () => {
		it("derives bracket state for 4 entrants", () => {
			const entrants = ["cat-1", "cat-2", "cat-3", "cat-4"];
			const derived = deriveBracketState(entrants, []);
			expect(derived.isComplete).toBe(false);
			expect(derived.pendingMatchIds).toEqual({
				leftId: "cat-1",
				rightId: "cat-2",
			});

			const metrics = calculateTournamentMetrics({ derived });
			expect(metrics.totalMatches).toBe(3);
			expect(metrics.matchNumber).toBe(1);
			expect(metrics.progress).toBe(0);
		});
	});

	describe("heat visual helpers", () => {
		it("returns correct heat level based on streak", () => {
			expect(getHeatLevel(0)).toBeNull();
			expect(getHeatLevel(2)).toBeNull();
			expect(getHeatLevel(3)).toBe("warm");
			expect(getHeatLevel(4)).toBe("warm");
			expect(getHeatLevel(5)).toBe("hot");
			expect(getHeatLevel(6)).toBe("hot");
			expect(getHeatLevel(7)).toBe("blazing");
			expect(getHeatLevel(10)).toBe("blazing");
		});

		it("returns correct card classes for heat levels", () => {
			expect(getHeatCardClasses(null)).toBe("");
			expect(getHeatCardClasses("warm")).toBe("ring-1 ring-orange-400/50 shadow-sm");
			expect(getHeatCardClasses("hot")).toBe("ring-2 ring-amber-500/70 shadow-md");
			expect(getHeatCardClasses("blazing")).toBe("ring-2 ring-orange-500/80 shadow-lg");
		});

		it("returns correct text classes for heat levels", () => {
			expect(getHeatTextClasses("warm")).toBe(
				"text-orange-100 border-orange-300/35 bg-orange-500/10",
			);
			expect(getHeatTextClasses("hot")).toBe("text-amber-200 border-amber-300/45 bg-amber-500/15");
			expect(getHeatTextClasses("blazing")).toBe(
				"text-orange-200 border-orange-300/45 bg-orange-500/15",
			);
		});

		it("returns gradient classes for heat levels", () => {
			expect(getHeatGradientClasses("warm")).toBe(
				"bg-gradient-to-t from-orange-500/20 via-amber-200/10 to-transparent",
			);
			expect(getHeatGradientClasses("hot")).toBe(
				"bg-gradient-to-t from-orange-500/35 via-amber-300/20 to-transparent",
			);
			expect(getHeatGradientClasses("blazing")).toBe(
				"bg-gradient-to-t from-orange-500/45 via-amber-400/25 to-transparent",
			);
		});

		it("returns default classes for invalid/unknown inputs", () => {
			// @ts-expect-error Testing fallback behavior for invalid heat level input
			expect(getHeatGradientClasses("unknown")).toBe(
				"bg-gradient-to-t from-orange-500/20 via-amber-200/10 to-transparent",
			);
		});
	});
});
