import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  refetchSettings: vi.fn(),
  semanticSearchAvailable: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { name: "users/alice" },
    userGeneralSetting: {
      locale: "en",
      memoVisibility: "PRIVATE",
      theme: "system",
      saveMediaMetadata: false,
    },
    refetchSettings: mocks.refetchSettings,
  }),
}));

vi.mock("@/hooks/useUserQueries", () => ({
  useUpdateUserGeneralSetting: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: { semanticSearchAvailable: mocks.semanticSearchAvailable } }),
}));

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  loadLocale: vi.fn(),
  useTranslate: () => (key: string) => key,
}));

vi.mock("@/utils/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/theme")>()),
  loadTheme: vi.fn(),
}));

import PreferencesSection from "@/components/Settings/PreferencesSection";
import { UserSetting_SemanticIndexState } from "@/types/proto/api/v1/user_service_pb";

describe("PreferencesSection media metadata setting", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.semanticSearchAvailable = false;
  });

  it("updates the account setting with the save_media_metadata field mask", () => {
    render(<PreferencesSection />);

    fireEvent.click(screen.getByRole("switch", { name: "setting.preference.save-media-metadata" }));

    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(mocks.mutate.mock.calls[0][0]).toEqual({
      generalSetting: { saveMediaMetadata: true },
      updateMask: ["save_media_metadata"],
    });
    expect(screen.queryByRole("switch", { name: "setting.preference.semantic-index" })).not.toBeInTheDocument();
  });

  it("shows fuzzy search only after the instance enables it", () => {
    mocks.semanticSearchAvailable = true;
    render(<PreferencesSection />);

    fireEvent.click(screen.getByRole("switch", { name: "setting.preference.semantic-index" }));

    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(mocks.mutate.mock.calls[0][0]).toEqual({
      generalSetting: { semanticIndexState: UserSetting_SemanticIndexState.INITIALIZING },
      updateMask: ["semantic_index_state"],
    });
  });

  it("saves the fuzzy-search match threshold", () => {
    mocks.semanticSearchAvailable = true;
    render(<PreferencesSection />);

    const slider = screen.getByRole("slider", { name: "setting.preference.semantic-score-threshold" });
    fireEvent.change(slider, { target: { value: "0.7" } });
    fireEvent.pointerUp(slider);

    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(mocks.mutate.mock.calls[0][0]).toEqual({
      generalSetting: { semanticScoreThreshold: 0.7 },
      updateMask: ["semantic_score_threshold"],
    });
  });
});
