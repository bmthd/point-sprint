-- The official event master (src/server/event-store.ts), collected from Rakuten's marathon pages by
-- the Worker's cron (src/server/collect-events.ts). How to fix a row: docs/event-master.md.

CREATE TABLE official_events (
  -- `marathon-<start>`. Saved plans refer to it as `officialEventId`, so it never changes.
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  -- `OfficialEvent["benefits"]`, checked against `OfficialEventSchema` before it is written.
  benefits_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TEXT,
  -- Only `published` rows are served.
  status TEXT NOT NULL CHECK (status IN ('published', 'pending', 'rejected')),
  -- 1 for a row the operator fixed: collection leaves it alone.
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ok', 'warning', 'failed')),
  message TEXT NOT NULL,
  -- SHA-256 of the pages read, to tell whether they changed between runs.
  source_hash TEXT
);

-- The events of packages/domain/src/master/events.ts, which this table replaces. The first was
-- checked by hand on its round's page and is locked; the others came from the schedule page.
INSERT INTO official_events
  (id, name, period_start, period_end, benefits_json, source_url, locked, status)
VALUES
  ('marathon-2026-10', 'お買い物マラソン&ジャンル祭', '2026-10-04', '2026-10-09', '[{"id":"b31ed383-3fb7-425f-9391-70ecc965aa0e","kind":"shop-around","category":"campaign","label":"ショップ買いまわり","enabled":true,"amountBasis":"tax-excluded","capScope":"campaign","sharedKey":"marathon-2026-10","conditions":{"dateRule":{"type":"range","start":"2026-10-04","end":"2026-10-09"}},"params":{"tiers":[{"minShops":2,"rate":1},{"minShops":3,"rate":2},{"minShops":4,"rate":3},{"minShops":5,"rate":4},{"minShops":6,"rate":5},{"minShops":7,"rate":6},{"minShops":8,"rate":7},{"minShops":9,"rate":8},{"minShops":10,"rate":9}],"cap":7000,"roundingUnit":"item"}}]', 'https://event.rakuten.co.jp/campaign/point-up/marathon/', 1, 'published'),
  ('marathon-2026-10-14', 'お買い物マラソン第二弾', '2026-10-14', '2026-10-17', '[{"id":"fc7a45a2-5bd9-49ee-a9e7-6104109bd30d","kind":"shop-around","category":"campaign","label":"ショップ買いまわり","enabled":true,"amountBasis":"tax-excluded","capScope":"campaign","sharedKey":"marathon-2026-10-14","conditions":{"dateRule":{"type":"range","start":"2026-10-14","end":"2026-10-17"}},"params":{"tiers":[{"minShops":2,"rate":1},{"minShops":3,"rate":2},{"minShops":4,"rate":3},{"minShops":5,"rate":4},{"minShops":6,"rate":5},{"minShops":7,"rate":6},{"minShops":8,"rate":7},{"minShops":9,"rate":8},{"minShops":10,"rate":9}],"cap":7000,"roundingUnit":"item"}}]', 'https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/', 0, 'published'),
  ('marathon-2026-10-24', 'お買い物マラソン第三弾', '2026-10-24', '2026-10-27', '[{"id":"a34813b7-479d-4081-9a07-6386d48aad50","kind":"shop-around","category":"campaign","label":"ショップ買いまわり","enabled":true,"amountBasis":"tax-excluded","capScope":"campaign","sharedKey":"marathon-2026-10-24","conditions":{"dateRule":{"type":"range","start":"2026-10-24","end":"2026-10-27"}},"params":{"tiers":[{"minShops":2,"rate":1},{"minShops":3,"rate":2},{"minShops":4,"rate":3},{"minShops":5,"rate":4},{"minShops":6,"rate":5},{"minShops":7,"rate":6},{"minShops":8,"rate":7},{"minShops":9,"rate":8},{"minShops":10,"rate":9}],"cap":7000,"roundingUnit":"item"}}]', 'https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/', 0, 'published');
