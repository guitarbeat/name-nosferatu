
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErrorBoundary, ErrorComponent, Iridescence, Loading, Modal, OfflineIndicator, RouteFallback, Section, StaggeredMenu, type StaggeredMenuItem } from '@/shared/components';
import { useAppStoreInitialization } from "@/store";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig, motion } from "framer-motion";
import { AlertTriangle, Info, X, XCircle } from "lucide-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { NameSuggestion } from "@/features/tournament/NameSuggestion";
import { queryClient } from "@/shared/api";

import { usePrefersReducedMotion, usePreloadImages } from "@/shared/hooks";
import { STORAGE_KEYS } from '@/shared/lib/constants';
import { scaleFadeMotionPreset } from "@/shared/lib/uiUtils";
import { setupGlobalImageErrorHandler } from "@/shared/lib/utils";
import useAppStore from "@/store";
import { AdminRoute, HomeRoute } from "./routes/Routes";

import "../index.css";

// Install global image fallback error handler immediately
setupGlobalImageErrorHandler();

function registerServiceWorker(): void {
	if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
		return;
	}

	window.addEventListener(
		"load",
		() => {
			navigator.serviceWorker.register("/sw.js").catch((error) => {
				console.warn("Service worker registration failed:", error);
			});
		},
		{ once: true },
	);
}

registerServiceWorker();

async function initSentry(): Promise<void> {
	if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) {
		return;
	}

	try {
		const Sentry = await import("@sentry/react");
		Sentry.init({
			dsn: import.meta.env.VITE_SENTRY_DSN,
			integrations: [
				Sentry.browserTracingIntegration(),
				Sentry.replayIntegration({
					maskAllText: false,
					blockAllMedia: false,
				}),
			],
			tracesSampleRate: 1.0,
			replaysSessionSampleRate: 0.1,
			replaysOnErrorSampleRate: 1.0,
			environment: import.meta.env.MODE,
			release: `name-nosferatu@${import.meta.env.VITE_APP_VERSION || "1.0.2"}`,
		});
	} catch (error) {
		console.warn(
			"Sentry not available, continuing without error tracking:",
			error,
		);
	}
}

initSentry();

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<ErrorBoundary
			context="Application Root"
			onError={(error: Error, errorInfo: React.ErrorInfo) => {
				// Sentry will automatically capture this through ErrorManager
				console.error("Application error:", error, errorInfo);
			}}
		>
			<QueryClientProvider client={queryClient}>
				<Providers>
					<BrowserRouter>
						<App />
					</BrowserRouter>
				</Providers>
			</QueryClientProvider>
		</ErrorBoundary>
	</React.StrictMode>,
);


import {
	getStorageString,
	removeStorageItem,
	setStorageString,
} from "@/shared/lib/storage";

const DEFAULT_TOAST_DURATION_MS = 5000;
const DEFAULT_MAX_TOASTS = 5;

export const localAuthAdapter: AuthAdapter = {
	getCurrentUser: async (): Promise<AuthUser | null> => {
		const name = getStorageString(STORAGE_KEYS.USER);
		const id = getStorageString(STORAGE_KEYS.USER_ID);
		if (!name || !id) {
			return null;
		}
		return { id, name, isAdmin: name.toLowerCase() === "admin" };
	},
	login: async (credentials: LoginCredentials): Promise<boolean> => {
		const name =
			credentials.name || credentials.email?.split("@")[0] || "Guest";
		const id = `local-usr-${Date.now()}`;
		setStorageString(STORAGE_KEYS.USER, name);
		setStorageString(STORAGE_KEYS.USER_ID, id);
		return true;
	},
	logout: async (): Promise<void> => {
		removeStorageItem(STORAGE_KEYS.USER);
		removeStorageItem(STORAGE_KEYS.USER_ID);
	},
	register: async (data: RegisterData): Promise<void> => {
		const name = data.name || data.email?.split("@")[0] || "Guest";
		const id = `local-usr-${Date.now()}`;
		setStorageString(STORAGE_KEYS.USER, name);
		setStorageString(STORAGE_KEYS.USER_ID, id);
	},
	checkAdminStatus: async (userIdOrName: string): Promise<boolean> => {
		return userIdOrName.toLowerCase() === "admin";
	},
};

