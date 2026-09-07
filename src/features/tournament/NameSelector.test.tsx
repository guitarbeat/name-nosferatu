import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mock ResizeObserver and IntersectionObserver for DOM testing environment
globalThis.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

globalThis.IntersectionObserver = class IntersectionObserver {
	readonly root: Element | null = null;
	readonly rootMargin: string = "";
	readonly thresholds: ReadonlyArray<number> = [];
	observe() {}
	unobserve() {}
	disconnect() {}
	takeRecords() {
		return [];
	}
};

import { SUPABASE_UNAVAILABLE_MSG } from "@/shared/api";
import useAppStore from "@/store";
import { NameSelector } from "./NameSelector";

vi.mock("@tanstack/react-query", async () => {
	const actual = await vi.importActual("@tanstack/react-query");
	return {
		...actual,
		useQuery: vi.fn(),
	};
});

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function renderComponent(ui: ReactNode) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(ui);
	});

	return {
		container,
		unmount() {
			act(() => {
				root.unmount();
			});
			container.remove();
		},
	};
}

describe("<NameSelector />", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useAppStore.getState().tournamentActions.resetTournament();
		useAppStore.getState().tournamentActions.setSelection([]);
	});

	it("renders loading state when query is pending and no data exists", () => {
		// @ts-expect-error Mocking partial UseQueryResult for testing loading state
		vi.mocked(useQuery).mockReturnValue({
			data: undefined,
			isPending: true,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		const html = renderToString(
			<QueryClientProvider client={createTestQueryClient()}>
				<NameSelector />
			</QueryClientProvider>,
		);

		expect(html).toContain("Loading cat pool...");
	});

	it("renders error card with retry button when query fails with error and no visible names available", () => {
		const mockRefetch = vi.fn();
		// @ts-expect-error Mocking partial UseQueryResult for testing error state
		vi.mocked(useQuery).mockReturnValue({
			data: { names: [{ id: "h1", name: "HiddenCat", isHidden: true }] },
			isPending: false,
			isLoading: false,
			error: new Error("Network timeout"),
			refetch: mockRefetch,
		});

		const queryClient = createTestQueryClient();
		const { container, unmount } = renderComponent(
			<QueryClientProvider client={queryClient}>
				<NameSelector />
			</QueryClientProvider>,
		);

		expect(container.textContent).toContain("Could not load shortlist");
		expect(container.textContent).toContain("Network timeout");

		const button = container.querySelector("button");
		expect(button).not.toBeNull();
		expect(button?.textContent).toContain("Try Again");

		act(() => {
			button?.click();
		});

		expect(mockRefetch).toHaveBeenCalled();

		unmount();
	});

	it("renders empty state message when data returns no visible names and no error", () => {
		// @ts-expect-error Mocking partial UseQueryResult for testing empty state
		vi.mocked(useQuery).mockReturnValue({
			data: { names: [{ id: "h1", name: "HiddenCat", isHidden: true }] },
			isPending: false,
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		const html = renderToString(
			<QueryClientProvider client={createTestQueryClient()}>
				<NameSelector />
			</QueryClientProvider>,
		);

		expect(html).toContain("No names available to display");
	});

	it("renders DriftWall with provided names when query succeeds", () => {
		const customNames = [
			{ id: "c1", name: "Sir Paws", description: "Feline knight" },
			{ id: "c2", name: "Duchess", description: "Royal cat" },
		];

		// @ts-expect-error Mocking partial UseQueryResult for testing success state
		vi.mocked(useQuery).mockReturnValue({
			data: { names: customNames },
			isPending: false,
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		const html = renderToString(
			<QueryClientProvider client={createTestQueryClient()}>
				<NameSelector />
			</QueryClientProvider>,
		);

		expect(html).toContain("Sir Paws");
		expect(html).toContain("Duchess");
		expect(html).toContain("drift-wall");
	});

	it("renders fallback sample names when error is SUPABASE_UNAVAILABLE_MSG", () => {
		// @ts-expect-error Mocking partial UseQueryResult for database unavailable fallback
		vi.mocked(useQuery).mockReturnValue({
			data: undefined,
			isPending: false,
			isLoading: false,
			error: new Error(SUPABASE_UNAVAILABLE_MSG),
			refetch: vi.fn(),
		});

		const html = renderToString(
			<QueryClientProvider client={createTestQueryClient()}>
				<NameSelector />
			</QueryClientProvider>,
		);

		expect(html).not.toContain("Could not load shortlist");
		expect(html).toContain("Nosferatu");
		expect(html).toContain("drift-wall");
	});

	it("automatically pre-selects candidates on initial render when selection is empty and candidates count >= 8", () => {
		const candidateList = Array.from({ length: 10 }, (_, i) => ({
			id: `id-${i + 1}`,
			name: `Cat ${i + 1}`,
			description: `Description ${i + 1}`,
			isHidden: false,
		}));

		// @ts-expect-error Mocking partial UseQueryResult for testing initial selection logic
		vi.mocked(useQuery).mockReturnValue({
			data: { names: candidateList },
			isPending: false,
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		expect(useAppStore.getState().tournament.selectedNames).toHaveLength(0);

		const queryClient = createTestQueryClient();
		const { unmount } = renderComponent(
			<QueryClientProvider client={queryClient}>
				<NameSelector />
			</QueryClientProvider>,
		);

		const selectedNames = useAppStore.getState().tournament.selectedNames;
		expect(selectedNames).toHaveLength(8);
		expect(selectedNames[0].name).toBe("Cat 1");
		expect(selectedNames[7].name).toBe("Cat 8");

		unmount();
	});

	it("automatically includes locked-in names in the tournament selection", () => {
		const namesWithLocked = [
			{ id: "l1", name: "Vampire", lockedIn: true },
			{ id: "l2", name: "Spooky", lockedIn: false },
		];

		// @ts-expect-error Mocking partial UseQueryResult for testing locked-in logic
		vi.mocked(useQuery).mockReturnValue({
			data: { names: namesWithLocked },
			isPending: false,
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		const queryClient = createTestQueryClient();
		const { unmount } = renderComponent(
			<QueryClientProvider client={queryClient}>
				<NameSelector />
			</QueryClientProvider>,
		);

		const selectedNames = useAppStore.getState().tournament.selectedNames;
		expect(selectedNames.some((n) => n.id === "l1")).toBe(true);

		unmount();
	});

	it("toggles name selection when tile is clicked", () => {
		const testNames = [
			{ id: "t1", name: "Tomi", description: "Playful" },
			{ id: "t2", name: "Sasha", description: "Gentle" },
		];

		// @ts-expect-error Mocking partial UseQueryResult for testing toggling
		vi.mocked(useQuery).mockReturnValue({
			data: { names: testNames },
			isPending: false,
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		const queryClient = createTestQueryClient();
		const { container, unmount } = renderComponent(
			<QueryClientProvider client={queryClient}>
				<NameSelector />
			</QueryClientProvider>,
		);

		expect(useAppStore.getState().tournament.selectedNames).toHaveLength(0);

		// Click tile for Tomi
		const tile = container.querySelector('[aria-label="Tomi"]') as HTMLElement | null;
		expect(tile).not.toBeNull();

		act(() => {
			tile?.click();
		});

		let selectedNames = useAppStore.getState().tournament.selectedNames;
		expect(selectedNames).toHaveLength(1);
		expect(selectedNames[0].id).toBe("t1");

		// Click tile again to deselect
		act(() => {
			tile?.click();
		});

		selectedNames = useAppStore.getState().tournament.selectedNames;
		expect(selectedNames).toHaveLength(0);

		unmount();
	});

	it("does not toggle locked names when tile is clicked", () => {
		const testNames = [
			{ id: "lock1", name: "LockedCat", lockedIn: true },
			{ id: "free1", name: "FreeCat", lockedIn: false },
		];

		// @ts-expect-error Mocking partial UseQueryResult for testing locked tiles
		vi.mocked(useQuery).mockReturnValue({
			data: { names: testNames },
			isPending: false,
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		const queryClient = createTestQueryClient();
		const { container, unmount } = renderComponent(
			<QueryClientProvider client={queryClient}>
				<NameSelector />
			</QueryClientProvider>,
		);

		// Locked name is auto-selected by useEffect
		expect(useAppStore.getState().tournament.selectedNames.map((n) => n.id)).toEqual(["lock1"]);

		// Attempting to click locked tile should do nothing
		const lockedTile = container.querySelector('[aria-label="LockedCat"]') as HTMLElement | null;
		expect(lockedTile).not.toBeNull();

		act(() => {
			lockedTile?.click();
		});

		expect(useAppStore.getState().tournament.selectedNames.map((n) => n.id)).toEqual(["lock1"]);

		unmount();
	});
});
