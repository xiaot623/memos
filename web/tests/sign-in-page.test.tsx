import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignIn from "@/pages/SignIn";

const state = vi.hoisted(() => ({
  generalSetting: {
    disallowPasswordAuth: false,
    disallowUserRegistration: false,
  },
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({
    generalSetting: state.generalSetting,
  }),
}));

vi.mock("@/components/AuthFooter", () => ({ default: () => null }));

vi.mock("@/components/PasswordSignInForm", () => ({
  default: () => <div data-testid="password-sign-in" />,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>,
  );

describe("<SignIn>", () => {
  beforeEach(() => {
    state.generalSetting.disallowPasswordAuth = false;
    state.generalSetting.disallowUserRegistration = false;
  });

  it("shows the password sign-in form when password auth is allowed", () => {
    renderPage();
    expect(screen.getByTestId("password-sign-in")).toBeInTheDocument();
  });

  it("shows the unavailable state when password auth is disallowed", () => {
    state.generalSetting.disallowPasswordAuth = true;
    renderPage();
    expect(screen.getByText("auth.signin-unavailable-title")).toBeInTheDocument();
    expect(screen.queryByTestId("password-sign-in")).not.toBeInTheDocument();
  });
});
