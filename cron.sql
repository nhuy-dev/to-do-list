-- Hẹn giờ mỗi phút gọi Edge Function send-reminders (Web Push nhắc hẹn).
-- TRƯỚC KHI CHẠY:
--   1. Bật Extensions trong Supabase Dashboard: pg_cron và pg_net
--      (Dashboard > Database > Extensions > tìm pg_cron / pg_net > Enable).
--   2. Thay THAY_CRON_SECRET_VAO_DAY bằng đúng CRON_SECRET đã đặt trong
--      Edge Functions > Secrets (phải giống hệt nhau).
-- Chạy file này trong SQL Editor SAU KHI đã deploy function send-reminders.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Xoá lịch cũ nếu chạy lại file này (tránh trùng 2 lịch).
select cron.unschedule('send-reminders-every-minute')
where exists (select 1 from cron.job where jobname = 'send-reminders-every-minute');

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://jdqtrfxpflygzsgwsagi.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'THAY_CRON_SECRET_VAO_DAY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- Kiểm tra lịch đã có: select * from cron.job;
