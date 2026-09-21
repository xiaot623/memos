import { memo, useRef } from "react";
import { MarkdownView } from "@/components/MarkdownRuntime/MarkdownView";
import { useContentSearchTerms } from "@/contexts/MemoFilterContext";
import { cn } from "@/lib/utils";
import type { MemoContentProps } from "./types";
import { useSearchMatchHighlight } from "./useSearchMatchHighlight";

const MemoContent = (props: MemoContentProps) => {
  const { className, contentClassName, content } = props;
  const contentRef = useRef<HTMLDivElement>(null);
  useSearchMatchHighlight(contentRef, useContentSearchTerms());

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      <div
        ref={contentRef}
        data-memo-content
        data-memo-name={props.memoName}
        className={cn(
          "relative w-full max-w-full wrap-break-word text-base leading-6",
          "[&>*:last-child]:mb-0",
          "[&_.katex-display]:max-w-full",
          "[&_.katex-display]:overflow-x-auto",
          "[&_.katex-display]:overflow-y-hidden",
          "[&_.footnotes]:mt-4 [&_.footnotes]:border-t [&_.footnotes]:border-border [&_.footnotes]:pt-2",
          "[&_.footnotes]:text-sm [&_.footnotes]:text-muted-foreground",
          "[&_[data-footnote-ref]]:no-underline [&_[data-footnote-ref]:hover]:underline",
          "[&_.data-footnote-backref]:no-underline [&_.data-footnote-backref:hover]:underline",
          contentClassName,
        )}
        onMouseUp={props.editable ? undefined : props.onClick}
        onDoubleClick={props.editable ? undefined : props.onDoubleClick}
      >
        <MarkdownView
          content={content}
          compact={Boolean(props.compact)}
          memoName={props.memoName}
          eager={!props.compact}
          editable={props.editable}
          inPlace={props.inPlace}
          caretPoint={props.caretPoint}
          onContentChange={props.onContentChange}
          onSubmit={props.onSubmit}
          onBlur={props.editable ? props.onBlur : undefined}
        />
      </div>
    </div>
  );
};

export default memo(MemoContent);
