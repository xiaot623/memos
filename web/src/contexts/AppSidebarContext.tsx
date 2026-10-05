import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export type AttachmentSection = "all" | "media" | "audio" | "documents" | "unused";

export interface MemoDetailSidebarDescriptor {
  memo: Memo;
  from?: string;
  hasExplicitOrigin?: boolean;
}

interface AppSidebarContextValue {
  attachmentSection: AttachmentSection;
  setAttachmentSection: (section: AttachmentSection) => void;
  memoDetail: MemoDetailSidebarDescriptor | undefined;
  setMemoDetail: (descriptor?: MemoDetailSidebarDescriptor) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  quickFindOpen: boolean;
  setQuickFindOpen: (open: boolean) => void;
}

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

export const AppSidebarProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [attachmentSection, setAttachmentSection] = useState<AttachmentSection>("all");
  const [memoDetail, setMemoDetailState] = useState<MemoDetailSidebarDescriptor>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setAttachmentSection("all");
  }, [location.pathname]);

  const setMemoDetail = useCallback((descriptor?: MemoDetailSidebarDescriptor) => {
    setMemoDetailState(descriptor);
  }, []);

  const value = useMemo(
    () => ({
      attachmentSection,
      setAttachmentSection,
      memoDetail,
      setMemoDetail,
      mobileOpen,
      setMobileOpen,
      quickFindOpen,
      setQuickFindOpen,
    }),
    [attachmentSection, memoDetail, setMemoDetail, mobileOpen, quickFindOpen],
  );

  return <AppSidebarContext.Provider value={value}>{children}</AppSidebarContext.Provider>;
};

export const useAppSidebar = (): AppSidebarContextValue => {
  const context = useContext(AppSidebarContext);
  if (!context) {
    throw new Error("useAppSidebar must be used within an AppSidebarProvider");
  }
  return context;
};
