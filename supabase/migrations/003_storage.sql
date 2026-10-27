-- ═══════════════════════════════════════════════════════════
-- 003 STORAGE BUCKETS AND POLICIES
-- ═══════════════════════════════════════════════════════════

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('task-attachments', 'task-attachments', false, 52428800, NULL),
  ('submission-files', 'submission-files', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;
-- ═══════════════════════════════════════════════════════════
-- TASK ATTACHMENTS BUCKET POLICIES
-- ═══════════════════════════════════════════════════════════

-- Teachers can upload to their own folder
DROP POLICY IF EXISTS "Teachers can upload task attachments" ON storage.objects;
CREATE POLICY "Teachers can upload task attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- Teachers can read their own task attachments
DROP POLICY IF EXISTS "Teachers can read own task attachments" ON storage.objects;
CREATE POLICY "Teachers can read own task attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- Students can read task attachments from their teacher's folder
DROP POLICY IF EXISTS "Students can read assigned task attachments" ON storage.objects;
CREATE POLICY "Students can read assigned task attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-attachments'
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.teacher_id::text = (storage.foldername(name))[1]
      )
      OR
      EXISTS (
        SELECT 1 FROM assignments
        WHERE assignments.student_id = auth.uid()
        AND assignments.teacher_id::text = (storage.foldername(name))[1]
      )
    )
  );
-- Teachers can delete their own task attachments
DROP POLICY IF EXISTS "Teachers can delete own task attachments" ON storage.objects;
CREATE POLICY "Teachers can delete own task attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- ═══════════════════════════════════════════════════════════
-- SUBMISSION FILES BUCKET POLICIES
-- ═══════════════════════════════════════════════════════════

-- Students can upload to their own folder
DROP POLICY IF EXISTS "Students can upload submission files" ON storage.objects;
CREATE POLICY "Students can upload submission files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submission-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- Students can read their own submission files
DROP POLICY IF EXISTS "Students can read own submission files" ON storage.objects;
CREATE POLICY "Students can read own submission files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- Teachers can read submission files from their students
DROP POLICY IF EXISTS "Teachers can read student submission files" ON storage.objects;
CREATE POLICY "Teachers can read student submission files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id::text = (storage.foldername(name))[1]
      AND profiles.teacher_id = auth.uid()
    )
  );
-- Students can delete their own submission files
DROP POLICY IF EXISTS "Students can delete own submission files" ON storage.objects;
CREATE POLICY "Students can delete own submission files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'submission-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