interface ProvidersProps {
	children: ReactNode;
	auth?: {
		adapter: AuthAdapter;
	};
	toastMaxToasts?: number;
	toastDefaultDuration?: number;
	toastPosition?: ToastPosition;
}

export function Providers({
	children,
	auth,
	toastMaxToasts = DEFAULT_MAX_TOASTS,
	toastDefaultDuration = DEFAULT_TOAST_DURATION_MS,
	toastPosition = "top-right",
}: ProvidersProps) {
	return (
		<AuthProvider adapter={auth?.adapter ?? localAuthAdapter}>
			<ToastProvider
				maxToasts={toastMaxToasts}
				defaultDuration={toastDefaultDuration}
				position={toastPosition}
			>
				{children}
			</ToastProvider>
		</AuthProvider>
	);
}

type UserRole = "user" | "moderator" | "admin";

interface AuthUser {
	id: string;
	name: string;
	email?: string;
	isAdmin: boolean;
	isLoggedIn?: boolean;
	avatarUrl?: string;
	role?: UserRole;
}

interface LoginCredentials {
	email?: string;
	password?: string;
	name?: string;
}

interface RegisterData {
	email: string;
	password: string;
	name: string;
}

interface AuthAdapter {
	getCurrentUser: () => Promise<AuthUser | null>;
	login: (credentials: LoginCredentials) => Promise<boolean>;
	logout: () => Promise<void>;
	register: (data: RegisterData) => Promise<void>;
	checkAdminStatus: (userIdOrName: string) => Promise<boolean>;
}

interface AuthContextValue {
	user: AuthUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (credentials: LoginCredentials) => Promise<boolean>;
	logout: () => Promise<void>;
	register: (data: RegisterData) => Promise<void>;
	checkAdminStatus: (userIdOrName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error(
			"useAuth must be used within <Providers>. Wrap your component tree with <Providers> in main.tsx.",
		);
	}

	return context;
}

function useAuthProvider(adapter: AuthAdapter): AuthContextValue {
	const [user, setUser] = useState<AuthContextValue["user"]>(null);
	const [isLoading, setIsLoading] = useState(true);
	const adapterRef = useRef(adapter);
	useEffect(() => {
		adapterRef.current = adapter;
	}, [adapter]);

	useEffect(() => {
		let cancelled = false;

		// Fallback timeout to ensure isLoading does not stay true forever if getCurrentUser stalls
		const timeoutId = setTimeout(() => {
			if (!cancelled) {
				setIsLoading(false);
			}
		}, 2500);

		adapterRef.current
			.getCurrentUser()
			.then((nextUser) => {
				if (!cancelled) {
					setUser(nextUser);
				}
			})
			.catch((error) => {
				console.error("[Providers] Failed to fetch current user:", error);
			})
			.finally(() => {
				if (!cancelled) {
					clearTimeout(timeoutId);
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
			clearTimeout(timeoutId);
		};
	}, []);

	const login = useCallback(
		async (credentials: LoginCredentials): Promise<boolean> => {
			try {
				const success = await adapterRef.current.login(credentials);
				if (success) {
					const updatedUser = await adapterRef.current.getCurrentUser();
					setUser(updatedUser);
				}
				return success;
			} catch (error) {
				console.error("[Providers] Login failed:", error);
				throw error;
			}
		},
		[],
	);

	const logout = useCallback(async () => {
		try {
			await adapterRef.current.logout();
			setUser(null);
		} catch (error) {
			console.error("[Providers] Logout failed:", error);
			throw error;
		}
	}, []);

	const register = useCallback(async (data: RegisterData) => {
		await adapterRef.current.register(data);
	}, []);

	const checkAdminStatus = useCallback(async (userIdOrName: string) => {
		return adapterRef.current.checkAdminStatus(userIdOrName);
	}, []);

	return useMemo(
		() => ({
			user,
			isLoading,
			isAuthenticated: user !== null,
			login,
			logout,
			register,
			checkAdminStatus,
		}),
		[user, isLoading, login, logout, register, checkAdminStatus],
	);
}

interface AuthProviderProps {
	children: ReactNode;
	adapter?: AuthAdapter;
}

export function AuthProvider({
	children,
	adapter = localAuthAdapter,
}: AuthProviderProps) {
	const value = useAuthProvider(adapter);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
	duration?: number;
	autoDismiss?: boolean;
}

interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
	duration: number;
	autoDismiss: boolean;
	createdAt: number;
}

interface ToastContextValue {
	toasts: ToastItem[];
	showToast: (
		message: string,
		type?: ToastType,
		options?: ToastOptions,
	) => string;
	hideToast: (id: string) => void;
	clearToasts: () => void;
	showSuccess: (message: string, options?: ToastOptions) => string;
	showError: (message: string, options?: ToastOptions) => string;
	showInfo: (message: string, options?: ToastOptions) => string;
	showWarning: (message: string, options?: ToastOptions) => string;
}

type ToastPosition =
	| "top-left"
	| "top-center"
	| "top-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

const POSITION_CLASSES: Record<ToastPosition, string> = {
	"top-left": "top-4 left-4 items-start",
	"top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
	"top-right": "top-4 right-4 items-end",
	"bottom-left": "bottom-4 left-4 items-start",
	"bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
	"bottom-right": "bottom-4 right-4 items-end",
};

const TYPE_STYLES: Record<ToastType, { bg: string; icon: React.ReactNode }> = {
	success: { bg: "bg-chart-2", icon: <CheckCircle className="size-5" /> },
	error: { bg: "bg-destructive", icon: <XCircle className="size-5" /> },
	warning: {
		bg: "bg-chart-4 text-foreground",
		icon: <AlertTriangle className="size-5" />,
	},
	info: { bg: "bg-primary", icon: <Info className="size-5" /> },
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error(
			"useToast must be used within <Providers>. Wrap your component tree with <Providers> in main.tsx.",
		);
	}

	return context;
}

