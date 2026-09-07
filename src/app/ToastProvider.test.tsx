import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "./Providers";

function TestConsumer() {
	const toast = useToast();
	return (
		<div>
			<button type="button" onClick={() => toast.showToast("Test Toast", "info")}>
				Show
			</button>
			<span data-testid="toast-count">{toast.toasts.length}</span>
		</div>
	);
}

describe("ToastProvider and useToast", () => {
	it("throws an error when useToast is used outside ToastProvider", () => {
		function OutOfBoundsConsumer() {
			useToast();
			return null;
		}

		expect(() => renderToString(<OutOfBoundsConsumer />)).toThrow(
			"useToast must be used within <Providers>. Wrap your component tree with <Providers> in main.tsx.",
		);
	});

	it("renders ToastProvider with children in SSR / test environment", () => {
		const html = renderToString(
			<ToastProvider defaultDuration={3000} maxToasts={5} position="top-right">
				<TestConsumer />
			</ToastProvider>,
		);

		expect(html).toContain("Show");
		expect(html).toContain("0");
	});

	it("renders children in ToastProvider with custom position and duration options", () => {
		const html = renderToString(
			<ToastProvider defaultDuration={5000} maxToasts={3} position="bottom-left">
				<div data-testid="child-content">Child Content</div>
			</ToastProvider>,
		);

		expect(html).toContain("Child Content");
	});
});
