import { Code, ConnectError } from "@connectrpc/connect";
import { useCallback, useEffect, useMemo as useReactMemo, useRef } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoView, { type MemoViewHandle } from "@/components/MemoView";
import { resolveMemoDetailOrigin } from "@/components/MemoView/navigation";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useMemoDetailError from "@/hooks/useMemoDetailError";
import { useMemo } from "@/hooks/useMemoQueries";
import { useSharedMemo, withShareAttachmentLinks } from "@/hooks/useMemoShareQueries";
import { memoNamePrefix } from "@/lib/resource-names";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { findMemoAnchorTarget } from "@/utils/markdown-manipulation";

const MemoSidebarRegistration = ({
  memo,
  from,
  hasExplicitOrigin,
  readonly,
  onEdit,
}: {
  memo: Memo;
  from: string;
  hasExplicitOrigin: boolean;
  readonly: boolean;
  onEdit: () => void;
}) => {
  const { setMemoDetail } = useAppSidebar();

  useEffect(() => {
    setMemoDetail({
      memo,
      from,
      hasExplicitOrigin,
      readonly,
      onEdit,
    });
  }, [from, hasExplicitOrigin, memo, onEdit, readonly, setMemoDetail]);

  useEffect(() => () => setMemoDetail(undefined), [setMemoDetail]);

  return null;
};

const MemoDetail = () => {
  const { isInitialized: authInitialized } = useAuth();
  const { isInitialized: instanceInitialized } = useInstance();
  const params = useParams();
  const location = useLocation();
  const { state: locationState, hash } = location;
  const memoViewRef = useRef<MemoViewHandle>(null);
  const handleEdit = useCallback(() => memoViewRef.current?.openEditor(), []);

  const shareToken = params.token;
  const isShareMode = !!shareToken;

  const memoNameFromParams = params.uid ? `${memoNamePrefix}${params.uid}` : "";
  const {
    data: memoFromDirect,
    error: directError,
    isLoading: directLoading,
    isUnavailable: directUnavailable,
    fetchStatus: directFetchStatus,
  } = useMemo(memoNameFromParams, { enabled: !isShareMode && !!memoNameFromParams });
  const { data: memoFromShare, error: shareError, isLoading: shareLoading } = useSharedMemo(shareToken ?? "", { enabled: isShareMode });

  const memo = isShareMode ? memoFromShare : memoFromDirect;
  const error = isShareMode ? shareError : directError;
  const isLoading = isShareMode ? shareLoading : directLoading;
  const hasExplicitOrigin =
    !!locationState && typeof locationState === "object" && typeof (locationState as { from?: unknown }).from === "string";
  const parentPage = resolveMemoDetailOrigin(locationState, { memoArchived: memo?.state === State.ARCHIVED });
  const memoName = memo?.name ?? memoNameFromParams;
  const displayMemo = useReactMemo(() => {
    if (!memo) return undefined;
    if (!isShareMode) return memo;
    return { ...memo, attachments: withShareAttachmentLinks(memo.attachments as Attachment[], shareToken!) };
  }, [isShareMode, memo, shareToken]);

  useMemoDetailError({
    error: error as Error | null,
  });

  const scrolledHashRef = useRef("");
  useEffect(() => {
    if (!hash) return;
    const scrollKey = `${memoName}\0${hash}`;
    if (scrolledHashRef.current === scrollKey) return;
    const fragment = decodeURIComponent(hash.slice(1));
    const el = findMemoAnchorTarget(document, memoName, fragment);
    if (!el) return;
    scrolledHashRef.current = scrollKey;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hash, memo, memoName]);

  if (!isShareMode && directUnavailable && directFetchStatus === "idle" && !directError) return <Navigate to="/404" replace />;

  if (isShareMode) {
    const isNotFound = error instanceof ConnectError && (error.code === Code.NotFound || error.code === Code.Unauthenticated);
    if (isNotFound || (!isLoading && !memo)) {
      return <Navigate to="/404" replace />;
    }
  }

  if (isLoading || !memo || !displayMemo || !authInitialized || !instanceInitialized) {
    return null;
  }

  const mentionResolutionContents = [displayMemo.content];
  const userResolutionNames = Array.from(
    new Set([displayMemo.creator, ...(displayMemo.reactions ?? []).map((reaction) => reaction.creator)]),
  );

  return (
    <section className="@container flex min-h-full w-full flex-col items-center pb-8 pt-3 md:pt-6">
      <MentionResolutionProvider contents={mentionResolutionContents} userNames={userResolutionNames}>
        <MemoSidebarRegistration
          memo={displayMemo}
          from={parentPage}
          hasExplicitOrigin={hasExplicitOrigin}
          readonly={isShareMode}
          onEdit={handleEdit}
        />
        <div className="w-full max-w-2xl px-4 sm:px-6">
          <div className="w-full">
            <MemoView
              ref={memoViewRef}
              key={displayMemo.name}
              memo={displayMemo}
              compact={false}
              parentPage={parentPage}
              showCreator
              showVisibility
              showPinned
              showSpace
            />
          </div>
        </div>
      </MentionResolutionProvider>
    </section>
  );
};

export default MemoDetail;
