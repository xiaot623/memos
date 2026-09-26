import { createContext, type ReactNode, useContext } from "react";
import type { User } from "@/types/proto/api/v1/user_service_pb";

/** Mentions no longer resolve to users; providers stay as no-ops for call sites. */
const MentionResolutionContext = createContext<Map<string, User | undefined>>(new Map());

export const MentionResolutionProvider = ({
  children,
}: {
  children: ReactNode;
  usernames?: string[];
  /** @deprecated Ignored; kept for call-site compatibility. */
  contents?: string[];
  /** @deprecated Ignored; kept for call-site compatibility. */
  userNames?: string[];
}) => <MentionResolutionContext.Provider value={new Map()}>{children}</MentionResolutionContext.Provider>;

export const useResolvedUsersByNames = (_names: string[]): Map<string, User | undefined> => {
  return useContext(MentionResolutionContext);
};
