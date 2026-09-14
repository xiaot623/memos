import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LinkMetadataCard from "@/components/MemoContent/LinkMetadataCard";
import { useLinkPreviewEnabled } from "@/contexts/ViewContext";

interface LinkPreviewHostProps {
  root: HTMLElement | null;
  enabled: boolean;
}

export function LinkPreviewHost({ root, enabled }: LinkPreviewHostProps) {
  const linkPreviewEnabled = useLinkPreviewEnabled();
  const [hosts, setHosts] = useState<Array<{ el: HTMLElement; url: string }>>([]);

  useEffect(() => {
    if (!root || !enabled || !linkPreviewEnabled) {
      setHosts([]);
      return;
    }

    const scan = () => {
      const next = [...root.querySelectorAll<HTMLElement>("[data-link-card]")].flatMap((el) => {
        const url = el.dataset.linkCard;
        return url ? [{ el, url }] : [];
      });
      setHosts(next);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root, enabled, linkPreviewEnabled]);

  if (!linkPreviewEnabled) {
    return null;
  }

  return <>{hosts.map(({ el, url }) => createPortal(<LinkMetadataCard key={url} url={url} fallback={<a href={url}>{url}</a>} />, el))}</>;
}
