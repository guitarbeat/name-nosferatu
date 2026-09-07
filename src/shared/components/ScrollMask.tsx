import {
	type MotionValue,
	motion,
	useMotionValue,
	useScroll,
	useSpring,
	useTransform,
} from "framer-motion";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

export interface GridBlockProps {
	progress: MotionValue<number>;
	index: number;
	gridCols: number;
	overlayClassName: string;
}

function GridBlock({ progress, index, gridCols, overlayClassName }: GridBlockProps) {
	const row = Math.floor(index / gridCols);
	const col = index % gridCols;
	const distFromCenter = Math.sqrt((row - 1.5) ** 2 + (col - 1.5) ** 2);

	const startReveal = 0.1 + distFromCenter * 0.15;
	const endReveal = Math.min(startReveal + 0.35, 1.0);

	const scale = useTransform(progress, [startReveal, endReveal], [1, 0]);
	const opacity = useTransform(progress, [startReveal, endReveal], [1, 0]);

	return (
		<motion.div
			style={{ scale, opacity }}
			className={cn("origin-center h-full w-full", overlayClassName)}
		/>
	);
}

export interface ScrollMaskProps {
	/**
	 * The image URL to be revealed.
	 */
	imageSrc: string;
	/**
	 * The visual variant of the mask geometry.
	 * Supports: "iris" | "wipe" | "curtain" | "grid" | "corners" | "zoom"
	 */
	variant?: "iris" | "wipe" | "curtain" | "grid" | "corners" | "zoom";
	/**
	 * The scroll container height in vh (default is 150vh to give a smooth scroll span).
	 */
	scrollLength?: number;
	/**
	 * Adds a feathering effect to the mask edges.
	 */
	feather?: boolean;
	/**
	 * Adds a zoom-in/reveal effect on the image.
	 */
	zoom?: boolean;
	/**
	 * Custom overlay color background class or hex code.
	 */
	overlayClassName?: string;
	/**
	 * Optional text/content overlay shown over the revealed section.
	 */
	children?: React.ReactNode;
	/**
	 * Custom class name for the wrapper.
	 */
	className?: string;
	/**
	 * If true, formats the scroll mask specifically for the hero section of the landing page.
	 * Text starts at full opacity and fades as scroll occurs.
	 */
	isHero?: boolean;
}

