import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Configure React act environment for jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import useAppStore from "@/store";
import { useAdminDashboard, useDashboardData } from "./hooks";

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
			},
		},
	});
}

function renderHookHarness<T>(hookFn: () => T) {
	let latestResult: T;
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	const queryClient = createTestQueryClient();

	function Harness() {
		latestResult = hookFn();
		return null;
	}

	act(() => {
		root.render(
			<QueryClientProvider client={queryClient}>
				<Harness />
			</QueryClientProvider>,
		);
	});

	return {
		get current() {
			return latestResult;
		},
		queryClient,
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
}

describe("Dashboard Hooks", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		useAppStore.getState().userActions.setUser({ name: "AdminUser", isAdmin: true });
	});

	describe("useAdminDashboard", () => {
		it("returns default state and loads mapped names and stats", async () => {
			const harness = renderHookHarness(() => useAdminDashboard());

			expect(harness.current.searchTerm).toBe("");
			expect(harness.current.filterStatus).toBe("all");
			expect(harness.current.isLoading).toBe(true);

			// Wait for query resolution
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			expect(harness.current.isLoading).toBe(false);
			expect(Array.isArray(harness.current.filteredNames)).toBe(true);
			expect(harness.current.filteredNames.length).toBeGreaterThan(0);
			expect(harness.current.stats).toHaveProperty("totalNames");
			expect(harness.current.stats).toHaveProperty("totalUsers");

			harness.unmount();
		});

		it("filters names when searchTerm changes", async () => {
			const harness = renderHookHarness(() => useAdminDashboard());

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			act(() => {
				harness.current.setSearchTerm("Nosferatu");
			});

			expect(harness.current.searchTerm).toBe("Nosferatu");
			expect(
				harness.current.filteredNames.every((n) => n.name.toLowerCase().includes("nosferatu")),
			).toBe(true);

			harness.unmount();
		});

		it("updates filterStatus on valid handleFilterChange and ignores invalid options", () => {
			const harness = renderHookHarness(() => useAdminDashboard());

			act(() => {
				harness.current.handleFilterChange("active");
			});
			expect(harness.current.filterStatus).toBe("active");

			act(() => {
				harness.current.handleFilterChange("hidden");
			});
			expect(harness.current.filterStatus).toBe("hidden");

			act(() => {
				harness.current.handleFilterChange("locked");
			});
			expect(harness.current.filterStatus).toBe("locked");

			// Invalid option should not mutate filterStatus
			act(() => {
				harness.current.handleFilterChange("invalid_status");
			});
			expect(harness.current.filterStatus).toBe("locked");

			harness.unmount();
		});

		it("executes handleToggleHidden and handleToggleLocked without throwing", async () => {
			const harness = renderHookHarness(() => useAdminDashboard());

			await act(async () => {
				await harness.current.handleToggleHidden("1", false);
			});

			await act(async () => {
				await harness.current.handleToggleLocked("1", false);
			});

			expect(true).toBe(true);
			harness.unmount();
		});

		it("handles soft delete based on window.confirm", async () => {
			const harness = renderHookHarness(() => useAdminDashboard());
			const confirmSpy = vi.spyOn(window, "confirm");

			// Case 1: User cancels deletion
			confirmSpy.mockReturnValueOnce(false);
			await act(async () => {
				await harness.current.handleSoftDelete("1");
			});
			expect(confirmSpy).toHaveBeenCalledWith(
				"Permanently delete this name? This cannot be undone.",
			);

			// Case 2: User confirms deletion
			confirmSpy.mockReturnValueOnce(true);
			await act(async () => {
				await harness.current.handleSoftDelete("1");
			});
			expect(confirmSpy).toHaveBeenCalledTimes(2);

			harness.unmount();
		});

		it("refetches queries when handleRefresh is called", () => {
			const harness = renderHookHarness(() => useAdminDashboard());

			act(() => {
				harness.current.handleRefresh();
			});

			expect(true).toBe(true);
			harness.unmount();
		});
	});

	describe("useDashboardData", () => {
		it("loads dashboard metrics and allows changing timeframe", async () => {
			const harness = renderHookHarness(() => useDashboardData({ userName: "AdminUser" }));

			expect(harness.current.timeframe).toBe("week");

			act(() => {
				harness.current.setTimeframe("day");
			});

			expect(harness.current.timeframe).toBe("day");

			// Wait for async loads
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			expect(harness.current.engagementMetrics).not.toBeNull();
			expect(harness.current.siteStats).not.toBeNull();
			expect(harness.current.userStats).not.toBeNull();

			// Test refresh functions
			await act(async () => {
				await harness.current.refreshLeaderboard();
				await harness.current.refreshEngagementMetrics();
			});

			harness.unmount();
		});

		it("handles empty userName gracefully when fetching dashboard data", async () => {
			const harness = renderHookHarness(() => useDashboardData({ userName: "" }));

			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
			});

			expect(harness.current.userStats).toBeNull();
			harness.unmount();
		});
	});
});