function ToastMessage({
	toast,
	onDismiss,
}: {
	toast: ToastItem;
	onDismiss: (id: string) => void;
}) {
	const style = TYPE_STYLES[toast.type];
	return (
		<div
			className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${style.bg}`}
			role="alert"
		>
			<span className="text-base leading-none" aria-hidden={true}>
				{style.icon}
			</span>
			<span className="flex-1">{toast.message}</span>
			<button
				onClick={() => onDismiss(toast.id)}
				className="ml-2 -mr-2 rounded-md p-1.5 opacity-70 transition-all hover:opacity-100 hover:bg-black/10 active:scale-95"
				aria-label="Dismiss"
				title="Dismiss"
				type="button"
			>
				<X className="size-4" />
			</button>
		</div>
	);
}

function ToastContainer({
	toasts,
	onDismiss,
	position,
}: {
	toasts: ToastItem[];
	onDismiss: (id: string) => void;
	position: ToastPosition;
}) {
	if (toasts.length === 0) {
		return null;
	}

	return (
		<section
			className={`fixed z-[9999] flex flex-col gap-2 ${POSITION_CLASSES[position]}`}
			aria-live="polite"
			aria-label="Notifications"
		>
			{toasts.map((toast) => (
				<ToastMessage key={toast.id} toast={toast} onDismiss={onDismiss} />
			))}
		</section>
	);
}

function useToastProvider(
	maxToasts: number,
	defaultDuration: number,
): ToastContextValue & {
	toastList: ToastItem[];
	dismiss: (id: string) => void;
} {
	const [toasts, setToasts] = useState<ToastItem[]>([]);
	const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
	const toastCounter = useRef(0);

	const scheduleAutoDismiss = useCallback((id: string, duration: number) => {
		const timer = setTimeout(() => {
			setToasts((previous) => previous.filter((toast) => toast.id !== id));
			timers.current.delete(id);
		}, duration);

		timers.current.set(id, timer);
	}, []);

	useEffect(() => {
		return () => {
			for (const timer of timers.current.values()) {
				clearTimeout(timer);
			}
			timers.current.clear();
		};
	}, []);

	const showToast = useCallback(
		(
			message: string,
			type: ToastType = "info",
			options: ToastOptions = {},
		): string => {
			const id = `toast-${++toastCounter.current}`;
			const duration = options.duration ?? defaultDuration;
			const autoDismiss = options.autoDismiss ?? true;

			const item: ToastItem = {
				id,
				message,
				type,
				duration,
				autoDismiss,
				createdAt: Date.now(),
			};

			setToasts((previous) => [item, ...previous].slice(0, maxToasts));

			if (autoDismiss) {
				scheduleAutoDismiss(id, duration);
			}

			return id;
		},
		[defaultDuration, maxToasts, scheduleAutoDismiss],
	);

	const hideToast = useCallback((id: string) => {
		setToasts((previous) => previous.filter((toast) => toast.id !== id));
		const timer = timers.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timers.current.delete(id);
		}
	}, []);

	const clearToasts = useCallback(() => {
		setToasts([]);
		for (const timer of timers.current.values()) {
			clearTimeout(timer);
		}
		timers.current.clear();
	}, []);

	const showSuccess = useCallback(
		(message: string, options?: ToastOptions) =>
			showToast(message, "success", options),
		[showToast],
	);
	const showError = useCallback(
		(message: string, options?: ToastOptions) =>
			showToast(message, "error", options),
		[showToast],
	);
	const showInfo = useCallback(
		(message: string, options?: ToastOptions) =>
			showToast(message, "info", options),
		[showToast],
	);
	const showWarning = useCallback(
		(message: string, options?: ToastOptions) =>
			showToast(message, "warning", options),
		[showToast],
	);

	return useMemo(
		() => ({
			toasts,
			showToast,
			hideToast,
			clearToasts,
			showSuccess,
			showError,
			showInfo,
			showWarning,
			toastList: toasts,
			dismiss: hideToast,
		}),
		[
			toasts,
			showToast,
			hideToast,
			clearToasts,
			showSuccess,
			showError,
			showInfo,
			showWarning,
		],
	);
}

interface ToastProviderProps {
	children: ReactNode;
	defaultDuration: number;
	maxToasts: number;
	position: ToastPosition;
}

export function ToastProvider({
	children,
	defaultDuration,
	maxToasts,
	position,
}: ToastProviderProps) {
	const { toastList, dismiss, ...value } = useToastProvider(
		maxToasts,
		defaultDuration,
	);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<ToastContainer
				toasts={toastList}
				onDismiss={dismiss}
				position={position}
			/>
		</ToastContext.Provider>
	);
}

import {
	BarChart3,
	CheckCircle,
	Lightbulb,
	Lock,
	Trophy,
	User,
} from "lucide-react";

import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";


import {
	cn,
	ErrorManager,
	handleImgError,
	hapticNavTap,
	hapticTournamentStart,
} from "@/shared/lib/utils";

const BOOT_TIMEOUT_FALLBACK_MS = 2500;
const INSTALL_DESCRIPTION =
	"Add Name Nosferatu to your home screen for quick access to cat name tournaments and your rankings.";
const PWA_TINT = "hsl(152, 26%, 42%)";

export function AppBootScreen({
	message = "Preparing the tournament...",
	visible = true,
}: {
	message?: string;
	visible?: boolean;
}) {
	if (!visible) {
		return null;
	}

	return (
		<div
			data-testid="boot-screen"
			className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground"
		>
			<motion.div
				{...scaleFadeMotionPreset}
				className="flex flex-col items-center space-y-6 px-4 text-center max-w-md"
			>
				<div className="relative flex h-16 w-16 items-center justify-center">
					<div className="absolute h-16 w-16 rounded-full border-4 border-primary/20" />
					<div className="absolute h-16 w-16 rounded-full border-4 border-t-primary animate-spin" />
				</div>

				<div className="space-y-2">
					<h2 className="text-xl font-bold tracking-tight text-foreground">
						{message}
					</h2>
					<p className="text-sm text-muted-foreground animate-pulse">
						Please wait a moment while we load the application context...
					</p>
				</div>
			</motion.div>
		</div>
	);
}

/**
 * Cross-browser PWA install dialog (Chromium prompt + Apple share instructions).
 */
export function PwaInstallPrompt() {
	const installRef = useRef<PWAInstallElement | null>(null);

	useEffect(() => {
		const element = installRef.current;
		if (!element) {
			return;
		}

		element.manifestUrl = "/manifest.json";
		element.useLocalStorage = true;
		element.installDescription = INSTALL_DESCRIPTION;
		element.styles = { "--tint-color": PWA_TINT };

		const deferred = window.__deferredPwaPrompt;
		if (deferred) {
			element.externalPromptEvent = deferred;
		}
	}, []);

	return <pwa-install ref={installRef} />;
}

const keyToId = {
	landing: "pick",
	about: "pick",
	pick: "pick",
	tournament: "pick",
	stats: "analysis",
	analysis: "analysis",
	results: "analysis",
} as const;

type NavSection = keyof typeof keyToId;

interface NavItem {
	id: string;
	label: string;
	icon: ReactNode;
	isActive?: boolean;
	isAccent?: boolean;
	hasBadge?: boolean;
	onClick: () => void;
}

const LazyProfileInner = lazy(() =>
	import("@/shared/components").then((module) => ({
		default: module.ProfileInner,
	})),
);

export function FloatingNavbar() {
	const tournament = useAppStore((s) => s.tournament);
	const tournamentActions = useAppStore((s) => s.tournamentActions);
	const user = useAppStore((s) => s.user);
	const navigate = useNavigate();
	const location = useLocation();
	const { login, logout } = useAuth();
	const { selectedNames } = tournament;
	const { isLoggedIn, name: userName, avatarUrl, isAdmin } = user;
	const [activeSection, setActiveSection] = useState<NavSection>("pick");
	const prefersReducedMotion = usePrefersReducedMotion();
	const [pendingScroll, setPendingScroll] = useState<NavSection | null>(null);
	const [isProfileOpen, setIsProfileOpen] = useState(false);
	const [isSuggestOpen, setIsSuggestOpen] = useState(false);

	const isHomeRoute = location.pathname === "/";
	const isAdminRoute = location.pathname === "/admin";
	const isTournamentRoute = location.pathname === "/tournament";

	const selectedCount = selectedNames?.length || 0;
	const isTournamentActive = Boolean(
		tournament.names && tournament.names.length >= 2 && !tournament.isComplete,
	);
	const profileLabel = isLoggedIn
		? userName?.split(" ")[0] || "Profile"
		: "Profile";

	const scrollToSection = useCallback(
		(key: NavSection | string) => {
			const id = keyToId[key as NavSection] || key;
			const target =
				document.getElementById(id) || document.getElementById(key);
			if (!target) {
				window.scrollTo({
					top: 0,
					behavior: prefersReducedMotion ? "auto" : "smooth",
				});
				return;
			}

			target.scrollIntoView({
				behavior: prefersReducedMotion ? "auto" : "smooth",
				block: "start",
			});
		},
		[prefersReducedMotion],
	);

	const handleStartTournament = useCallback(() => {
		hapticTournamentStart();
		if (selectedNames && selectedNames.length >= 2) {
			tournamentActions.setNames(selectedNames);
			window.dispatchEvent(
				new CustomEvent("nav-tab-change", { detail: "tournament" }),
			);
			if (isHomeRoute) {
				scrollToSection("tournament");
			} else {
				setPendingScroll("tournament");
				navigate("/");
			}
		}
	}, [
		isHomeRoute,
		navigate,
		scrollToSection,
		selectedNames,
		tournamentActions,
	]);

	const handleNavClick = useCallback(
		(key: NavSection) => {
			hapticNavTap();
			if (!isHomeRoute) {
				setPendingScroll(key);
				navigate(`/#${key}`);
				return;
			}
			setActiveSection(key);
			scrollToSection(key);
			if (typeof window !== "undefined" && window.history?.replaceState) {
				window.history.replaceState(null, "", `#${key}`);
			}
		},
		[isHomeRoute, navigate, scrollToSection],
	);

	const handleAdminClick = useCallback(() => {
		hapticNavTap();
		if (!isAdminRoute) {
			navigate("/admin");
		}
	}, [isAdminRoute, navigate]);

	const openProfileModal = useCallback(() => {
		hapticNavTap();
		setIsSuggestOpen(false);
		setIsProfileOpen((prev) => !prev);
	}, []);

	const openSuggestModal = useCallback(() => {
		hapticNavTap();
		setIsProfileOpen(false);
		setIsSuggestOpen((prev) => !prev);
	}, []);

	const handleLogin = useCallback(
		async (name: string) => {
			const ok = await login({ name });
			if (ok !== false) {
				setIsProfileOpen(false);
			}
			return ok;
		},
		[login],
	);

	useEffect(() => {
		if (isHomeRoute && location.hash) {
			const hashKey = location.hash.replace("#", "") as NavSection;
			if (hashKey) {
				scrollToSection(hashKey);
			}
		}
	}, [isHomeRoute, location.hash, scrollToSection]);

	useEffect(() => {
		if (!isHomeRoute || !pendingScroll) {
			return;
		}
		scrollToSection(pendingScroll);
		setPendingScroll(null);
	}, [isHomeRoute, pendingScroll, scrollToSection]);

	useEffect(() => {
		const handleTabChange = (e: Event) => {
			const customEvent = e as CustomEvent<NavSection>;
			if (customEvent.detail) {
				setActiveSection(customEvent.detail);
				scrollToSection(customEvent.detail);
			}
		};
		window.addEventListener("nav-tab-change", handleTabChange);
		return () => window.removeEventListener("nav-tab-change", handleTabChange);
	}, [scrollToSection]);

	useEffect(() => {
		if (!isHomeRoute) {
			return;
		}

		let rafId: number | null = null;
		const sections: NavSection[] = ["pick", "analysis"];

		const handleScroll = () => {
			if (rafId) {
				return;
			}
			rafId = requestAnimationFrame(() => {
				rafId = null;
				let current: NavSection | null = null;
				let minDistance = Number.POSITIVE_INFINITY;

				for (const section of sections) {
					const targetId = keyToId[section] || section;
					const element =
						document.getElementById(targetId) ||
						document.getElementById(section);
					if (!element) {
						continue;
					}
					const rect = element.getBoundingClientRect();
					const distance = Math.abs(rect.top);
					if (distance < minDistance && rect.top < window.innerHeight * 0.7) {
						minDistance = distance;
						current = section;
					}
				}
				if (current) {
					setActiveSection(current);
				}
			});
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();
		return () => {
			window.removeEventListener("scroll", handleScroll);
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [isHomeRoute]);

	const navItems = useMemo((): NavItem[] => {
		const items: NavItem[] = [];

		if (isHomeRoute) {
			items.push({
				id: "pick",
				label: isTournamentActive
					? "Arena"
					: selectedCount >= 2
						? `Vote (${selectedCount})`
						: "Contenders",
				icon: isTournamentActive ? (
					<Trophy className="h-4 w-4" />
				) : selectedCount >= 2 ? (
					<Trophy className="h-4 w-4" />
				) : (
					<CheckCircle className="h-4 w-4" />
				),
				isActive: activeSection === "pick" || activeSection === "tournament",
				isAccent: isTournamentActive || selectedCount >= 2,
				onClick: () => {
					if (isTournamentActive) {
						handleNavClick("tournament");
					} else if (selectedCount >= 2) {
						handleStartTournament();
					} else {
						handleNavClick("pick");
					}
				},
			});

			items.push({
				id: "analysis",
				label: "Results",
				icon: <BarChart3 className="h-4 w-4" />,
				isActive: activeSection === "analysis" || activeSection === "stats",
				hasBadge:
					Object.keys(tournament.ratings).length > 0 &&
					activeSection !== "analysis",
				onClick: () => handleNavClick("analysis"),
			});
		} else {
			items.push({
				id: "pick",
				label: "Home",
				icon: <Trophy className="h-4 w-4" />,
				isActive: false,
				onClick: () => {
					hapticNavTap();
					navigate("/");
				},
			});
		}

		items.push({
			id: "suggest",
			label: "Suggest",
			icon: <Lightbulb className="h-4 w-4" />,
			isActive: isSuggestOpen,
			onClick: openSuggestModal,
		});

		if (isAdmin) {
			items.push({
				id: "admin",
				label: "Admin",
				icon: <Lock className="h-4 w-4" />,
				isActive: isAdminRoute,
				onClick: handleAdminClick,
			});
		}

		items.push({
			id: "profile",
			label: profileLabel,
			icon:
				isLoggedIn && avatarUrl ? (
					<img
						src={avatarUrl}
						alt={profileLabel}
						className="h-5 w-5 rounded-full border border-foreground/15 object-cover"
						onError={handleImgError}
					/>
				) : (
					<User
						className={cn(
							"h-4 w-4",
							isLoggedIn && isAdmin && "text-chart-4",
							isLoggedIn && !isAdmin && "text-primary",
						)}
					/>
				),
			isActive: isProfileOpen,
			onClick: openProfileModal,
		});

		return items;
	}, [
		activeSection,
		avatarUrl,
		handleAdminClick,
		handleNavClick,
		handleStartTournament,
		isAdmin,
		isAdminRoute,
		isHomeRoute,
		isLoggedIn,
		isProfileOpen,
		isSuggestOpen,
		isTournamentActive,
		navigate,
		openProfileModal,
		openSuggestModal,
		profileLabel,
		selectedCount,
		tournament.ratings,
	]);

	const staggeredItems: StaggeredMenuItem[] = useMemo(() => {
		const items: StaggeredMenuItem[] = [];

		if (!isHomeRoute) {
			items.push({
				label: "Home",
				ariaLabel: "Go to home page",
				link: "/",
				onClick: (e) => {
					e.preventDefault();
					navigate("/");
				},
			});
		}

		navItems.forEach((item) => {
			items.push({
				label: item.label,
				ariaLabel: item.label,
				onClick: () => {
					hapticNavTap();
					item.onClick();
				},
			});
		});

		return items;
	}, [isHomeRoute, navItems, navigate]);

	if (isTournamentRoute) {
		return null;
	}

	return (
		<>
			<div
				className="floating-navbar-frame"
				role="navigation"
				aria-label="Main Navigation"
			>
				<nav className="floating-navbar-shell flex items-center justify-center gap-1 sm:gap-1.5 p-1.5 rounded-full">
					{navItems.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={item.onClick}
							aria-label={item.label}
							aria-current={item.isActive ? "page" : undefined}
							className={cn(
								"floating-nav-button relative flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-medium cursor-pointer select-none",
								item.isActive && "floating-nav-button--active font-semibold",
								item.isAccent &&
									!item.isActive &&
									"floating-nav-button--accent font-semibold",
							)}
						>
							<span className="floating-nav-icon flex items-center justify-center">
								{item.icon}
							</span>
							<span className="floating-nav-label whitespace-nowrap">
								{item.label}
							</span>
							{item.hasBadge && (
								<span
									className="size-2 rounded-full bg-primary animate-pulse"
									aria-hidden="true"
								/>
							)}
						</button>
					))}
				</nav>
			</div>

			<StaggeredMenu
				isFixed={true}
				position="right"
				items={staggeredItems}
				displaySocials={false}
				displayItemNumbering={true}
				menuButtonColor="#ffffff"
				openMenuButtonColor="#ffffff"
				colors={["#1f1430", "#3b1c60", "#6b21a8", "#9333ea"]}
				accentColor="#c084fc"
				hideHeader={true}
			/>

			{isProfileOpen && (
				<Modal
					title="Player Profile"
					open={isProfileOpen}
					onClose={() => setIsProfileOpen(false)}
					description="Sign in to save your rankings and track your stats."
				>
					<Suspense fallback={<Loading variant="card-skeleton" height={260} />}>
						<LazyProfileInner onLogin={handleLogin} onLogout={logout} />
					</Suspense>
				</Modal>
			)}
			{isSuggestOpen && (
				<Modal
					title="Suggest a Cat Name"
					open={isSuggestOpen}
					onClose={() => setIsSuggestOpen(false)}
					description="Suggest a cat name for the tournament bracket."
				>
					<Suspense fallback={<Loading variant="card-skeleton" height={260} />}>
						<NameSuggestion
							variant="modal"
							onClose={() => setIsSuggestOpen(false)}
						/>
					</Suspense>
				</Modal>
			)}
		</>
	);
}

