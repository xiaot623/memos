import { useDirection } from "@base-ui/react/direction-provider";
import {
  ArchiveIcon,
  ArrowRightIcon,
  FileAudioIcon,
  FileTextIcon,
  HouseIcon,
  ImageIcon,
  ListIcon,
  type LucideIcon,
  MenuIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MemoDetailSidebar } from "@/components/MemoDetailSidebar";
import MemoDisplaySettingMenu from "@/components/MemoDisplaySettingMenu";
import { DEFAULT_SETTING_SECTION, SETTINGS_SECTIONS } from "@/components/Settings/settingSections";
import StatisticsView from "@/components/StatisticsView";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type AttachmentSection, useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { useInstance } from "@/contexts/InstanceContext";
import { getFilterSearch, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useAttachmentLibraryStats } from "@/hooks/useAttachmentLibrary";
import useCurrentUser from "@/hooks/useCurrentUser";
import { type MemoStatsContext, useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import { getMemoScopePath, type PrimaryMemoScope, resolveMemoScope } from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { collectionPathForLocation, ROUTES } from "@/router/routes";
import { State } from "@/types/proto/api/v1/common_pb";
import { User_Role } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemosLogo from "../MemosLogo";
import CommonSidebarContent from "./CommonSidebarContent";
import { getSidebarRouteKind } from "./routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_FOCUS_CLASSES, SidebarRowIconSlot, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "./SidebarSection";
import SpaceSwitcher from "./SpaceSwitcher";
import {
  SIDEBAR_LEADING_SLOT_CLASSES,
  SIDEBAR_NAV_LEADING_SLOT_CLASSES,
  SIDEBAR_RAIL_CLASSES,
  sidebarSurfaceVariants,
} from "./sidebar-layout";
import TagsSection from "./TagsSection";

const NewMemoAction = ({ onClick }: { onClick: () => void }) => {
  const t = useTranslate();
  const label = t("editor.new-memo");

  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" size="icon-compact" onClick={onClick} aria-label={label} data-new-memo-trigger />}>
        <SquarePenIcon className="size-4" strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};

const CollectionSidebarContent = ({ context }: { context: MemoStatsContext }) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { memoFilter, selectedSpaceName } = useSpaceContext();
  const md = useMediaQuery("md");
  const { mobileOpen, setMobileOpen } = useAppSidebar();
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const statsUserName = context === "home" || context === "archived" ? currentUser?.name : undefined;
  const isUserLevelCollection = context === "archived";
  // Space home counts every memo the viewer can read, matching the feed.
  const sharedSpaceFeed = context === "home" && Boolean(selectedSpaceName);
  const collectionFilter = isUserLevelCollection ? undefined : memoFilter;
  const { statistics, tags } = useFilteredMemoStats({
    context,
    userName: sharedSpaceFeed ? undefined : statsUserName,
    filter: collectionFilter,
    shared: sharedSpaceFeed,
    enabled: authInitialized && instanceInitialized && (md || mobileOpen),
  });

  const tagStateScope = isUserLevelCollection
    ? (statsUserName ?? context)
    : `${statsUserName ?? context}${selectedSpaceName ? `:${selectedSpaceName}` : ""}`;

  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      <SidebarSection ariaLabel={t("common.statistics")}>
        <StatisticsView statisticsData={statistics} onDateSelect={() => setMobileOpen(false)} />
      </SidebarSection>
      <SidebarSection label={t("memo.view-options")} action={<MemoDisplaySettingMenu />} />
      <TagsSection tagCount={tags} scope={tagStateScope} onSelect={() => setMobileOpen(false)} />
    </div>
  );
};

const AttachmentsSidebarContent = () => {
  const t = useTranslate();
  const { memoFilter, selectedSpaceName } = useSpaceContext();
  const { attachmentSection, setAttachmentSection, setMobileOpen } = useAppSidebar();
  const { isComplete, stats } = useAttachmentLibraryStats(memoFilter);
  const total = stats.media + stats.documents + stats.audio;
  const rows: Array<{ value: AttachmentSection; icon: LucideIcon; label: string; count?: number }> = [
    { value: "all", icon: ListIcon, label: t("common.all"), count: isComplete ? total : undefined },
    { value: "media", icon: ImageIcon, label: t("attachment-library.tabs.media"), count: isComplete ? stats.media : undefined },
    { value: "audio", icon: FileAudioIcon, label: t("attachment-library.tabs.audio"), count: isComplete ? stats.audio : undefined },
    {
      value: "documents",
      icon: FileTextIcon,
      label: t("attachment-library.tabs.documents"),
      count: isComplete ? stats.documents : undefined,
    },
  ];
  if (!selectedSpaceName) {
    rows.push({
      value: "unused",
      icon: Trash2Icon,
      label: t("attachment-library.labels.unused"),
      count: isComplete ? stats.unused : undefined,
    });
  }
  return (
    <SidebarSection label={t("common.attachments")}>
      {rows.map((row) => (
        <SidebarRow
          key={row.value}
          state={attachmentSection === row.value ? "current" : "idle"}
          icon={row.icon}
          label={row.label}
          count={row.count}
          onClick={() => {
            setAttachmentSection(row.value);
            setMobileOpen(false);
          }}
        />
      ))}
    </SidebarSection>
  );
};

