-- Permanent record of the sequential predecessor, never cleared by unlock/lock.
-- Used to restore prerequisite_goal_id when re-locking a goal.
alter table goals add column if not exists sequential_predecessor_id uuid references goals(id);

-- Back-fill from prerequisite_goal_id for any goals that still have it set.
update goals set sequential_predecessor_id = prerequisite_goal_id
where prerequisite_goal_id is not null and sequential_predecessor_id is null;
