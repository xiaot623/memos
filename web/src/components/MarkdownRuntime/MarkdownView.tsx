import type { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNearViewport } from "@/hooks/useNearViewport";
import { cn } from "@/lib/utils";
import { getThemeWithFallback } from "@/utils/theme";
import { createMarkdownRuntime } from "./createRuntime";
import { applyTagColors, suppressReadonlyEditorFocus, useMarkdownViewClicks } from "./interaction";
import { LinkPreviewHost } from "./LinkPreviewHost";
import "./theme.css";

interface MarkdownViewProps {
  content: string;
  className?: string;
  compact?: boolean;
  memoName?: string;
  eager?: boolean;
}

const MarkdownViewInner = ({ content }: { content: string }) => {
  const { userGeneralSetting, userTagsSetting } = useAuth();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | undefined>(undefined);
  const contentRef = useRef(content);
  contentRef.current = content;

  const { loading } = useEditor((root) => {
    const crepe = createMarkdownRuntime({
      root,
      defaultValue: contentRef.current,
      mode: "view",
      getTheme: () => getThemeWithFallback(userGeneralSetting?.theme),
    });
    crepeRef.current = crepe;
    return crepe;
  }, []);

  useEffect(() => {
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
  }, [content, loading]);

  useEffect(() => {
    if (!host) {
      return;
    }
    applyTagColors(host, userTagsSetting);
  });

  return (
    <div ref={setHost} className="w-full">
      <Milkdown />
      <LinkPreviewHost root={host} enabled={!loading} />
    </div>
  );
};

export function MarkdownView({ content, className, compact, memoName, eager = false }: MarkdownViewProps) {
  const { ref, isNearViewport } = useNearViewport<HTMLDivElement>();
  const shouldMount = eager || isNearViewport;
  const onClick = useMarkdownViewClicks({ compact, memoName });

  return (
    <div
      ref={ref}
      className={cn("markdown-runtime w-full", className)}
      data-readonly=""
      onClick={onClick}
      onMouseDown={suppressReadonlyEditorFocus}
      onFocusCapture={suppressReadonlyEditorFocus}
    >
      {shouldMount ? (
        <MilkdownProvider>
          <MarkdownViewInner content={content} />
        </MilkdownProvider>
      ) : (
        <div className="min-h-8 whitespace-pre-wrap text-muted-foreground">{content.slice(0, 200)}</div>
      )}
    </div>
  );
}
