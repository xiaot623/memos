import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useTagCounts } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { addTag, hasTag, isValidTagName, listTags, normalizeTagName, removeTag } from "@/utils/tag-markdown";

interface TagPickerDialogProps {
  open: boolean;
  content: string;
  onOpenChange: (open: boolean) => void;
  onContentChange: (content: string) => void;
}

export function TagPickerDialog({ open, content, onOpenChange, onContentChange }: TagPickerDialogProps) {
  const t = useTranslate();
  const { data: tagCounts = {} } = useTagCounts();
  const [query, setQuery] = useState("");

  const selected = useMemo(() => listTags(content), [content]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const knownTags = useMemo(() => {
    const names = new Set<string>([...Object.keys(tagCounts), ...selected]);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [selected, tagCounts]);

  const normalizedQuery = normalizeTagName(query);
  const queryLower = normalizedQuery.toLowerCase();
  const filteredTags = queryLower ? knownTags.filter((tag) => tag.toLowerCase().includes(queryLower)) : knownTags;
  const canCreate = isValidTagName(normalizedQuery) && !knownTags.some((tag) => tag.toLowerCase() === queryLower);

  const toggleTag = (tag: string) => {
    onContentChange(hasTag(content, tag) ? removeTag(content, tag) : addTag(content, tag));
  };

  const createTag = () => {
    if (!canCreate) {
      return;
    }
    toggleTag(normalizedQuery);
    setQuery("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent size="sm" showCloseButton={false} className="p-2! sm:p-2! md:p-2! gap-0">
        <VisuallyHidden>
          <DialogTitle>{t("editor.insert-menu.add-tag")}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>{t("editor.tag-picker.search-placeholder")}</DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            value={query}
            placeholder={t("editor.tag-picker.search-placeholder")}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createTag();
              }
            }}
            aria-label={t("editor.tag-picker.search-placeholder")}
            className="h-8"
          />
          <div className="flex max-h-52 flex-wrap content-start items-center gap-1.5 overflow-y-auto">
            {filteredTags.length === 0 && !canCreate && (
              <p className="w-full py-4 text-center text-sm text-muted-foreground">{t("editor.tag-picker.empty")}</p>
            )}
            {filteredTags.map((tag) => {
              const checked = selectedSet.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={cn(
                    "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-sm leading-5",
                    checked ? "border-primary bg-primary/15 text-primary" : "border-border text-foreground hover:bg-accent",
                  )}
                  onClick={() => toggleTag(tag)}
                >
                  <span className="truncate">#{tag}</span>
                </button>
              );
            })}
            <button
              type="button"
              disabled={!canCreate}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              aria-label={t("editor.tag-picker.create", { tag: normalizedQuery || "" })}
              onClick={createTag}
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
