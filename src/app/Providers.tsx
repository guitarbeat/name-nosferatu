import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { STORAGE_KEYS } from "@/shared/lib/constants";
import { getStorageString, removeStorageItem, setStorageString } from "@/shared/lib/storage";

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
		const name = credentials.name || credentials.email?.split("@")[0] || "Guest";
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

	const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
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
	}, []);

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

export function AuthProvider({ children, adapter = localAuthAdapter }: AuthProviderProps) {
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
	showToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
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

function ToastMessage({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
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
		(message: string, type: ToastType = "info", options: ToastOptions = {}): string => {
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
		(message: string, options?: ToastOptions) => showToast(message, "success", options),
		[showToast],
	);
	const showError = useCallback(
		(message: string, options?: ToastOptions) => showToast(message, "error", options),
		[showToast],
	);
	const showInfo = useCallback(
		(message: string, options?: ToastOptions) => showToast(message, "info", options),
		[showToast],
	);
	const showWarning = useCallback(
		(message: string, options?: ToastOptions) => showToast(message, "warning", options),
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
		[toasts, showToast, hideToast, clearToasts, showSuccess, showError, showInfo, showWarning],
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
	const { toastList, dismiss, ...value } = useToastProvider(maxToasts, defaultDuration);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<ToastContainer toasts={toastList} onDismiss={dismiss} position={position} />
		</ToastContext.Provider>
	);
}
