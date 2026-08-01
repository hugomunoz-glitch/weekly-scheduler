-- ============================================================
-- Coaching & Templates System
-- ============================================================

-- 1. Add role to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'coach', 'admin'));

-- ============================================================
-- 2. Coach invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_email text,
  message       text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitee_required CHECK (invitee_id IS NOT NULL OR invitee_email IS NOT NULL)
);

ALTER TABLE coach_invitations ENABLE ROW LEVEL SECURITY;

-- Coach can create and view their own invitations
CREATE POLICY "coach_invitations_coach_select" ON coach_invitations
  FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY "coach_invitations_coach_insert" ON coach_invitations
  FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_invitations_coach_delete" ON coach_invitations
  FOR DELETE USING (coach_id = auth.uid());

-- Invitee can view and respond to invitations sent to them
CREATE POLICY "coach_invitations_invitee_select" ON coach_invitations
  FOR SELECT USING (invitee_id = auth.uid());

CREATE POLICY "coach_invitations_invitee_update" ON coach_invitations
  FOR UPDATE USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid() AND status IN ('accepted', 'declined'));

-- ============================================================
-- 3. Coach assignments (established relationships)
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, member_id)
);

ALTER TABLE coach_assignments ENABLE ROW LEVEL SECURITY;

-- Coach and member can both see the relationship
CREATE POLICY "coach_assignments_select" ON coach_assignments
  FOR SELECT USING (coach_id = auth.uid() OR member_id = auth.uid());

-- Only the system (via function) inserts — no direct client inserts
-- (acceptance is handled by accept_coaching_invitation function below)

-- ============================================================
-- 4. Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Coaches and admins can create templates
CREATE POLICY "templates_insert" ON templates
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
  );

-- Creator can update/delete their own templates
CREATE POLICY "templates_update" ON templates
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "templates_delete" ON templates
  FOR DELETE USING (created_by = auth.uid());

-- Coaches can see templates they created; admins see all; members see public ones
CREATE POLICY "templates_select" ON templates
  FOR SELECT USING (
    created_by = auth.uid()
    OR is_public = true
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM user_templates ut
      WHERE ut.template_id = templates.id AND ut.member_id = auth.uid()
    )
  );

-- ============================================================
-- 5. Template goals
-- ============================================================
CREATE TABLE IF NOT EXISTS template_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  title       text NOT NULL,
  category    text,
  priority    text CHECK (priority IN ('high', 'medium', 'low')),
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE template_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_goals_select" ON template_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM templates t
      WHERE t.id = template_goals.template_id
        AND (
          t.created_by = auth.uid()
          OR t.is_public = true
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
          OR EXISTS (SELECT 1 FROM user_templates ut WHERE ut.template_id = t.id AND ut.member_id = auth.uid())
        )
    )
  );

CREATE POLICY "template_goals_insert" ON template_goals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM templates WHERE id = template_goals.template_id AND created_by = auth.uid())
  );

CREATE POLICY "template_goals_update" ON template_goals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM templates WHERE id = template_goals.template_id AND created_by = auth.uid())
  );

CREATE POLICY "template_goals_delete" ON template_goals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM templates WHERE id = template_goals.template_id AND created_by = auth.uid())
  );

-- ============================================================
-- 6. Template tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS template_tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_goal_id    uuid NOT NULL REFERENCES template_goals(id) ON DELETE CASCADE,
  title               text NOT NULL,
  notes               text,
  priority            text CHECK (priority IN ('high', 'medium', 'low')),
  unlock_days_offset  int NOT NULL DEFAULT 0,
  due_days_offset     int,
  sort_order          int NOT NULL DEFAULT 0
);

ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_tasks_select" ON template_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM template_goals tg
      JOIN templates t ON t.id = tg.template_id
      WHERE tg.id = template_tasks.template_goal_id
        AND (
          t.created_by = auth.uid()
          OR t.is_public = true
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
          OR EXISTS (SELECT 1 FROM user_templates ut WHERE ut.template_id = t.id AND ut.member_id = auth.uid())
        )
    )
  );

CREATE POLICY "template_tasks_insert" ON template_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM template_goals tg
      JOIN templates t ON t.id = tg.template_id
      WHERE tg.id = template_tasks.template_goal_id AND t.created_by = auth.uid()
    )
  );

CREATE POLICY "template_tasks_update" ON template_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM template_goals tg
      JOIN templates t ON t.id = tg.template_id
      WHERE tg.id = template_tasks.template_goal_id AND t.created_by = auth.uid()
    )
  );

