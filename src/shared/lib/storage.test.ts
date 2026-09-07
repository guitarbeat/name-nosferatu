import { describe, expect, it } from "vitest";
import {
	decryptValue,
	getStorageString,
	readStorageJson,
	removeStorageItem,
	setStorageString,
	writeStorageJson,
} from "./storage";

describe("storage utility", () => {
	it("encrypts and decrypts strings correctly", () => {
		const testKey = "test_string_key";
		const testValue = "hello_world_123";

		const success = setStorageString(testKey, testValue);
		expect(success).toBe(true);

		const retrieved = getStorageString(testKey);
		expect(retrieved).toBe(testValue);

		removeStorageItem(testKey);
		expect(getStorageString(testKey)).toBeNull();
	});

	it("handles JSON objects read and write", () => {
		const testKey = "test_json_key";
		const testValue = { name: "Vlad", score: 100 };

		const success = writeStorageJson(testKey, testValue);
		expect(success).toBe(true);

		const retrieved = readStorageJson(testKey, null);
		expect(retrieved).toEqual(testValue);

		removeStorageItem(testKey);
	});

	it("decrypts value with decryptValue helper", () => {
		expect(decryptValue(null)).toBe("");
		expect(decryptValue("plain_text")).toBe("plain_text");
	});
});
