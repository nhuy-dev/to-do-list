# Web Push nhắc hẹn (kể cả khi tắt app)

Cách hoạt động:
1. Người dùng bấm "Bật thông báo nhắc hẹn" trong app → trình duyệt hỏi quyền → app đăng ký push và lưu vào bảng `push_subscriptions` (Supabase).
2. `pg_cron` mỗi phút gọi Edge Function `send-reminders`.
3. Function tìm việc có `due_at - remind_minutes <= bây giờ` (và chưa gửi), mã hoá push theo chuẩn Web Push (VAPID) và gửi tới máy người dùng.
4. Service worker (`sw.js`) nhận push và hiện thông báo, kể cả khi app đã tắt. Bấm vào thông báo sẽ mở app.

## Các bước setup trên Supabase Dashboard

1. **SQL Editor**: chạy toàn bộ `schema.sql` (thêm bảng `push_subscriptions` + cột `reminder_sent_at`).
2. **Edge Functions > Create function**: tên `send-reminders`, dán nội dung file `edge-function-send-reminders.ts`, **tắt Verify JWT**, Deploy.
3. **Edge Functions > Secrets**: thêm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (vd `mailto:email@cuaban.com`), `CRON_SECRET` (chuỗi ngẫu nhiên tự đặt, giữ bí mật).
   - `VAPID_PUBLIC_KEY` phải giống hệt giá trị trong `config.js` của web.
   - TUYỆT ĐỐI không đưa `VAPID_PRIVATE_KEY` / `CRON_SECRET` vào GitHub hay code web.
4. **Database > Extensions**: bật `pg_cron` và `pg_net`.
5. **SQL Editor**: mở `cron.sql`, thay `THAY_CRON_SECRET_VAO_DAY` bằng đúng `CRON_SECRET` ở bước 3, rồi chạy.

## Kiểm tra

- Mở app, đăng nhập, bấm "Bật thông báo nhắc hẹn" và cho phép.
- Tạo việc hẹn sau 3 phút, đặt nhắc trước 2 phút, tắt app.
- Sau khoảng 1 phút sẽ có thông báo push hiện lên.
- iPhone: phải cài app vào màn hình chính (Chia sẻ → Thêm vào màn hình chính) và mở app từ icon đó thì mới nhận được push.
