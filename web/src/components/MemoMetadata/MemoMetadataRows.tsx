import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentRows } from "./Attachment/AttachmentListView";
import { METADATA_ROW_LIST_CLASSES } from "./MetadataSection";

interface MemoMetadataRowsProps {
  audio: Attachment[];
  docs: Attachment[];
  currentMemoName?: string;
  parentPage?: string;
}

/**
 * Non-media attachments shown beneath memo content. Location and relations were removed.
 */
const MemoMetadataRows = ({ audio, docs }: MemoMetadataRowsProps) => {
  if (audio.length === 0 && docs.length === 0) {
    return null;
  }

  return (
    <div className={METADATA_ROW_LIST_CLASSES}>
      <AttachmentRows audio={audio} docs={docs} />
    </div>
  );
};

export default MemoMetadataRows;
