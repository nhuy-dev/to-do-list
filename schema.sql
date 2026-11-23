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
  avatar_emoji text,
  avatar_color text,
  avatar_image text,
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
  remind_minutes integer,
  completed_at timestamptz,
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

-- 8. Migration cho database ĐÃ tạo từ trước (chạy lại file này là đủ, không mất dữ liệu)
-- Nhắc hẹn tuỳ chỉnh theo phút, thời gian hoàn thành, và tuỳ chỉnh avatar.
alter table public.profiles add column if not exists avatar_emoji text;
alter table public.profiles add column if not exists avatar_color text;
alter table public.profiles add column if not exists avatar_image text;
alter table public.tasks add column if not exists remind_minutes integer;
alter table public.tasks add column if not exists completed_at timestamptz;

-- 9. Web Push nhắc hẹn khi app đã tắt
alter table public.tasks add column if not exists reminder_sent_at timestamptz;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions for insert with check (user_id = auth.uid());
drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions for delete using (user_id = auth.uid());

-- 10. Báo lỗi / góp ý: user chỉ ĐƯỢC GHI, không có quyền đọc qua app.
-- Chủ app xem báo cáo trong Supabase Dashboard > Table Editor > reports.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reporter_name text not null default '',
  reporter_username text not null default '',
  type text not null default 'Báo lỗi',
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports for insert with check (reporter_id = auth.uid());
-- Cố ý KHÔNG tạo policy select/update/delete: không ai đọc/sửa được reports qua app.
