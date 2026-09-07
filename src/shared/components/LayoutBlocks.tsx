import { Loader2, X, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import React, {
	Component,
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { CAT_IMAGES, FALLBACK_CAT_IMAGE, FALLBACK_CAT_SVG } from "@/shared/lib/constants";
import { themeSurfaces } from "@/shared/lib/uiUtils";
import { cn, ErrorManager, handleImgError } from "@/shared/lib/utils";

export type ButtonVariant = "primary" | "danger" | "ghost" | "outline" | "flat" | "glass";
export type ButtonSize = "small" | "medium" | "large" | "icon";

const baseButtonClass =
	"inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-medium tracking-wide rounded-[var(--radius-button)] transition-transform transition-opacity duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none";

const variantClasses: Record<ButtonVariant, string> = {
	primary:
		"bg-primary text-primary-foreground shadow-sm hover:brightness-105 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97] active:brightness-95 border border-primary/20",
	danger:
		"bg-destructive text-destructive-foreground shadow-sm hover:brightness-105 motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 active:brightness-95 motion-safe:active:scale-[0.96]",
	ghost: "text-foreground/80 hover:bg-accent/40 hover:text-accent-foreground active:bg-accent/60",
	outline:
		"border border-border/80 bg-white/5 text-foreground shadow-sm hover:bg-accent/20 hover:border-border hover:text-accent-foreground motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 active:bg-accent/40 motion-safe:active:scale-[0.96] backdrop-blur-sm",
	flat: "text-foreground/80 hover:bg-accent/30 active:bg-accent/50",
	glass:
		"border border-white/15 bg-white/10 text-foreground backdrop-blur-md hover:bg-white/15 hover:border-white/25 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 active:bg-white/20 motion-safe:active:scale-[0.97]",
};

const sizeClasses: Record<ButtonSize, string> = {
	small: "h-8 px-3 text-xs rounded-md [&_svg]:size-3.5 min-h-[44px] sm:min-h-0",
	medium: "h-10 px-4 text-sm rounded-md [&_svg]:size-4 min-h-[44px] sm:min-h-0",
	large: "h-12 px-6 text-base font-semibold rounded-lg [&_svg]:size-5 min-h-[44px]",
	icon: "h-10 w-10 p-0 rounded-md [&_svg]:size-4 min-h-[44px] min-w-[44px]",
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
	children: React.ReactNode;
	variant?: ButtonVariant;
	size?: ButtonSize;
	disabled?: boolean;
	loading?: boolean;
	type?: "button" | "submit" | "reset";
	className?: string;
	onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	iconOnly?: boolean;
}

const ButtonComponent = ({
	children,
	variant = "primary",
	size = "medium",
	disabled = false,
	loading = false,
	type = "button",
	className = "",
	onClick,
	iconOnly = false,
	title,
	"aria-label": ariaLabel,
	...rest
}: ButtonProps) => {
	const finalSize = iconOnly ? "icon" : size;

	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (disabled || loading) {
			event.preventDefault();
			return;
		}
		onClick?.(event);
	};

	return (
		<button
			type={type}
			disabled={disabled || loading}
			className={cn(baseButtonClass, variantClasses[variant], sizeClasses[finalSize], className)}
			onClick={handleClick}
			title={iconOnly && !title && ariaLabel ? ariaLabel : title}
			aria-label={ariaLabel}
			{...rest}
		>
			{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
			{!iconOnly && children}
			{iconOnly && !loading && children}
		</button>
	);
};

ButtonComponent.displayName = "Button";

export const Button = memo(ButtonComponent);

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	children?: React.ReactNode;
	variant?: "default" | "filled";
	padding?: "none" | "medium";
	shadow?: "medium" | "large";
}

const CardBase = memo(
	React.forwardRef<HTMLDivElement, CardProps>(
		(
			{
				children,
				className = "",
				variant = "default",
				padding = "medium",
				shadow = "medium",
				...props
			},
			ref,
		) => {
			const finalClasses = cn(
				"relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 backdrop-blur-md",
				variant === "filled"
					? "bg-foreground/10 border-none"
					: "bg-foreground/5 border border-border/10 bg-background/40",
				padding === "none" ? "p-0" : "p-5",
				shadow === "large" ? "shadow-lg" : "shadow-md",
				className,
				"before:absolute before:inset-0 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500 before:pointer-events-none before:z-0",
				"before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_55%)]",
			);

			return (
				<div ref={ref} className={finalClasses} {...props}>
					<div className="relative z-10 h-full">{children}</div>
				</div>
			);
		},
	),
);

CardBase.displayName = "Card";

export const Card = CardBase;

export interface CatImageProps {
	src?: string;
	alt?: string;
	containerClassName?: string;
	imageClassName?: string;
	loading?: "lazy" | "eager";
	decoding?: "async" | "auto" | "sync";
	containerStyle?: React.CSSProperties;
	onLoad?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
	onError?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

function CatImage({
	src,
	alt = "Cat picture",
	containerClassName = "",
	imageClassName = "",
	loading = "lazy",
	decoding = "async",
	containerStyle,
	onLoad,
	onError,
}: CatImageProps) {
	const [hasError, setHasError] = useState(false);
	const [svgFallback, setSvgFallback] = useState(false);
	const fallbackUrl = CAT_IMAGES[0] ?? FALLBACK_CAT_IMAGE;

	const currentSrc = svgFallback ? FALLBACK_CAT_SVG : hasError || !src ? fallbackUrl : src;
	const isLocalAsset = currentSrc.startsWith("/");

	const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
		if (!hasError && src !== fallbackUrl) {
			setHasError(true);
		} else if (!svgFallback) {
			setSvgFallback(true);
		}
		onError?.(event);
	};

	const combinedStyle = {
		...containerStyle,
		"--bg-image": `url(${currentSrc})`,
	} as React.CSSProperties;

	return (
		<div className={containerClassName} style={combinedStyle}>
			<img
				src={currentSrc}
				alt={hasError || svgFallback ? "Fallback cat picture" : alt}
				className={imageClassName}
				loading={loading}
				decoding={decoding}
				onLoad={onLoad}
				onError={handleError}
				{...(isLocalAsset ? {} : { crossOrigin: "anonymous" as const })}
			/>
		</div>
	);
}

export { CatImage };

export interface EmptyStateProps {
	title: string;
	description?: ReactNode;
	className?: string;
}

export function EmptyState({ title, description, className }: EmptyStateProps) {
	return (
		<div
			className={cn(
				themeSurfaces.panelInset,
				"px-4 py-8 text-center text-sm text-muted-foreground",
				className,
			)}
		>
			<p>{title}</p>
			{description ? <p className="mt-1">{description}</p> : null}
		</div>
	);
}

export interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: React.ComponentType<ErrorFallbackProps>;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
	context?: string;
}

export interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorId: string | null;
}

export interface ErrorFallbackProps {
	error: Error | null;
	errorId: string | null;
	resetError: () => void;
	context: string;
}

const handleGoHome = (resetError: () => void) => {
	resetError();
	if (window.location.pathname === "/") {
		window.location.reload();
		return;
	}
	window.location.assign("/");
};

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
	error,
	errorId,
	resetError,
	context,
}) => {
	return (
		<div className="mx-auto my-8 flex min-h-[40vh] w-full max-w-xl items-center justify-center px-4">
			<div className="w-full rounded-lg border border-destructive/30 bg-background/80 p-6 text-center shadow-xl backdrop-blur">
				<h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
				<p className="mt-2 text-sm text-muted-foreground">{context} could not finish loading.</p>
				<p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
					{error?.message || "An unexpected error occurred."}
				</p>
				{errorId ? (
					<p className="mt-2 font-mono text-xs text-muted-foreground">ID: {errorId}</p>
				) : null}
				<div className="mt-5 flex flex-wrap justify-center gap-3">
					<button
						onClick={resetError}
						className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer disabled:cursor-not-allowed"
						type="button"
					>
						Try again
					</button>
					<button
						onClick={() => handleGoHome(resetError)}
						className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						type="button"
					>
						Go home
					</button>
				</div>
			</div>
		</div>
	);
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null, errorId: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error, errorId: null };
	}

	override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		const { onError, context = "React Component" } = this.props;

		const formattedError = ErrorManager.handleError(error, context, {
			componentStack: errorInfo.componentStack,
			isCritical: true,
		});

		this.setState({ errorId: formattedError ? formattedError.id : null });
		onError?.(error, errorInfo);
	}

	resetError = () => {
		this.setState({ hasError: false, error: null, errorId: null });
	};

	override render() {
		if (this.state.hasError) {
			const FallbackComponent = this.props.fallback || DefaultErrorFallback;
			return (
				<FallbackComponent
					error={this.state.error}
					errorId={this.state.errorId}
					resetError={this.resetError}
					context={this.props.context || "Application"}
				/>
			);
		}

		return this.props.children;
	}
}

