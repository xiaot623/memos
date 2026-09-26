import { useMemo } from "react";
import MemoEditor from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/utils/deriveDefaultCreateTime";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { spaceScopedCacheKey } from "@/lib/resource-names";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const user = useCurrentUser();
  const t = useTranslate();
  const { isUserSettingsInitialized } = useAuth();
  const { claimHomeAutoFocus } = useGlobalMemoEditor();
  const { filters } = useMemoFilterContext();
  const { memoFilter: contextFilter, selectedSpaceName } = useSpaceContext();
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromFilters(filters), [filters]);
  // Doubles as the remount key: the draft cache only reloads on mount, so the editor
  // has to be rebuilt for the new Space rather than just re-pointed at another cache.
  const editorCacheKey = spaceScopedCacheKey("home-memo-editor", selectedSpaceName);

  // A Space feed lists every memo the viewer can read there. Personal home stays
  // the signed-in user's own memos; the server still hides other people's PRIVATE notes.
  const memoFilter = useMemoFilters({
    creatorName: selectedSpaceName ? undefined : user?.name,
    includeMemoViews: true,
    includePinned: true,
  });

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <NewMemoProvider>
        <PagedMemoList
          renderer={(memo: Memo, { compact }) => (
            <MemoView
              key={getMemoKey(memo)}
              memo={memo}
              showCreator={Boolean(selectedSpaceName)}
              showPinned
              showSpace={!selectedSpaceName}
              compact={compact}
            />
          )}
          listSort={listSort}
          orderBy={orderBy}
          filter={memoFilter}
          contextFilter={contextFilter}
          renderLeading={({ useGrid }) => {
            if (!isUserSettingsInitialized) return null;

            return (
              <MemoEditor
                key={editorCacheKey}
                autoFocus={claimHomeAutoFocus}
                className={useGrid ? undefined : "mb-2"}
                cacheKey={editorCacheKey}
                placeholder={t("editor.any-thoughts")}
                defaultCreateTime={defaultCreateTime}
                defaultSpace={selectedSpaceName}
              />
            );
          }}
        />
      </NewMemoProvider>
    </div>
  );
};

export default Home;
