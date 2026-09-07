import { motion, useReducedMotion } from "framer-motion";
import {
	Award,
	Check,
	Crown,
	Flame,
	Loader2,
	LogOut,
	Pencil,
	Search,
	Shield,
	Trophy,
	User,
} from "lucide-react";
import { type ChangeEvent, memo, type ReactNode, useEffect, useRef, useState } from "react";
import { Button, Input, Loading } from "@/shared/components/LayoutBlocks";
import { CAT_IMAGES, FALLBACK_CAT_IMAGE, FALLBACK_CAT_SVG } from "@/shared/lib/constants";
import { cn, ErrorManager, handleImgError, hapticNavTap } from "@/shared/lib/utils";
import useAppStore from "@/store";

export interface ProfileInnerProps {
	onLogin: (name: string) => Promise<boolean | undefined>;
	onLogout: () => Promise<void>;
}

export function ProfileInner({ onLogin, onLogout }: ProfileInnerProps) {
	const user = useAppStore((s) => s.user);
	const userActions = useAppStore((s) => s.userActions);
	const tournament = useAppStore((s) => s.tournament);
	const defaultAvatar = CAT_IMAGES[0] ?? FALLBACK_CAT_IMAGE;
	const nameInputRef = useRef<HTMLInputElement | null>(null);
	const [editedName, setEditedName] = useState(user.name || "");
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [isEditing, setIsEditing] = useState(!user.isLoggedIn);
	const [avatarSrc, setAvatarSrc] = useState(user.avatarUrl || defaultAvatar);
	const [showAvatarPicker, setShowAvatarPicker] = useState(false);
	const previousLoginStateRef = useRef(user.isLoggedIn);
	const previousEditingStateRef = useRef(isEditing);

	const ratingsCount = Object.keys(tournament.ratings || {}).length;
	const selectedCount = tournament.selectedNames?.length || 0;

	useEffect(() => {
		setEditedName(user.name || "");
		setAvatarSrc(user.avatarUrl || defaultAvatar);
	}, [user.name, user.avatarUrl, defaultAvatar]);

	useEffect(() => {
		const wasLoggedIn = previousLoginStateRef.current;
		if (!user.isLoggedIn) {
			setIsEditing(true);
		} else if (!wasLoggedIn) {
			setIsEditing(false);
		}
		previousLoginStateRef.current = user.isLoggedIn;
	}, [user.isLoggedIn]);

	useEffect(() => {
		const enteredEditingWhileLoggedIn =
			user.isLoggedIn && !previousEditingStateRef.current && isEditing;
		if (enteredEditingWhileLoggedIn) {
			nameInputRef.current?.focus();
		}
		previousEditingStateRef.current = isEditing;
	}, [isEditing, user.isLoggedIn]);

	const handleSelectAvatar = (url: string) => {
		setAvatarSrc(url);
		userActions.setUser({ avatarUrl: url });
		setShowAvatarPicker(false);
	};

	const handleSave = async () => {
		if (!editedName.trim()) {
			return;
		}
		setIsSaving(true);
		setSaveError(null);
		try {
			const didLogin = await onLogin(editedName.trim());
			if (didLogin === false) {
				setSaveError("We couldn't log you in with that name. Try again.");
				return;
			}
			setIsEditing(false);
		} catch (err) {
			ErrorManager.handleError(err, "ProfileInner.handleSave");
			setSaveError("We couldn't log you in right now. Try again.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleLogout = async () => {
		setIsLoggingOut(true);
		try {
			await onLogout();
			setIsEditing(true);
		} catch (err) {
			ErrorManager.handleError(err, "ProfileInner.handleLogout");
		} finally {
			setIsLoggingOut(false);
		}
	};

	const handleNameChange = (val: string) => {
		setEditedName(val);
		if (saveError) {
			setSaveError(null);
		}
	};

	return (
		<div className="flex flex-col items-center gap-5 w-full p-2">
			{/* Avatar Showcase with interactive picker toggle */}
			<div className="flex flex-col items-center gap-2">
				<div className="relative group">
					<div
						className="absolute -inset-3 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 blur-2xl opacity-50 group-hover:opacity-75 transition-opacity"
						aria-hidden="true"
					/>
					<button
						type="button"
						onClick={() => setShowAvatarPicker((prev) => !prev)}
						className="relative size-24 rounded-full overflow-hidden ring-4 ring-primary/30 ring-offset-4 ring-offset-background bg-muted shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
						title="Click to choose avatar"
						aria-label="Change profile avatar"
						aria-expanded={showAvatarPicker}
						aria-controls="avatar-picker-tray"
					>
						<img
							src={avatarSrc}
							alt="Profile avatar"
							className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
							onError={() =>
								setAvatarSrc((prev) => (prev === defaultAvatar ? FALLBACK_CAT_SVG : defaultAvatar))
							}
						/>
						<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-bold tracking-wider uppercase">
							Change
						</div>
					</button>

					{user.isAdmin && (
						<div
							className="absolute -bottom-1 -right-1 size-7 rounded-full bg-chart-4 text-black flex items-center justify-center shadow-md ring-2 ring-background font-bold"
							title="Tournament Master Admin"
						>
							<Crown size={14} />
						</div>
					)}
				</div>

				<button
					type="button"
					onClick={() => setShowAvatarPicker((prev) => !prev)}
					className="text-xs text-primary/80 hover:text-primary font-medium transition-colors"
					aria-expanded={showAvatarPicker}
					aria-controls="avatar-picker-tray"
				>
					{showAvatarPicker ? "Hide Avatar Options" : "Choose Avatar"}
				</button>
			</div>

			{/* Avatar Selector Tray */}
			{showAvatarPicker && (
				<motion.div
					id="avatar-picker-tray"
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					exit={{ opacity: 0, height: 0 }}
					className="w-full bg-card/60 border border-border/40 rounded-2xl p-3 backdrop-blur-md"
				>
					<p className="text-xs font-semibold text-muted-foreground tracking-wide text-center mb-2.5">
						Select Cat Persona
					</p>
					<div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 justify-items-center">
						{CAT_IMAGES.slice(0, 8).map((imgUrl, idx) => {
							const isSelected = avatarSrc === imgUrl;
							return (
								<button
									key={imgUrl || idx}
									type="button"
									onClick={() => handleSelectAvatar(imgUrl)}
									aria-pressed={isSelected}
									aria-label={`Select avatar ${idx + 1}`}
									className={cn(
										"relative size-12 rounded-full overflow-hidden border-2 transition-all hover:scale-110",
										isSelected
											? "border-primary ring-2 ring-primary/40 scale-105"
											: "border-border/60 opacity-70 hover:opacity-100",
									)}
								>
									<img
										src={imgUrl}
										alt={`Avatar option ${idx + 1}`}
										className="size-full object-cover"
										onError={handleImgError}
									/>
									{isSelected && (
										<div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
											<Check size={14} className="text-primary-foreground stroke-[3]" />
										</div>
									)}
								</button>
							);
						})}
					</div>
				</motion.div>
			)}

			{isEditing ? (
				<div className="w-full space-y-4">
					<div className="relative group">
						<User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-primary/60 pointer-events-none transition-colors group-focus-within:text-primary" />
						<Input
							ref={nameInputRef}
							type="text"
							value={editedName}
							onChange={(e) => handleNameChange(e.target.value)}
							placeholder="Enter your player handle..."
							aria-label="Player Handle"
							maxLength={32}
							onKeyDown={(e) => e.key === "Enter" && handleSave()}
							className="w-full h-12 pl-10 pr-4 text-sm rounded-2xl bg-background/50 border-primary/20 focus:border-primary focus:ring-primary/30 shadow-inner transition-all duration-300"
						/>
					</div>
					{saveError && (
						<p role="alert" className="text-sm text-destructive text-center font-medium">
							{saveError}
						</p>
					)}
					<div className="flex gap-3">
						{user.isLoggedIn && (
							<Button
								type="button"
								variant="ghost"
								onClick={() => setIsEditing(false)}
								className="flex-1 rounded-xl"
							>
								Cancel
							</Button>
						)}
						<Button
							type="submit"
							variant="glass"
							size="large"
							onClick={handleSave}
							disabled={!editedName.trim() || isSaving}
							loading={isSaving}
							className={`${user.isLoggedIn ? "flex-[2]" : "w-full"} rounded-xl shadow-lg shadow-primary/20 font-semibold`}
						>
							{user.isLoggedIn ? "Save Changes" : "Begin Battle Journey"}
						</Button>
					</div>
				</div>
			) : (
				<div className="w-full flex flex-col items-center gap-4">
					<div className="flex items-center justify-center gap-3 bg-foreground/5 py-2.5 px-5 rounded-2xl border border-foreground/10 w-full max-w-sm">
						<div className="flex flex-col items-center">
							<div className="flex items-center gap-2">
								<h3 className="text-2xl font-black tracking-tight text-foreground">{user.name}</h3>
								<button
									type="button"
									onClick={() => setIsEditing(true)}
									className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors"
									aria-label="Edit name"
									title="Edit name"
								>
									<Pencil size={15} />
								</button>
							</div>
							<div className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-primary tracking-wide">
								{user.isAdmin ? (
									<>
										<Shield size={12} className="text-chart-4" />
										<span className="text-chart-4">Arena Master</span>
									</>
								) : (
									<>
										<Award size={12} />
										<span>Feline Judge</span>
									</>
								)}
							</div>
						</div>
					</div>

					{/* Player Stats Snapshot */}
					<div className="grid grid-cols-2 gap-3 w-full max-w-sm">
						<div className="bg-card/40 border border-border/40 rounded-xl p-3 text-center backdrop-blur-sm">
							<div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
								<Trophy size={13} className="text-primary" />
								<span>Selected Names</span>
							</div>
							<span className="text-lg font-bold text-foreground tabular-nums">
								{selectedCount}
							</span>
						</div>
						<div className="bg-card/40 border border-border/40 rounded-xl p-3 text-center backdrop-blur-sm">
							<div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
								<Flame size={13} className="text-accent" />
								<span>Active Ratings</span>
							</div>
							<span className="text-lg font-bold text-foreground tabular-nums">{ratingsCount}</span>
						</div>
					</div>

					<button
						type="button"
						onClick={handleLogout}
						disabled={isLoggingOut}
						className="mt-1 flex items-center justify-center gap-2 w-full max-w-sm py-2.5 rounded-xl text-sm font-semibold text-destructive hover:text-destructive-foreground hover:bg-destructive shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer disabled:cursor-not-allowed"
					>
						<LogOut size={15} />
						{isLoggingOut ? "Logging out..." : "Log Out of Profile"}
					</button>
				</div>
			)}
		</div>
	);
}

export interface MagicToggleOption<T extends string> {
	value: T;
	label: string;
	icon?: ReactNode;
}

export interface MagicToggleProps<T extends string> {
	options: readonly MagicToggleOption<T>[];
	value: T;
	onChange: (value: T) => void;
	ariaLabel?: string;
	size?: "small" | "default";
}

export function MagicToggle<T extends string>({
	options,
	value,
	onChange,
	ariaLabel,
	size = "default",
}: MagicToggleProps<T>) {
	return (
		<div
			className={`relative inline-flex items-center w-full sm:w-auto ${size === "small" ? "p-1" : "p-1.5"} bg-white/5 dark:bg-black/40 backdrop-blur-xl ${size === "small" ? "rounded-xl" : "rounded-2xl"} border border-white/10 shadow-xl`}
			role="tablist"
			aria-label={ariaLabel}
		>
			<motion.div
				className={`absolute ${size === "small" ? "inset-y-1 rounded-md" : "inset-y-1.5 rounded-lg"} bg-primary/20 border border-primary/30 pointer-events-none`}
				initial={false}
				animate={{
					x: `calc(${options.findIndex((o) => o.value === value) * 100}% + ${options.findIndex((o) => o.value === value) * (size === "small" ? 2 : 4)}px)`,
					width: `calc(${100 / options.length}% - ${size === "small" ? 2 : 4}px)`,
				}}
				transition={{
					type: "spring",
					stiffness: 500,
					damping: 20,
					mass: 0.8,
				}}
			/>
			{options.map((option) => {
				const isSelected = value === option.value;
				return (
					<button
						key={option.value}
						type="button"
						role="tab"
						aria-selected={isSelected}
						onClick={() => {
							hapticNavTap();
							onChange(option.value);
						}}
						className={`relative flex-1 ${size === "small" ? "px-3 py-1.5 text-xs" : "px-5 py-2 sm:px-8 sm:py-2.5 text-xs sm:text-sm"} font-semibold tracking-wide transition-colors z-10 ${size === "small" ? "rounded-md" : "rounded-lg"} ${
							isSelected
								? "text-primary-foreground font-bold"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<div className="flex items-center justify-center gap-2">
							{option.icon && (
								<motion.span
									className="flex items-center justify-center"
									animate={{
										scale: isSelected ? [1, 1.15, 1] : 1,
									}}
									transition={{
										duration: 0.3,
										ease: "easeInOut",
									}}
								>
									{option.icon}
								</motion.span>
							)}
							<span>{option.label}</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}

export interface SearchFilterBarProps {
	searchTerm: string;
	onSearchTermChange: (value: string) => void;
	filterStatus: string;
	filterOptions: readonly { value: string; label: string }[];
	onFilterChange: (value: string) => void;
	onRefresh: () => void;
}

export function SearchFilterBar({
	searchTerm,
	onSearchTermChange,
	filterStatus,
	filterOptions,
	onFilterChange,
	onRefresh,
}: SearchFilterBarProps) {
	const prefersReducedMotion = useReducedMotion();

	const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
		onSearchTermChange(event.target.value);
	};

	const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
		onFilterChange(event.target.value);
	};

	const handleRefresh = () => {
		hapticNavTap();
		onRefresh();
	};

	return (
		<motion.div
			className="flex flex-col sm:flex-row items-center gap-2 w-full bg-background/40 backdrop-blur-md rounded-2xl p-1.5 sm:p-2 border border-border/10 shadow-inner group transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_15px_rgba(var(--primary),0.1)] focus-within:border-primary/40 focus-within:shadow-[0_0_20px_rgba(var(--primary),0.15)] focus-within:bg-background/60 mb-6"
			initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
			animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
			transition={{
				duration: 0.3,
				type: "spring",
				stiffness: 300,
				damping: 25,
			}}
		>
			<div className="flex-1 w-full relative flex items-center min-w-0">
				<div className="pl-4 pr-3 text-muted-foreground transition-colors group-focus-within:text-primary">
					<Search size={18} />
				</div>
				<input
					type="text"
					placeholder="Search names..."
					value={searchTerm}
					onChange={handleSearchChange}
					aria-label="Search names"
					className="w-full h-12 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground border-none outline-none ring-0 min-w-0"
				/>
			</div>

			<div className="w-px h-8 bg-border/20 hidden sm:block mx-1" />

			<div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-border/10 sm:border-t-0 shrink-0 px-2 sm:px-0 pb-1 sm:pb-0">
				<div className="relative">
					<select
						value={filterStatus}
						onChange={handleFilterChange}
						aria-label="Filter names by status"
						className="h-10 bg-foreground/5 hover:bg-foreground/10 transition-colors rounded-xl px-4 pr-10 text-sm font-medium text-foreground appearance-none outline-none cursor-pointer border border-transparent focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
					>
						{filterOptions.map((option) => (
							<option
								key={option.value}
								value={option.value}
								className="bg-background text-foreground"
							>
								{option.label}
							</option>
						))}
					</select>
					<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
						<svg
							className="h-4 w-4 fill-current"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							aria-hidden="true"
						>
							<path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
						</svg>
					</div>
				</div>

				<Button
					onClick={handleRefresh}
					variant="primary"
					className="h-10 w-10 sm:w-10 p-0 shrink-0 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95"
					aria-label="Refresh list"
					title="Refresh list"
				>
					<Loader2 size={16} />
				</Button>
			</div>
		</motion.div>
	);
}

export function RouteFallback({ text }: { text: string }) {
	return <Loading variant="cat-gif" text={text} className="min-h-[82dvh]" />;
}

export const SectionHeading = memo(function SectionHeading({
	id,
	title,
	subtitle,
}: {
	id?: string;
	title: string;
	subtitle?: string;
}) {
	return (
		<div className="mx-auto mb-4 sm:mb-6 flex w-full max-w-2xl flex-col items-center text-center">
			<h2
				id={id}
				className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-foreground"
			>
				{title}
			</h2>
			{subtitle && (
				<p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm md:text-base leading-relaxed text-muted-foreground">
					{subtitle}
				</p>
			)}
		</div>
	);
});
