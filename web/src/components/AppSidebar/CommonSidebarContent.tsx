import { InfoIcon } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import { SIDEBAR_ROW_CLASSES, SidebarRowIconSlot, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "./SidebarSection";

const CommonSidebarContent = () => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  const aboutActive = Boolean(matchPath(ROUTES.ABOUT, location.pathname));

  if (!currentUser) return null;

  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      <SidebarSection ariaLabel={t("common.about")}>
        <Link
          to={ROUTES.ABOUT}
          aria-current={aboutActive ? "page" : undefined}
          onClick={() => setMobileOpen(false)}
          className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(aboutActive ? "current" : "idle"))}
        >
          <SidebarRowIconSlot icon={InfoIcon} />
          <span className="min-w-0 flex-1 truncate">{t("common.about")}</span>
        </Link>
      </SidebarSection>
    </div>
  );
};

export default CommonSidebarContent;
