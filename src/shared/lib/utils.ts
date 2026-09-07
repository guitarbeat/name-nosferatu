import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { FALLBACK_CAT_IMAGE, FALLBACK_CAT_SVG } from "@/shared/lib/constants";

/**
 * Merges Tailwind CSS classes with clsx logic.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/**
 * Shuffles an array using the Fisher-Yates algorithm.
 */
export function shuffleArray<T>(array: T[]): T[] {
	const next = [...array];
	for (let i = next.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = next[i] as T;
		next[i] = next[j] as T;
		next[j] = temp;
	}
	return next;
}

/**
 * Creates a stable, sorted string key from IDs/values for deduplication and comparison.
 */
export function createSortedKey(
	items: Array<string | number | { id: string | number } | null | undefined>,
): string {
	// ⚡ Bolt Optimization: Replace map/filter/map chain with a single-pass loop
	const validItems: string[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const val = item && typeof item === "object" ? item.id : item;
		if (val) {
			validItems.push(String(val));
		}
	}
	return validItems.sort().join(",");
}

export function addToSet<T>(source: ReadonlySet<T>, value: T): Set<T> {
	const next = new Set(source);
	next.add(value);
	return next;
}

export function addManyToSet<T>(source: ReadonlySet<T>, values: Iterable<T>): Set<T> {
	const next = new Set(source);
	for (const value of values) {
		next.add(value);
	}
	return next;
}

export function removeFromSet<T>(source: ReadonlySet<T>, value: T): Set<T> {
	const next = new Set(source);
	next.delete(value);
	return next;
}

export function toggleInSet<T>(source: ReadonlySet<T>, value: T): Set<T> {
	if (source.has(value)) {
		return removeFromSet(source, value);
	}
	return addToSet(source, value);
}
/**
 * Triggers a light haptic feedback for navigation taps.
 */
export function hapticNavTap(): void {
	if (typeof navigator !== "undefined") {
		navigator.vibrate?.(10);
	}
}

/**
 * Triggers subtle haptic feedback when a user clicks on a cat name during voting.
 * Emits a crisp, subtle 15ms vibration pulse using the Vibration API.
 */
export function hapticVoteTap(durationMs = 15): boolean {
	if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
		try {
			return navigator.vibrate(durationMs);
		} catch {
			// Fail gracefully if Vibration API is blocked in sandbox/iframe or unsupported
			return false;
		}
	}
	return false;
}

/**
 * Triggers a sequence of haptic feedback for tournament starts.
 */
export function hapticTournamentStart(): void {
	if (typeof navigator !== "undefined") {
		navigator.vibrate?.([50, 50, 50]);
	}
}

/**
 * React image onError fallback handler to replace broken images with consistent fallback SVG.
 */
export function handleImgError(
	e: React.SyntheticEvent<HTMLImageElement, Event>,
	fallbackSrc: string = FALLBACK_CAT_SVG,
): void {
	if (e.currentTarget.src !== fallbackSrc) {
		e.currentTarget.src = fallbackSrc;
	}
}

/**
 * Intercepts image load failures globally in the capture phase to replace broken <img>
 * elements with a consistent SVG fallback UI, preventing browser broken-image icons.
 */
export function setupGlobalImageErrorHandler(
	fallbackSrc: string = FALLBACK_CAT_SVG,
	localFallback: string = FALLBACK_CAT_IMAGE,
): () => void {
	if (typeof window === "undefined") {
		return () => {
			/* no-op when window is undefined */
		};
	}

	const handleImageError = (event: Event) => {
		const target = event.target;
		if (!(target instanceof HTMLImageElement)) {
			return;
		}

		// Prevent infinite loops if the fallback itself triggers an error
		if (target.dataset.fallbackApplied === "true") {
			if (target.src !== fallbackSrc) {
				target.src = fallbackSrc;
			}
			return;
		}

		target.dataset.fallbackApplied = "true";
		target.dataset.originalSrc = target.currentSrc || target.src;
		target.classList.add("img-fallback-applied");

		// If current src is not already the local fallback, try local fallback first, otherwise SVG data URI
		const isFailedLocal = target.src.includes(localFallback);
		target.src = isFailedLocal ? fallbackSrc : localFallback;
	};

	window.addEventListener("error", handleImageError, true);

	return () => {
		window.removeEventListener("error", handleImageError, true);
	};
}

export class ErrorManager {
	static setupGlobalErrorHandling() {
		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			console.error("Unhandled Promise Rejection:", event.reason);
			ErrorManager.handleError(event.reason);
		};

		const handleErrorEvent = (event: ErrorEvent) => {
			console.error("Global Error:", event.error);
			ErrorManager.handleError(event.error);
		};

		window.addEventListener("unhandledrejection", handleUnhandledRejection);
		window.addEventListener("error", handleErrorEvent);
		const cleanupImageErrorHandler = setupGlobalImageErrorHandler();

		return () => {
			window.removeEventListener("unhandledrejection", handleUnhandledRejection);
			window.removeEventListener("error", handleErrorEvent);
			cleanupImageErrorHandler();
		};
	}

	static handleError(
		error: unknown,
		context?: string,
		options?: { componentStack?: string | null; isCritical?: boolean },
	): { id: string } {
		const errorMessage =
			error instanceof Error
				? error.message
				: typeof error === "string"
					? error
					: "An unexpected error occurred.";
		const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		if (context) {
			console.error(`[${context}] Error:`, error, options);
		} else {
			console.error("Error:", error);
		}
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("app-error", {
					detail: { id, message: errorMessage, isCritical: options?.isCritical },
				}),
			);
		}
		return { id };
	}
}