const SettingsSidebarContent = () => {
  const t = useTranslate();
  const location = useLocation();
  const user = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  const isHost = user?.role === User_Role.ADMIN;
  const currentSection = location.hash.slice(1) || DEFAULT_SETTING_SECTION;
  const basic = SETTINGS_SECTIONS.filter((section) => section.scope === "basic");
  const admin = SETTINGS_SECTIONS.filter((section) => section.scope === "admin");
  const renderSections = (sections: typeof SETTINGS_SECTIONS) =>
    sections.map((section) => (
      <Link
        key={section.key}
        to={`${ROUTES.SETTING}#${section.key}`}
        onClick={() => setMobileOpen(false)}
        className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(currentSection === section.key ? "current" : "idle"))}
      >
        <SidebarRowIconSlot icon={section.icon} />
        <span className="truncate">{t(section.labelKey)}</span>
      </Link>
    ));
  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      <SidebarSection label={t("common.basic")}>{renderSections(basic)}</SidebarSection>
      {isHost && <SidebarSection label={t("common.admin")}>{renderSections(admin)}</SidebarSection>}
    </div>
  );
};

const MemoDetailSidebarContent = () => {
  const { memoDetail, closeMobileThen } = useAppSidebar();
  if (!memoDetail) return null;
  const runAndClose = (action: (() => void) | undefined) => (action ? () => closeMobileThen(action) : undefined);
  return (
    <MemoDetailSidebar
      memo={memoDetail.memo}
      parentPage={memoDetail.from}
      hasExplicitOrigin={memoDetail.hasExplicitOrigin}
      forceReadonly={memoDetail.readonly}
      onEdit={runAndClose(memoDetail.onEdit)}
      className="pb-2"
    />
  );
};

const RouteSidebarContent = () => {
  const location = useLocation();
  const kind = getSidebarRouteKind(location.pathname);
  if (kind === "home" || kind === "archived") {
    return <CollectionSidebarContent context={kind} />;
  }
  if (kind === "attachments") return <AttachmentsSidebarContent />;
  if (kind === "settings") return <SettingsSidebarContent />;
  if (kind === "memo") return <MemoDetailSidebarContent />;
  if (kind === "common") return <CommonSidebarContent />;
  return null;
};

const navPillClasses = (active: boolean) =>
  cn(sidebarSurfaceVariants({ role: "navPill" }), SIDEBAR_ROW_FOCUS_CLASSES, sidebarRowStateClasses(active ? "current" : "idle"));

const GlobalNavigation = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { memoDetail, memoScope, setMemoScope, setMobileOpen, setQuickFindOpen } = useAppSidebar();
  const { filters } = useMemoFilterContext();
  const routeKind = getSidebarRouteKind(location.pathname);
  const resolvedScope = resolveMemoScope(location.pathname, {
    detailFrom: memoDetail?.from,
    memoArchived: memoDetail?.memo.state === State.ARCHIVED,
    fallback: memoScope,
  });
  const primaryScope: PrimaryMemoScope = "home";
  const homeActive = routeKind === "home" || (routeKind === "memo" && resolvedScope === "home");
  const archivedActive = routeKind === "archived" || (routeKind === "memo" && resolvedScope === "archived");

  const navigateHome = () => {
    setMemoScope(primaryScope);
    navigate({ pathname: collectionPathForLocation(getMemoScopePath(primaryScope), location.pathname), search: getFilterSearch(filters) });
    setMobileOpen(false);
  };

  return (
    <TooltipProvider>
      <nav className={cn("@container flex h-7 items-center gap-0.5", SIDEBAR_RAIL_CLASSES)} aria-label="Primary">
        {currentUser && (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={t("common.home")}
                    aria-current={homeActive ? "page" : undefined}
                    className={navPillClasses(homeActive)}
                    onClick={navigateHome}
                  />
                }
              >
                <span className={SIDEBAR_NAV_LEADING_SLOT_CLASSES} aria-hidden="true">
                  <HouseIcon className="size-4 opacity-75" strokeWidth={1.8} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("common.home")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    to={ROUTES.ARCHIVED}
                    onClick={() => setMobileOpen(false)}
                    aria-label={t("common.archived")}
                    aria-current={archivedActive ? "page" : undefined}
                    className={navPillClasses(archivedActive)}
                  />
                }
              >
                <span className={SIDEBAR_NAV_LEADING_SLOT_CLASSES} aria-hidden="true">
                  <ArchiveIcon className="size-4 opacity-75" strokeWidth={1.8} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("common.archived")}</TooltipContent>
            </Tooltip>
          </>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("common.search")}
                className={cn("ms-auto", navPillClasses(false))}
                onClick={() => {
                  setMobileOpen(false);
                  setQuickFindOpen(true);
                }}
              />
            }
          >
            <span className={SIDEBAR_NAV_LEADING_SLOT_CLASSES} aria-hidden="true">
              <SearchIcon className="size-4 opacity-75" strokeWidth={1.8} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("common.search")}</TooltipContent>
        </Tooltip>
      </nav>
    </TooltipProvider>
  );
};

