import { memo } from "react";
import { MarkdownView } from "@/components/MarkdownRuntime/MarkdownView";
import type { MemoContentProps } from "./types";

const MemoContent = (props: MemoContentProps) => {
  const { className, contentClassName, content } = props;

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      <div
        data-memo-content
        className={`relative w-full max-w-full wrap-break-word text-base leading-6 [&>*:last-child]:mb-0 ${contentClassName || ""}`}
        onMouseUp={props.onClick}
        onDoubleClick={props.onDoubleClick}
      >
        <MarkdownView content={content} compact={Boolean(props.compact)} memoName={props.memoName} eager={!props.compact} />
      </div>
    </div>
  );
};

export default memo(MemoContent);
