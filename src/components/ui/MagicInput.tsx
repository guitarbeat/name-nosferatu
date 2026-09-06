import { motion } from "framer-motion";
import { type ComponentProps, forwardRef, type ReactNode, useId, useState } from "react";
import { cn } from "@/shared/lib/utils";

export interface MagicInputProps extends ComponentProps<"input"> {
	icon?: ReactNode;
	label?: string;
}

export const MagicInput = forwardRef<HTMLInputElement, MagicInputProps>(
	({ icon, label, className, ...props }, ref) => {
		const internalId = useId();
		const id = props.id || internalId;
		const [isFocused, setIsFocused] = useState(false);

		return (
			<div className="w-full flex flex-col gap-1.5">
				{label && (
					<label htmlFor={id} className="text-sm font-semibold text-foreground/80 pl-1">
						{label}
					</label>
				)}
				<div className="relative group isolate">
					<motion.div
						className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/30 to-accent/30 opacity-0 blur-md transition-opacity duration-300 -z-10"
						animate={{ opacity: isFocused ? 1 : 0 }}
					/>

					{icon && (
						<div
							className={cn(
								"absolute left-3.5 top-1/2 -translate-y-1/2 text-primary/60 pointer-events-none transition-colors z-10",
								isFocused ? "text-primary" : "group-hover:text-primary/80",
							)}
						>
							{icon}
						</div>
					)}

					<input
						{...props}
						id={id}
						ref={ref}
						onFocus={(e) => {
							setIsFocused(true);
							props.onFocus?.(e);
						}}
						onBlur={(e) => {
							setIsFocused(false);
							props.onBlur?.(e);
						}}
						className={cn(
							"w-full h-12 text-sm rounded-2xl bg-background/50 border border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/30 shadow-inner transition-all duration-300 outline-none placeholder:text-muted-foreground/50",
							icon ? "pl-10 pr-4" : "px-4",
							className,
						)}
					/>
				</div>
			</div>
		);
	},
);
MagicInput.displayName = "MagicInput";
