/** Reserved fragment ids that memo heading anchors must not claim. */
export const MEMO_COMMENTS_ANCHOR_ID = "memo-comments";
export const LEGACY_MEMO_COMMENTS_ANCHOR_ID = "comments";
export const RESERVED_MEMO_COMMENTS_ANCHOR_IDS = [MEMO_COMMENTS_ANCHOR_ID, LEGACY_MEMO_COMMENTS_ANCHOR_ID] as const;
