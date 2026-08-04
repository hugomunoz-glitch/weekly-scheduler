-- ============================================================
-- ARTIFACTS SYSTEM
-- Versioned artifact links for coaching and collaboration
-- ============================================================

-- artifacts: one container per unique artifact
CREATE TABLE artifacts (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope                text NOT NULL CHECK (scope IN ('personal', 'collaboration')),
    recipient_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
    collaboration_id     uuid REFERENCES collaborations(id) ON DELETE CASCADE,
    created_by           uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    deleted_at           timestamptz,
    deleted_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
    display_in_main_view boolean NOT NULL DEFAULT false,
    created_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT personal_requires_recipient
        CHECK (scope <> 'personal' OR recipient_id IS NOT NULL),
    CONSTRAINT collaboration_requires_collaboration
        CHECK (scope <> 'collaboration' OR collaboration_id IS NOT NULL),
    CONSTRAINT personal_no_collaboration
        CHECK (scope <> 'personal' OR collaboration_id IS NULL),
    CONSTRAINT collaboration_no_recipient
        CHECK (scope <> 'collaboration' OR recipient_id IS NULL)
);

CREATE INDEX artifacts_recipient_id_idx     ON artifacts(recipient_id) WHERE deleted_at IS NULL;
CREATE INDEX artifacts_collaboration_id_idx ON artifacts(collaboration_id) WHERE deleted_at IS NULL;
CREATE INDEX artifacts_created_by_idx       ON artifacts(created_by);

-- artifact_versions: immutable append-only version history
CREATE TABLE artifact_versions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id    uuid NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    url            text NOT NULL,
    title          text NOT NULL,
    notes          text,
    pushed_by      uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    created_at     timestamptz NOT NULL DEFAULT now(),

    UNIQUE (artifact_id, version_number)
);

CREATE INDEX artifact_versions_artifact_id_idx ON artifact_versions(artifact_id);
CREATE INDEX artifact_versions_pushed_by_idx   ON artifact_versions(pushed_by);

-- Auto-increment version_number per artifact
CREATE OR REPLACE FUNCTION set_artifact_version_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO NEW.version_number
    FROM artifact_versions
    WHERE artifact_id = NEW.artifact_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_artifact_version_number
BEFORE INSERT ON artifact_versions
FOR EACH ROW EXECUTE FUNCTION set_artifact_version_number();

-- artifact_notifications: unread tracking per recipient
CREATE TABLE artifact_notifications (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_version_id uuid NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
    artifact_id         uuid NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    recipient_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_read             boolean NOT NULL DEFAULT false,
    read_at             timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),

    UNIQUE (artifact_version_id, recipient_id)
);

CREATE INDEX artifact_notifications_recipient_unread_idx
    ON artifact_notifications(recipient_id, created_at DESC) WHERE is_read = false;
CREATE INDEX artifact_notifications_artifact_id_idx
    ON artifact_notifications(artifact_id);

-- Auto-set read_at when marked read
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at := now();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_notification_read_at
BEFORE UPDATE ON artifact_notifications
FOR EACH ROW EXECUTE FUNCTION set_notification_read_at();

