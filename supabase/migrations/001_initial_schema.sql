-- ═══════════════════════════════════════════════════════════
-- 001 INITIAL SCHEMA
-- Homework Management Platform
-- ═══════════════════════════════════════════════════════════

-- ── Role enum ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
'teacher', 'student'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- ── Assignment status enum ────────────────────────────────
DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM (

  'not_started',
  'in_progress',
  'submitted',
  'under_review',
  'needs_revision',
  'done'

  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- ── Task type enum ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE task_type AS ENUM (

  'keyword',
  'summary',
  'vocabulary',
  'writing',
  'reading',
  'listening',
  'speaking',
  'grammar',
  'other'

  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
-- ═══════════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  role        user_role NOT NULL,
  teacher_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Index for teacher-student lookup
CREATE INDEX IF NOT EXISTS idx_profiles_teacher_id ON profiles(teacher_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
-- ═══════════════════════════════════════════════════════════
-- TASK TEMPLATES
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  type             task_type NOT NULL DEFAULT 'other',
  instructions     TEXT,
  submission_types JSONB NOT NULL DEFAULT '["text"]'::jsonb,
  metadata         JSONB DEFAULT '{}'::jsonb,
  is_archived      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_templates_teacher_id ON task_templates(teacher_id);
-- ═══════════════════════════════════════════════════════════
-- TASK ATTACHMENTS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  storage_path     TEXT NOT NULL,
  mime_type        TEXT,
  file_size        BIGINT,
  attachment_type  TEXT NOT NULL DEFAULT 'file', -- 'file', 'image', 'link'
  url              TEXT,  -- for link attachments
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_template_id ON task_attachments(task_template_id);
-- ═══════════════════════════════════════════════════════════
-- ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  teacher_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Snapshot of template at assignment time
  title            TEXT NOT NULL,
  type             task_type NOT NULL DEFAULT 'other',
  instructions     TEXT,
  submission_types JSONB NOT NULL DEFAULT '["text"]'::jsonb,

  deadline         TIMESTAMPTZ,
  status           assignment_status NOT NULL DEFAULT 'not_started',

  grade            INTEGER CHECK (grade >= 0 AND grade <= 100),
  feedback         TEXT,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES profiles(id),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student_id ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);
CREATE INDEX IF NOT EXISTS idx_assignments_template_id ON assignments(task_template_id);
-- ═══════════════════════════════════════════════════════════
-- ASSIGNMENT ATTACHMENTS (references to template attachments)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS assignment_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id    UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  storage_path     TEXT NOT NULL,
  mime_type        TEXT,
  file_size        BIGINT,
  attachment_type  TEXT NOT NULL DEFAULT 'file',
  url              TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment_id ON assignment_attachments(assignment_id);
-- ═══════════════════════════════════════════════════════════
-- SUBMISSIONS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  text_content    TEXT,
  version         INTEGER NOT NULL DEFAULT 1,

  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
-- ═══════════════════════════════════════════════════════════
-- SUBMISSION ATTACHMENTS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS submission_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  mime_type       TEXT,
  file_size       BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission_id ON submission_attachments(submission_id);
-- ═══════════════════════════════════════════════════════════
-- TRIGGERS: Auto-update updated_at
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_task_templates_updated_at ON task_templates;
CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
