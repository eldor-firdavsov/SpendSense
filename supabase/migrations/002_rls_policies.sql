-- ═══════════════════════════════════════════════════════════
-- 002 ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;
-- ═══════════════════════════════════════════════════════════
-- PROFILES POLICIES
-- ═══════════════════════════════════════════════════════════

-- Teachers can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());
-- Teachers can read profiles of their students
DROP POLICY IF EXISTS "Teachers can read their students profiles" ON profiles;
CREATE POLICY "Teachers can read their students profiles"
  ON profiles FOR SELECT
  USING (teacher_id = auth.uid());
-- Users can update their own profile (limited fields)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
-- Allow service role insert (for Edge Function student creation)
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);
-- ═══════════════════════════════════════════════════════════
-- TASK TEMPLATES POLICIES
-- ═══════════════════════════════════════════════════════════

-- Teachers can CRUD only their own templates
DROP POLICY IF EXISTS "Teachers can read own templates" ON task_templates;
CREATE POLICY "Teachers can read own templates"
  ON task_templates FOR SELECT
  USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can insert own templates" ON task_templates;
CREATE POLICY "Teachers can insert own templates"
  ON task_templates FOR INSERT
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can update own templates" ON task_templates;
CREATE POLICY "Teachers can update own templates"
  ON task_templates FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can delete own templates" ON task_templates;
CREATE POLICY "Teachers can delete own templates"
  ON task_templates FOR DELETE
  USING (teacher_id = auth.uid());
-- ═══════════════════════════════════════════════════════════
-- TASK ATTACHMENTS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Teachers can manage attachments for their templates
DROP POLICY IF EXISTS "Teachers can read own template attachments" ON task_attachments;
CREATE POLICY "Teachers can read own template attachments"
  ON task_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_templates
      WHERE task_templates.id = task_attachments.task_template_id
      AND task_templates.teacher_id = auth.uid()
    )
  );
-- Students can read attachments for their assigned templates
DROP POLICY IF EXISTS "Students can read assigned template attachments" ON task_attachments;
CREATE POLICY "Students can read assigned template attachments"
  ON task_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.task_template_id = task_attachments.task_template_id
      AND assignments.student_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Teachers can insert own template attachments" ON task_attachments;
CREATE POLICY "Teachers can insert own template attachments"
  ON task_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_templates
      WHERE task_templates.id = task_attachments.task_template_id
      AND task_templates.teacher_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Teachers can delete own template attachments" ON task_attachments;
CREATE POLICY "Teachers can delete own template attachments"
  ON task_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM task_templates
      WHERE task_templates.id = task_attachments.task_template_id
      AND task_templates.teacher_id = auth.uid()
    )
  );
-- ═══════════════════════════════════════════════════════════
-- ASSIGNMENTS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Teachers can read their assignments
DROP POLICY IF EXISTS "Teachers can read own assignments" ON assignments;
CREATE POLICY "Teachers can read own assignments"
  ON assignments FOR SELECT
  USING (teacher_id = auth.uid());
-- Students can read their assignments
DROP POLICY IF EXISTS "Students can read own assignments" ON assignments;
CREATE POLICY "Students can read own assignments"
  ON assignments FOR SELECT
  USING (student_id = auth.uid());
-- Teachers can create assignments for their students
DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
CREATE POLICY "Teachers can create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = assignments.student_id
      AND profiles.teacher_id = auth.uid()
    )
  );
-- Teachers can update their assignments
DROP POLICY IF EXISTS "Teachers can update own assignments" ON assignments;
CREATE POLICY "Teachers can update own assignments"
  ON assignments FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());
-- Students can update status of their assignments (limited)
DROP POLICY IF EXISTS "Students can update own assignment status" ON assignments;
CREATE POLICY "Students can update own assignment status"
  ON assignments FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (
    student_id = auth.uid()
    -- Students can only set status to in_progress or submitted
    AND status IN ('in_progress', 'submitted')
  );
-- Teachers can delete their assignments
DROP POLICY IF EXISTS "Teachers can delete own assignments" ON assignments;
CREATE POLICY "Teachers can delete own assignments"
  ON assignments FOR DELETE
  USING (teacher_id = auth.uid());
-- ═══════════════════════════════════════════════════════════
-- ASSIGNMENT ATTACHMENTS POLICIES
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Teachers can read own assignment attachments" ON assignment_attachments;
CREATE POLICY "Teachers can read own assignment attachments"
  ON assignment_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_attachments.assignment_id
      AND assignments.teacher_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Students can read own assignment attachments" ON assignment_attachments;
CREATE POLICY "Students can read own assignment attachments"
  ON assignment_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_attachments.assignment_id
      AND assignments.student_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Teachers can insert assignment attachments" ON assignment_attachments;
CREATE POLICY "Teachers can insert assignment attachments"
  ON assignment_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_attachments.assignment_id
      AND assignments.teacher_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Teachers can delete assignment attachments" ON assignment_attachments;
CREATE POLICY "Teachers can delete assignment attachments"
  ON assignment_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_attachments.assignment_id
      AND assignments.teacher_id = auth.uid()
    )
  );
-- ═══════════════════════════════════════════════════════════
-- SUBMISSIONS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Students can create submissions for their own assignments
DROP POLICY IF EXISTS "Students can create own submissions" ON submissions;
CREATE POLICY "Students can create own submissions"
  ON submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = submissions.assignment_id
      AND assignments.student_id = auth.uid()
    )
  );
-- Students can read their own submissions
DROP POLICY IF EXISTS "Students can read own submissions" ON submissions;
CREATE POLICY "Students can read own submissions"
  ON submissions FOR SELECT
  USING (student_id = auth.uid());
-- Teachers can read submissions for their assignments
DROP POLICY IF EXISTS "Teachers can read submissions for own assignments" ON submissions;
CREATE POLICY "Teachers can read submissions for own assignments"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = submissions.assignment_id
      AND assignments.teacher_id = auth.uid()
    )
  );
-- Students can update their own submissions (before final review)
DROP POLICY IF EXISTS "Students can update own submissions" ON submissions;
CREATE POLICY "Students can update own submissions"
  ON submissions FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
-- ═══════════════════════════════════════════════════════════
-- SUBMISSION ATTACHMENTS POLICIES
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Students can insert own submission attachments" ON submission_attachments;
CREATE POLICY "Students can insert own submission attachments"
  ON submission_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = submission_attachments.submission_id
      AND submissions.student_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Students can read own submission attachments" ON submission_attachments;
CREATE POLICY "Students can read own submission attachments"
  ON submission_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = submission_attachments.submission_id
      AND submissions.student_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Teachers can read submission attachments for own assignments" ON submission_attachments;
CREATE POLICY "Teachers can read submission attachments for own assignments"
  ON submission_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM submissions
      JOIN assignments ON assignments.id = submissions.assignment_id
      WHERE submissions.id = submission_attachments.submission_id
      AND assignments.teacher_id = auth.uid()
    )
  );
