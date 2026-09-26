import { LockIcon, type LucideIcon, UserLockIcon } from "lucide-react";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

export interface VisibilityOption {
  value: Visibility;
  /** Proto enum name, as stored in user settings and sent in filter expressions. */
  name: "PRIVATE" | "SPACE";
  labelKey: "memo.visibility.private" | "memo.visibility.space";
  descriptionKey: "memo.visibility.private-description" | "memo.visibility.space-description";
  icon: LucideIcon;
  /** SPACE only means anything inside a Space, so it is offered contextually rather than as a standing choice. */
  requiresSpace: boolean;
}

/**
 * The single source of truth for how each audience is named, described and drawn.
 * Ordered by widening audience. Every visibility surface derives from this, so a new
 * enum value is added here once instead of in each picker, icon map and converter.
 */
export const VISIBILITY_OPTIONS: readonly VisibilityOption[] = [
  {
    value: Visibility.PRIVATE,
    name: "PRIVATE",
    labelKey: "memo.visibility.private",
    descriptionKey: "memo.visibility.private-description",
    icon: LockIcon,
    requiresSpace: false,
  },
  {
    value: Visibility.SPACE,
    name: "SPACE",
    labelKey: "memo.visibility.space",
    descriptionKey: "memo.visibility.space-description",
    icon: UserLockIcon,
    requiresSpace: true,
  },
];

export const getVisibilityOption = (visibility: Visibility): VisibilityOption | undefined =>
  VISIBILITY_OPTIONS.find((option) => option.value === visibility);

/** Audiences offered as a persistent default. A Space-scoped default has no meaning outside a Space. */
export const DEFAULT_VISIBILITY_OPTIONS: readonly VisibilityOption[] = VISIBILITY_OPTIONS.filter((option) => !option.requiresSpace);

export const convertVisibilityFromString = (visibility: string) =>
  VISIBILITY_OPTIONS.find((option) => option.name === visibility)?.value ?? Visibility.PRIVATE;

export const convertVisibilityToString = (visibility: Visibility) => getVisibilityOption(visibility)?.name ?? "PRIVATE";
