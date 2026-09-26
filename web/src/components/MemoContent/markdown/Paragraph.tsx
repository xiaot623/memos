import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface ParagraphProps extends React.HTMLAttributes<HTMLParagraphElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

export const Paragraph = ({ children, className, node: _node, ...props }: ParagraphProps) => {
  return (
    <p className={cn(markdownStyles.paragraph, className)} {...props}>
      {children}
    </p>
  );
};