export interface AppError {
	message?: string;
	severity?: string;
	isRetryable?: boolean;
	timestamp?: number | string;
	details?: string;
	suggestion?: string;
	errorType?: string;
	attempts?: number;
	originalError?: unknown;
	stack?: string;
	context?: string;
	[key: string]: unknown;
}

export interface ErrorProps {
	variant?: "boundary" | "inline";
	error?: AppError | string | unknown;
	onDismiss?: () => void;
	context?: string;
	className?: string;
	children?: React.ReactNode;
}

export interface ErrorInlineProps {
	error: AppError | string | unknown;
	onDismiss?: () => void;
	className?: string;
}

const ErrorInline: React.FC<ErrorInlineProps> = ({ error, onDismiss, className = "" }) => {
	if (!error) {
		return null;
	}
	const msg = typeof error === "string" ? error : (error as AppError).message || "Error";
	return (
		<div
			className={cn(
				"flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-100 text-sm shadow-sm backdrop-blur-sm",
				className,
			)}
			role="alert"
		>
			<span className="text-lg leading-none select-none">!</span>
			<span className="flex-1 font-medium pt-0.5 leading-tight">{msg}</span>
			{onDismiss && (
				<button
					onClick={onDismiss}
					className="rounded-full p-1 text-yellow-100/70 transition-colors hover:bg-yellow-500/20 hover:text-yellow-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 cursor-pointer disabled:cursor-not-allowed"
					aria-label="Dismiss error"
					title="Dismiss error"
					type="button"
				>
					<X size={14} />
				</button>
			)}
		</div>
	);
};

export const ErrorComponent: React.FC<ErrorProps> = ({
	variant = "inline",
	error,
	onDismiss,
	context,
	className = "",
	children,
}) => {
	if (variant === "boundary") {
		return <ErrorBoundary context={context || "Component Boundary"}>{children}</ErrorBoundary>;
	}
	return <ErrorInline error={error} onDismiss={onDismiss} className={className} />;
};

ErrorComponent.displayName = "ErrorComponent";

export interface BaseFieldProps {
	label?: string;
	error?: string | null;
	required?: boolean;
	className?: string;
}

const inputBaseStyles =
	"flex h-12 w-full rounded-2xl border border-border/30 bg-white/5 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 text-foreground backdrop-blur-md transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out relative z-10";

const errorStyles = "border-destructive focus-visible:ring-destructive";

export interface FormFieldProps extends BaseFieldProps {
	children: React.ReactNode;
	id?: string;
	name?: string;
	disabled?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
	id,
	name,
	label,
	error,
	required = false,
	disabled = false,
	children,
	className = "",
}) => {
	const generatedId = useId();
	const fieldId = id || (name ? `${name}-field` : `field-${generatedId}`);
	const errorId = error ? `${fieldId}-error` : undefined;

	return (
		<div className={cn("flex flex-col gap-2 w-full", className)}>
			{label && (
				<label
					htmlFor={fieldId}
					className={cn(
						"text-sm font-medium leading-none text-foreground ml-1 transition-opacity",
						disabled && "cursor-not-allowed opacity-50",
					)}
				>
					{label}
					{required ? <span className="text-destructive ml-1">*</span> : null}
				</label>
			)}
			{children}
			{error && errorId && (
				<div
					id={errorId}
					className="ml-1 text-xs font-medium text-destructive motion-safe:animate-[fadeIn_140ms_ease-out]"
					role="alert"
				>
					{error}
				</div>
			)}
		</div>
	);
};

FormField.displayName = "FormField";

