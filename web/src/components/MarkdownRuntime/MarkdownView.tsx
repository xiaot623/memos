import type { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNearViewport } from "@/hooks/useNearViewport";
import { cn } from "@/lib/utils";
import { getThemeWithFallback } from "@/utils/theme";
import { createMarkdownRuntime } from "./createRuntime";
import { applyMarkdownEditable, type MarkdownCaretPoint } from "./focus";
import { applyTagColors, useMarkdownViewClicks } from "./interaction";
import { LinkPreviewHost } from "./LinkPreviewHost";
import "./theme.css";

interface MarkdownViewProps {
  content: string;
  className?: string;
  compact?: boolean;
  memoName?: string;
  eager?: boolean;
  /** When true, the same reading surface becomes a WYSIWYG editor. */
  editable?: boolean;
  /** Create with edit plugins and flip readonly in place instead of remounting. */
  inPlace?: boolean;
  caretPoint?: MarkdownCaretPoint | null;
  onContentChange?: (content: string) => void;
  onSubmit?: () => void;
  onBlur?: () => void;
}

const MarkdownViewInner = ({
  content,
  editable,
  inPlace,
  caretPoint,
  onContentChange,
  onSubmit,
}: {
  content: string;
  editable: boolean;
  inPlace: boolean;
  caretPoint?: MarkdownCaretPoint | null;
  onContentChange?: (content: string) => void;
  onSubmit?: () => void;
}) => {
  const { userGeneralSetting, userTagsSetting } = useAuth();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | undefined>(undefined);
  const contentRef = useRef(content);
  contentRef.current = content;
  const onChangeRef = useRef(onContentChange);
  onChangeRef.current = onContentChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const caretPointRef = useRef(caretPoint);
  caretPointRef.current = caretPoint;

  const { loading } = useEditor((root) => {
    const crepe = createMarkdownRuntime({
      root,
      defaultValue: contentRef.current,
      mode: inPlace ? "edit" : "view",
      onMarkdownUpdated: inPlace
        ? (markdown) => {
            if (!editableRef.current) {
              return;
            }
            onChangeRef.current?.(markdown);
          }
        : undefined,
      onSubmit: inPlace ? () => onSubmitRef.current?.() : undefined,
      getTheme: () => getThemeWithFallback(userGeneralSetting?.theme),
    });
    crepeRef.current = crepe;
    if (inPlace) {
      crepe.setReadonly(true);
    }
    return crepe;
  }, []);

  useEffect(() => {
    const crepe = crepeRef.current;
    if (!crepe || loading || !inPlace) {
      return;
    }
    applyMarkdownEditable(crepe, editable, editable ? caretPointRef.current : null);
  }, [editable, inPlace, loading]);

  useEffect(() => {
    if (editable) {
      return;
    }
    const crepe = crepeRef.current;
    if (!crepe || loading) {
      return;
    }
    if (crepe.getMarkdown() === content) {
      return;
    }
    crepe.editor.action((ctx) => {
      replaceAll(content)(ctx);
    });
  }, [content, editable, loading]);

  useEffect(() => {
    if (!host) {
      return;
    }
    applyTagColors(host, userTagsSetting);
  });

  return (
    <div ref={setHost} className="w-full">
      <Milkdown />
      <LinkPreviewHost root={host} enabled={!loading && !editable} />
    </div>
  );
};

export function MarkdownView({
  content,
  className,
  compact,
  memoName,
  eager = false,
  editable = false,
  inPlace = false,
  caretPoint,
  onContentChange,
  onSubmit,
  onBlur,
}: MarkdownViewProps) {
  const { ref, isNearViewport } = useNearViewport<HTMLDivElement>();
  const shouldMount = eager || isNearViewport;
  const onClick = useMarkdownViewClicks({ compact, memoName });
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!editable || !onBlur) {
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    onBlur();
  };

  return (
    <div
      ref={ref}
      className={cn("markdown-runtime w-full", className)}
      data-readonly={editable ? undefined : ""}
      onClick={editable ? undefined : onClick}
      onBlur={handleBlur}
    >
      {shouldMount ? (
        <MilkdownProvider>
          <MarkdownViewInner
            content={content}
            editable={editable}
            inPlace={inPlace}
            caretPoint={caretPoint}
            onContentChange={onContentChange}
            onSubmit={onSubmit}
          />
        </MilkdownProvider>
      ) : (
        <div className="min-h-8 whitespace-pre-wrap text-muted-foreground">{content.slice(0, 200)}</div>
      )}
    </div>
  );
}
