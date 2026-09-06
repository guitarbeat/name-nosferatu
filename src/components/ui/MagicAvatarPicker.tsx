import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown } from "lucide-react";
import { useState } from "react";
import { CAT_IMAGES, FALLBACK_CAT_SVG } from "@/shared/lib/constants";
import { cn, hapticNavTap } from "@/shared/lib/utils";

export interface MagicAvatarPickerProps {
	avatarSrc: string;
	onSelectAvatar: (url: string) => void;
	isAdmin?: boolean;
	defaultAvatar?: string;
}

export function MagicAvatarPicker({
	avatarSrc,
	onSelectAvatar,
	isAdmin,
	defaultAvatar = FALLBACK_CAT_SVG,
}: MagicAvatarPickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [currentSrc, setCurrentSrc] = useState(avatarSrc);

	const handleToggle = () => {
		hapticNavTap();
		setIsOpen((p) => !p);
	};

	const handleSelect = (url: string) => {
		hapticNavTap();
		onSelectAvatar(url);
		setIsOpen(false);
	};

	return (
		<div className="flex flex-col items-center gap-4 w-full">
			<div className="relative group">
				<div
					className="absolute -inset-3 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 blur-2xl opacity-50 group-hover:opacity-75 transition-opacity"
					aria-hidden="true"
				/>
				<button
					type="button"
					onClick={handleToggle}
					className="relative size-24 rounded-full overflow-hidden ring-4 ring-primary/30 ring-offset-4 ring-offset-background bg-muted shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer z-10"
					title="Click to choose avatar"
					aria-label="Change profile avatar"
					aria-expanded={isOpen}
					aria-controls="avatar-picker-tray"
				>
					<img
						src={currentSrc}
						alt="Profile avatar"
						className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
						onError={() => setCurrentSrc(defaultAvatar)}
					/>
					<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[11px] font-bold tracking-wider uppercase">
						{isOpen ? "Close" : "Change"}
					</div>
				</button>

				{isAdmin && (
					<div
						className="absolute -bottom-1 -right-1 size-7 rounded-full bg-chart-4 text-black flex items-center justify-center shadow-md ring-2 ring-background font-bold z-20"
						title="Tournament Master Admin"
					>
						<Crown size={14} />
					</div>
				)}
			</div>

			<AnimatePresence>
				{isOpen && (
					<motion.div
						id="avatar-picker-tray"
						initial={{ opacity: 0, height: 0, scale: 0.95 }}
						animate={{ opacity: 1, height: "auto", scale: 1 }}
						exit={{ opacity: 0, height: 0, scale: 0.95 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
						className="w-full bg-card/60 border border-border/40 rounded-2xl p-3 backdrop-blur-md overflow-hidden origin-top"
					>
						<p className="text-xs font-semibold text-muted-foreground tracking-wide text-center mb-2.5">
							Select Cat Persona
						</p>
						<div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 justify-items-center">
							{CAT_IMAGES.slice(0, 8).map((imgUrl, idx) => {
								const isSelected = currentSrc === imgUrl;
								return (
									<button
										key={imgUrl || idx}
										type="button"
										onClick={() => handleSelect(imgUrl)}
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
											onError={(e) => {
												e.currentTarget.src = defaultAvatar;
											}}
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
			</AnimatePresence>
		</div>
	);
}
