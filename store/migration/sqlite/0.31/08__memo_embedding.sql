CREATE TABLE memo_embedding (
  memo_id INTEGER NOT NULL,
  attachment_id INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  updated_ts BIGINT NOT NULL,
  skipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (memo_id, attachment_id)
);
