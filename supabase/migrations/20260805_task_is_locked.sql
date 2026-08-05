alter table tasks add column if not exists is_locked boolean not null default false;