CREATE POLICY "template_tasks_delete" ON template_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM template_goals tg
      JOIN templates t ON t.id = tg.template_id
      WHERE tg.id = template_tasks.template_goal_id AND t.created_by = auth.uid()
    )
  );

-- ============================================================
-- 7. User templates (template assignments to members)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

ALTER TABLE user_templates ENABLE ROW LEVEL SECURITY;

-- Coach can assign templates to their members
CREATE POLICY "user_templates_insert" ON user_templates
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (SELECT 1 FROM coach_assignments WHERE coach_id = auth.uid() AND member_id = user_templates.member_id)
    AND EXISTS (SELECT 1 FROM templates WHERE id = user_templates.template_id AND (created_by = auth.uid() OR is_public = true))
  );

-- Coach and member can view
CREATE POLICY "user_templates_select" ON user_templates
  FOR SELECT USING (coach_id = auth.uid() OR member_id = auth.uid());

-- Coach can remove an assignment
CREATE POLICY "user_templates_delete" ON user_templates
  FOR DELETE USING (coach_id = auth.uid());

-- ============================================================
-- 8. Function: accept a coaching invitation
--    Atomically: updates invitation status, creates coach_assignment,
--    and promotes the coach to the 'coach' role if still 'member'.
-- ============================================================
CREATE OR REPLACE FUNCTION accept_coaching_invitation(invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id   uuid;
  v_invitee_id uuid;
BEGIN
  -- Verify the invitation belongs to the calling user and is still pending
  SELECT coach_id, invitee_id
    INTO v_coach_id, v_invitee_id
    FROM coach_invitations
   WHERE id = invitation_id
     AND invitee_id = auth.uid()
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already handled';
  END IF;

  -- Mark accepted
  UPDATE coach_invitations
     SET status = 'accepted', updated_at = now()
   WHERE id = invitation_id;

  -- Create the coaching relationship
  INSERT INTO coach_assignments (coach_id, member_id)
  VALUES (v_coach_id, v_invitee_id)
  ON CONFLICT (coach_id, member_id) DO NOTHING;

  -- Promote the coach to 'coach' role if they're still a plain member
  UPDATE profiles
     SET role = 'coach'
   WHERE id = v_coach_id AND role = 'member';
END;
$$;

-- ============================================================
-- 9. Function: decline a coaching invitation
-- ============================================================
CREATE OR REPLACE FUNCTION decline_coaching_invitation(invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coach_invitations
     SET status = 'declined', updated_at = now()
   WHERE id = invitation_id
     AND invitee_id = auth.uid()
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already handled';
  END IF;
END;
$$;

-- ============================================================
-- 10. Function: instantiate a template for a member
--     Creates real goals and tasks owned by the member,
--     with dates calculated from assigned_at + offsets.
-- ============================================================
CREATE OR REPLACE FUNCTION activate_user_template(user_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ut          user_templates%ROWTYPE;
  v_template    templates%ROWTYPE;
  v_tgoal       template_goals%ROWTYPE;
  v_ttask       template_tasks%ROWTYPE;
  v_goal_id     uuid;
  v_base_date   date;
BEGIN
  -- Load the user_template and verify the caller is the coach
  SELECT * INTO v_ut FROM user_templates WHERE id = user_template_id AND coach_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User template not found or access denied';
  END IF;

  SELECT * INTO v_template FROM templates WHERE id = v_ut.template_id;
  v_base_date := v_ut.assigned_at::date;

  FOR v_tgoal IN
    SELECT * FROM template_goals WHERE template_id = v_template.id ORDER BY sort_order
  LOOP
    -- Create a real goal owned by the member
    INSERT INTO goals (user_id, title, category, priority, created_at)
    VALUES (v_ut.member_id, v_tgoal.title, v_tgoal.category, v_tgoal.priority, now())
    RETURNING id INTO v_goal_id;

    FOR v_ttask IN
      SELECT * FROM template_tasks WHERE template_goal_id = v_tgoal.id ORDER BY sort_order
    LOOP
      INSERT INTO tasks (
        user_id, goal_id, title, notes, priority,
        scheduled_date, due_date, status, created_at
      ) VALUES (
        v_ut.member_id,
        v_goal_id,
        v_ttask.title,
        v_ttask.notes,
        v_ttask.priority,
        v_base_date + v_ttask.unlock_days_offset,
        CASE WHEN v_ttask.due_days_offset IS NOT NULL
             THEN v_base_date + v_ttask.due_days_offset
             ELSE NULL END,
        'todo',
        now()
      );
    END LOOP;
  END LOOP;

  -- Mark the template as activated
  UPDATE user_templates SET activated_at = now() WHERE id = user_template_id;
END;
$$;
