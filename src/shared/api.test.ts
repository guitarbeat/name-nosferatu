import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	addName,
	batchUpdateLocked,
	batchUpdateVisibility,
	DEFAULT_CANDIDATE_NAMES,
	fetchNames,
	leaderboardAPI,
	namesQueryKeys,
	namesQueryOptions,
	ratingsAPI,
	SUPABASE_UNAVAILABLE_MSG,
	softDeleteName,
	statsAPI,
	toggleNameHidden,
	toggleNameLocked,
	unhideAllNames,
} from "./api";

describe("shared/api", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	describe("Constants & Query Keys", () => {
		it("exports SUPABASE_UNAVAILABLE_MSG constant", () => {
			expect(SUPABASE_UNAVAILABLE_MSG).toBe("Database is unavailable. Running in local mode.");
		});

		it("generates correct query keys and options", () => {
			expect(namesQueryKeys.all).toEqual(["names"]);
			expect(namesQueryKeys.lists()).toEqual(["names", "list"]);
			expect(namesQueryKeys.list(true)).toEqual(["names", "list", { includeHidden: true }]);
			expect(namesQueryKeys.list(false)).toEqual(["names", "list", { includeHidden: false }]);

			const options = namesQueryOptions(true);
			expect(options.queryKey).toEqual(["names", "list", { includeHidden: true }]);
			expect(options.staleTime).toBe(30_000);
		});
	});

	describe("Names API & LocalStorage Handling", () => {
		it("fetchNames returns default candidate names when localStorage is empty", async () => {
			const result = await fetchNames(false);
			expect(result.source).toBe("local");
			expect(result.names.length).toBe(DEFAULT_CANDIDATE_NAMES.length);
		});

		it("fetchNames filters hidden names when includeHidden is false", async () => {
			const testNames = [
				{ ...DEFAULT_CANDIDATE_NAMES[0], isHidden: false, is_hidden: false },
				{ ...DEFAULT_CANDIDATE_NAMES[1], id: "hidden-1", isHidden: true, is_hidden: true },
			];
			localStorage.setItem("nosferatu-candidates", JSON.stringify(testNames));

			const result = await fetchNames(false);
			expect(result.names.length).toBe(1);
			expect(result.names[0].id).toBe(DEFAULT_CANDIDATE_NAMES[0].id);

			const allResult = await fetchNames(true);
			expect(allResult.names.length).toBe(2);
		});

		it("handles invalid JSON in localStorage gracefully with default fallback", async () => {
			localStorage.setItem("nosferatu-candidates", "invalid-json-{");
			const result = await fetchNames(true);
			expect(result.names).toEqual(DEFAULT_CANDIDATE_NAMES);
		});

		it("addName adds a new candidate name to storage", async () => {
			const newCandidate = await addName({
				name: " Whiskers II ",
				description: "  The sequel  ",
			});

			expect(newCandidate.name).toBe("Whiskers II");
			expect(newCandidate.description).toBe("The sequel");
			expect(newCandidate.status).toBe("candidate");
			expect(newCandidate.avgRating).toBe(1500);

			const fetched = await fetchNames(true);
			expect(fetched.names[0].id).toBe(newCandidate.id);
			expect(fetched.names[0].name).toBe("Whiskers II");
		});

		it("addName uses fallback description when none is provided", async () => {
			const newCandidate = await addName({ name: "Felix" });
			expect(newCandidate.description).toBe("Community suggested cat name");
		});

		it("softDeleteName removes item from storage", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			const initialCount = DEFAULT_CANDIDATE_NAMES.length;
			const targetId = DEFAULT_CANDIDATE_NAMES[0].id;

			await softDeleteName({ nameId: targetId });

			const updated = await fetchNames(true);
			expect(updated.names.find((n) => n.id === targetId)).toBeUndefined();
			expect(updated.names.length).toBe(initialCount - 1);
		});

		it("toggleNameHidden toggles hidden and active status", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			const targetId = DEFAULT_CANDIDATE_NAMES[0].id;

			await toggleNameHidden({ nameId: targetId, isCurrentlyHidden: false });

			let updated = await fetchNames(true);
			let target = updated.names.find((n) => n.id === targetId);
			expect(target?.isHidden).toBe(true);
			expect(target?.isActive).toBe(false);

			await toggleNameHidden({ nameId: targetId, isCurrentlyHidden: true });

			updated = await fetchNames(true);
			target = updated.names.find((n) => n.id === targetId);
			expect(target?.isHidden).toBe(false);
			expect(target?.isActive).toBe(true);
		});

		it("toggleNameLocked toggles lockedIn status", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			const targetId = DEFAULT_CANDIDATE_NAMES[0].id;

			await toggleNameLocked({ nameId: targetId, isCurrentlyLocked: false });

			let updated = await fetchNames(true);
			let target = updated.names.find((n) => n.id === targetId);
			expect(target?.lockedIn).toBe(true);

			await toggleNameLocked({ nameId: targetId, isCurrentlyLocked: true });

			updated = await fetchNames(true);
			target = updated.names.find((n) => n.id === targetId);
			expect(target?.lockedIn).toBe(false);
		});

		it("unhideAllNames resets all names to visible and active", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			await toggleNameHidden({ nameId: "1", isCurrentlyHidden: false });
			await toggleNameHidden({ nameId: "2", isCurrentlyHidden: false });

			await unhideAllNames();

			const updated = await fetchNames(true);
			for (const name of updated.names) {
				expect(name.isHidden).toBe(false);
				expect(name.isActive).toBe(true);
			}
		});

		it("batchUpdateVisibility updates visibility for specified IDs", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			await batchUpdateVisibility({ nameIds: ["1", "2"], isHidden: true });

			const updated = await fetchNames(true);
			const item1 = updated.names.find((n) => n.id === "1");
			const item2 = updated.names.find((n) => n.id === "2");
			const item3 = updated.names.find((n) => n.id === "3");

			expect(item1?.isHidden).toBe(true);
			expect(item2?.isHidden).toBe(true);
			expect(item3?.isHidden).toBe(false);
		});

		it("batchUpdateLocked updates locked status for specified IDs", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			await batchUpdateLocked({ nameIds: ["3", "4"], isLocked: true });

			const updated = await fetchNames(true);
			const item3 = updated.names.find((n) => n.id === "3");
			const item4 = updated.names.find((n) => n.id === "4");
			const item5 = updated.names.find((n) => n.id === "5");

			expect(item3?.lockedIn).toBe(true);
			expect(item4?.lockedIn).toBe(true);
			expect(item5?.lockedIn).toBe(false);
		});

		it("handles localStorage write exceptions gracefully", async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
				throw new Error("QuotaExceededError");
			});

			await addName({ name: "Error Cat" });
			expect(warnSpy).toHaveBeenCalledWith("Failed to persist candidates:", expect.any(Error));
		});
	});

	describe("Ratings, Leaderboard & Stats API", () => {
		it("ratingsAPI.applyTournamentMatch resolves without error", async () => {
			await expect(ratingsAPI.applyTournamentMatch({})).resolves.toBeUndefined();
		});

		it("ratingsAPI.saveRatings updates candidate ratings in localStorage", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			const userId = "user123";
			const ratings = {
				"1": { rating: 1700, wins: 2, losses: 0 },
			};

			await ratingsAPI.saveRatings(userId, ratings);

			const savedUserRatings = localStorage.getItem(`nosferatu-ratings-${userId}`);
			expect(savedUserRatings).toBeTruthy();

			const updated = await fetchNames(true);
			const item1 = updated.names.find((n) => n.id === "1");
			expect(item1?.avgRating).toBe(1700);
			expect(item1?.wins).toBe(16); // 14 + 2
		});

		it("leaderboardAPI.getLeaderboard returns sorted top visible names", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			const leaderboard = await leaderboardAPI.getLeaderboard(3);
			expect(leaderboard.length).toBe(3);
			expect(leaderboard[0].score).toBeGreaterThanOrEqual(leaderboard[1].score);
			expect(leaderboard[1].score).toBeGreaterThanOrEqual(leaderboard[2].score);
		});

		it("statsAPI methods return expected mock statistics", async () => {
			localStorage.setItem("nosferatu-candidates", JSON.stringify(DEFAULT_CANDIDATE_NAMES));
			const metrics = await statsAPI.getEngagementMetrics("7d");
			expect(metrics?.current).toBe(842);
			expect(metrics?.trendDirection).toBe("up");

			const siteStats = await statsAPI.getSiteStats();
			expect(siteStats?.totalNames).toBeGreaterThan(0);

			const userStats = await statsAPI.getUserStats("testUser");
			expect(userStats?.rank).toBe(1);
		});
	});
});
