-- ============================================================
-- hackX Evaluation Dashboard
-- Migration 019: Fix evaluation submission failure caused by
-- unsafe jsonb->boolean cast in validate_evaluation_upsert().
-- ============================================================
-- Root cause: /api/system-settings stores evaluations_locked as a
-- double-JSON-encoded string (JSONB scalar "true"/"false"), not a
-- raw JSON boolean. The trigger added in 018_security_audit_fixes.sql
-- did `value::boolean`, which Postgres cannot cast for a JSON string
-- scalar ("cannot cast jsonb string to type boolean"). This made
-- every evaluation submit fail once the lock setting row existed,
-- regardless of whether the lock was actually on.
--
-- submit_evaluation() (017_rubric_validation.sql) already compares
-- the value safely as a string; this migration brings the trigger
-- in line with that same safe comparison.
-- ============================================================

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

  -- Check global lock — value may be stored as either a raw JSON
  -- boolean (`true`) or a JSON string scalar (`"true"`), so compare
  -- against both forms instead of casting directly to boolean.
  SELECT EXISTS (
    SELECT 1 FROM public.system_settings
    WHERE key = 'evaluations_locked'
      AND (value = '"true"'::jsonb OR value = 'true'::jsonb)
  ) INTO v_is_locked;

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
