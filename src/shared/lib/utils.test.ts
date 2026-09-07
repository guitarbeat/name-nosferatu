import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SAMPLE_NAMES, getRatingForName, normalizeRatingsWithStats } from "./names";
import {
	addManyToSet,
	addToSet,
	cn,
	createSortedKey,
	handleImgError,
	hapticNavTap,
	hapticTournamentStart,
	hapticVoteTap,
	removeFromSet,
	shuffleArray,
	toggleInSet,
} from "./utils";

describe("shared utils", () => {
	describe("handleImgError", () => {
		it("replaces broken img src with fallback SVG", () => {
			const mockImg = { src: "broken.jpg" } as HTMLImageElement;
			const mockEvent = { currentTarget: mockImg } as unknown as React.SyntheticEvent<
				HTMLImageElement,
				Event
			>;
			handleImgError(mockEvent);
			expect(mockImg.src).toContain("data:image/svg+xml");
		});
	});

	describe("ratings and names helpers", () => {
		it("normalizes ratings from mixed inputs", () => {
			const normalized = normalizeRatingsWithStats({
				cat1: 1600,
				cat2: { rating: 1550, wins: 3, losses: 1 },
			});
			expect(normalized.cat1).toEqual({ rating: 1600, wins: 0, losses: 0 });
			expect(normalized.cat2).toEqual({ rating: 1550, wins: 3, losses: 1 });
		});

		it("gets rating for name by id or name string", () => {
			const ratings = {
				"1": { rating: 1600, wins: 2, losses: 0 },
				Luna: { rating: 1500, wins: 1, losses: 1 },
			};
			expect(getRatingForName(ratings, { id: "1", name: "Nosferatu" })).toEqual({
				rating: 1600,
				wins: 2,
				losses: 0,
			});
			expect(getRatingForName(ratings, { id: "99", name: "Luna" })).toEqual({
				rating: 1500,
				wins: 1,
				losses: 1,
			});
		});

		it("exports default sample names array", () => {
			expect(DEFAULT_SAMPLE_NAMES.length).toBeGreaterThan(0);
			expect(DEFAULT_SAMPLE_NAMES[0].name).toBe("Nosferatu");
		});
	});

	describe("cn", () => {
		it("merges class names and handles conditionals", () => {
			expect(cn("bg-red-500", true && "text-white", false && "hidden")).toBe(
				"bg-red-500 text-white",
			);
		});

		it("resolves tailwind conflicts correctly", () => {
			expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
		});
	});

	describe("createSortedKey", () => {
		it("sorts array of keys consistently", () => {
			expect(createSortedKey(["b", "c", "a"])).toBe("a,b,c");
		});
	});

	describe("shuffleArray", () => {
		it("preserves array elements without mutating original", () => {
			const original = ["1", "2", "3", "4", "5"];
			const shuffled = shuffleArray(original);
			expect(shuffled).toHaveLength(original.length);
			expect([...shuffled].sort()).toEqual([...original].sort());
		});
	});

	describe("Set utilities", () => {
		it("addToSet immutably adds values", () => {
			const initial = new Set(["a", "b"]);
			const next = addToSet(initial, "c");
			expect(next.has("c")).toBe(true);
			expect(initial.has("c")).toBe(false);
		});

		it("addManyToSet immutably adds multiple values", () => {
			const initial = new Set(["a"]);
			const next = addManyToSet(initial, ["b", "c"]);
			expect(next.size).toBe(3);
			expect(initial.size).toBe(1);
		});

		it("removeFromSet immutably deletes values", () => {
			const initial = new Set(["a", "b"]);
			const next = removeFromSet(initial, "a");
			expect(next.has("a")).toBe(false);
			expect(initial.has("a")).toBe(true);
		});

		it("toggleInSet toggles presence of values", () => {
			const initial = new Set(["a"]);
			const withB = toggleInSet(initial, "b");
			expect(withB.has("b")).toBe(true);
			const withoutB = toggleInSet(withB, "b");
			expect(withoutB.has("b")).toBe(false);
		});
	});

	describe("Haptic & Vibration utilities", () => {
		it("hapticVoteTap calls navigator.vibrate with subtle default duration", () => {
			const mockVibrate = vi.fn().mockReturnValue(true);
			vi.stubGlobal("navigator", { vibrate: mockVibrate });

			const result = hapticVoteTap();
			expect(mockVibrate).toHaveBeenCalledWith(15);
			expect(result).toBe(true);

			vi.unstubAllGlobals();
		});

		it("hapticVoteTap supports custom duration", () => {
			const mockVibrate = vi.fn().mockReturnValue(true);
			vi.stubGlobal("navigator", { vibrate: mockVibrate });

			const result = hapticVoteTap(20);
			expect(mockVibrate).toHaveBeenCalledWith(20);
			expect(result).toBe(true);

			vi.unstubAllGlobals();
		});

		it("hapticVoteTap handles errors gracefully without throwing", () => {
			const mockVibrate = vi.fn().mockImplementation(() => {
				throw new Error("SecurityError: vibrate not allowed");
			});
			vi.stubGlobal("navigator", { vibrate: mockVibrate });

			expect(() => hapticVoteTap()).not.toThrow();
			expect(hapticVoteTap()).toBe(false);

			vi.unstubAllGlobals();
		});

		it("hapticNavTap calls navigator.vibrate with navigation pattern", () => {
			const mockVibrate = vi.fn();
			vi.stubGlobal("navigator", { vibrate: mockVibrate });

			hapticNavTap();
			expect(mockVibrate).toHaveBeenCalledWith(10);

			vi.unstubAllGlobals();
		});

		it("hapticTournamentStart calls navigator.vibrate with start pattern", () => {
			const mockVibrate = vi.fn();
			vi.stubGlobal("navigator", { vibrate: mockVibrate });

			hapticTournamentStart();
			expect(mockVibrate).toHaveBeenCalledWith([50, 50, 50]);

			vi.unstubAllGlobals();
		});
	});
});