export function AppLayout({ children }: { children: ReactNode }) {
	const tournament = useAppStore((s) => s.tournament);
	const errors = useAppStore((s) => s.errors);
	const errorActions = useAppStore((s) => s.errorActions);

	const handleSkipToMain = () => {
		const main = document.getElementById("main-content");
		if (!main) {
			return;
		}
		main.focus();
		main.scrollIntoView({ behavior: "smooth" });
	};

	const handleDismissError = () => {
		errorActions.clearError();
	};

	return (
		<ErrorBoundary context="Main Application Layout">
			<div className="app relative min-h-dvh w-full text-foreground overflow-x-hidden">
				<div className="app-ambient" aria-hidden="true">
					<Iridescence
						color={[0.45, 0.22, 0.7]}
						speed={0.75}
						amplitude={0.12}
						mouseReact={true}
						className="w-full h-full opacity-60"
					/>
				</div>
				<PwaInstallPrompt />
				<OfflineIndicator />

				<button
					type="button"
					className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-4 focus:left-4 focus:p-4 focus:bg-background focus:text-foreground focus:rounded-md focus:shadow-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:ring-offset-background cursor-pointer disabled:cursor-not-allowed"
					onClick={handleSkipToMain}
				>
					Skip to main content
				</button>
				<FloatingNavbar />
				<main
					id="main-content"
					className="app-main relative z-10 flex w-full flex-col pt-0"
					tabIndex={-1}
				>
					{Boolean(errors.current) && (
						<div className="mx-auto mb-4 w-full max-w-4xl px-3 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8">
							<ErrorComponent
								error={String(errors.current)}
								onDismiss={handleDismissError}
							/>
						</div>
					)}
					<div className="app-main__content flex w-full flex-1 flex-col items-stretch pb-24 sm:pb-28">
						{children}
					</div>
					{tournament.isLoading && (
						<div
							className="global-loading-overlay"
							role="status"
							aria-live="polite"
							aria-busy="true"
						>
							<Loading variant="spinner" text="Initializing Tournament..." />
						</div>
					)}
				</main>
			</div>
		</ErrorBoundary>
	);
}

