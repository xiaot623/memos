import { toggleLinkCommand } from "@milkdown/kit/component/link-tooltip";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import {
  createCodeBlockCommand,
  liftListItemCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import {
  type ActiveFormatState,
  type EditorCommandContext,
  type EditorCommandId,
  EMPTY_ACTIVE_FORMATS,
  toToolbarHeadingLevel,
} from "../formatting/commands";
import type { FormattingController } from "../types/editorController";

function isInNode(ctx: Ctx, name: string): boolean {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === name) {
      return true;
    }
  }
  return false;
}

function headingLevel(ctx: Ctx): number | null {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "heading") {
      return Number(node.attrs.level) || null;
    }
  }
  return null;
}

function isTaskList(ctx: Ctx): boolean {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "list_item" && node.attrs.checked != null) {
      return true;
    }
  }
  return false;
}

function hasMark(ctx: Ctx, name: string): boolean {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const marks = state.storedMarks ?? state.selection.$from.marks();
  return marks.some((mark) => mark.type.name === name);
}

function setTaskChecked(ctx: Ctx, checked: boolean | null): void {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== "list_item") {
      continue;
    }
    const pos = $from.before(depth);
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked }));
    return;
  }
}

export function createWysiwygFormattingController(getCtx: () => Ctx | undefined, listeners: Set<() => void>): FormattingController {
  const call = (run: (ctx: Ctx) => void) => {
    const ctx = getCtx();
    if (!ctx) {
      return;
    }
    run(ctx);
  };

  return {
    run: (command: EditorCommandId, commandCtx?: EditorCommandContext) => {
      call((ctx) => {
        const commands = ctx.get(commandsCtx);
        switch (command) {
          case "bold":
            commands.call(toggleStrongCommand.key);
            break;
          case "italic":
            commands.call(toggleEmphasisCommand.key);
            break;
          case "strikethrough":
            commands.call(toggleStrikethroughCommand.key);
            break;
          case "code":
            commands.call(toggleInlineCodeCommand.key);
            break;
          case "codeBlock":
            commands.call(createCodeBlockCommand.key);
            break;
          case "bulletList":
            if (isInNode(ctx, "bullet_list") && !isTaskList(ctx)) {
              commands.call(liftListItemCommand.key);
            } else {
              if (isTaskList(ctx)) {
                setTaskChecked(ctx, null);
              }
              commands.call(wrapInBulletListCommand.key);
            }
            break;
          case "orderedList":
            if (isInNode(ctx, "ordered_list")) {
              commands.call(liftListItemCommand.key);
            } else {
              commands.call(wrapInOrderedListCommand.key);
            }
            break;
          case "taskList":
            if (isTaskList(ctx)) {
              setTaskChecked(ctx, null);
              commands.call(liftListItemCommand.key);
            } else {
              if (!isInNode(ctx, "bullet_list") && !isInNode(ctx, "ordered_list")) {
                commands.call(wrapInBulletListCommand.key);
              }
              setTaskChecked(ctx, false);
            }
            break;
          case "paragraph":
            commands.call(turnIntoTextCommand.key);
            break;
          case "heading1":
            commands.call(wrapInHeadingCommand.key, 1);
            break;
          case "heading2":
            commands.call(wrapInHeadingCommand.key, 2);
            break;
          case "heading3":
            commands.call(wrapInHeadingCommand.key, 3);
            break;
          case "link":
            commands.call(toggleLinkCommand.key, commandCtx?.url ? { href: commandCtx.url } : undefined);
            break;
          default:
            break;
        }
      });
    },
    getActiveFormats: (): ActiveFormatState => {
      const ctx = getCtx();
      if (!ctx) {
        return EMPTY_ACTIVE_FORMATS;
      }
      const level = headingLevel(ctx);
      return {
        bold: hasMark(ctx, "strong"),
        italic: hasMark(ctx, "emphasis"),
        strikethrough: hasMark(ctx, "strike_through"),
        code: hasMark(ctx, "inlineCode") || hasMark(ctx, "inline_code"),
        codeBlock: isInNode(ctx, "code_block"),
        bulletList: isInNode(ctx, "bullet_list") && !isTaskList(ctx),
        orderedList: isInNode(ctx, "ordered_list"),
        taskList: isTaskList(ctx),
        link: hasMark(ctx, "link"),
        headingLevel: level ? toToolbarHeadingLevel(level) : null,
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
