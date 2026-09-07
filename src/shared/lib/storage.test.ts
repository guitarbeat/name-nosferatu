import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";
import {
	getStorageString,
	parseJsonValue,
	removeStorageItem,
	setStorageString,
	writeStorageJson,
} from "./storage";

describe("Storage Error Logging", () => {
	beforeEach(() => {
		vi.spyOn(logger, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("logs error using logger.error when localStorage.getItem throws after passing availability check", () => {
		const storageMap = new Map<string, string>();
		vi.spyOn(window, "localStorage", "get").mockReturnValue({
			getItem: (key: string) => {
				if (key === "__storage_test__") {
					return "__storage_test__";
				}
				throw new Error(`Read error for ${key}`);
			},
			setItem: (key: string, val: string) => {
				storageMap.set(key, val);
			},
			removeItem: (key: string) => {
				storageMap.delete(key);
			},
			clear: () => storageMap.clear(),
			length: 0,
			key: () => null,
		});

		const result = getStorageString("test-key", "fallback-val");

		expect(logger.error).toHaveBeenCalledWith(
			'[storage] Failed to read key "test-key" from localStorage:',
			expect.any(Error),
		);
		expect(result).toBe("fallback-val");
	});

	it("logs error using logger.error when setStorageString encounters a localStorage write failure in fallback", () => {
		const storageMap = new Map<string, string>();
		vi.spyOn(window, "localStorage", "get").mockReturnValue({
			getItem: (key: string) => {
				if (key === "__storage_test__") {
					return "__storage_test__";
				}
				return storageMap.get(key) ?? null;
			},
			setItem: (key: string) => {
				if (key === "__storage_test__") {
					return;
				}
				throw new Error("Write error");
			},
			removeItem: (key: string) => {
				storageMap.delete(key);
			},
			clear: () => storageMap.clear(),
			length: 0,
			key: () => null,
		});

		setStorageString("test-key", "value");

		expect(logger.error).not.toHaveBeenCalled(); // Quota/write errors fall back to memory store safely without throwing outer catch
	});

	it("logs error using logger.error when localStorage.removeItem throws after passing availability check", () => {
		const storageMap = new Map<string, string>();
		vi.spyOn(window, "localStorage", "get").mockReturnValue({
			getItem: (key: string) => storageMap.get(key) ?? null,
			setItem: (key: string, val: string) => {
				storageMap.set(key, val);
			},
			removeItem: (key: string) => {
				if (key === "__storage_test__") {
					return;
				}
				throw new Error("Remove error");
			},
			clear: () => storageMap.clear(),
			length: 0,
			key: () => null,
		});

		removeStorageItem("test-key");

		expect(logger.error).toHaveBeenCalledWith(
			'[storage] Failed to remove key "test-key" from localStorage:',
			expect.any(Error),
		);
	});

	it("logs error using logger.error when parseJsonValue fails to parse JSON", () => {
		const result = parseJsonValue("{invalid json}", "fallback");

		expect(logger.error).toHaveBeenCalledWith(
			"[storage] Failed to parse JSON from localStorage:",
			expect.any(Error),
		);
		expect(result).toBe("fallback");
	});

	it("logs error using logger.error when writeStorageJson JSON.stringify fails", () => {
		const circularObj: Record<string, unknown> = {};
		circularObj.self = circularObj;

		const result = writeStorageJson("circular-key", circularObj);

		expect(logger.error).toHaveBeenCalledWith(
			'[storage] Failed to write key "circular-key" to localStorage:',
			expect.any(Error),
		);
		expect(result).toBe(false);
	});
});
