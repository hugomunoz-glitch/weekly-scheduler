-- Database webhook: call notify-coaching-invitation Edge Function on INSERT
-- Requires the pg_net extension and supabase_functions schema (both available by default).

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the webhook trigger function
CREATE OR REPLACE FUNCTION notify_coaching_invitation_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _project_ref text;
  _service_role_key text;
BEGIN
  -- These are set as Supabase Vault secrets / project env vars.
  -- The Edge Function reads them from Deno.env, not from here.
  -- We just need to fire the webhook; auth is handled by the function.
  SELECT value INTO _project_ref  FROM vault.decrypted_secrets WHERE name = 'project_ref'  LIMIT 1;
  SELECT value INTO _service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  PERFORM net.http_post(
    url     => 'https://' || _project_ref || '.supabase.co/functions/v1/notify-coaching-invitation',
    headers => jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || _service_role_key
               ),
    body    => jsonb_build_object(
                 'type',   'INSERT',
                 'table',  'coach_invitations',
                 'record', row_to_json(NEW)
               )
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to coach_invitations
DROP TRIGGER IF EXISTS on_coaching_invitation_created ON coach_invitations;
CREATE TRIGGER on_coaching_invitation_created
  AFTER INSERT ON coach_invitations
  FOR EACH ROW
  EXECUTE FUNCTION notify_coaching_invitation_webhook();