-- Back-references on tasks and goals
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS
    source_artifact_version_id uuid REFERENCES artifact_versions(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS
    source_artifact_version_id uuid REFERENCES artifact_versions(id) ON DELETE SET NULL;

CREATE INDEX tasks_source_artifact_version_id_idx
    ON tasks(source_artifact_version_id) WHERE source_artifact_version_id IS NOT NULL;
CREATE INDEX goals_source_artifact_version_id_idx
    ON goals(source_artifact_version_id) WHERE source_artifact_version_id IS NOT NULL;

-- ── Helper functions ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_collaboration_member(collab_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM collaboration_members
        WHERE collaboration_id = collab_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION is_coach_of(p_member_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM coach_assignments
        WHERE coach_id = auth.uid() AND member_id = p_member_id
    );
$$;

-- ── RLS: artifacts ────────────────────────────────────────────
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY artifacts_select ON artifacts FOR SELECT USING (
    deleted_at IS NULL AND (
        (scope = 'personal' AND recipient_id = auth.uid())
        OR (scope = 'personal' AND created_by = auth.uid())
        OR (scope = 'collaboration' AND is_collaboration_member(collaboration_id))
    )
);

CREATE POLICY artifacts_insert ON artifacts FOR INSERT WITH CHECK (
    created_by = auth.uid() AND (
        (scope = 'personal' AND recipient_id = auth.uid())
        OR (scope = 'personal' AND is_coach_of(recipient_id))
        OR (scope = 'collaboration' AND is_collaboration_member(collaboration_id))
    )
);

CREATE POLICY artifacts_update_recipient ON artifacts FOR UPDATE
USING (deleted_at IS NULL AND scope = 'personal' AND recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY artifacts_softdelete ON artifacts FOR UPDATE
USING (
    deleted_at IS NULL AND (
        (scope = 'personal' AND recipient_id = auth.uid())
        OR (scope = 'collaboration' AND is_collaboration_member(collaboration_id))
    )
)
WITH CHECK (deleted_by = auth.uid() AND deleted_at IS NOT NULL);

-- ── RLS: artifact_versions ────────────────────────────────────
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY artifact_versions_select ON artifact_versions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM artifacts a WHERE a.id = artifact_versions.artifact_id
        AND a.deleted_at IS NULL AND (
            (a.scope = 'personal' AND (a.recipient_id = auth.uid() OR a.created_by = auth.uid()))
            OR (a.scope = 'collaboration' AND is_collaboration_member(a.collaboration_id))
        )
    )
);

CREATE POLICY artifact_versions_insert ON artifact_versions FOR INSERT WITH CHECK (
    pushed_by = auth.uid() AND EXISTS (
        SELECT 1 FROM artifacts a WHERE a.id = artifact_versions.artifact_id
        AND a.deleted_at IS NULL AND (
            (a.scope = 'personal' AND (a.recipient_id = auth.uid() OR is_coach_of(a.recipient_id)))
            OR (a.scope = 'collaboration' AND is_collaboration_member(a.collaboration_id))
        )
    )
);

-- ── RLS: artifact_notifications ───────────────────────────────
ALTER TABLE artifact_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY artifact_notifications_select ON artifact_notifications FOR SELECT
USING (recipient_id = auth.uid());

CREATE POLICY artifact_notifications_insert ON artifact_notifications FOR INSERT
WITH CHECK (false);

CREATE POLICY artifact_notifications_update ON artifact_notifications FOR UPDATE
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid() AND is_read = true);

CREATE POLICY artifact_notifications_delete ON artifact_notifications FOR DELETE
USING (recipient_id = auth.uid());

-- ── Notification creation (SECURITY DEFINER) ─────────────────
CREATE OR REPLACE FUNCTION create_artifact_notifications(version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v   artifact_versions%ROWTYPE;
    a   artifacts%ROWTYPE;
    mid uuid;
BEGIN
    SELECT * INTO v FROM artifact_versions WHERE id = version_id;
    SELECT * INTO a FROM artifacts WHERE id = v.artifact_id;

    IF a.scope = 'personal' THEN
        IF a.recipient_id <> v.pushed_by THEN
            INSERT INTO artifact_notifications (artifact_version_id, artifact_id, recipient_id)
            VALUES (v.id, a.id, a.recipient_id)
            ON CONFLICT (artifact_version_id, recipient_id) DO NOTHING;
        END IF;
    ELSIF a.scope = 'collaboration' THEN
        FOR mid IN
            SELECT user_id FROM collaboration_members
            WHERE collaboration_id = a.collaboration_id AND user_id <> v.pushed_by
        LOOP
            INSERT INTO artifact_notifications (artifact_version_id, artifact_id, recipient_id)
            VALUES (v.id, a.id, mid)
            ON CONFLICT (artifact_version_id, recipient_id) DO NOTHING;
        END LOOP;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_fn_notify_on_version_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM create_artifact_notifications(NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_version_insert
AFTER INSERT ON artifact_versions
FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_on_version_insert();
