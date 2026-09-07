import CryptoJS from "crypto-js";
import { describe, expect, it } from "vitest";
import {
	decryptValue,
	getStorageString,
	readStorageJson,
	setStorageString,
	writeStorageJson,
} from "./storage";

describe("storage", () => {
	it("encrypts and decrypts strings correctly", () => {
		const key = "test_key";
		const val = "hello_world_secret";
		setStorageString(key, val);
		const decrypted = getStorageString(key);
		expect(decrypted).toBe(val);
	});

	it("prepends a random IV in hex format when encrypting", () => {
		const key = "test_iv_key";
		const val = "test_iv_value";
		setStorageString(key, val);

		// Read raw encrypted value from localStorage
		const rawEncrypted = window.localStorage.getItem(key);
		expect(rawEncrypted).toBeDefined();
		expect(rawEncrypted).toContain(":");

		if (!rawEncrypted) {
			throw new Error("rawEncrypted should be defined");
		}
		const [ivHex, ciphertext] = rawEncrypted.split(":");
		expect(ivHex).toHaveLength(32); // 16 bytes = 32 hex chars
		expect(ciphertext.length).toBeGreaterThan(0);

		// Decrypt raw string via decryptValue
		const decrypted = decryptValue(rawEncrypted);
		expect(decrypted).toBe(val);
	});

	it("handles JSON read/write operations properly", () => {
		const key = "test_json_key";
		const data = { foo: "bar", num: 42 };
		writeStorageJson(key, data);
		const readData = readStorageJson(key, null);
		expect(readData).toEqual(data);
	});

	it("decrypts legacy ciphertexts created with the legacy static IV fallback", () => {
		const legacySecretKey = "nosferatu-secure-storage-key-1337";
		const legacyKeyHex = CryptoJS.enc.Utf8.parse(legacySecretKey.padEnd(32, "0").substring(0, 32));
		const legacyIv = CryptoJS.enc.Utf8.parse("nosferatu-iv-123".padEnd(16, "0"));

		const legacyPlainText = "legacy_secret_data_123";
		const legacyCiphertext = CryptoJS.AES.encrypt(legacyPlainText, legacyKeyHex, {
			iv: legacyIv,
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,
		}).toString();

		const decrypted = decryptValue(legacyCiphertext);
		expect(decrypted).toBe(legacyPlainText);
	});
});
