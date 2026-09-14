const TRUSTED_IFRAME_SRC_PATTERNS = [
  /^https:\/\/www\.youtube\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/player\.vimeo\.com\/video\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/open\.spotify\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/w\.soundcloud\.com\/player\/?(?:\?.*)?$/i,
  /^https:\/\/www\.loom\.com\/embed\/[^?#]+(?:\?.*)?$/i,
  /^https:\/\/www\.google\.com\/maps\/embed(?:\/[^?#]*)?(?:\?.*)?$/i,
  /^https:\/\/(?:app\.)?diagrams\.net\/(?:[^?#]+)?(?:\?.*)?$/i,
  /^https:\/\/(?:www\.)?draw\.io\/(?:[^?#]+)?(?:\?.*)?$/i,
];

export const isTrustedIframeSrc = (src: string): boolean => TRUSTED_IFRAME_SRC_PATTERNS.some((pattern) => pattern.test(src));
