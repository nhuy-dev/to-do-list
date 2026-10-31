# To Do Cute — Bản Supabase (máy khác follow nhau được)

## Bản này khác gì bản trước?
- Trước: dữ liệu lưu localStorage trên 1 máy/trình duyệt, hoặc app Muse riêng tư.
- Bản này: dữ liệu lưu chung trên Supabase. Máy nào mở cùng link đã deploy cũng vào cùng 1 database, đăng ký tài khoản 1 lần là dùng qua mọi máy, follow và xem timeline của nhau được.

## Trong gói có gì?
- `index.html`: toàn bộ app (việc, danh mục, ưu tiên, ngày hẹn, ghi chú, tìm kiếm, lọc, tiến độ, đăng ký/đăng nhập, follow, timeline, hồ sơ)
- `config.js`: chỗ điền Supabase URL + anon key
- `schema.sql`: tạo bảng profiles, tasks, follows + chính sách bảo mật RLS
- `manifest.webmanifest`, `icons/`, `sw.js`: cài dạng PWA (service worker chỉ cache giao diện, không cache API Supabase)

## Bước 1 — Tạo project Supabase (miễn phí)
1. Vào https://supabase.com, đăng ký/đăng nhập, bấm **New project**.
2. Đặt tên project, đặt mật khẩu database (giữ riêng, không dùng trong app), chọn region gần nhất, bấm Create.
3. Đợi project khởi tạo xong.

## Bước 2 — Tạo bảng
1. Trong Supabase Dashboard, vào **SQL Editor** > **New query**.
2. Copy toàn bộ nội dung file `schema.sql` trong gói này, dán vào, bấm **Run**.
3. Kiểm tra ở **Table Editor** thấy 3 bảng: profiles, tasks, follows.

## Bước 3 — Tắt xác nhận email (quan trọng)
Vì app đăng nhập bằng username (không dùng email thật):
1. Vào **Authentication** > **Providers** > **Email**.
2. Tắt **Confirm email** (nếu bật, tài khoản mới đăng ký sẽ không đăng nhập được ngay vì không có email thật để xác nhận).

## Bước 4 — Lấy key và điền config
1. Vào **Project Settings** > **API**.
2. Copy **Project URL** và **anon public** key.
3. Mở file `config.js`, thay:
   - `https://YOUR-PROJECT.supabase.co` bằng Project URL thật
   - `YOUR-ANON-KEY` bằng anon key thật
4. **Chỉ dùng anon key ở frontend. Tuyệt đối không dùng `service_role` key trong app**, vì key đó bỏ qua RLS và ai lấy được cũng đọc/ghi được toàn bộ database.

## Bước 5 — Deploy frontend
Chọn 1 cách, upload cả thư mục này (giữ nguyên cấu trúc):
- **Netlify Drop:** https://app.netlify.com/drop, kéo thả cả thư mục vào.
- **Vercel:** tạo project mới, import thư mục này.
- **GitHub Pages / host tĩnh bất kỳ:** upload toàn bộ file lên host.
- Mở link bằng **HTTPS** (bắt buộc để cài PWA).

## Bước 6 — Thử qua 2 máy
1. Máy A mở link, đăng ký username `a`, thêm 1 việc, bật chia sẻ timeline ở Hồ sơ.
2. Máy B mở cùng link, đăng ký username `b`, vào tab Bạn bè tìm `a`, bấm Follow.
3. Vào tab Timeline ở máy B sẽ thấy việc của `a`.

## Cài dạng PWA sau khi deploy
- iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính.
- Android: Chrome → Cài đặt ứng dụng / Thêm vào Màn hình chính.

## Cách tài khoản hoạt động (đọc kỹ trước khi đổi)
- Đăng nhập vẫn bằng **username + mật khẩu** như bản cũ.
- Bên trong, Supabase Auth cần email nên app tự tạo email giả dạng `username@todocute.app` từ username. Email này không dùng để gửi mail, chỉ là định danh nội bộ.
- Vì vậy: **username đăng nhập không đổi được sau khi đăng ký** (đổi tên hiển thị thì được, ở tab Hồ sơ). Nếu muốn username khác thì đăng ký tài khoản mới.
- **Quên mật khẩu qua email không hoạt động** với email giả này. Muốn khôi phục thì phải dùng email thật cho Auth, hoặc admin reset trong Supabase Dashboard > Authentication > Users.
- Mật khẩu được Supabase Auth băm và lưu ở phía máy chủ, frontend không tự lưu mật khẩu.

## Bảo mật đã làm trong schema.sql
- RLS bật cho cả 3 bảng.
- Việc: chỉ chủ sở hữu sửa/xoá; người khác chỉ xem được khi đang follow VÀ chủ việc bật chia sẻ timeline.
- Follow: chỉ tự follow/bỏ follow với tư cách chính mình.
- Hồ sơ: ai cũng xem được username/tên để tìm bạn, nhưng chỉ tự sửa hồ sơ của mình.

## Khắc phục lỗi thường gặp
- **Mở app thấy cảnh báo chưa cấu hình Supabase:** chưa sửa `config.js`, hoặc deploy bản cũ chưa có config mới.
- **Đăng ký xong không đăng nhập được:** kiểm tra lại đã tắt Confirm email chưa (Bước 3), và đã chạy `schema.sql` chưa.
- **Không thấy bạn bè:** bạn đó phải đăng ký trên cùng project Supabase này (cùng link đã deploy với cùng config), không phải bản local/APK cũ.
- **Timeline trống dù đã follow:** kiểm tra người được follow đã bật chia sẻ timeline ở Hồ sơ chưa, và đã có việc chưa.
- **Lỗi CORS / Failed to fetch:** kiểm tra lại Project URL trong `config.js`, và link deploy dùng HTTPS.
