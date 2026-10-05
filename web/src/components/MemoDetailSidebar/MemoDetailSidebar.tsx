import { ArrowLeftIcon } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getSidebarRouteKind } from "@/components/AppSidebar/routes";
import { SIDEBAR_ROW_CLASSES, SidebarRowIconSlot } from "@/components/AppSidebar/SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "@/components/AppSidebar/SidebarSection";
import { extractHeadings } from "@/components/MemoContent/pipeline";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import MemoOutline from "./MemoOutline";

interface Props {
  memo: Memo;
  parentPage?: string;
  hasExplicitOrigin?: boolean;
  className?: string;
}

const MemoDetailSidebar = (props: Props) => {
  const { memo, parentPage, hasExplicitOrigin, className } = props;
  const t = useTranslate();
  const headings = useMemo(() => extractHeadings(memo.content), [memo.content]);
  const showBack = Boolean(hasExplicitOrigin && parentPage);
  const backLabel = useMemo(() => {
    if (!parentPage) return t("common.home");
    const kind = getSidebarRouteKind(parentPage);
    if (kind === "archived") return t("common.archived");
    return t("common.home");
  }, [parentPage, t]);

  return (
    <div className={cn(SIDEBAR_SECTION_STACK_CLASSES, className)}>
      {showBack && parentPage && (
        <SidebarSection>
          <Link
            to={parentPage}
            className={cn(SIDEBAR_ROW_CLASSES, "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground")}
          >
            <SidebarRowIconSlot icon={ArrowLeftIcon} />
            <span className="min-w-0 flex-1 truncate">{backLabel}</span>
          </Link>
        </SidebarSection>
      )}

      {headings.length > 0 && (
        <SidebarSection label={t("common.outline")}>
          <MemoOutline headings={headings} memoName={memo.name} />
        </SidebarSection>
      )}
    </div>
  );
};

export default MemoDetailSidebar;
