// ============================================================
// Edge Function: send-report-email
// Gửi báo cáo lỗi / góp ý từ app về Gmail của chủ app qua Resend.
//
// Deploy: Supabase Dashboard > Edge Functions > Create function
//   tên: send-report-email  (giữ Verify JWT BẬT - app gọi kèm phiên đăng nhập)
// Secrets cần thêm (Edge Functions > Secrets):
//   RESEND_API_KEY = khoá API của Resend (tài khoản đăng ký bằng chính Gmail nhận báo cáo)
//   REPORT_TO_EMAIL (tuỳ chọn) = nhuuyyis2806@gmail.com
// Người gửi dùng onboarding@resend.dev của Resend: khi chưa xác thực domain riêng,
// Resend chỉ cho gửi tới email của chính chủ tài khoản Resend - đúng nhu cầu ở đây.
// ============================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const TO = Deno.env.get("REPORT_TO_EMAIL") ?? "nhuuyyis2806@gmail.com";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let b: Record<string, string> = {};
  try { b = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "missing RESEND_API_KEY secret" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const subject = `[To Do Cute] ${b.type || "Báo lỗi"}: ${b.title || "(chưa có tiêu đề)"}`;
  const html =
    `<h2>${esc(subject)}</h2>` +
    `<p><b>Loại:</b> ${esc(b.type || "")}</p>` +
    `<p><b>Người gửi:</b> ${esc(b.reporter_name || "")} (@${esc(b.reporter_username || "")})</p>` +
    `<p><b>Nội dung:</b></p><p>${esc(b.body || "").replace(/\n/g, "<br>")}</p>` +
    `<hr><p style="color:#888;font-size:12px">Báo cáo này cũng đã được lưu trong Supabase &gt; Table Editor &gt; reports.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "To Do Cute <onboarding@resend.dev>", to: [TO], subject, html }),
  });
  const data = await res.text();
  console.log("resend status", res.status, data.slice(0, 200));
  return new Response(JSON.stringify({ status: res.status }), {
    status: res.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
});
