-- SQL Schema for Supabase Migration

-- 1. Profiles (ID will link to auth.users.id when they actually join)
create table if not exists profiles (
  id uuid primary key, 
  display_name text,
  email text unique not null,
  photo_url text,
  role text default 'Membro',
  user_type text default 'funcionário',
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Companies
create table if not exists companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  industry text,
  website text,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Contacts
create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  role text,
  email text,
  phone text,
  type text check (type in ('cliente', 'equipe')),
  department text,
  source text,
  company_id uuid references companies on delete set null,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Properties
create table if not exists properties (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  type text check (type in ('casa', 'apartamento', 'terreno', 'comercial')),
  status text check (status in ('disponível', 'reservado', 'vendido', 'alugado')),
  price numeric not null,
  location text,
  cep text,
  street text,
  neighborhood text,
  city text,
  state text,
  number text,
  complement text,
  area numeric,
  bedrooms int,
  bathrooms int,
  parking_spots int,
  accepts_financing boolean default false,
  notes text,
  description text,
  image_url text, -- Store as JSON array or text
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indices for performance
create index if not exists idx_properties_owner_id on properties(owner_id);
create index if not exists idx_properties_created_at on properties(created_at desc);
create index if not exists idx_properties_status on properties(status);

-- 5. Deals
create table if not exists deals (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  value numeric default 0,
  stage text not null,
  company_id uuid references companies on delete set null,
  contact_id uuid references contacts on delete set null,
  property_id uuid references properties on delete set null,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Goals
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  month text not null, -- YYYY-MM
  revenue numeric,
  stage_goals jsonb default '{}'::jsonb,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(owner_id, month)
);

-- 7. Activities
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  date timestamp with time zone not null,
  type text check (type in ('call', 'meeting', 'email', 'task', 'other')),
  status text check (status in ('pending', 'completed')),
  contact_id uuid references contacts on delete set null,
  deal_id uuid references deals on delete cascade,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Timeline
create table if not exists timeline (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('system', 'note')),
  category text check (category in ('contact', 'deal', 'company')),
  related_id uuid not null,
  content text not null,
  title text,
  author_name text,
  owner_id uuid references auth.users on delete cascade not null,
  created_by uuid references auth.users on delete cascade not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Conversations
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  participants uuid[] not null,
  participant_details jsonb default '{}'::jsonb,
  last_message text,
  last_message_at timestamp with time zone,
  type text check (type in ('direct', 'group')),
  category text check (category in ('client', 'team')),
  owner_id uuid references auth.users on delete cascade not null,
  unread_count jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null,
  content text not null,
  type text default 'text',
  file_name text,
  file_url text,
  owner_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. Property Images (Sub-table for multiple images per property)
create table if not exists property_images (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references properties(id) on delete cascade not null,
  url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security) on all tables (idempotent)
do $$ 
begin
  alter table profiles enable row level security;
  alter table companies enable row level security;
  alter table contacts enable row level security;
  alter table properties enable row level security;
  alter table deals enable row level security;
  alter table goals enable row level security;
  alter table activities enable row level security;
  alter table timeline enable row level security;
  alter table conversations enable row level security;
  alter table messages enable row level security;
  alter table property_images enable row level security;
exception when others then
  null;
end $$;

-- Create a security definer function to avoid RLS recursion
create or replace function public.is_admin()
returns boolean 
language plpgsql 
security definer 
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'Admin'
  );
end;
$$;

-- Create Policies
do $$
begin
  -- 1. Profiles Policies
  -- Delete existing to recreate with improved logic
  drop policy if exists "Users can see all profiles" on profiles;
  drop policy if exists "Users can see their own profile" on profiles;
  drop policy if exists "Users can update their own profile" on profiles;
  drop policy if exists "Admins can see all profiles" on profiles;
  drop policy if exists "Admins can manage all profiles" on profiles;
  drop policy if exists "Users can claim profile by email" on profiles;

  -- Anyone can see any profile (necessary for CRM collaboration)
  create policy "Users can see all profiles" on profiles for select using (auth.uid() is not null);
  
  -- Anyone can update their own profile
  create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);

  -- Special policy to allow claiming a profile by email during login
  create policy "Users can claim profile by email" on profiles for update using (email = auth.jwt() ->> 'email');

  -- Admins can manage all profiles (using the security definer function to avoid recursion)
  -- Note: We use auth.uid() directly in the check if possible, or the function
  create policy "Admins can manage all profiles" on profiles for all using (public.is_admin());

  -- 2. Base policies for all other tables: must be the owner OR be an admin
  declare
    t text;
  begin
    for t in select table_name from information_schema.tables 
             where table_schema = 'public' 
             and table_name not in ('profiles', 'conversations', 'messages', 'property_images')
    loop
      execute format('drop policy if exists "Owners and Admins can manage everything" on %I', t);
      execute format('create policy "Owners and Admins can manage everything" on %I for all using (
        auth.uid() = owner_id OR public.is_admin()
      )', t);
    end loop;
  end;

  -- specific for property_images
  drop policy if exists "Users can manage images of their properties" on property_images;
  create policy "Users can manage images of their properties" on property_images
  for all using (
    exists (
      select 1 from properties p
      where p.id = property_id
      and (p.owner_id = auth.uid() OR public.is_admin())
    )
  );

  -- 3. Specific policies for Conversations and Messages (Participant-based)
  -- Explicitly drop the broad policy if it was applied before exclusion
  drop policy if exists "Owners and Admins can manage everything" on conversations;
  drop policy if exists "Owners and Admins can manage everything" on messages;

  drop policy if exists "Participants can see their conversations" on conversations;
  create policy "Participants can see their conversations" on conversations
    for all using ( (participants @> array[auth.uid()]::uuid[]) OR public.is_admin() );

  drop policy if exists "Participants can see messages" on messages;
  create policy "Participants can see messages" on messages
    for all using (
      exists (
        select 1 from conversations c 
        where c.id = conversation_id 
        and ( (c.participants @> array[auth.uid()]::uuid[]) OR public.is_admin() )
      )
      OR owner_id = auth.uid()
      OR public.is_admin()
    );