export interface InputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">,
		BaseFieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ label, error, required, className = "", ...props }, ref) => {
		const internalId = useId();
		const id = props.id || internalId;
		const hasError = Boolean(error);
		const [isFocused, setIsFocused] = useState(false);

		return (
			<FormField id={id} label={label} error={error} required={required} disabled={props.disabled}>
				<div className="relative isolate group">
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
							inputBaseStyles,
							hasError && errorStyles,
							isFocused ? "bg-white/10" : "hover:bg-white/10 hover:border-border/40",
							className,
						)}
						aria-invalid={hasError || undefined}
						aria-describedby={hasError ? `${id}-error` : undefined}
					/>
					{hasError && (
						<span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-destructive pointer-events-none motion-safe:animate-[fadeIn_160ms_ease-out] z-20">
							<XCircle size={16} />
						</span>
					)}
				</div>
			</FormField>
		);
	},
);

Input.displayName = "Input";

export interface TextareaProps
	extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">,
		BaseFieldProps {
	showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ label, error, required, value, showCount = false, className = "", ...props }, ref) => {
		const internalId = useId();
		const id = props.id || internalId;
		const hasError = Boolean(error);
		const [isFocused, setIsFocused] = useState(false);

		const currentLength = String(value || "").length;
		const maxLength = props.maxLength;
		const countId = `${id}-count`;

		const describedBy = [
			hasError ? `${id}-error` : undefined,
			showCount && maxLength ? countId : undefined,
		]
			.filter(Boolean)
			.join(" ");

		return (
			<FormField id={id} label={label} error={error} required={required} disabled={props.disabled}>
				<div className="relative isolate group">
					<textarea
						{...props}
						id={id}
						ref={ref}
						value={value}
						onFocus={(e) => {
							setIsFocused(true);
							props.onFocus?.(e);
						}}
						onBlur={(e) => {
							setIsFocused(false);
							props.onBlur?.(e);
						}}
						className={cn(
							inputBaseStyles,
							"min-h-[80px] py-3",
							hasError && errorStyles,
							isFocused ? "bg-white/10" : "hover:bg-white/10 hover:border-border/40",
							className,
						)}
						aria-invalid={hasError || undefined}
						aria-describedby={describedBy || undefined}
					/>
					{hasError && (
						<span className="absolute right-3.5 top-3 text-destructive pointer-events-none motion-safe:animate-[fadeIn_160ms_ease-out] z-20">
							<XCircle size={16} />
						</span>
					)}
					{showCount && maxLength && (
						<div
							id={countId}
							className={cn(
								"absolute bottom-3 right-3 text-xs z-20 transition-colors",
								currentLength >= maxLength
									? "text-destructive font-medium"
									: "text-muted-foreground",
							)}
						>
							{currentLength}/{maxLength}
						</div>
					)}
				</div>
			</FormField>
		);
	},
);

Textarea.displayName = "Textarea";

const LOADING_ASSET = "/assets/images/cats/cat.gif";

export interface LoadingProps {
	variant?: "spinner" | "skeleton" | "card-skeleton" | "cat-gif";
	text?: string;
	className?: string;
	height?: string | number;
}

function SpinnerCircle({
	size = "medium",
	className,
}: {
	size?: "small" | "medium";
	className?: string;
}) {
	const dimensions = size === "small" ? "h-6 w-6 border-2" : "h-8 w-8 border-4";

	return (
		<div
			className={cn(
				"animate-spin rounded-full border-white/10 border-t-primary border-r-primary/60",
				dimensions,
				className,
			)}
			aria-hidden={true}
		/>
	);
}

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
	return (
		<div
			className={cn(
				"animate-pulse rounded-lg bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.12),rgba(255,255,255,0.04))] bg-[length:200%_100%]",
				className,
			)}
			style={style}
			aria-hidden={true}
		/>
	);
}

