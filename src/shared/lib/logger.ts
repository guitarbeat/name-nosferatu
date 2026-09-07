const isDev = (): boolean => {
	try {
		return import.meta.env?.DEV ?? false;
	} catch {
		return false;
	}
};

export interface Logger {
	error: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	info: (message: string, ...args: unknown[]) => void;
	debug: (message: string, ...args: unknown[]) => void;
}

export const logger: Logger = {
	error(message: string, ...args: unknown[]): void {
		if (isDev()) {
			console.error(message, ...args);
		}
	},
	warn(message: string, ...args: unknown[]): void {
		if (isDev()) {
			console.warn(message, ...args);
		}
	},
	info(message: string, ...args: unknown[]): void {
		if (isDev()) {
			console.info(message, ...args);
		}
	},
	debug(message: string, ...args: unknown[]): void {
		if (isDev()) {
			console.debug(message, ...args);
		}
	},
};
