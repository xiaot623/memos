import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { countBy } from "lodash-es";
import { useMemo } from "react";
import { type MemoTimeBasis, useView } from "@/contexts/ViewContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useAllUserStats, useUserStats } from "@/hooks/useUserQueries";
import { mergeTagCounts } from "@/lib/tag";
import { State } from "@/types/proto/api/v1/common_pb";
import type { UserStats } from "@/types/proto/api/v1/user_service_pb";
import type { StatisticsData } from "@/types/statistics";

export interface FilteredMemoStats {
  statistics: StatisticsData;
  tags: Record<string, number>;
  loading: boolean;
}

export type MemoStatsContext = "home" | "archived";

export interface UseFilteredMemoStatsOptions {
  userName?: string;
  context?: MemoStatsContext;
  enabled?: boolean;
  filter?: string;
  /** Merge every creator the viewer can read. Used by a Space feed. */
  shared?: boolean;
}

const toDateString = (date: Date) => dayjs(date).format("YYYY-MM-DD");

const timestampsForBasis = (stats: UserStats, basis: MemoTimeBasis) => {
  const createdArray = stats.memoCreatedTimestamps ?? [];
  const updatedArray = stats.memoUpdatedTimestamps ?? [];
  const wantUpdated = basis === "update_time";
  const oldServerFallback = wantUpdated && updatedArray.length === 0 && createdArray.length > 0;
  if (oldServerFallback) {
    console.warn("UserStats.memo_updated_timestamps not present; falling back to memo_created_timestamps");
  }
  return wantUpdated && !oldServerFallback ? updatedArray : createdArray;
};

const activityFromStats = (statsList: UserStats[], timeBasis: MemoTimeBasis) => {
  const displayDates: string[] = [];
  for (const stats of statsList) {
    displayDates.push(
      ...timestampsForBasis(stats, timeBasis)
        .map((ts) => (ts ? timestampDate(ts) : undefined))
        .filter((date): date is Date => date !== undefined)
        .map(toDateString),
    );
  }
  return {
    activityStats: countBy(displayDates),
    tags: mergeTagCounts(...statsList.map((stats) => stats.tagCount)),
  };
};

export const useFilteredMemoStats = (options: UseFilteredMemoStatsOptions = {}): FilteredMemoStats => {
  const { userName, context, enabled = true, filter, shared = false } = options;
  const currentUser = useCurrentUser();
  const { timeBasis } = useView();
  const aggregate = shared || context === "archived";

  const { data: userStats, isLoading: isLoadingUserStats } = useUserStats(userName, { enabled: enabled && !aggregate, filter });
  const shouldFetchAllUserStats = aggregate && !!currentUser?.name;
  const { data: allUserStats = [], isLoading: isLoadingAllUserStats } = useAllUserStats(
    context === "archived" ? { state: State.ARCHIVED, filter } : { filter },
    { enabled: enabled && shouldFetchAllUserStats },
  );

  const data = useMemo(() => {
    const loading = isLoadingUserStats || isLoadingAllUserStats;
    const source = aggregate ? allUserStats : userStats ? [userStats] : [];
    const { activityStats, tags } = activityFromStats(source, timeBasis);

    return {
      statistics: { activityStats, timeBasis },
      tags,
      loading,
    };
  }, [aggregate, allUserStats, isLoadingAllUserStats, isLoadingUserStats, timeBasis, userStats]);

  return data;
};