export function ScrollMask({
	imageSrc,
	variant = "iris",
	scrollLength = 150,
	zoom = true,
	overlayClassName = "bg-background",
	children,
	className,
	isHero = false,
}: ScrollMaskProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	// Get scroll progress relative to this specific container
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ["start start", "end end"],
	});

	const [wheelProgress, setWheelProgress] = useState(0);
	const progressValue = useMotionValue(0);

	useEffect(() => {
		if (!isHero) {
			return;
		}

		const handleWheel = (e: WheelEvent) => {
			setWheelProgress((prev) => {
				const next = prev + e.deltaY * 0.0015; // smooth increment
				return Math.max(0, Math.min(1, next));
			});
		};

		const handleTouchStart = (e: TouchEvent) => {
			const touch = e.touches[0];
			let startY = touch.clientY;

			const handleTouchMove = (e: TouchEvent) => {
				const touch = e.touches[0];
				const deltaY = startY - touch.clientY;
				startY = touch.clientY;
				setWheelProgress((prev) => {
					const next = prev + deltaY * 0.003;
					return Math.max(0, Math.min(1, next));
				});
			};

			const handleTouchEnd = () => {
				window.removeEventListener("touchmove", handleTouchMove);
				window.removeEventListener("touchend", handleTouchEnd);
			};

			window.addEventListener("touchmove", handleTouchMove, { passive: true });
			window.addEventListener("touchend", handleTouchEnd);
		};

		window.addEventListener("wheel", handleWheel, { passive: true });
		window.addEventListener("touchstart", handleTouchStart, { passive: true });

		return () => {
			window.removeEventListener("wheel", handleWheel);
			window.removeEventListener("touchstart", handleTouchStart);
		};
	}, [isHero]);

	useEffect(() => {
		progressValue.set(wheelProgress);
	}, [wheelProgress, progressValue]);

	// Smooth out the scroll progress using a spring
	const smoothScrollProgress = useSpring(isHero ? progressValue : scrollYProgress, {
		damping: 30,
		stiffness: 100,
		mass: 0.5,
	});

	// 1. Iris Reveal: expanding circle
	const irisClip = useTransform(
		smoothScrollProgress,
		[0, 1],
		["circle(0% at 50% 50%)", "circle(120% at 50% 50%)"],
	);

	// 2. Wipe Reveal: left-to-right inset
	const wipeClip = useTransform(
		smoothScrollProgress,
		[0, 1],
		["inset(0% 100% 0% 0%)", "inset(0% 0% 0% 0%)"],
	);

	// 3. Curtain Reveal: splitting vertical lines parting from center
	const curtainClip = useTransform(
		smoothScrollProgress,
		[0, 1],
		["inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)"],
	);

	// 4. Corners Reveal: expanding square from the center
	const cornersClip = useTransform(
		smoothScrollProgress,
		[0, 1],
		["inset(45% 45% 45% 45% round 12px)", "inset(0% 0% 0% 0% round 0px)"],
	);

	// 5. Zoom Reveal: circle reveal with extreme scale
	const zoomClip = useTransform(
		smoothScrollProgress,
		[0, 1],
		["circle(20% at 50% 50%)", "circle(120% at 50% 50%)"],
	);

	// Map variant to clip path motion values
	const getClipPath = () => {
		switch (variant) {
			case "iris":
				return irisClip;
			case "wipe":
				return wipeClip;
			case "curtain":
				return curtainClip;
			case "corners":
				return cornersClip;
			case "zoom":
				return zoomClip;
			default:
				return undefined;
		}
	};

	// Image transformations (scaling / zoom effect)
	const imageScale = useTransform(
		smoothScrollProgress,
		[0, 1],
		zoom ? (variant === "zoom" ? [1.4, 1.0] : [1.0, 1.15]) : [1.0, 1.0],
	);

	const textOpacity = useTransform(smoothScrollProgress, isHero ? [0.1, 0.8] : [0.4, 0.9], [0, 1]);
	const textY = useTransform(
		smoothScrollProgress,
		isHero ? [0.1, 0.8] : [0.4, 0.9],
		isHero ? [30, 0] : [40, 0],
	);

	const scrollHintOpacity = useTransform(smoothScrollProgress, [0, 0.25], [0.7, 0]);

	// Generate static overlay grid elements for the "grid" variant
	const gridRows = 4;
	const gridCols = 4;
	const totalGridBlocks = gridRows * gridCols;

	return (
		<div
			ref={containerRef}
			style={{ height: isHero ? "100dvh" : `${scrollLength}vh` }}
			className={cn("relative w-full overflow-hidden", className)}
		>
			{/* Sticky stage viewport */}
			<div
				className={
					isHero
						? "relative h-[100dvh] w-full overflow-hidden"
						: "sticky top-0 h-[100vh] w-full overflow-hidden"
				}
			>
				{/* Background Overlay Color */}
				<div className={cn("absolute inset-0 z-0", overlayClassName)} />

				{/* Revealed Image Stage */}
				{variant === "grid" ? (
					// 6. Grid Reveal: 16 individual grid cells that scale down to 0
					<div className="absolute inset-0 z-10 h-full w-full overflow-hidden">
						{/* Base Image under the grid cells */}
						<motion.img
							src={imageSrc}
							alt=""
							style={{ scale: zoom ? imageScale : 1.0 }}
							className="absolute inset-0 h-full w-full object-cover object-center"
						/>
						<div className="absolute inset-0 z-20 grid h-full w-full grid-cols-4 grid-rows-4 gap-[1px]">
							{Array.from({ length: totalGridBlocks }).map((_, index) => (
								<GridBlock
									key={`grid-block-${index}`}
									progress={smoothScrollProgress}
									index={index}
									gridCols={gridCols}
									overlayClassName={overlayClassName}
								/>
							))}
						</div>
					</div>
				) : (
					<motion.div
						style={{
							clipPath: getClipPath(),
						}}
						className="absolute inset-0 z-10 h-full w-full overflow-hidden"
					>
						<motion.img
							src={imageSrc}
							alt=""
							style={{ scale: imageScale }}
							className="h-full w-full object-cover object-center filter brightness-95"
						/>
						{/* Subtle Inner vignette gradient */}
						<div className="absolute inset-0 bg-[radial-gradient(circle,_transparent_30%,_rgba(0,0,0,0.45)_100%)] mix-blend-multiply" />
					</motion.div>
				)}

				{/* Foreground Content Overlay */}
				{children && (
					<div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center select-none">
						<motion.div style={{ opacity: textOpacity, y: textY }}>{children}</motion.div>

						{isHero && (
							<motion.div
								style={{ opacity: scrollHintOpacity }}
								className="mt-14 flex flex-col items-center gap-2 pointer-events-none"
							>
								<span className="text-xs sm:text-sm tracking-[0.35em] uppercase text-muted-foreground/90 font-bold">
									Scroll to reveal
								</span>
								<motion.div
									animate={{ y: [0, 6, 0] }}
									transition={{
										repeat: Infinity,
										duration: 1.5,
										ease: "easeInOut",
									}}
									className="mt-1"
								>
									<svg
										className="w-5 h-5 text-muted-foreground/80"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M19 13l-7 7m0 0l-7-7m7 7V3"
										/>
									</svg>
								</motion.div>
							</motion.div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
