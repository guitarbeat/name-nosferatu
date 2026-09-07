import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

describe("Shared Logger Utility", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("logs errors in dev mode", () => {
		vi.stubEnv("DEV", true);
		logger.error("test error", { details: 123 });
		expect(console.error).toHaveBeenCalledWith("test error", { details: 123 });
		vi.unstubAllEnvs();
	});

	it("logs warnings in dev mode", () => {
		vi.stubEnv("DEV", true);
		logger.warn("test warn");
		expect(console.warn).toHaveBeenCalledWith("test warn");
		vi.unstubAllEnvs();
	});

	it("logs info in dev mode", () => {
		vi.stubEnv("DEV", true);
		logger.info("test info");
		expect(console.info).toHaveBeenCalledWith("test info");
		vi.unstubAllEnvs();
	});

	it("logs debug in dev mode", () => {
		vi.stubEnv("DEV", true);
		logger.debug("test debug");
		expect(console.debug).toHaveBeenCalledWith("test debug");
		vi.unstubAllEnvs();
	});

	it("suppresses logs when not in dev mode", () => {
		vi.stubEnv("DEV", false);
		logger.error("test error");
		logger.warn("test warn");
		logger.info("test info");
		logger.debug("test debug");
		expect(console.error).not.toHaveBeenCalled();
		expect(console.warn).not.toHaveBeenCalled();
		expect(console.info).not.toHaveBeenCalled();
		expect(console.debug).not.toHaveBeenCalled();
		vi.unstubAllEnvs();
	});
});
