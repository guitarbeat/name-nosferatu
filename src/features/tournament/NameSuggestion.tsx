import DOMPurify from "dompurify";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Dices, Plus, Trophy, Zap } from "lucide-react";
import {
	type FormEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { useToast } from "@/app/Providers";
import { addName } from "@/shared/api";
import { Button, CatImage, Input, Textarea } from "@/shared/components";
import { CAT_IMAGES } from "@/shared/lib/constants";
import { scaleFadeMotionPreset, statusMessageMotionPreset } from "@/shared/lib/uiUtils";

interface UseNameSuggestionProps {
	onSuccess?: () => void;
}

interface UseNameSuggestionResult {
	values: { name: string; description: string };
	errors: { name?: string; description?: string };
	touched: { name?: boolean; description?: boolean };
	isSubmitting: boolean;
	isValid: boolean;
	handleChange: (field: "name" | "description", value: string) => void;
	handleBlur: (field: "name" | "description") => void;
	handleSubmit: () => Promise<void>;
	reset: () => void;
	globalError: string;
	successMessage: string;
	setGlobalError: (error: string) => void;
}

export function useNameSuggestion(props: UseNameSuggestionProps = {}): UseNameSuggestionResult {
	const [values, setValues] = useState({ name: "", description: "" });
	const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
	const [touched, setTouched] = useState<{
		name?: boolean;
		description?: boolean;
	}>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [globalError, setGlobalError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	const handleChange = useCallback((field: "name" | "description", value: string) => {
		setValues((previous) => ({ ...previous, [field]: value }));
		setErrors((previous) => ({ ...previous, [field]: undefined }));
		setGlobalError("");
	}, []);

	const handleBlur = useCallback((field: "name" | "description") => {
		setTouched((previous) => ({ ...previous, [field]: true }));
	}, []);

	const validate = useCallback(() => {
		const nextErrors: { name?: string; description?: string } = {};

		if (!values.name.trim()) {
			nextErrors.name = "Name is required";
		}
		if (!values.description.trim()) {
			nextErrors.description = "Description is required";
		}

		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	}, [values]);

	const handleSubmit = useCallback(async () => {
		if (!validate()) {
			return;
		}

		setIsSubmitting(true);
		setGlobalError("");
		setSuccessMessage("");

		try {
			const sanitizedName = DOMPurify.sanitize(values.name, {
				ALLOWED_TAGS: [],
			}).trim();
			const sanitizedDescription = DOMPurify.sanitize(values.description, {
				ALLOWED_TAGS: [],
			}).trim();

			await addName({ name: sanitizedName, description: sanitizedDescription });

			setSuccessMessage("Name suggestion submitted successfully!");
			setValues({ name: "", description: "" });
			setTouched({});
			props.onSuccess?.();
		} catch (submitError) {
			setGlobalError(
				submitError instanceof Error ? submitError.message : "Failed to submit suggestion",
			);
		} finally {
			setIsSubmitting(false);
		}
	}, [props, validate, values.description, values.name]);

	const reset = useCallback(() => {
		setValues({ name: "", description: "" });
		setErrors({});
		setTouched({});
		setGlobalError("");
		setSuccessMessage("");
	}, []);

	const isValid = !errors.name && !errors.description && values.name.trim() !== "";

	return {
		values,
		errors,
		touched,
		isSubmitting,
		isValid,
		handleChange,
		handleBlur,
		handleSubmit,
		reset,
		globalError,
		successMessage,
		setGlobalError,
	};
}

interface NameSuggestionProps {
	variant?: "inline" | "modal";
	onClose?: () => void;
}

interface InspirationArchetype {
	id: string;
	label: string;
	icon: string;
	names: Array<{ name: string; description: string }>;
}

const INSPIRATION_ARCHETYPES: InspirationArchetype[] = [
	{
		id: "vampiric",
		label: "Gothic / Vampire",
		icon: "🦇",
		names: [
			{
				name: "Nosferpaws",
				description: "Only comes out at 3 AM to zoom silently across the velvet sofa.",
			},
			{
				name: "Count Whiskula",
				description: "Drinks goat milk from a crystal goblet and casts no mirror reflection.",
			},
			{
				name: "Lord Vladiclaw",
				description: "Ancient vampire lord who demands fresh tuna sacrifices upon waking.",
			},
		],
	},
	{
		id: "regal",
		label: "Regal / Noble",
		icon: "👑",
		names: [
			{
				name: "Sir Paws-a-lot",
				description: "Knighted for defending the realm against the red laser dot.",
			},
			{
				name: "Duchess Fluffington",
				description: "Heiress to the cardboard castle with nine royal titles.",
			},
			{
				name: "Baron Von Claw",
				description: "Monocled aristocrat who refuses to sit on unbrushed cushions.",
			},
		],
	},
	{
		id: "mystical",
		label: "Mystic / Cosmic",
		icon: "🌙",
		names: [
			{
				name: "Shadowfax",
				description: "Swift as moonlight, capable of vanishing between dimension folds.",
			},
			{
				name: "Cosmic Whisker",
				description: "Travels across the astral plane to knock over celestial cups.",
			},
			{
				name: "Grimoire",
				description: "An enchanted familiar containing secrets of the ancient purrs.",
			},
		],
	},
	{
		id: "gremlin",
		label: "Chaos / Gremlin",
		icon: "⚡",
		names: [
			{
				name: "Bitey McBiteface",
				description: "Zero thoughts, maximum chaos, attacks ankles with precision.",
			},
			{
				name: "Captain Turbo Zoomies",
				description: "Breaks the sound barrier across hallways at 4:15 in the morning.",
			},
			{
				name: "Goblin Mode",
				description: "Hoards hair ties beneath the washing machine with demonic glee.",
			},
		],
	},
	{
		id: "whimsical",
		label: "Food / Cute",
		icon: "🥐",
		names: [
			{
				name: "Baguette",
				description: "Warm, golden, elongated, and delightfully crusty in the morning.",
			},
			{
				name: "Tiramisu",
				description: "Layers of sweetness topped with a dust of cocoa espresso attitude.",
			},
			{
				name: "Wasabi",
				description: "Small, seemingly sweet, but packs an unexpectedly fiery kick.",
			},
		],
	},
];

// ============================================================================
// LIVE CARD PREVIEW
// ============================================================================

interface CardPreviewProps {
	name: string;
	description: string;
	archetypeIcon?: string;
}

function getAvatarForName(nameStr: string): string {
	if (!nameStr.trim()) {
		return CAT_IMAGES[0] || "";
	}
	let hash = 0;
	for (let i = 0; i < nameStr.length; i++) {
		hash = (hash << 5) - hash + nameStr.charCodeAt(i);
		hash |= 0;
	}
	const index = Math.abs(hash) % CAT_IMAGES.length;
	return CAT_IMAGES[index] || CAT_IMAGES[0] || "";
}

function ContenderCardPreview({ name, description, archetypeIcon = "🐾" }: CardPreviewProps) {
	const displayName = name.trim() || "Feline Contender";
	const displayLore = description.trim() || "Backstory and tournament lore will appear here...";
	const hasContent = Boolean(name.trim() || description.trim());
	const previewAvatar = getAvatarForName(name);

	return (
		<div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/85 p-4 sm:p-5 shadow-lg backdrop-blur-md transition-all">
			<div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-border/50">
				<div className="flex items-center gap-3 min-w-0">
					<div className="relative size-11 shrink-0 rounded-full overflow-hidden ring-2 ring-primary/40 shadow-sm bg-muted">
						<CatImage
							src={previewAvatar}
							alt={displayName}
							containerClassName="size-full"
							imageClassName="size-full object-cover"
						/>
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
							<span>{archetypeIcon}</span>
							<span>Live Contender Preview</span>
						</div>
						<div className="text-sm font-extrabold text-foreground truncate">
							{hasContent ? displayName : "Previewing Your Cat"}
						</div>
					</div>
				</div>
				<div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold shrink-0 shadow-xs">
					<Zap size={12} />
					<span>1500 ELO</span>
				</div>
			</div>

			<div className="space-y-2">
				<div className="text-base sm:text-lg font-black tracking-tight text-foreground line-clamp-1">
					{hasContent ? (
						displayName
					) : (
						<span className="text-muted-foreground/50 italic">Name your feline warrior...</span>
					)}
				</div>
				<p className="text-xs sm:text-sm leading-relaxed text-muted-foreground line-clamp-2 italic">
					"{displayLore}"
				</p>
			</div>

			<div className="mt-3.5 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
				<span className="flex items-center gap-1 font-medium text-foreground/80">
					Ready for Bracket
				</span>
				<span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
					Matchup Eligible
				</span>
			</div>
		</div>
	);
}

// ============================================================================
// STATUS MESSAGE
// ============================================================================

function StatusMessage({ error, success }: { error?: string; success?: string }) {
	return (
		<AnimatePresence mode="wait">
			{error && (
				<motion.div
					role="alert"
					{...statusMessageMotionPreset}
					className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs sm:text-sm text-destructive font-medium flex items-center justify-center gap-2"
				>
					<AlertCircle size={16} className="shrink-0 text-destructive" />
					<span>{error}</span>
				</motion.div>
			)}
			{success && (
				<motion.div
					role="status"
					{...statusMessageMotionPreset}
					className="p-3 rounded-xl border border-chart-2/30 bg-chart-2/10 text-xs sm:text-sm text-center flex items-center justify-center gap-2 text-chart-2 font-medium"
				>
					<CheckCircle2 size={16} className="shrink-0" />
					<span>{success}</span>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// ============================================================================
// SUCCESS CELEBRATION CARD
// ============================================================================

interface SuggestionSuccessViewProps {
	submittedName: string;
	submittedDescription: string;
	onSuggestAnother: () => void;
	onClose?: () => void;
}

function SuggestionSuccessView({
	submittedName,
	submittedDescription,
	onSuggestAnother,
	onClose,
}: SuggestionSuccessViewProps) {
	return (
		<motion.div
			{...scaleFadeMotionPreset}
			className="flex flex-col items-center text-center py-4 px-2 space-y-5"
		>
			<div className="relative">
				<div className="absolute -inset-2 rounded-full bg-primary/20 blur-md animate-pulse" />
				<div className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
					<Trophy size={28} className="animate-bounce" />
				</div>
			</div>

			<div className="space-y-1.5">
				<h4 className="text-xl font-bold text-foreground">Added to Tournament Pool!</h4>
				<p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
					Your cat has entered the arena. Contenders will face off in upcoming head-to-head matches!
				</p>
			</div>

			<div className="w-full">
				<ContenderCardPreview
					name={submittedName}
					description={submittedDescription}
					archetypeIcon="🏆"
				/>
			</div>

			<div className="flex flex-wrap items-center justify-center gap-3 w-full pt-2">
				<Button
					type="button"
					variant="ghost"
					size="medium"
					onClick={onSuggestAnother}
					className="gap-1.5"
				>
					<Plus size={16} />
					Suggest Another
				</Button>
				{onClose && (
					<Button type="button" variant="primary" size="medium" onClick={onClose} className="px-6">
						Done
					</Button>
				)}
			</div>
		</motion.div>
	);
}

// ============================================================================
// INSPIRATION CHIPS ROW
// ============================================================================

interface ArchetypeBarProps {
	onSelectIdea: (name: string, description: string) => void;
	onRandomize: () => void;
	disabled?: boolean;
}

function ArchetypeBar({ onSelectIdea, onRandomize, disabled }: ArchetypeBarProps) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
					Quick Inspiration
				</span>
				<button
					type="button"
					onClick={onRandomize}
					disabled={disabled}
					className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline hover:text-primary/80 transition-colors disabled:opacity-50"
				>
					<Dices size={13} />
					Surprise Me
				</button>
			</div>

			<div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
				{INSPIRATION_ARCHETYPES.map((cat) => {
					const sample = cat.names[Math.floor(Math.random() * cat.names.length)];
					return (
						<button
							key={cat.id}
							type="button"
							disabled={disabled}
							onClick={() => onSelectIdea(sample.name, sample.description)}
							className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 px-2.5 py-1 text-xs font-medium text-foreground transition-all active:scale-95 disabled:opacity-50"
							title={`Try "${sample.name}"`}
						>
							<span>{cat.icon}</span>
							<span>{cat.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

// ============================================================================
// INLINE INNER
// ============================================================================

function NameSuggestionInner() {
	const toast = useToast();
	const [submittedPreview, setSubmittedPreview] = useState<{
		name: string;
		description: string;
	} | null>(null);

	const {
		values,
		errors,
		touched,
		isSubmitting,
		isValid,
		handleChange,
		handleBlur,
		handleSubmit,
		reset,
		globalError,
		successMessage,
	} = useNameSuggestion({
		onSuccess: () => {
			toast.showSuccess("Name suggestion submitted successfully!");
			setSubmittedPreview({
				name: values.name,
				description: values.description,
			});
		},
	});

	const handleLocalSubmit = async (e: FormEvent) => {
		e.preventDefault();
		await handleSubmit();
	};

	const handleSelectIdea = (name: string, description: string) => {
		handleChange("name", name);
		handleChange("description", description);
	};

	const handleRandomize = () => {
		const randomArchetype =
			INSPIRATION_ARCHETYPES[Math.floor(Math.random() * INSPIRATION_ARCHETYPES.length)];
		const randomPick =
			randomArchetype.names[Math.floor(Math.random() * randomArchetype.names.length)];
		handleSelectIdea(randomPick.name, randomPick.description);
	};

	const isFormComplete = values.name.trim().length > 0 && values.description.trim().length > 0;

	if (submittedPreview) {
		return (
			<div className="w-full max-w-xl mx-auto rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-xl shadow-lg">
				<SuggestionSuccessView
					submittedName={submittedPreview.name}
					submittedDescription={submittedPreview.description}
					onSuggestAnother={() => {
						setSubmittedPreview(null);
						reset();
					}}
				/>
			</div>
		);
	}

	return (
		<form
			onSubmit={handleLocalSubmit}
			className="w-full max-w-xl mx-auto rounded-2xl border border-border/50 bg-card/60 p-6 sm:p-8 backdrop-blur-xl shadow-lg space-y-6"
		>
			<div className="text-center space-y-1.5">
				<h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
					Suggest a Cat Name
				</h3>
				<p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
					Propose a name to enter into head-to-head tournament matchups.
				</p>
			</div>

			<ArchetypeBar
				onSelectIdea={handleSelectIdea}
				onRandomize={handleRandomize}
				disabled={isSubmitting}
			/>

			<div className="space-y-4">
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<label
							htmlFor="suggest-name"
							className="text-xs font-bold uppercase tracking-wider text-foreground"
						>
							Cat Name
						</label>
						<span className="text-[10px] text-muted-foreground tabular-nums">
							{values.name.length}/50
						</span>
					</div>
					<Input
						id="suggest-name"
						type="text"
						value={values.name}
						onChange={(e) => handleChange("name", e.target.value)}
						onBlur={() => handleBlur("name")}
						placeholder="e.g. Sir Paws-a-lot, Count Whiskula"
						className="h-11 text-sm bg-background/50 focus:bg-background transition-colors"
						disabled={isSubmitting}
						maxLength={50}
						error={touched.name ? errors.name : null}
					/>
				</div>

				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<label
							htmlFor="suggest-description"
							className="text-xs font-bold uppercase tracking-wider text-foreground"
						>
							Why this name? (Backstory)
						</label>
						<span className="text-[10px] text-muted-foreground tabular-nums">
							{values.description.length}/500
						</span>
					</div>
					<Textarea
						id="suggest-description"
						value={values.description}
						onChange={(e) => handleChange("description", e.target.value)}
						onBlur={() => handleBlur("description")}
						placeholder="What makes this feline legendary, funny, or iconic?"
						rows={3}
						className="text-sm resize-none bg-background/50 focus:bg-background transition-colors"
						disabled={isSubmitting}
						maxLength={500}
						showCount={false}
						error={touched.description ? errors.description : null}
					/>
				</div>
			</div>

			<ContenderCardPreview name={values.name} description={values.description} />

			<StatusMessage error={globalError} success={successMessage} />

			<Button
				type="submit"
				disabled={!isFormComplete || !isValid || isSubmitting}
				loading={isSubmitting}
				variant="primary"
				size="medium"
				className="w-full h-11 text-sm font-semibold shadow-md"
			>
				{isSubmitting ? "Submitting to Arena..." : "Add to Bracket"}
			</Button>
		</form>
	);
}

// ============================================================================
// MODAL CONTENT
// ============================================================================

function ModalNameSuggestionContent({ onClose }: { onClose: () => void }) {
	const toast = useToast();
	const isMountedRef = useRef(true);
	const nameInputRef = useRef<HTMLInputElement | null>(null);
	const nameInputId = useId();
	const descInputId = useId();

	const suggestionData = useNameSuggestion({
		onSuccess: () => {
			toast.showSuccess("Cat name suggestion added to the pool!");
			if (isMountedRef.current) {
				onClose();
			}
		},
	});

	const {
		values,
		errors,
		touched,
		isSubmitting,
		isValid,
		handleChange,
		handleBlur,
		handleSubmit,
		reset,
		globalError,
		setGlobalError,
	} = suggestionData;

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			nameInputRef.current?.focus();
		}, 60);
		return () => clearTimeout(timer);
	}, []);

	const handleClose = useCallback(() => {
		if (isSubmitting) {
			return;
		}
		reset();
		setGlobalError("");
		onClose();
	}, [isSubmitting, onClose, reset, setGlobalError]);

	const handleKeyDown = (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			if (isValid && !isSubmitting && values.name.trim() && values.description.trim()) {
				void handleSubmit();
			}
		}
	};

	const handleSelectIdea = (name: string, description: string) => {
		handleChange("name", name);
		handleChange("description", description);
	};

	const handleRandomize = () => {
		const randomArchetype =
			INSPIRATION_ARCHETYPES[Math.floor(Math.random() * INSPIRATION_ARCHETYPES.length)];
		const randomPick =
			randomArchetype.names[Math.floor(Math.random() * randomArchetype.names.length)];
		handleSelectIdea(randomPick.name, randomPick.description);
	};

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void handleSubmit();
			}}
			onKeyDown={handleKeyDown}
			className="space-y-4"
		>
			<ArchetypeBar
				onSelectIdea={handleSelectIdea}
				onRandomize={handleRandomize}
				disabled={isSubmitting}
			/>

			<div className="space-y-3">
				<div className="space-y-1">
					<div className="flex items-center justify-between">
						<label
							htmlFor={nameInputId}
							className="text-xs font-bold uppercase tracking-wider text-foreground"
						>
							Name
						</label>
						<span className="text-[10px] text-muted-foreground tabular-nums">
							{values.name.length}/50
						</span>
					</div>
					<Input
						ref={nameInputRef}
						id={nameInputId}
						type="text"
						value={values.name}
						onChange={(e) => {
							handleChange("name", e.target.value);
							if (globalError) {
								setGlobalError("");
							}
						}}
						onBlur={() => handleBlur("name")}
						placeholder="e.g. Sir Paws-a-lot, Count Whiskula"
						disabled={isSubmitting}
						maxLength={50}
						error={touched.name ? errors.name : null}
						className="h-10 text-sm bg-background/50 focus:bg-background transition-colors"
					/>
				</div>

				<div className="space-y-1">
					<div className="flex items-center justify-between">
						<label
							htmlFor={descInputId}
							className="text-xs font-bold uppercase tracking-wider text-foreground"
						>
							Backstory / Description
						</label>
						<span className="text-[10px] text-muted-foreground tabular-nums">
							{values.description.length}/500
						</span>
					</div>
					<Textarea
						id={descInputId}
						value={values.description}
						onChange={(e) => {
							handleChange("description", e.target.value);
							if (globalError) {
								setGlobalError("");
							}
						}}
						onBlur={() => handleBlur("description")}
						placeholder="What makes it special, cute, or hilarious?"
						disabled={isSubmitting}
						maxLength={500}
						rows={3}
						error={touched.description ? errors.description : null}
						showCount={false}
						className="text-sm resize-none bg-background/50 focus:bg-background transition-colors"
					/>
				</div>
			</div>

			<ContenderCardPreview name={values.name} description={values.description} />

			<StatusMessage error={globalError} />

			<div className="flex items-center justify-between pt-2 border-t border-border/40">
				<span className="hidden sm:inline-block text-[11px] text-muted-foreground">
					Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">⌘</kbd> +{" "}
					<kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd>
				</span>
				<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
					<Button
						type="button"
						variant="ghost"
						size="medium"
						onClick={handleClose}
						disabled={isSubmitting}
						className="px-4 text-muted-foreground hover:text-foreground"
					>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="primary"
						size="medium"
						disabled={isSubmitting || !isValid || !values.name.trim() || !values.description.trim()}
						loading={isSubmitting}
						className="px-5 font-semibold"
					>
						Submit Suggestion
					</Button>
				</div>
			</div>
		</form>
	);
}

// ============================================================================
// UNIFIED EXPORT
// ============================================================================

export function NameSuggestion({ variant = "inline", onClose }: NameSuggestionProps) {
	const handleClose = onClose ?? (() => undefined);

	if (variant === "modal") {
		return <ModalNameSuggestionContent onClose={handleClose} />;
	}
	return <NameSuggestionInner />;
}
