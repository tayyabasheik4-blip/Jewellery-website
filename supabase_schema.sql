-- JS Gold & Silver Jewellery — Supabase schema (OPTIONAL)
-- Run in Supabase Dashboard > SQL Editor ONLY if these tables/policies do not exist yet.
-- Safe to re-run (idempotent).

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  price numeric,
  image_path text,
  is_published boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_path text,
  is_published boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  review_text text not null,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  subject text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid() and role = 'admin');
$$;

alter table public.admin_profiles   enable row level security;
alter table public.products         enable row level security;
alter table public.services         enable row level security;
alter table public.reviews          enable row level security;
alter table public.contact_messages enable row level security;

-- admin_profiles: a user may read only their own row (needed for the admin login check)
drop policy if exists "own profile read" on public.admin_profiles;
create policy "own profile read" on public.admin_profiles for select using (user_id = auth.uid());

-- products & services: public reads published rows; admin does everything
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (is_published or public.is_admin());
drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "services public read" on public.services;
create policy "services public read" on public.services for select using (is_published or public.is_admin());
drop policy if exists "services admin write" on public.services;
create policy "services admin write" on public.services for all using (public.is_admin()) with check (public.is_admin());

-- reviews: anyone can submit (pending only); public reads approved; admin manages
drop policy if exists "reviews public insert" on public.reviews;
create policy "reviews public insert" on public.reviews for insert with check (is_approved = false);
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (is_approved or public.is_admin());
drop policy if exists "reviews admin update" on public.reviews;
create policy "reviews admin update" on public.reviews for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "reviews admin delete" on public.reviews;
create policy "reviews admin delete" on public.reviews for delete using (public.is_admin());

-- contact messages: anyone can send; only admin can read/update
drop policy if exists "messages public insert" on public.contact_messages;
create policy "messages public insert" on public.contact_messages for insert with check (true);
drop policy if exists "messages admin read" on public.contact_messages;
create policy "messages admin read" on public.contact_messages for select using (public.is_admin());
drop policy if exists "messages admin update" on public.contact_messages;
create policy "messages admin update" on public.contact_messages for update using (public.is_admin()) with check (public.is_admin());

-- Storage bucket for product/service images (public read, admin write)
insert into storage.buckets (id, name, public) values ('site-media','site-media', true) on conflict (id) do nothing;
drop policy if exists "site-media public read" on storage.objects;
create policy "site-media public read" on storage.objects for select using (bucket_id = 'site-media');
drop policy if exists "site-media admin write" on storage.objects;
create policy "site-media admin write" on storage.objects for all using (bucket_id = 'site-media' and public.is_admin()) with check (bucket_id = 'site-media' and public.is_admin());

-- Make an existing auth user an admin (replace the email):
-- insert into public.admin_profiles (user_id, role)
-- select id, 'admin' from auth.users where email = 'tayyabasheik4@gmail.com'
-- on conflict (user_id) do update set role = 'admin';
