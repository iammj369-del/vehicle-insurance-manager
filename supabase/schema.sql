create table if not exists public.vehicle_insurances (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references auth.users(id) on delete set null,
  owner_name text not null,
  owner_mobile text not null,
  vehicle_type text not null check (vehicle_type in ('car', 'auto', 'bike', 'load_van', 'truck', 'bus', 'other')),
  vehicle_reg_no text not null,
  loan_details text,
  claimed_amount numeric(12, 2) default 0,
  payment_due_date date not null,
  paid_date date,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  customer_photo_url text,
  bill_pdf_url text,
  vehicle_proof_urls text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vehicle_type, vehicle_reg_no)
);

create index if not exists vehicle_insurances_due_date_idx
on public.vehicle_insurances (payment_due_date);

create index if not exists vehicle_insurances_reg_no_idx
on public.vehicle_insurances (vehicle_reg_no);

alter table public.vehicle_insurances
add column if not exists customer_photo_url text;

create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text,
  mobile text,
  email text,
  business_name text,
  business_mobile text,
  business_address text,
  profile_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_id)
);

alter table public.admin_profiles enable row level security;

drop policy if exists "Managers can read own admin profile" on public.admin_profiles;
drop policy if exists "Managers can insert own admin profile" on public.admin_profiles;
drop policy if exists "Managers can update own admin profile" on public.admin_profiles;

create policy "Managers can read own admin profile"
on public.admin_profiles
for select
to authenticated
using (auth.uid() = manager_id);

create policy "Managers can insert own admin profile"
on public.admin_profiles
for insert
to authenticated
with check (auth.uid() = manager_id);

create policy "Managers can update own admin profile"
on public.admin_profiles
for update
to authenticated
using (auth.uid() = manager_id)
with check (auth.uid() = manager_id);

alter table public.vehicle_insurances enable row level security;

drop policy if exists "Authenticated managers can read vehicle insurance records" on public.vehicle_insurances;
drop policy if exists "Authenticated managers can insert vehicle insurance records" on public.vehicle_insurances;
drop policy if exists "Authenticated managers can update vehicle insurance records" on public.vehicle_insurances;
drop policy if exists "Authenticated managers can delete vehicle insurance records" on public.vehicle_insurances;

create policy "Authenticated managers can read vehicle insurance records"
on public.vehicle_insurances
for select
to authenticated
using (true);

create policy "Authenticated managers can insert vehicle insurance records"
on public.vehicle_insurances
for insert
to authenticated
with check (auth.uid() = manager_id);

create policy "Authenticated managers can update vehicle insurance records"
on public.vehicle_insurances
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated managers can delete vehicle insurance records"
on public.vehicle_insurances
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('insurance-bills', 'insurance-bills', true, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-proofs', 'vehicle-proofs', true, 10485760, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-photos', 'customer-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('admin-profiles', 'admin-profiles', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated managers can upload insurance bills" on storage.objects;
drop policy if exists "Authenticated managers can upload vehicle proofs" on storage.objects;
drop policy if exists "Authenticated managers can upload customer photos" on storage.objects;
drop policy if exists "Authenticated managers can upload admin profile photos" on storage.objects;
drop policy if exists "Authenticated managers can update insurance bills" on storage.objects;
drop policy if exists "Authenticated managers can update vehicle proofs" on storage.objects;
drop policy if exists "Authenticated managers can update customer photos" on storage.objects;
drop policy if exists "Authenticated managers can update admin profile photos" on storage.objects;
drop policy if exists "Public can view insurance bill files" on storage.objects;
drop policy if exists "Public can view vehicle proof files" on storage.objects;
drop policy if exists "Public can view customer photos" on storage.objects;
drop policy if exists "Public can view admin profile photos" on storage.objects;

create policy "Authenticated managers can upload insurance bills"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'insurance-bills');

create policy "Authenticated managers can upload vehicle proofs"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'vehicle-proofs');

create policy "Authenticated managers can upload customer photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'customer-photos');

create policy "Authenticated managers can upload admin profile photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'admin-profiles');

create policy "Authenticated managers can update insurance bills"
on storage.objects
for update
to authenticated
using (bucket_id = 'insurance-bills')
with check (bucket_id = 'insurance-bills');

create policy "Authenticated managers can update vehicle proofs"
on storage.objects
for update
to authenticated
using (bucket_id = 'vehicle-proofs')
with check (bucket_id = 'vehicle-proofs');

create policy "Authenticated managers can update customer photos"
on storage.objects
for update
to authenticated
using (bucket_id = 'customer-photos')
with check (bucket_id = 'customer-photos');

create policy "Authenticated managers can update admin profile photos"
on storage.objects
for update
to authenticated
using (bucket_id = 'admin-profiles')
with check (bucket_id = 'admin-profiles');

create policy "Public can view insurance bill files"
on storage.objects
for select
to public
using (bucket_id = 'insurance-bills');

create policy "Public can view vehicle proof files"
on storage.objects
for select
to public
using (bucket_id = 'vehicle-proofs');

create policy "Public can view customer photos"
on storage.objects
for select
to public
using (bucket_id = 'customer-photos');

create policy "Public can view admin profile photos"
on storage.objects
for select
to public
using (bucket_id = 'admin-profiles');
