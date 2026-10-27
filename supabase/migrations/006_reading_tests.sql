-- ═══════════════════════════════════════════════════════════
-- 006 IELTS READING TESTS
-- Reading Test Management for IELTS exam simulation
-- ═══════════════════════════════════════════════════════════

-- ── Reading Tests (teacher-created test templates) ────────
CREATE TABLE IF NOT EXISTS reading_tests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,

  -- Up to 3 passages per test (IELTS format)
  -- Structure: [{ title, text, questions: [{ id, type, questionText, options, correctAnswer, correctAnswers, points }] }]
  passages         JSONB NOT NULL DEFAULT '[]'::jsonb,

  time_limit_mins  INTEGER NOT NULL DEFAULT 60,
  total_questions  INTEGER NOT NULL DEFAULT 40,

  -- Raw score → band mapping override (optional)
  band_scale       JSONB DEFAULT '{}'::jsonb,

  is_archived      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reading_tests_teacher_id ON reading_tests(teacher_id);
-- ── Reading Test Assignments ──────────────────────────────
CREATE TABLE IF NOT EXISTS reading_test_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_test_id  UUID NOT NULL REFERENCES reading_tests(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  status           TEXT NOT NULL DEFAULT 'assigned',
  -- 'assigned' | 'in_progress' | 'submitted' | 'graded'

  deadline         TIMESTAMPTZ,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rt_assignments_teacher ON reading_test_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_rt_assignments_student ON reading_test_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_rt_assignments_test    ON reading_test_assignments(reading_test_id);
-- ── Reading Test Submissions ──────────────────────────────
CREATE TABLE IF NOT EXISTS reading_test_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     UUID NOT NULL REFERENCES reading_test_assignments(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Student answers: { "q1": "TRUE", "q2": "C", ... }
  answers           JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- AI Grading Results
  correct_count     INTEGER,
  total_questions   INTEGER,
  band_score        REAL,
  percentage        REAL,

  -- Per-question breakdown: [{ questionId, studentAnswer, correctAnswer, isCorrect, explanation }]
  detailed_results  JSONB,

  ai_feedback       TEXT,
  graded_at         TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_spent_secs   INTEGER,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rt_submissions_assignment ON reading_test_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_rt_submissions_student    ON reading_test_submissions(student_id);
-- ── Triggers: auto-update updated_at ──────────────────────
DROP TRIGGER IF EXISTS update_reading_tests_updated_at ON reading_tests;
CREATE TRIGGER update_reading_tests_updated_at
  BEFORE UPDATE ON reading_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_rt_assignments_updated_at ON reading_test_assignments;
CREATE TRIGGER update_rt_assignments_updated_at
  BEFORE UPDATE ON reading_test_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_rt_submissions_updated_at ON reading_test_submissions;
CREATE TRIGGER update_rt_submissions_updated_at
  BEFORE UPDATE ON reading_test_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ═══════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════

ALTER TABLE reading_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_test_submissions ENABLE ROW LEVEL SECURITY;
-- ── reading_tests policies ────────────────────────────────

DROP POLICY IF EXISTS "Teachers can read own reading tests" ON reading_tests;
CREATE POLICY "Teachers can read own reading tests"
  ON reading_tests FOR SELECT
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can insert own reading tests" ON reading_tests;
CREATE POLICY "Teachers can insert own reading tests"
  ON reading_tests FOR INSERT
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can update own reading tests" ON reading_tests;
CREATE POLICY "Teachers can update own reading tests"
  ON reading_tests FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can delete own reading tests" ON reading_tests;
CREATE POLICY "Teachers can delete own reading tests"
  ON reading_tests FOR DELETE
  USING (teacher_id = auth.uid());
-- Students can read tests they are assigned to
DROP POLICY IF EXISTS "Students can read assigned reading tests" ON reading_tests;
CREATE POLICY "Students can read assigned reading tests"
  ON reading_tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reading_test_assignments
      WHERE reading_test_assignments.reading_test_id = reading_tests.id
      AND reading_test_assignments.student_id = auth.uid()
    )
  );
-- ── reading_test_assignments policies ─────────────────────

DROP POLICY IF EXISTS "Teachers can read own rt assignments" ON reading_test_assignments;
CREATE POLICY "Teachers can read own rt assignments"
  ON reading_test_assignments FOR SELECT
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can create rt assignments" ON reading_test_assignments;
CREATE POLICY "Teachers can create rt assignments"
  ON reading_test_assignments FOR INSERT
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can update own rt assignments" ON reading_test_assignments;
CREATE POLICY "Teachers can update own rt assignments"
  ON reading_test_assignments FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can delete own rt assignments" ON reading_test_assignments;
CREATE POLICY "Teachers can delete own rt assignments"
  ON reading_test_assignments FOR DELETE
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Students can read own rt assignments" ON reading_test_assignments;
CREATE POLICY "Students can read own rt assignments"
  ON reading_test_assignments FOR SELECT
  USING (student_id = auth.uid());
DROP POLICY IF EXISTS "Students can update own rt assignments" ON reading_test_assignments;
CREATE POLICY "Students can update own rt assignments"
  ON reading_test_assignments FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
-- ── reading_test_submissions policies ─────────────────────

DROP POLICY IF EXISTS "Students can create own rt submissions" ON reading_test_submissions;
CREATE POLICY "Students can create own rt submissions"
  ON reading_test_submissions FOR INSERT
  WITH CHECK (student_id = auth.uid());
DROP POLICY IF EXISTS "Students can read own rt submissions" ON reading_test_submissions;
CREATE POLICY "Students can read own rt submissions"
  ON reading_test_submissions FOR SELECT
  USING (student_id = auth.uid());
DROP POLICY IF EXISTS "Students can update own rt submissions" ON reading_test_submissions;
CREATE POLICY "Students can update own rt submissions"
  ON reading_test_submissions FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can read rt submissions for own assignments" ON reading_test_submissions;
CREATE POLICY "Teachers can read rt submissions for own assignments"
  ON reading_test_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reading_test_assignments
      WHERE reading_test_assignments.id = reading_test_submissions.assignment_id
      AND reading_test_assignments.teacher_id = auth.uid()
    )
  );
-- ═══════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reading_test_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reading_test_assignments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reading_test_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reading_test_submissions;
  END IF;
END $$;
