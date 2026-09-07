import { describe, expect, it, vi } from "vitest";
import { logger } from "./storage";
import {
	addManyToSet,
	addToSet,
	cn,
	createSortedKey,
	hapticNavTap,
	hapticTournamentStart,
	hapticVoteTap,
	removeFromSet,
	shuffleArray,
	toggleInSet,
} from "./utils";

describe("shared utils", () => {
	describe("logger", () => {
		it("logs error, warn, info, debug in dev mode", () => {
			const spyError = vi.spyOn(console, "error").mockImplementation(() => {});
			const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
			const spyDebug = vi.spyOn(console, "debug").mockImplementation(() => {});

			logger.error("test error", { details: 123 });
			logger.warn("test warn");
			logger.info("test info");
			logger.debug("test debug");

			expect(spyError).toHaveBeenCalledWith("test error", { details: 123 });
			expect(spyWarn).toHaveBeenCalledWith("test warn");
			expect(spyLog).toHaveBeenCalledWith("test info");
			expect(spyDebug).toHaveBeenCalledWith("test debug");

			spyError.mockRestore();
			spyWarn.mockRestore();
			spyLog.mockRestore();
			spyDebug.mockRestore();
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
