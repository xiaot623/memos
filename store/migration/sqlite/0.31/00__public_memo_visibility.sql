-- Allow PUBLIC memo visibility on databases created before that audience existed.
CREATE TABLE memo__public_visibility (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  row_status TEXT NOT NULL CHECK (row_status IN ('NORMAL', 'ARCHIVED')) DEFAULT 'NORMAL',
  content TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('PRIVATE', 'PUBLIC', 'SPACE')) DEFAULT 'PRIVATE',
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)) DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}',
  space_id INTEGER DEFAULT NULL
);

INSERT INTO memo__public_visibility (
  id, uid, creator_id, created_ts, updated_ts, row_status, content, visibility, pinned, payload, space_id
)
SELECT id, uid, creator_id, created_ts, updated_ts, row_status, content, visibility, pinned, payload, space_id
FROM memo;

DROP TABLE memo;

ALTER TABLE memo__public_visibility RENAME TO memo;

CREATE INDEX idx_memo_creator_id ON memo(creator_id);
CREATE INDEX idx_memo_space_id ON memo(space_id, row_status, created_ts DESC, id DESC);
