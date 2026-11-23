# Hướng dẫn: để báo cáo lỗi bay thẳng vào Gmail (Resend)

Form "Báo lỗi / Góp ý" trong app luôn lưu báo cáo vào bảng `reports` trên Supabase
(chỉ chủ app xem được ở Dashboard > Table Editor > reports, không hiện trong app).
Muốn mỗi báo cáo **đồng thời** gửi 1 email về Gmail `nhuuyyis2806@gmail.com` thì làm 3 bước sau (1 lần duy nhất):

## Bước 1 — Tạo tài khoản Resend
1. Vào https://resend.com → Sign up.
2. Đăng ký bằng **chính Gmail nhuuyyis2806@gmail.com** (Continue with Google cho nhanh).
   > Quan trọng: khi chưa xác thực domain riêng, Resend chỉ cho gửi email tới
   > địa chỉ của chính chủ tài khoản — nên tài khoản Resend phải là Gmail này.

## Bước 2 — Tạo API key
1. Trong Resend: **API Keys → Create API Key** (tên tuỳ ý, ví dụ `todo-app`, quyền Sending access).
2. Copy key (chỉ hiện 1 lần, dạng `re_...`). **Không gửi key này qua chat.**

## Bước 3 — Dán key vào Supabase (Secrets)
1. Vào Supabase Dashboard của project → **Edge Functions → Secrets → Add secret**.
2. Name: `RESEND_API_KEY` — Value: dán key ở bước 2 → Save.
3. (Hàm `send-report-email` đã được deploy sẵn trên project.)

Xong! Từ giờ ai gửi báo cáo trong app, chủ app nhận ngay 1 email trong Gmail,
kèm nội dung + tên người gửi, đồng thời vẫn có bản lưu trong bảng `reports`.
