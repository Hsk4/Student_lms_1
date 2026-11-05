-- ---------------------------------------------------------------------------
-- Starter catalogue: boards, levels, subjects and course combinations.
--
-- Paste this into the Neon SQL editor (or `psql`) when the catalogue is empty
-- and the request form says "The catalog is empty". It is the SQL equivalent of
-- `bun run --cwd apps/api seed:catalog`, and it is safe to run more than once:
-- every insert is guarded by the schema's own unique keys.
--
-- Order matters: courses reference boards, levels and subjects, so those are
-- inserted first and looked up by slug/order below.
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. Boards ----------------------------------------------------------------
INSERT INTO boards (name, slug, active) VALUES
  ('Federal Board (FBISE)',        'fbise',        true),
  ('Sindh Board (BISE Karachi)',   'bise-karachi', true),
  ('Punjab Board (BISE Lahore)',   'bise-lahore',  true),
  ('Aga Khan Examination Board',   'akeb',         true),
  ('Cambridge (CAIE)',             'cambridge',    true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Levels ----------------------------------------------------------------
INSERT INTO levels (name, "order", active) VALUES
  ('Matric (Grade 9)',          1, true),
  ('Matric (Grade 10)',         2, true),
  ('Intermediate (Grade 11)',   3, true),
  ('Intermediate (Grade 12)',   4, true),
  ('O Level',                   5, true),
  ('AS Level',                  6, true),
  ('A Level',                   7, true)
ON CONFLICT ("order") DO NOTHING;

-- 3. Subjects --------------------------------------------------------------
INSERT INTO subjects (name, slug, active) VALUES
  ('Accounting',          'accounting',          true),
  ('Biology',             'biology',             true),
  ('Business Studies',    'business-studies',    true),
  ('Chemistry',           'chemistry',           true),
  ('Commerce',            'commerce',            true),
  ('Computer Science',    'computer-science',    true),
  ('Economics',           'economics',           true),
  ('English',             'english',             true),
  ('General Science',     'general-science',     true),
  ('Islamic Studies',     'islamic-studies',     true),
  ('Mathematics',         'mathematics',         true),
  ('Pakistan Studies',    'pakistan-studies',    true),
  ('Physics',             'physics',             true),
  ('Urdu',                'urdu',                true)
ON CONFLICT (slug) DO NOTHING;

-- 4. Course combinations ---------------------------------------------------
-- One row per (board, level, subject). `medium` stays NULL, which the unique
-- index treats as "no medium" (NULLS NOT DISTINCT).
INSERT INTO courses (board_id, level_id, subject_id, medium, active)
SELECT b.id, l.id, s.id, NULL, true
FROM boards b
JOIN levels l ON true
JOIN subjects s ON true
WHERE
  -- SSC (grades 9-10) across the four Pakistani boards.
  (
    b.slug IN ('fbise', 'bise-karachi', 'bise-lahore', 'akeb')
    AND l."order" IN (1, 2)
    AND s.slug IN (
      'english', 'urdu', 'mathematics', 'physics', 'chemistry', 'biology',
      'computer-science', 'general-science', 'pakistan-studies', 'islamic-studies'
    )
  )
  OR
  -- HSSC (grades 11-12) across the four Pakistani boards.
  (
    b.slug IN ('fbise', 'bise-karachi', 'bise-lahore', 'akeb')
    AND l."order" IN (3, 4)
    AND s.slug IN (
      'english', 'urdu', 'mathematics', 'physics', 'chemistry', 'biology',
      'computer-science', 'pakistan-studies', 'islamic-studies',
      'accounting', 'economics', 'business-studies', 'commerce'
    )
  )
  OR
  -- Cambridge O Level.
  (
    b.slug = 'cambridge'
    AND l."order" = 5
    AND s.slug IN (
      'english', 'urdu', 'mathematics', 'physics', 'chemistry', 'biology',
      'computer-science', 'pakistan-studies', 'islamic-studies',
      'accounting', 'economics', 'business-studies'
    )
  )
  OR
  -- Cambridge AS and A Level.
  (
    b.slug = 'cambridge'
    AND l."order" IN (6, 7)
    AND s.slug IN (
      'english', 'mathematics', 'physics', 'chemistry', 'biology',
      'computer-science', 'accounting', 'economics', 'business-studies'
    )
  )
ON CONFLICT (board_id, level_id, subject_id, medium) DO NOTHING;

COMMIT;

-- What was created:
--   SELECT (SELECT count(*) FROM boards)   AS boards,
--          (SELECT count(*) FROM levels)   AS levels,
--          (SELECT count(*) FROM subjects) AS subjects,
--          (SELECT count(*) FROM courses)  AS courses;