export const Loading: React.FC<LoadingProps> = memo(
	({ variant = "spinner", text, className = "", height = 20 }) => {
		const containerClasses = cn("flex flex-col items-center justify-center gap-3 p-4", className);

		if (variant === "skeleton") {
			return (
				<SkeletonBlock
					className={cn("rounded-lg", className)}
					style={{
						width: "100%",
						height: typeof height === "number" ? `${height}px` : height,
					}}
				/>
			);
		}

		if (variant === "card-skeleton") {
			return (
				<div
					className={cn(
						"flex flex-col gap-3 overflow-hidden rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm",
						className,
					)}
					style={{
						width: "100%",
						height: typeof height === "number" ? `${height}px` : height,
						minHeight: typeof height === "number" ? `${height}px` : "200px",
					}}
				>
					<div className="flex items-center gap-3">
						<SkeletonBlock className="h-10 w-10 rounded-full" />
						<div className="flex flex-1 flex-col gap-2">
							<SkeletonBlock className="h-4 w-3/4" />
							<SkeletonBlock className="h-3 w-1/2" />
						</div>
					</div>
					<SkeletonBlock className="min-h-[100px] w-full flex-1" />
					<div className="flex justify-end pt-2">
						<SkeletonBlock className="h-8 w-20" />
					</div>
					{text ? <div className="pt-2 text-center text-xs text-white/50">{text}</div> : null}
				</div>
			);
		}

		if (variant === "cat-gif") {
			return (
				<div className={containerClasses} role="status" aria-label="Loading">
					<img
						src={LOADING_ASSET}
						alt=""
						aria-hidden="true"
						className="h-44 w-auto select-none object-contain opacity-95"
						onError={handleImgError}
					/>
					{text && <p className="text-[10px] font-semibold tracking-wide text-white/35">{text}</p>}
				</div>
			);
		}

		return (
			<div className={containerClasses} role="status" aria-label="Loading">
				<SpinnerCircle />
				{text ? (
					<p className="mt-2 text-sm font-medium text-white/80">{text}</p>
				) : (
					<span className="sr-only">Loading...</span>
				)}
			</div>
		);
	},
);

Loading.displayName = "Loading";

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
	title: string;
	open?: boolean;
	onClose: () => void;
	children: React.ReactNode;
	closeDisabled?: boolean;
	description?: string;
	hideTitle?: boolean;
}

const EXIT_DURATION_MS = 220;

function useModalAnimation(isOpenResolved: boolean) {
	const [isClosing, setIsClosing] = useState(false);
	const [shouldRender, setShouldRender] = useState(isOpenResolved);

	useEffect(() => {
		if (isOpenResolved) {
			setShouldRender(true);
			setIsClosing(false);
			return;
		}
		if (!shouldRender) {
			return;
		}
		setIsClosing(true);
		const timer = window.setTimeout(() => {
			setShouldRender(false);
			setIsClosing(false);
		}, EXIT_DURATION_MS);
		return () => window.clearTimeout(timer);
	}, [isOpenResolved, shouldRender]);

	return { isClosing, shouldRender };
}

export interface ModalHeaderProps {
	title: string;
	hideTitle: boolean;
	requestClose: () => void;
	closeDisabled: boolean;
}

function ModalHeader({ title, hideTitle, requestClose, closeDisabled }: ModalHeaderProps) {
	const headerContent = (
		<>
			<h2
				id="modal-title"
				className={
					hideTitle ? "sr-only" : "text-base sm:text-lg font-bold text-foreground tracking-tight"
				}
			>
				{title}
			</h2>
			<button
				type="button"
				onClick={requestClose}
				disabled={closeDisabled}
				className={`inline-flex items-center justify-center size-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
					hideTitle ? "absolute top-3.5 right-3.5 z-10" : ""
				}`}
				aria-label={`Close ${title.toLowerCase()}`}
				title={`Close ${title.toLowerCase()}`}
			>
				<X className="size-4" />
			</button>
		</>
	);

	if (hideTitle) {
		return headerContent;
	}

	return (
		<div className="flex items-center justify-between pb-3 mb-4 border-b border-border/30">
			{headerContent}
		</div>
	);
}

