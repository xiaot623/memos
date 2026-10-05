import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";

/** Every normal memo whose author marked it public, across authors and spaces. */
const PublicFeed = () => {
  const { memoFilter: contextFilter } = useSpaceContext();
  const memoFilter = useMemoFilters({
    includeMemoViews: true,
    visibilities: [Visibility.PUBLIC],
  });
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: true,
    state: State.NORMAL,
  });

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <PagedMemoList
        renderer={(memo: Memo, { compact }) => (
          <MemoView key={getMemoKey(memo)} memo={memo} showCreator showPinned showSpace compact={compact} />
        )}
        listSort={listSort}
        orderBy={orderBy}
        filter={memoFilter}
        contextFilter={contextFilter}
      />
    </div>
  );
};

export default PublicFeed;
