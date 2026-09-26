import { createContext, useContext } from "react";

const emptyScores = new Map<string, number>();

export const SemanticScoreContext = createContext<ReadonlyMap<string, number>>(emptyScores);

export function useSemanticScore(memoName: string): number | undefined {
  return useContext(SemanticScoreContext).get(memoName);
}