export function Modal({
	title,
	open,
	onClose,
	children,
	closeDisabled = false,
	description,
	hideTitle = false,
}: ModalProps) {
	const isOpenResolved = open ?? true;
	const { isClosing, shouldRender } = useModalAnimation(isOpenResolved);
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const hasCapturedFocusRef = useRef(false);
	const onCloseRef = useRef(onClose);

	// Keep onCloseRef always pointing to the latest onClose callback
	useEffect(() => {
		onCloseRef.current = onClose;
	});

	const requestClose = useCallback(() => {
		if (closeDisabled) {
			return;
		}
		onCloseRef.current();
	}, [closeDisabled]);

	// Auto-focus the dialog on mount and restore focus on unmount
	useEffect(() => {
		if (shouldRender && !isClosing) {
			// Only capture the trigger element on the initial open, not on rapid re-opens
			if (!hasCapturedFocusRef.current) {
				previousFocusRef.current = document.activeElement as HTMLElement | null;
				hasCapturedFocusRef.current = true;
			}
			// Use a small delay so the DOM is ready
			const timer = window.setTimeout(() => {
				dialogRef.current?.focus();
			}, 0);
			return () => window.clearTimeout(timer);
		}

		if (!shouldRender) {
			if (previousFocusRef.current) {
				previousFocusRef.current.focus();
				previousFocusRef.current = null;
			}
			hasCapturedFocusRef.current = false;
		}
	}, [shouldRender, isClosing]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape" && !closeDisabled) {
				event.preventDefault();
				requestClose();
				return;
			}

			if (event.key !== "Tab") {
				return;
			}

			const dialog = dialogRef.current;
			if (!dialog) {
				return;
			}

			const focusableElements = Array.from(
				dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
			);
			if (focusableElements.length === 0) {
				event.preventDefault();
				return;
			}

			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (event.shiftKey) {
				if (document.activeElement === firstElement || document.activeElement === dialog) {
					event.preventDefault();
					lastElement?.focus();
				}
			} else {
				if (document.activeElement === lastElement) {
					event.preventDefault();
					firstElement?.focus();
				}
			}
		},
		[closeDisabled, requestClose],
	);

	if (!shouldRender) {
		return null;
	}

	const surfaceAnimation = isClosing
		? "motion-safe:animate-[fadeIn_180ms_ease-out_reverse_forwards]"
		: "motion-safe:animate-[surface-enter_220ms_var(--ease-out-expo)]";
	const overlayAnimation = isClosing
		? "motion-safe:animate-[fadeIn_220ms_ease-out_reverse_forwards]"
		: "motion-safe:animate-[fadeIn_180ms_ease-out]";

	return (
		<div
			className={`fixed inset-0 z-modal-backdrop flex items-center justify-center px-4 pb-24 sm:pb-4 ${overlayAnimation}`}
		>
			<div
				className="absolute inset-0 bg-background/60 backdrop-blur-sm"
				onClick={() => {
					if (!closeDisabled) {
						requestClose();
					}
				}}
				aria-hidden="true"
			/>

			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
				aria-describedby={description ? "modal-description" : undefined}
				tabIndex={-1}
				onKeyDown={handleKeyDown}
				className={`glass-surface relative z-modal-dialog w-full max-w-md overflow-hidden rounded-2xl border border-border/40 bg-card/85 backdrop-blur-xl p-5 sm:p-6 shadow-2xl ${surfaceAnimation}`}
			>
				<ModalHeader
					title={title}
					hideTitle={hideTitle}
					requestClose={requestClose}
					closeDisabled={closeDisabled}
				/>

				{description && (
					<p id="modal-description" className="sr-only">
						{description}
					</p>
				)}

				{children}
			</div>
		</div>
	);
}

export function OfflineIndicator() {
	const [isOnline, setIsOnline] = useState(
		typeof navigator === "undefined" ? true : navigator.onLine,
	);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	if (isOnline) {
		return null;
	}

	return (
		<div className="indicator" role="status" aria-live="polite">
			<div className="indicator-content">
				<span className="indicator-dot" />
				<span className="indicator-message">You are offline</span>
			</div>
		</div>
	);
}

export interface SectionProps {
	id?: string;
	children: ReactNode;
	maxWidth?: "md" | "xl" | "2xl" | "full";
	className?: string;
	separator?: boolean;
	fullpage?: boolean;
	ariaLabelledBy?: string;
	ariaLabel?: string;
}

const maxWidthClasses = {
	md: "app-section--max-md",
	xl: "app-section--max-xl",
	"2xl": "app-section--max-2xl",
	full: "w-full max-w-none px-0",
} as const;

export function Section({
	id,
	children,
	maxWidth = "2xl",
	className = "",
	separator = false,
	fullpage = false,
	ariaLabelledBy,
	ariaLabel,
}: SectionProps) {
	return (
		<section
			id={id}
			aria-labelledby={ariaLabelledBy}
			aria-label={ariaLabel}
			className={cn(
				"app-section",
				maxWidthClasses[maxWidth],
				separator && "app-section--separator",
				fullpage && "app-section--fullpage",
				className,
			)}
		>
			{children}
		</section>
	);
}
