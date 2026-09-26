import { cn } from "@/lib/utils";

interface MentionProps {
  username?: string;
  className?: string;
  children?: React.ReactNode;
  resolved?: boolean;
  "data-mention"?: string;
  [key: string]: unknown;
}

/** Mentions render as plain text; interactive @mention UI was removed. */
export const Mention = ({ username, className, children, "data-mention": dataMention }: MentionProps) => {
  const name = (typeof username === "string" && username) || (typeof dataMention === "string" && dataMention) || "";
  return <span className={cn("font-medium text-foreground", className)}>{children ?? (name ? `@${name}` : null)}</span>;
};
