-- Migration 018: Security and Audit Fixes

-- 1. Profiles Trigger: Prevent non-admins from changing their own role
CREATE OR REPLACE FUNCTION public.check_role_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Check if the current user is an admin
    IF (SELECT public.get_user_role()) != 'admin' THEN
      RAISE EXCEPTION 'Only admins can change user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_role_update ON public.profiles;
CREATE TRIGGER enforce_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_role_update();

-- 2. Evaluations Trigger: Enforce assignment, locks, max score, and block admin direct edits
CREATE OR REPLACE FUNCTION public.validate_evaluation_upsert()
RETURNS TRIGGER AS $$
DECLARE
  v_max_score INT;
  v_is_locked BOOLEAN;
  v_is_assigned BOOLEAN;
BEGIN
  -- Admins can view but never edit evaluations (based on user feedback)
  IF (SELECT public.get_user_role()) = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot edit evaluations.';
  END IF;

  -- Must be assigned to this proposal
  SELECT EXISTS(
    SELECT 1 FROM public.proposal_assignments
    WHERE proposal_id = NEW.proposal_id AND evaluator_id = NEW.evaluator_id
  ) INTO v_is_assigned;
  
  IF NOT v_is_assigned THEN
    RAISE EXCEPTION 'Evaluator is not assigned to this proposal.';
  END IF;

  -- Check global lock
  SELECT (value::boolean) INTO v_is_locked FROM public.system_settings WHERE key = 'evaluations_locked';
  IF v_is_locked THEN
    RAISE EXCEPTION 'Evaluations are currently locked.';
  END IF;

  -- Check score cap
  SELECT max_score INTO v_max_score FROM public.rubric_criteria WHERE id = NEW.rubric_criterion_id;
  IF NEW.score > v_max_score THEN
    RAISE EXCEPTION 'Score exceeds the maximum allowed for this criterion.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_evaluation_rules ON public.evaluations;
CREATE TRIGGER enforce_evaluation_rules
  BEFORE INSERT OR UPDATE ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_evaluation_upsert();

-- Update Evaluations RLS to reflect this strictness:
-- We'll drop the existing evaluator insert/update policies and create stricter ones.
DROP POLICY IF EXISTS "evaluator_evaluations_insert" ON public.evaluations;
DROP POLICY IF EXISTS "evaluator_evaluations_update" ON public.evaluations;

CREATE POLICY "evaluator_evaluations_insert"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND (SELECT public.get_user_role()) = 'evaluator'
    AND EXISTS (
      SELECT 1 FROM public.proposal_assignments
      WHERE proposal_id = evaluations.proposal_id AND evaluator_id = auth.uid()
    )
  );

CREATE POLICY "evaluator_evaluations_update"
  ON public.evaluations FOR UPDATE TO authenticated
  USING (
    evaluator_id = auth.uid()
    AND (SELECT public.get_user_role()) = 'evaluator'
    AND EXISTS (
      SELECT 1 FROM public.proposal_assignments
      WHERE proposal_id = evaluations.proposal_id AND evaluator_id = auth.uid()
    )
  )
  WITH CHECK (
    evaluator_id = auth.uid()
    AND (SELECT public.get_user_role()) = 'evaluator'
    AND EXISTS (
      SELECT 1 FROM public.proposal_assignments
      WHERE proposal_id = evaluations.proposal_id AND evaluator_id = auth.uid()
    )
  );

-- Admins should not be able to INSERT or UPDATE evaluations anymore (as per user request)
DROP POLICY IF EXISTS "admin_evaluations_all" ON public.evaluations;

CREATE POLICY "admin_evaluations_select"
  ON public.evaluations FOR SELECT TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');

CREATE POLICY "admin_evaluations_delete"
  ON public.evaluations FOR DELETE TO authenticated
  USING ((SELECT public.get_user_role()) = 'admin');
-- Notice no INSERT or UPDATE policy for admins here.

-- 3. Update pdf_annotations and video_comments INSERT policies to require assignment
DROP POLICY IF EXISTS "evaluator_annotations_insert" ON public.pdf_annotations;
CREATE POLICY "evaluator_annotations_insert"
  ON public.pdf_annotations FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND (SELECT public.get_user_role()) = 'evaluator'
    AND EXISTS (
      SELECT 1 FROM public.proposal_assignments
      WHERE proposal_id = pdf_annotations.proposal_id AND evaluator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "evaluator_video_comments_insert" ON public.video_comments;
CREATE POLICY "evaluator_video_comments_insert"
  ON public.video_comments FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND (SELECT public.get_user_role()) = 'evaluator'
    AND EXISTS (
      SELECT 1 FROM public.proposal_assignments
      WHERE proposal_id = video_comments.proposal_id AND evaluator_id = auth.uid()
    )
  );

-- 4. system_settings SELECT policy to require authenticated
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system settings"
  ON public.system_settings FOR SELECT TO authenticated
  USING (true);
