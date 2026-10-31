-- To Do Cute — Supabase schema
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor > New query > Run.
-- Sau đó vào Authentication > Providers > Email và TẮT "Confirm email"
-- (vì app dùng username, không dùng email thật để xác nhận).

-- 1. Bảng hồ sơ: 1 hàng cho 1 tài khoản Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  share_timeline boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Bảng việc
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category text not null default 'Cá nhân',
  priority text not null default 'Bình thường',
  due_at timestamptz,
  note text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3. Bảng follow
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- 4. Bật Row Level Security
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.follows enable row level security;

-- 5. Policies cho profiles
-- Ai cũng xem được username/tên để tìm bạn (bản thân hồ sơ không chứa thông tin nhạy cảm).
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- Chỉ tự tạo hồ sơ của chính mình.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Chỉ tự sửa hồ sơ của chính mình.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 6. Policies cho tasks
-- Xem được: việc của mình, hoặc việc của người mình đang follow VÀ người đó bật chia sẻ timeline.
drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select using (
    owner_id = auth.uid()
    or (
      exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = tasks.owner_id
      )
      and exists (
        select 1 from public.profiles p
        where p.id = tasks.owner_id and p.share_timeline = true
      )
    )
  );

-- Chỉ tạo việc cho chính mình.
drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (owner_id = auth.uid());

-- Chỉ sửa/xoá việc của chính mình.
drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete using (owner_id = auth.uid());

-- 7. Policies cho follows
-- Xem được các follow liên quan tới mình (mình follow ai, ai follow mình).
drop policy if exists "follows_select_related" on public.follows;
create policy "follows_select_related" on public.follows
  for select using (follower_id = auth.uid() or following_id = auth.uid());

-- Chỉ follow với tư cách chính mình.
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows
  for insert with check (follower_id = auth.uid());

-- Chỉ bỏ follow của chính mình.
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows
  for delete using (follower_id = auth.uid());
