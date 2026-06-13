-- 20260526130000_scheduled_messages_template_set_null.sql
--
-- HOTFIX: scheduled_messages.template_id had ON DELETE RESTRICT, which made
-- it impossible for a user to delete an email_template once any quote or
-- order had been sent using it (e.g. secarter23@gmail.com had 4 templates,
-- 3 with active scheduled_messages references, blocking deletion entirely
-- with a "Server Components render" error in the UI).
--
-- outbound_messages.template_id already uses ON DELETE SET NULL. This
-- migration brings scheduled_messages in line. Historical scheduled_messages
-- retain their subject_snapshot / body_snapshot columns so the dispatcher
-- can still send them even if the source template is later deleted.
--
-- Safe: no data loss. Past scheduled rows simply lose the template_id link
-- when the source template is removed.

ALTER TABLE public.scheduled_messages
  DROP CONSTRAINT IF EXISTS scheduled_messages_template_id_fkey;

ALTER TABLE public.scheduled_messages
  ADD CONSTRAINT scheduled_messages_template_id_fkey
  FOREIGN KEY (template_id)
  REFERENCES public.email_templates(id)
  ON DELETE SET NULL;
