import { CAT_IMAGES } from "./constants";

// ============================================================================
// MEDIA & IMAGE HELPERS (Consolidated from media.ts)
// ============================================================================

/**
 * Generates a simple hash for a string or number.
 */
function hashString(str: string): number {
	let hash = 2166136261;
	for (let i = 0; i < str.length; i += 1) {
		hash ^= str.charCodeAt(i);
		hash *= 16777619;
	}
	return hash;
}

const imageCache = new Map<string, string>();
const MAX_IMAGE_CACHE_SIZE = 500;

const NAME_IMAGE_MAPPING: Record<string, string> = {
	Nosferatu: CAT_IMAGES[8],
	Shadow: CAT_IMAGES[9],
	Luna: CAT_IMAGES[0],
	Milo: CAT_IMAGES[10],
	Miso: CAT_IMAGES[1],
	Pixel: CAT_IMAGES[2],
	Saffron: CAT_IMAGES[3],
	Noodle: CAT_IMAGES[4],
	Ziggy: CAT_IMAGES[5],
	Whiskers: CAT_IMAGES[6],
	Pepper: CAT_IMAGES[7],
	Barnaby: CAT_IMAGES[11],
};

/**
 * Consistently returns a "random" cat image for a given ID.
 * The same ID will always return the same image for the same images pool.
 */
export function getRandomCatImage(
	id: string | number | null | undefined,
	images: readonly string[] = CAT_IMAGES,
	name?: string,
): string {
	if (name && NAME_IMAGE_MAPPING[name]) {
		return NAME_IMAGE_MAPPING[name];
	}

	if (!id || images.length === 0) {
		return images[0] ?? "";
	}

	const cacheKey = `${id}-${images.length}`;
	const cached = imageCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const seed = typeof id === "string" ? hashString(id) : Number(id);
	const index = Math.abs(seed) % images.length;
	const selected = images[index] ?? images[0] ?? "";
	imageCache.set(cacheKey, selected);
	while (imageCache.size > MAX_IMAGE_CACHE_SIZE) {
		const firstKey = imageCache.keys().next().value;
		if (firstKey) {
			imageCache.delete(firstKey);
		} else {
			break;
		}
	}
	return selected;
}

// ============================================================================
// DESIGN TOKENS & SURFACE CLASSES (Consolidated from themeClasses.ts)
// ============================================================================

/**
 * Shared Tailwind class groups aligned with design tokens in src/index.css.
 * Prefer these over ad-hoc border-white/10 and bg-black/15 patterns.
 */
export const themeSurfaces = {
	panel:
		"rounded-2xl border border-border/45 bg-card/50 backdrop-blur-xl shadow-sm ring-1 ring-inset ring-[color-mix(in_srgb,var(--foreground)_6%,transparent)]",
	panelInset:
		"overflow-hidden rounded-2xl border border-border/40 bg-card/40 ring-1 ring-inset ring-[color-mix(in_srgb,var(--foreground)_4%,transparent)]",
	panelDense: "rounded-xl border border-border/40 bg-card/40",
	rowDivider: "border-b border-border/40 last:border-b-0",
	avatar: "border border-border/50 bg-foreground/[0.04]",
	statTile:
		"flex flex-col items-center justify-center gap-2 rounded-xl border border-border/35 bg-card/30 px-4 py-5 text-center",
	statIcon: "rounded-lg border border-border/35 bg-foreground/[0.03] text-muted-foreground",
	statIconAccent: "rounded-lg border border-primary/20 bg-primary/10 text-primary",
	badge:
		"inline-flex items-center rounded-full border border-border/35 bg-card/25 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground",
	badgeAccent:
		"inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary/85",
} as const;

export const themeText = {
	eyebrow: "text-[10px] font-semibold tracking-wide text-muted-foreground",
	eyebrowWide: "text-[11px] font-semibold tracking-wide text-muted-foreground",
	sectionLabel: "text-xs font-semibold tracking-wide text-muted-foreground",
	subtitle: "text-sm leading-relaxed text-muted-foreground",
	statValue: "text-2xl font-semibold leading-none text-foreground/90",
	heroDisplay: "font-black uppercase leading-[0.88] tracking-tighter text-foreground",
	heroPlaceholder: "text-muted-foreground",
} as const;

// ============================================================================
// MOTION TIMING & EASING CONSTANTS (Consolidated from motion.ts)
// ============================================================================

export const MOTION_DURATIONS = {
	micro: 0.08,
	fast: 0.15,
	quick: 0.2,
	base: 0.28,
	moderate: 0.35,
	slow: 0.5,
	gentle: 0.6,
	reducedMotionDuration: 0.01,
} as const;

export const MOTION_EASING = {
	easeOutExpo: [0.16, 1, 0.3, 1] as const,
	easeOutBack: [0.34, 1.56, 0.64, 1] as const,
	easeInOutSmooth: [0.4, 0, 0.2, 1] as const,
	easeSpring: [0.175, 0.885, 0.32, 1.275] as const,
	easeStandard: "easeOut" as const,
} as const;

// ============================================================================
// CONSOLIDATED FRAMER MOTION VARIANTS & PRESETS
// ============================================================================

export const fadeMotionPreset = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: {
		duration: MOTION_DURATIONS.base,
		ease: MOTION_EASING.easeInOutSmooth,
	},
};

export const scaleFadeMotionPreset = {
	initial: { opacity: 0, scale: 0.95 },
	animate: { opacity: 1, scale: 1 },
	exit: { opacity: 0, scale: 0.95 },
	transition: {
		duration: MOTION_DURATIONS.base,
		ease: MOTION_EASING.easeOutExpo,
	},
};

export const statusMessageMotionPreset = {
	initial: { opacity: 0, y: -4 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -4 },
	transition: {
		duration: MOTION_DURATIONS.fast,
		ease: MOTION_EASING.easeStandard,
	},
};