/** Signed-in users can navigate between Spaces from any page; global pages show Memos. */
const SidebarBrand = ({ className, size = "md" }: { className?: string; size?: "md" | "header" }) => {
  const currentUser = useCurrentUser();

  if (currentUser) {
    return <SpaceSwitcher className={className} size={size} />;
  }

  return (
    <Link
      to={ROUTES.HOME}
      className={cn(
        "transition-colors hover:bg-sidebar-accent/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
        sidebarSurfaceVariants({ role: size === "header" ? "headerBrand" : "mobileBrand" }),
        className,
      )}
    >
      <MemosLogo compact size={size === "header" ? "header" : "md"} />
    </Link>
  );
};

const AppSidebar = ({ className }: { className?: string }) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  const { canOpen: canCompose, openEditor } = useGlobalMemoEditor();
  return (
    <aside className={cn("flex h-full w-full select-none flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div data-sidebar-header className={cn("flex h-13 shrink-0 items-center justify-between gap-2", SIDEBAR_RAIL_CLASSES)}>
        <SidebarBrand className="min-w-0" size="header" />
        {canCompose && <NewMemoAction onClick={openEditor} />}
      </div>
      <GlobalNavigation />
      <div className="mx-3 mt-2 border-t border-border/70" />
      <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-3 [scrollbar-width:thin]", SIDEBAR_RAIL_CLASSES)}>
        <RouteSidebarContent />
      </div>
      <footer className="shrink-0 border-t border-border/70">
        {currentUser ? (
          <UserMenu />
        ) : (
          <Link
            to={ROUTES.AUTH}
            onClick={() => setMobileOpen(false)}
            className={cn(
              sidebarSurfaceVariants({ role: "account" }),
              "group text-[13px] font-medium text-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
            )}
          >
            <span className={SIDEBAR_LEADING_SLOT_CLASSES}>
              <UserRoundIcon className="size-4 text-muted-foreground me-auto" strokeWidth={1.8} />
            </span>
            <span data-sidebar-label className="min-w-0 flex-1 truncate">
              {t("common.sign-in-to-memos")}
            </span>
            <ArrowRightIcon
              data-sidebar-trailing
              className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              strokeWidth={1.8}
            />
          </Link>
        )}
      </footer>
    </aside>
  );
};

export const MobileAppHeader = () => {
  const { setMobileOpen } = useAppSidebar();
  return (
    <header className="sticky top-0 z-20 flex h-12 w-full shrink-0 items-center justify-start gap-1 border-b border-border/70 bg-background/90 px-2 backdrop-blur-md md:hidden">
      <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-mobile-navigation-trigger>
        <MenuIcon className="size-[18px]" />
      </Button>
      <SidebarBrand className="max-w-[12rem]" size="md" />
    </header>
  );
};

export const MobileAppSidebar = () => {
  const direction = useDirection();
  const { mobileOpen, setMobileOpen, completeMobileClose } = useAppSidebar();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen} onOpenChangeComplete={completeMobileClose}>
      <SheetContent
        side={direction === "rtl" ? "right" : "left"}
        className="w-[min(18rem,calc(100vw-2rem))] gap-0 border-border p-0 shadow-2xl [&>[data-slot=sheet-close]]:sr-only"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar />
      </SheetContent>
    </Sheet>
  );
};

export default AppSidebar;
