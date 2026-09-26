import { ArrowRightIcon, LockIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AuthPageLayout, { AuthEmptyState, AuthLinkPrompt } from "@/components/AuthPageLayout";
import PasswordSignInForm from "@/components/PasswordSignInForm";
import { useInstance } from "@/contexts/InstanceContext";
import { ROUTES } from "@/router/routes";
import { AUTH_REDIRECT_PARAM, appendSearchParams, getSafeRedirectPath } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const SignIn = () => {
  const t = useTranslate();
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const [searchParams] = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
  const signUpPath = appendSearchParams(ROUTES.AUTH_SIGNUP, searchParams);

  const passwordAuthAllowed = !instanceGeneralSetting.disallowPasswordAuth;

  return (
    <AuthPageLayout title={t("common.sign-in")} subtitle={passwordAuthAllowed ? t("auth.welcome-back") : undefined}>
      {passwordAuthAllowed ? (
        <>
          <PasswordSignInForm redirectPath={redirectTarget} />
          {!instanceGeneralSetting.disallowUserRegistration && (
            <AuthLinkPrompt prompt={t("auth.sign-up-tip")} to={signUpPath} label={t("common.sign-up")} />
          )}
        </>
      ) : (
        <AuthEmptyState
          icon={<LockIcon className="h-5 w-5" />}
          title={t("auth.signin-unavailable-title")}
          description={t("auth.signin-unavailable-description")}
        >
          <Link to={ROUTES.AUTH_ADMIN} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline" viewTransition>
            {t("auth.admin-sign-in")}
            <ArrowRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </AuthEmptyState>
      )}
    </AuthPageLayout>
  );
};

export default SignIn;
