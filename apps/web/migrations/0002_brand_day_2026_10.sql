-- The 楽天ブランドデー of 2026-10-20 to 21. Collection (src/server/official-events/collect-events.ts) does not read
-- brand days, so the row is copied by hand from https://event.rakuten.co.jp/brand/campaign/ and locked
-- (docs/event-master.md). The `brand-day` order tag it needs is read from this version of the app on,
-- so the row ships with it. A row the operator put in first is kept.

INSERT OR IGNORE INTO official_events
  (id, name, period_start, period_end, benefits_json, source_url, locked, status)
VALUES
  ('brand-day-2026-10-20', '楽天ブランドデー', '2026-10-20', '2026-10-21', '[{"id":"ac1159e0-b878-47be-92ef-e870d40d1399","kind":"spend-tiers","category":"campaign","label":"ブランドデー","enabled":true,"amountBasis":"tax-excluded","capScope":"campaign","sharedKey":"brand-day-2026-10-20","conditions":{"dateRule":{"type":"range","start":"2026-10-20","end":"2026-10-21"},"orderTags":["brand-day"]},"params":{"tiers":[{"minAmount":0,"rate":2},{"minAmount":30000,"rate":4}],"cap":4000,"roundingUnit":"item"}}]', 'https://event.rakuten.co.jp/brand/campaign/', 1, 'published');