function AppShell() {
	const { pathname } = useLocation();

	useLayoutEffect(() => {
		if (!pathname) {
			return;
		}
		document.documentElement.scrollTop = 0;
		document.body.scrollTop = 0;
	}, [pathname]);

	return (
		<MotionConfig reducedMotion="user">
			<AppLayout>
				<Routes>
					<Route
						path="/"
						element={
							<Suspense fallback={<RouteFallback text="Loading home..." />}>
								<HomeRoute />
							</Suspense>
						}
					/>
					<Route
						path="/tournament"
						element={<Navigate to="/" replace={true} />}
					/>
					<Route
						path="/analysis"
						element={<Navigate to="/" replace={true} />}
					/>
					<Route
						path="/admin"
						element={
							<Suspense fallback={<RouteFallback text="Loading admin..." />}>
								<AdminRoute />
							</Suspense>
						}
					/>
				</Routes>
			</AppLayout>
		</MotionConfig>
	);
}

function App() {
	usePreloadImages();

	const { user: authUser, isLoading } = useAuth();
	const isStoreLoggedIn = useAppStore((state) => state.user.isLoggedIn);
	const isBootLoading = useAppStore((state) => state.ui.isBootLoading);

	const userActions = useAppStore((state) => state.userActions);
	const setBootLoading = useAppStore((state) => state.uiActions.setBootLoading);

	useEffect(() => {
		if (isLoading) {
			return;
		}

		if (authUser) {
			userActions.setUser({
				id: authUser.id,
				name: authUser.name,
				isLoggedIn: true,
				isAdmin: Boolean(authUser.isAdmin),
			});
		} else if (isStoreLoggedIn) {
			userActions.logout();
		}

		setBootLoading(false);
	}, [authUser, isLoading, isStoreLoggedIn, setBootLoading, userActions]);

	useEffect(() => {
		const fallbackTimer = setTimeout(() => {
			setBootLoading(false);
		}, BOOT_TIMEOUT_FALLBACK_MS);

		return () => {
			clearTimeout(fallbackTimer);
		};
	}, [setBootLoading]);

	useEffect(() => {
		const cleanup = ErrorManager.setupGlobalErrorHandling();
		return () => {
			cleanup();
		};
	}, []);

	const handleUserContext = useCallback((_name: string) => {
		// No-op user context initialization hook
	}, []);
	useAppStoreInitialization(handleUserContext);

	if (isBootLoading) {
		return <AppBootScreen visible={true} />;
	}

	return (
		<Suspense
			fallback={
				<div className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
					Loading...
				</div>
			}
		>
			<AppShell />
		</Suspense>
	);
}

export default App;
