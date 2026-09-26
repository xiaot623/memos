import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { InfoIcon, LoaderIcon, SparklesIcon, UserRoundXIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { setAccessToken } from "@/auth-state";
import AuthPageLayout, { AuthChip, AuthEmptyState, AuthLinkPrompt } from "@/components/AuthPageLayout";
import ChallengeWidget, { CHALLENGE_TOKEN_HEADER } from "@/components/ChallengeWidget";
import CredentialFields from "@/components/CredentialFields";
import { Button } from "@/components/ui/button";
import { authServiceClient, userServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useLoading from "@/hooks/useLoading";
import useNavigateTo from "@/hooks/useNavigateTo";
import { ERROR_REASON_CHALLENGE_REQUIRED, handleError, hasErrorReason } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { User_Role, UserSchema } from "@/types/proto/api/v1/user_service_pb";
import { AUTH_REDIRECT_PARAM, appendSearchParams, getSafeRedirectPath } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const SignUp = () => {
  const t = useTranslate();
  const navigateTo = useNavigateTo();
  const actionBtnLoadingState = useLoading(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeResetKey, setChallengeResetKey] = useState(0);
  const { initialize: initAuth } = useAuth();
  const { generalSetting: instanceGeneralSetting, profile, initialize: initInstance } = useInstance();
  const [searchParams] = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
  const signInPath = appendSearchParams(ROUTES.AUTH, searchParams);

  const passwordAuthAllowed = !instanceGeneralSetting.disallowPasswordAuth;
  const registrationOpen = !instanceGeneralSetting.disallowUserRegistration;
  const needsSetup = profile.needsSetup;

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (username === "" || password === "") {
      return;
    }

    if (actionBtnLoadingState.isLoading) {
      return;
    }

    try {
      actionBtnLoadingState.setLoading();
      const user = create(UserSchema, {
        username,
        password,
        role: User_Role.USER,
      });
      const callOptions = challengeToken ? { headers: { [CHALLENGE_TOKEN_HEADER]: challengeToken } } : undefined;
      await userServiceClient.createUser({ user }, callOptions);
      const response = await authServiceClient.signIn(
        {
          passwordCredentials: { username, password },
        },
        callOptions,
      );
      if (response.accessToken) {
        setAccessToken(response.accessToken, response.accessTokenExpiresAt ? timestampDate(response.accessTokenExpiresAt) : undefined);
      }
      await initAuth();
      await initInstance();
      navigateTo(redirectTarget || ROUTES.HOME, { replace: true });
    } catch (error: unknown) {
      if (hasErrorReason(error, ERROR_REASON_CHALLENGE_REQUIRED)) {
        setChallengeResetKey((key) => key + 1);
      }
      handleError(error, toast.error, {
        fallbackMessage: "Sign up failed",
      });
    }
    actionBtnLoadingState.setFinish();
  };

  const signUpForm = (
    <form className="flex w-full flex-col gap-4" onSubmit={handleFormSubmit}>
      <CredentialFields
        idPrefix="signup"
        username={username}
        password={password}
        passwordAutoComplete="new-password"
        readOnly={actionBtnLoadingState.isLoading}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
      />
      {!needsSetup && <ChallengeWidget onToken={setChallengeToken} resetKey={challengeResetKey} />}
      <Button type="submit" disabled={actionBtnLoadingState.isLoading}>
        {needsSetup ? t("auth.create-admin-account") : t("common.sign-up")}
        {actionBtnLoadingState.isLoading && <LoaderIcon className="ml-1 h-4 w-auto animate-spin opacity-60" />}
      </Button>
    </form>
  );

  const signInPrompt = <AuthLinkPrompt prompt={t("auth.sign-in-tip")} to={signInPath} label={t("common.sign-in")} />;

  if (needsSetup) {
    return (
      <AuthPageLayout
        chip={
          <AuthChip>
            <SparklesIcon className="h-3 w-3" />
            {t("auth.first-run")}
          </AuthChip>
        }
        title={t("auth.setup-title")}
        subtitle={t("auth.setup-description")}
      >
        {signUpForm}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-accent/50 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("auth.setup-note")}
        </div>
      </AuthPageLayout>
    );
  }

  if (!registrationOpen || !passwordAuthAllowed) {
    return (
      <AuthPageLayout title={t("auth.create-your-account")}>
        <AuthEmptyState
          icon={<UserRoundXIcon className="h-5 w-5" />}
          title={t("auth.signups-closed-title")}
          description={t("auth.signups-closed-description")}
        />
        {signInPrompt}
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("auth.create-your-account")}>
      {signUpForm}
      {signInPrompt}
    </AuthPageLayout>
  );
};

export default SignUp;
