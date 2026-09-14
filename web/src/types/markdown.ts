export interface TagNode {
  type: "tagNode";
  value: string;
  data: TagNodeData;
}

export interface MentionNode {
  type: "mentionNode";
  value: string;
  data: MentionNodeData;
}

export interface TagNodeData {
  hName: "span";
  hProperties: TagNodeProperties;
  hChildren: Array<{ type: "text"; value: string }>;
}

export interface MentionNodeData {
  hName: "span";
  hProperties: MentionNodeProperties;
  hChildren: Array<{ type: "text"; value: string }>;
}

export interface TagNodeProperties {
  className: string;
  "data-tag": string;
}

export interface MentionNodeProperties {
  className: string;
  "data-mention": string;
}
