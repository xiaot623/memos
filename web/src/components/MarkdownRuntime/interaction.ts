import { type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent, useContext } from "react";
import { type MemoFilter, stringifyFilters, useOptionalMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import useNavigateTo from "@/hooks/useNavigateTo";
import { colorToHex } from "@/lib/color";
import { findTagMetadata } from "@/lib/tag";
import { Routes } from "@/router";
import { toggleTaskAtIndex } from "@/utils/markdown-manipulation";
import { MemoViewContext } from "../MemoView/MemoViewContext";

const VIEW_WIDGET_SELECTOR = "a, button, input, textarea, select, [data-slot='checkbox']";

/** True when a view-mode click landed on Milkdown/CodeMirror rather than a real control. */
export function isReadonlyEditorSurface(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  if (!element || element.closest(VIEW_WIDGET_SELECTOR)) {
    return false;
  }
  return Boolean(element.closest(".ProseMirror, .cm-editor"));
}

/** Keep card/detail views from taking editor focus. Widgets (copy, tags, tasks) still work. */
export function suppressReadonlyEditorFocus(event: Pick<ReactMouseEvent | ReactFocusEvent, "target" | "preventDefault">): void {
  if (!isReadonlyEditorSurface(event.target)) {
    return;
  }
  event.preventDefault();
  if (event.target instanceof HTMLElement) {
    event.target.blur();
  }
}

export function applyTagColors(root: HTMLElement, tagsSetting: Parameters<typeof findTagMetadata>[1] | undefined): void {
  if (!tagsSetting) {
    return;
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-tag]")) {
    const tag = el.dataset.tag ?? "";
    const metadata = findTagMetadata(tag, tagsSetting);
    const bgHex = colorToHex(metadata?.backgroundColor);
    if (!bgHex) {
      el.style.borderColor = "";
      el.style.color = "";
      el.style.backgroundColor = "";
      continue;
    }
    el.style.borderColor = bgHex;
    el.style.color = `color-mix(in srgb, ${bgHex} 60%, black)`;
    el.style.backgroundColor = `color-mix(in srgb, ${bgHex} 15%, transparent)`;
  }
}

export function useMarkdownViewClicks(options: { compact?: boolean; memoName?: string }) {
  const memoView = useContext(MemoViewContext);
  const parentPage = memoView?.parentPage ?? "";
  const readonly = memoView?.readonly ?? true;
  const memo = memoView?.memo;
  const locationPath = typeof window !== "undefined" ? window.location.pathname : "";
  const navigateTo = useNavigateTo();
  const filters = useOptionalMemoFilterContext();
  const { mutate: updateMemo } = useUpdateMemo();

  const handleTag = (tag: string) => {
    if (locationPath.startsWith("/m")) {
      const pathname = parentPage || Routes.HOME;
      const searchParams = new URLSearchParams();
      searchParams.set("filter", stringifyFilters([{ factor: "tagSearch", value: tag }]));
      navigateTo(`${pathname}?${searchParams.toString()}`);
      return;
    }

    if (!filters) {
      return;
    }
    const isActive = filters.getFiltersByFactor("tagSearch").some((filter: MemoFilter) => filter.value === tag);
    if (isActive) {
      filters.removeFilter((f: MemoFilter) => f.factor === "tagSearch" && f.value === tag);
      return;
    }
    filters.removeFilter((f: MemoFilter) => f.factor === "tagSearch");
    filters.addFilter({ factor: "tagSearch", value: tag });
  };

  const handleTask = (block: HTMLElement, root: HTMLElement) => {
    if (readonly || !memo) {
      return;
    }
    const items = [...root.querySelectorAll<HTMLElement>(".milkdown-list-item-block")].filter((el) =>
      el.querySelector(".checked, .unchecked"),
    );
    const taskIndex = items.indexOf(block);
    if (taskIndex < 0) {
      return;
    }
    const currentlyChecked = Boolean(block.querySelector(".checked"));
    const newContent = toggleTaskAtIndex(memo.content, taskIndex, !currentlyChecked);
    updateMemo({
      update: {
        name: memo.name,
        content: newContent,
      },
      updateMask: ["content", "update_time"],
    });
  };

  return (event: ReactMouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const tagEl = target.closest<HTMLElement>("[data-tag]");
    if (tagEl?.dataset.tag) {
      event.preventDefault();
      event.stopPropagation();
      handleTag(tagEl.dataset.tag);
      return;
    }

    const mentionEl = target.closest<HTMLElement>("[data-mention]");
    if (mentionEl?.dataset.mention) {
      event.preventDefault();
      event.stopPropagation();
      navigateTo(`/u/${mentionEl.dataset.mention}`);
      return;
    }

    const taskItem = target.closest<HTMLElement>(".milkdown-list-item-block");
    if (taskItem?.querySelector(".checked, .unchecked") && target.closest(".label-wrapper, .checked, .unchecked")) {
      event.preventDefault();
      event.stopPropagation();
      const root = taskItem.closest<HTMLElement>("[data-memo-content]");
      if (root) {
        handleTask(taskItem, root);
      }
      return;
    }

    const anchor = target.closest("a");
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute("href") ?? "";
    if (!href.startsWith("#")) {
      return;
    }
    if (options.compact && options.memoName) {
      event.preventDefault();
      navigateTo(`/${options.memoName}${href}`);
      return;
    }
    const id = decodeURIComponent(href.slice(1));
    if (!id) {
      return;
    }
    const root = anchor.closest("[data-memo-content]");
    const footnoteTarget = root?.querySelector(`#${CSS.escape(id)}`);
    if (footnoteTarget) {
      event.preventDefault();
      footnoteTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
}
