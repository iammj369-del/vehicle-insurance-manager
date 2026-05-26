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