end $$;

-- 5. Storage Buckets and Policies
-- Ensure the buckets exist
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- Grant permissions (sometimes needed if not default)
grant usage on schema storage to authenticated;
grant all on table storage.objects to authenticated;
grant all on table storage.buckets to authenticated;

-- Storage Policies for property-images
drop policy if exists "Allow authenticated uploads to property-images" on storage.objects;
drop policy if exists "Allow owners to manage property images" on storage.objects;
drop policy if exists "Allow public selection of property images" on storage.objects;
drop policy if exists "Permissive property-images" on storage.objects;

create policy "Manage property-images for all"
on storage.objects for all
using ( bucket_id = 'property-images' )
with check ( bucket_id = 'property-images' );

create policy "Public view for property-images"
on storage.objects for select
using ( bucket_id = 'property-images' );

-- Broad insert policy for all buckets
drop policy if exists "Authenticated upload all buckets" on storage.objects;
create policy "Global insert for authenticated"
on storage.objects for insert
with check ( auth.role() = 'authenticated' );

-- Storage Policies for chat-attachments
drop policy if exists "Allow authenticated uploads to chat-attachments" on storage.objects;
drop policy if exists "Allow users to manage their chat attachments" on storage.objects;
drop policy if exists "Allow public selection of chat attachments" on storage.objects;

create policy "Manage chat-attachments for authenticated"
on storage.objects for all
using ( bucket_id = 'chat-attachments' and auth.role() = 'authenticated' )
with check ( bucket_id = 'chat-attachments' and auth.role() = 'authenticated' );

create policy "Public view for chat-attachments"
on storage.objects for select
using ( bucket_id = 'chat-attachments' );

-- 6. Enable Realtime for all tables
-- This is often done by adding tables to the supabase_realtime publication
do $$
begin
  -- Safely add tables to publication (Supabase handles duplicates usually, but let's be safe)
  alter publication supabase_realtime add table profiles;
  alter publication supabase_realtime add table companies;
  alter publication supabase_realtime add table contacts;
  alter publication supabase_realtime add table properties;
  alter publication supabase_realtime add table deals;
  alter publication supabase_realtime add table goals;
  alter publication supabase_realtime add table activities;
  alter publication supabase_realtime add table timeline;
  alter publication supabase_realtime add table conversations;
  alter publication supabase_realtime add table messages;
exception when others then
  null; -- Skip if already added or publication doesn't exist
end $$;

-- 4. Trigger to create profile on signup
-- This function handles linking pre-registered profiles to their real auth ID
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer 
set search_path = public
as $$
declare
  existing_profile_id uuid;
begin
  -- Check if a profile already exists for this email
  select id into existing_profile_id from public.profiles where email = new.email;

  if existing_profile_id is not null then
    -- Update the existing profile to use the new AUTH ID
    update public.profiles
    set id = new.id,
        display_name = coalesce(profiles.display_name, new.raw_user_meta_data->>'display_name'),
        updated_at = now()
    where email = new.email;
  else
    -- Insert a new profile
    insert into public.profiles (id, display_name, email, role, user_type, is_admin)
    values (
      new.id,
      new.raw_user_meta_data->>'display_name',
      new.email,
      case when new.email = 'ggsalles@gmail.com' then 'Admin' else 'Membro' end,
      'funcionário',
      case when new.email = 'ggsalles@gmail.com' then true else false end
    );
  end if;
  
  return new;
exception when others then
  -- Just return new if anything fails to avoid blocking the sign-up process
  -- We can always sync it later via the auth-provider.tsx frontend logic
  return new;
end;
$$;

-- Recreate trigger safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- TROUBLESHOOTING: Si houver erro de "duplicate key email", rode:
-- DELETE FROM public.profiles WHERE email = 'seu-email@exemplo.com';

