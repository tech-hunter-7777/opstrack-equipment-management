create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  code text not null check (length(trim(code)) between 1 and 160),
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null check (length(trim(category)) between 1 and 160),
  location text not null check (length(trim(location)) between 1 and 160),
  technician text not null check (length(trim(technician)) between 1 and 160),
  status text not null check (status in ('Operational','Needs attention','Out of service')),
  health numeric not null check (health between 0 and 100),
  "lastService" date,
  "nextService" date,
  unique (user_id, id)
);
create unique index equipment_code_per_user on public.equipment(user_id, lower(code));

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  "assetId" uuid not null,
  date date not null,
  condition numeric not null check (condition between 0 and 100),
  performance numeric not null check (performance between 0 and 100),
  downtime numeric not null check (downtime between 0 and 8760),
  maintenance text not null check (maintenance in ('Scheduled','Completed')),
  notes text not null default '' check (length(notes) <= 5000),
  foreign key (user_id, "assetId") references public.equipment(user_id, id) on delete no action,
  unique (user_id, "assetId", date)
);

create table public.maintenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  "assetId" uuid not null,
  date date not null,
  title text not null check (length(trim(title)) between 1 and 160),
  technician text not null check (length(trim(technician)) between 1 and 160),
  type text not null check (type in ('Inspection','Preventive','Corrective')),
  status text not null check (status in ('Scheduled','Completed')),
  condition numeric not null check (condition between 0 and 100),
  notes text not null default '' check (length(notes) <= 5000),
  foreign key (user_id, "assetId") references public.equipment(user_id, id) on delete no action,
  unique (user_id, id)
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  "assetId" uuid not null,
  date date not null,
  title text not null check (length(trim(title)) between 1 and 160),
  severity text not null check (severity in ('Low','Medium','High','Critical')),
  priority text not null check (priority in ('P1','P2','P3','P4')),
  status text not null check (status in ('Open','In progress','Resolved')),
  cause text not null default '' check (length(cause) <= 5000),
  resolution text not null default '' check (length(resolution) <= 5000),
  foreign key (user_id, "assetId") references public.equipment(user_id, id) on delete no action,
  unique (user_id, id)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  issue_id uuid,
  maintenance_id uuid,
  name text not null check (length(name) between 1 and 255),
  path text not null unique check (split_part(path, '/', 1) = user_id::text),
  check (num_nonnulls(issue_id, maintenance_id) = 1),
  foreign key (user_id, issue_id) references public.issues(user_id, id) on delete no action,
  foreign key (user_id, maintenance_id) references public.maintenance(user_id, id) on delete no action
);

create index maintenance_asset on public.maintenance(user_id, "assetId");
create index issues_asset on public.issues(user_id, "assetId");
create index evidence_owner on public.evidence(user_id, id);

do $$
declare table_name text;
begin
  foreach table_name in array array['equipment','inspections','maintenance','issues','evidence']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']);

create policy own_evidence_objects on storage.objects
for all to authenticated
using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
