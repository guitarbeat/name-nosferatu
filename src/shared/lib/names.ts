import type { IdType, NameItem, RatingData, RatingInput } from "@/shared/types";

/**
 * Default sample names used as fallback when database is empty or offline.
 */
export const DEFAULT_SAMPLE_NAMES: NameItem[] = [
	{ id: "1", name: "Nosferatu", description: "The immortal feline count with shadowy charm" },
	{ id: "2", name: "Luna", description: "Graceful and mysterious moonlit tabby" },
	{
		id: "3",
		name: "Miso",
		description: "Sweet and playful companion who purrs like an engine",
	},
	{ id: "4", name: "Pixel", description: "Tech-savvy, energetic, and clever troublemaker" },
	{ id: "5", name: "Saffron", description: "Warm and spicy personality with golden fur" },
	{ id: "6", name: "Noodle", description: "Long, stretchy acrobatic champion" },
	{ id: "7", name: "Ziggy", description: "Bold and energetic fearless explorer" },
	{ id: "8", name: "Whiskers", description: "Classic, timeless, and distinguished gentlegato" },
	{ id: "9", name: "Pepper", description: "Small but mighty whirlwind of energy" },
	{
		id: "10",
		name: "Shadow",
		description: "Silent stalker of dust motes and midnight zoomies",
	},
	{ id: "11", name: "Milo", description: "Friendly adventurer with curious streak" },
	{ id: "12", name: "Barnaby", description: "Dignified floof with a heart of gold" },
];

/**
 * Normalizes a record of ratings (raw numbers or RatingData) to standard RatingData.
 */
export function normalizeRatingsWithStats(
	ratings: Record<string, RatingInput | undefined> | null | undefined,
): Record<string, RatingData> {
	if (!ratings) {
		return {};
	}
	const result: Record<string, RatingData> = {};
	for (const id of Object.keys(ratings)) {
		const entry = ratings[id];
		if (entry == null) {
			continue;
		}
		if (typeof entry === "number") {
			result[id] = { rating: entry, wins: 0, losses: 0 };
		} else {
			result[id] = {
				rating: typeof entry.rating === "number" ? entry.rating : 1500,
				wins: typeof entry.wins === "number" ? entry.wins : 0,
				losses: typeof entry.losses === "number" ? entry.losses : 0,
			};
		}
	}
	return result;
}

/**
 * Safely looks up the rating data for a name by id, stringified id, or name.
 */
export function getRatingForName(
	ratings: Record<string, RatingData | undefined> | null | undefined,
	name: NameItem | { id?: IdType | number; name?: string } | null | undefined,
): RatingData | undefined {
	if (!ratings || !name) {
		return undefined;
	}
	const id = name.id == null ? undefined : String(name.id);
	const nameKey = name.name;
	if (id && ratings[id]) {
		return ratings[id];
	}
	if (nameKey && ratings[nameKey]) {
		return ratings[nameKey];
	}
	return undefined;
}

/** Raw row shape — accepts both snake_case and camelCase fields. */

/**
 * Maps a raw database row (snake_case or camelCase) to a canonical NameItem.
 * Single source of truth — all name-fetching code should use this.
 */

/**
 * Checks if a name item is hidden.
 */
export function isNameHidden(name: NameItem | null | undefined): boolean {
	return name?.is_hidden === true || name?.isHidden === true;
}

/**
 * Checks if a name item is locked in.
 */
export function isNameLocked(name: NameItem | null | undefined): boolean {
	return name?.locked_in === true || name?.lockedIn === true;
}

/**
 * Checks if a name item is active (neither hidden nor locked).
 */

/**
 * Filters a list of names to only those that are not hidden.
 */
// ⚡ Bolt Performance Optimization: Single-pass loop for name filtering
export function getVisibleNames(names: NameItem[] | null | undefined): NameItem[] {
	if (!Array.isArray(names)) {
		return [];
	}
	const len = names.length;
	const result: NameItem[] = [];
	for (let i = 0; i < len; i++) {
		const name = names[i];
		if (!isNameHidden(name)) {
			result.push(name);
		}
	}
	return result;
}

/**
 * Filters a list of names to only those that are active (neither hidden nor locked).
 */
export function getActiveNames(names: NameItem[] | null | undefined): NameItem[] {
	if (!Array.isArray(names)) {
		return [];
	}
	const len = names.length;
	const result: NameItem[] = [];
	for (let i = 0; i < len; i++) {
		const name = names[i];
		if (isNameActive(name)) {
			result.push(name);
		}
	}
	return result;
}

/**
 * Filters a list of names to only those that are hidden.
 */
export function getHiddenNames(names: NameItem[] | null | undefined): NameItem[] {
	if (!Array.isArray(names)) {
		return [];
	}
	const len = names.length;
	const result: NameItem[] = [];
	for (let i = 0; i < len; i++) {
		const name = names[i];
		if (isNameHidden(name)) {
			result.push(name);
		}
	}
	return result;
}

/**
 * Filters a list of names to only those that are locked in.
 */
export function getLockedNames(names: NameItem[] | null | undefined): NameItem[] {
	if (!Array.isArray(names)) {
		return [];
	}
	const len = names.length;
	const result: NameItem[] = [];
	for (let i = 0; i < len; i++) {
		const name = names[i];
		if (isNameLocked(name)) {
			result.push(name);
		}
	}
	return result;
}

/**
 * Checks if a name matches a search term (by name or description).
 */
export function matchesNameSearchTerm(
	name: NameItem | null | undefined,
	searchTerm: string,
): boolean {
	const normalizedTerm = searchTerm.trim().toLowerCase();
	if (!normalizedTerm) {
		return true;
	}

	if (!name) {
		return false;
	}

	return (
		name.name.toLowerCase().includes(normalizedTerm) ||
		(name.description ?? "").toLowerCase().includes(normalizedTerm)
	);
}
function isNameActive(name: NameItem): boolean {
	return !name.is_hidden && !name.locked_in;
}
