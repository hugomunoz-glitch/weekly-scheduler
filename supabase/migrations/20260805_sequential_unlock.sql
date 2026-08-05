-- Replace is_locked columns with is_unlocked override flags.
-- is_unlocked = true means the item is manually unlocked from its sequential prerequisite.
-- Locking just clears this flag; the prerequisite_goal_id relationship is never touched.

alter table goals drop column if exists is_locked;
alter table tasks drop column if exists is_locked;

alter table goals add column if not exists is_unlocked boolean not null default false;
alter table tasks add column if not exists is_unlocked boolean not null default false;
