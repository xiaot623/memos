// Utilities for manipulating markdown strings using AST parsing
// Uses mdast for accurate task detection that properly handles code blocks

import type { Heading, ListItem } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { visit } from "unist-util-visit";

interface TaskInfo {
  lineNumber: number;
  checked: boolean;
}

// Extract all task list items from markdown using AST parsing
// This correctly ignores task-like patterns inside code blocks
function extractTasksFromAst(markdown: string): TaskInfo[] {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const tasks: TaskInfo[] = [];

  visit(tree, "listItem", (node: ListItem) => {
    // Only process actual task list items (those with a checkbox)
    if (typeof node.checked === "boolean" && node.position?.start.line) {
      tasks.push({
        lineNumber: node.position.start.line - 1, // Convert to 0-based
        checked: node.checked,
      });
    }
  });

  return tasks;
}

export function toggleTaskAtLine(markdown: string, lineNumber: number, checked: boolean): string {
  const lines = markdown.split("\n");

  if (lineNumber < 0 || lineNumber >= lines.length) {
    return markdown;
  }

  const line = lines[lineNumber];

  // Match task list patterns: - [ ], - [x], - [X], etc.
  const taskPattern = /^(\s*[-*+]\s+)\[([ xX])\](\s+.*)$/;
  const match = line.match(taskPattern);

  if (!match) {
    return markdown;
  }

  const [, prefix, , suffix] = match;
  const newCheckmark = checked ? "x" : " ";
  lines[lineNumber] = `${prefix}[${newCheckmark}]${suffix}`;

  return lines.join("\n");
}

export function toggleTaskAtIndex(markdown: string, taskIndex: number, checked: boolean): string {
  const tasks = extractTasksFromAst(markdown);

  if (taskIndex < 0 || taskIndex >= tasks.length) {
    return markdown;
  }

  const task = tasks[taskIndex];
  return toggleTaskAtLine(markdown, task.lineNumber, checked);
}

export function getTaskLineNumber(markdown: string, taskIndex: number): number {
  const tasks = extractTasksFromAst(markdown);

  if (taskIndex < 0 || taskIndex >= tasks.length) {
    return -1;
  }

  return tasks[taskIndex].lineNumber;
}

export interface TaskItem {
  lineNumber: number;
  taskIndex: number;
  checked: boolean;
  content: string;
  indentation: number;
}

export interface HeadingItem {
  text: string;
  level: 1 | 2 | 3 | 4;
  slug: string;
}

const HASH_UNSAFE = /[\s#?]/g;

/** Unique URL fragment for an outline heading. Callers must walk h1–h4 in document order. */
export function headingAnchor(text: string, used: Map<string, number>): string {
  const base = text.trim().replace(HASH_UNSAFE, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "h";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

/**
 * Extract h1–h4 headings from markdown content for outline navigation.
 */
export function extractHeadings(markdown: string): HeadingItem[] {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const headings: HeadingItem[] = [];
  const used = new Map<string, number>();

  visit(tree, "heading", (node: Heading) => {
    if (node.depth < 1 || node.depth > 4) return;

    const text = getNodeText(node as unknown as MdastNode);
    if (!text) return;

    headings.push({ text, level: node.depth as 1 | 2 | 3 | 4, slug: headingAnchor(text, used) });
  });

  return headings;
}

interface MdastNode {
  value?: string;
  children?: MdastNode[];
}

function getNodeText(node: MdastNode): string {
  if (node.value) return node.value;
  if (node.children) return node.children.map(getNodeText).join("");
  return "";
}

export function extractTasks(markdown: string): TaskItem[] {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const lines = markdown.split("\n");
  const tasks: TaskItem[] = [];
  let taskIndex = 0;

  visit(tree, "listItem", (node: ListItem) => {
    if (typeof node.checked === "boolean" && node.position?.start.line) {
      const lineNumber = node.position.start.line - 1;
      const line = lines[lineNumber];

      // Extract indentation
      const indentMatch = line.match(/^(\s*)/);
      const indentation = indentMatch ? indentMatch[1].length : 0;

      // Extract content (text after the checkbox)
      const contentMatch = line.match(/^\s*[-*+]\s+\[[ xX]\]\s+(.*)/);
      const content = contentMatch ? contentMatch[1] : "";

      tasks.push({
        lineNumber,
        taskIndex: taskIndex++,
        checked: node.checked,
        content,
        indentation,
      });
    }
  });

  return tasks;
}
