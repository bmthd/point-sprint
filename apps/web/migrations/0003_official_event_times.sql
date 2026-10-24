-- The time, in Japan, each event starts on its first day and ends on its last day (#69). NULL when
-- it is not known. The marathon rounds' are from the schedule page; the brand day's is not known.

ALTER TABLE official_events ADD COLUMN period_start_time TEXT;
ALTER TABLE official_events ADD COLUMN period_end_time TEXT;

UPDATE official_events SET period_start_time = '20:00', period_end_time = '01:59'
  WHERE id = 'marathon-2026-10';
UPDATE official_events SET period_start_time = '20:00', period_end_time = '09:59'
  WHERE id IN ('marathon-2026-10-14', 'marathon-2026-10-24');
