import { describe, expect, it } from "vitest";
import type { NameItem } from "@/shared/types";
import {
	getActiveNames,
	getHiddenNames,
	getLockedNames,
	getVisibleNames,
	isNameHidden,
	isNameLocked,
} from "./names";

describe("names helper functions", () => {
	const sampleNames: NameItem[] = [
		{ id: "1", name: "Visible", is_hidden: false, locked_in: false },
		{ id: "2", name: "Hidden", is_hidden: true, locked_in: false },
		{ id: "3", name: "Locked", is_hidden: false, locked_in: true },
		{ id: "4", name: "HiddenAndLocked", is_hidden: true, locked_in: true },
	];

	it("correctly identifies hidden and locked names", () => {
		expect(isNameHidden(sampleNames[0])).toBe(false);
		expect(isNameHidden(sampleNames[1])).toBe(true);
		expect(isNameLocked(sampleNames[2])).toBe(true);
		expect(isNameLocked(sampleNames[0])).toBe(false);
	});

	it("filters visible names correctly with single-pass loop", () => {
		const visible = getVisibleNames(sampleNames);
		expect(visible.map((n) => n.name)).toEqual(["Visible", "Locked"]);
	});

	it("filters active names correctly", () => {
		const active = getActiveNames(sampleNames);
		expect(active.map((n) => n.name)).toEqual(["Visible"]);
	});

	it("filters hidden names correctly", () => {
		const hidden = getHiddenNames(sampleNames);
		expect(hidden.map((n) => n.name)).toEqual(["Hidden", "HiddenAndLocked"]);
	});

	it("filters locked names correctly", () => {
		const locked = getLockedNames(sampleNames);
		expect(locked.map((n) => n.name)).toEqual(["Locked", "HiddenAndLocked"]);
	});

	it("handles null or undefined input gracefully", () => {
		expect(getVisibleNames(null)).toEqual([]);
		expect(getVisibleNames(undefined)).toEqual([]);
		expect(getActiveNames(null)).toEqual([]);
		expect(getHiddenNames(undefined)).toEqual([]);
		expect(getLockedNames(null)).toEqual([]);
	});
});
