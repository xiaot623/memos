import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";

const clients = vi.hoisted(() => ({
  getUserStats: vi.fn(),
  listAllUserStats: vi.fn(),
}));

vi.mock("@/connect", () => ({
  userServiceClient: clients,
}));

vi.mock("@/contexts/ViewContext", () => ({
  useView: () => ({ timeBasis: "create_time" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/root" }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("useFilteredMemoStats", () => {
  beforeEach(() => {
    clients.getUserStats.mockReset().mockResolvedValue({
      tagCount: { mine: 1 },
      memoCreatedTimestamps: [timestampFromDate(new Date("2026-09-01T12:00:00Z"))],
    });
    clients.listAllUserStats.mockReset().mockResolvedValue({
      stats: [
        {
          tagCount: { shared: 1 },
          memoCreatedTimestamps: [timestampFromDate(new Date("2026-09-02T12:00:00Z"))],
        },
        {
          tagCount: { shared: 2 },
          memoCreatedTimestamps: [timestampFromDate(new Date("2026-09-03T12:00:00Z"))],
        },
      ],
    });
  });

  it("keeps a personal home on the current user's statistics", async () => {
    const { result } = renderHook(() => useFilteredMemoStats({ context: "home", userName: "users/root" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(clients.getUserStats).toHaveBeenCalledWith({ name: "users/root", filter: undefined });
    expect(clients.listAllUserStats).not.toHaveBeenCalled();
    expect(result.current.tags).toEqual({ mine: 1 });
  });

  it("merges every readable creator when a Space feed asks for shared statistics", async () => {
    const filter = 'space == "spaces/product"';
    const { result } = renderHook(() => useFilteredMemoStats({ context: "home", filter, shared: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.tags).toEqual({ shared: 3 }));
    expect(clients.listAllUserStats).toHaveBeenCalledWith(expect.objectContaining({ filter }));
    expect(clients.getUserStats).not.toHaveBeenCalled();
    expect(result.current.statistics.activityStats).toEqual({ "2026-09-02": 1, "2026-09-03": 1 });
  });
});
