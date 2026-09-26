import copy from "copy-to-clipboard";
import { ArrowLeftIcon, Edit3Icon, LinkIcon, Share2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation } from "react-router-dom";
import { getSidebarRouteKind } from "@/components/AppSidebar/routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SidebarRowIconSlot } from "@/components/AppSidebar/SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "@/components/AppSidebar/SidebarSection";
import { extractHeadings } from "@/components/MemoContent/pipeline";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { canManageMemo } from "@/utils/user";
import MemoOutline from "./MemoOutline";
import MemoSharePanel from "./MemoSharePanel";

interface Props {
  memo: Memo;
  parentPage?: string;
  hasExplicitOrigin?: boolean;
  className?: string;
  onEdit?: () => void;
  forceReadonly?: boolean;
}

const MemoDetailSidebar = (props: Props) => {
  const { memo, parentPage, hasExplicitOrigin, className, onEdit, forceReadonly } = props;
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [shareOpen, setShareOpen] = useState(false);
  const canEdit = !forceReadonly && canManageMemo(memo, currentUser);
  const headings = useMemo(() => extractHeadings(memo.content), [memo.content]);
  const showBack = Boolean(hasExplicitOrigin && parentPage);
  const backLabel = useMemo(() => {
    if (!parentPage) return t("common.home");
    const kind = getSidebarRouteKind(parentPage);
    if (kind === "archived") return t("common.archived");
    return t("common.home");
  }, [parentPage, t]);

  const handleCopyLink = () => {
    copy(`${window.location.origin}${location.pathname}${location.search}`);
    toast.success(t("message.succeed-copy-link"));
  };

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

      {(canEdit || memo.state === State.NORMAL) && (
        <SidebarSection label={t("common.actions")}>
          {canEdit && onEdit && <SidebarRow icon={Edit3Icon} label={t("common.edit")} onClick={onEdit} />}
          <SidebarRow icon={LinkIcon} label={t("memo.copy-link")} onClick={handleCopyLink} />
          <SidebarRow icon={Share2Icon} label={t("common.share")} onClick={() => setShareOpen(true)} />
        </SidebarSection>
      )}

      {headings.length > 0 && (
        <SidebarSection label={t("common.actions")}>
          <MemoOutline headings={headings} memoName={memo.name} />
        </SidebarSection>
      )}

      <MemoSharePanel open={shareOpen} onClose={() => setShareOpen(false)} memoName={memo.name} />
    </div>
  );
};

export default MemoDetailSidebar;
