# Hướng dẫn chạy bot — dành cho người KHÔNG rành kỹ thuật

Làm theo đúng thứ tự từ trên xuống. Mỗi bước đều có ảnh mô tả bằng chữ. Cứ làm chậm, không sao cả.

> Bạn cần khoảng **20–30 phút** cho lần đầu. Sau đó bot tự chạy.

---

## Bạn cần chuẩn bị gì trước

1. Một máy tính **Windows** (bật liên tục thì bot chạy liên tục).
2. Một tài khoản **Twitter/X** mà bạn muốn dùng để comment (nên dùng tài khoản phụ, đừng dùng tài khoản chính quan trọng).
3. Một **API key AI** (bot dùng AI để tự viết comment). Rẻ nhất là **DeepSeek**:
   - Vào https://platform.deepseek.com → đăng ký → mục **API Keys** → tạo key mới → copy chuỗi bắt đầu bằng `sk-...`.
   - Nạp vài đô la là dùng được rất lâu.
4. (Tuỳ chọn) **Telegram** nếu muốn nhận thông báo khi bot comment. Có thể bỏ qua.

---

## BƯỚC 1 — Cài Node.js (phần mềm để chạy bot)

1. Vào https://nodejs.org
2. Bấm nút xanh tải bản **LTS** (ví dụ "20.x.x LTS").
3. Mở file vừa tải, bấm **Next → Next → Install** đến hết. Không cần đổi gì.
4. Kiểm tra đã cài xong: bấm nút **Start** của Windows, gõ `cmd`, mở **Command Prompt**, gõ:
   ```
   node -v
   ```
   Nếu hiện ra số kiểu `v20.x.x` là **THÀNH CÔNG**. Nếu báo lỗi, cài lại Node.

> Mẹo: "Command Prompt" (cmd) là cái cửa sổ màu đen để gõ lệnh. Mỗi lần gõ xong một lệnh thì bấm **Enter**.

---

## BƯỚC 2 — Đặt thư mục bot vào máy

1. Bạn nhận được thư mục tên `twitter-comment-pack` (hoặc file `.zip`).
2. Nếu là file `.zip`: chuột phải → **Extract All / Giải nén** → giải nén ra ổ `C:\`.
3. Kết quả mong muốn: có thư mục `C:\twitter-comment-pack`.

---

## BƯỚC 3 — Mở Command Prompt ĐÚNG thư mục bot

1. Mở thư mục `C:\twitter-comment-pack` trong File Explorer.
2. Bấm vào thanh địa chỉ ở trên cùng (chỗ ghi đường dẫn), xoá đi, gõ `cmd`, bấm **Enter**.
3. Một cửa sổ đen mở ra, dòng đầu hiện `C:\twitter-comment-pack>`. Đúng rồi đó. Để nguyên cửa sổ này, các bước sau gõ vào đây.

---

## BƯỚC 4 — Cài các thành phần của bot

Trong cửa sổ đen, gõ:
```
npm install
```
Bấm **Enter** và **chờ**. Nó sẽ tải nhiều thứ, chạy 1–3 phút, chữ chạy ào ào là bình thường. Khi nào quay lại dòng `C:\twitter-comment-pack>` là xong.

> Nếu có vài dòng chữ vàng **warning** thì kệ nó, không sao. Chỉ lo khi có chữ đỏ **error** rõ ràng.

---

## BƯỚC 5 — Lấy "cookies" Twitter (để bot đăng nhập thay bạn)

Cookies giống như chìa khoá phiên đăng nhập. Cách lấy:

1. Cài tiện ích **Cookie-Editor** cho trình duyệt Chrome/Edge/Brave:
   https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
   → bấm **Add to Chrome / Thêm vào**.
2. Mở https://x.com và **đăng nhập** tài khoản bạn muốn dùng để comment.
3. Bấm icon **Cookie-Editor** (góc trên phải trình duyệt, có thể nằm trong dấu ☰ tiện ích).
4. Trong bảng Cookie-Editor, góc dưới bên phải có nút **Export** → chọn **Export as JSON**.
5. Lúc này một đoạn chữ JSON đã được **copy vào clipboard** (bộ nhớ tạm). Giữ nguyên, đừng copy gì khác. Sang bước sau sẽ dán.

> Lưu ý: cookies hết hạn sau khoảng **2–4 tuần**. Khi đó bot báo `SESSION_EXPIRED`, bạn chỉ cần làm lại bước này và chạy lại wizard.

---

## BƯỚC 6 — Chạy "wizard" để khai báo (hỏi 5 câu)

Quay lại cửa sổ đen, gõ:
```
npm run setup
```
Bấm **Enter**. Nó sẽ hỏi 5 câu, trả lời lần lượt:

### Câu 1 — Cookies
Nó bảo "Paste cookies JSON now". Bạn **chuột phải** trong cửa sổ đen để **dán** (đoạn JSON ở Bước 5). Sau khi dán xong, **xuống dòng mới gõ `EOF` rồi Enter** để báo "hết".
- Nếu báo `Saved ... cookies` là OK.
- Nếu báo lỗi `ct0 cookie not present` → bạn chưa đăng nhập x.com hoặc copy thiếu. Làm lại Bước 5.

### Câu 2 — Telegram (có thể bỏ qua)
- Không muốn dùng: cứ bấm **Enter** để trống là xong.
- Muốn nhận thông báo: xem file `guides/02-get-telegram-token.md`, dán bot token và chat ID.

### Câu 3 — Chọn chế độ A / B / C
Gõ **A** rồi Enter nếu bạn mới bắt đầu (an toàn nhất). Giải thích:
- **A = Comment theo list**: bạn đưa ID của list Twitter, bot vào đó đọc tweet mới và tự comment. → Khuyên dùng cho người mới.
- **B = Khuếch đại bài của bạn**: khi bạn đăng bài, bot đi comment vào các bài hashtag để kéo người về. Dễ bị Twitter phạt nếu lạm dụng. Chỉ dùng khi nội dung bạn thật sự có giá trị.
- **C = Cả hai.**

Nếu chọn **A**, nó hỏi tiếp:
- **List IDs**: lấy từ link list. Ví dụ link `https://x.com/i/lists/1234567890` → gõ `1234567890`. Nhiều list thì cách nhau bằng dấu phẩy.
- **Language**: gõ `auto` (bot tự nhận ngôn ngữ mỗi bài) hoặc cố định `en`/`ja`/`ko`/`zh`.
- **Style/persona**: mô tả giọng văn. Ví dụ: `trader chuyên nghiệp, ngắn gọn dưới 200 ký tự, không dùng emoji`.

### Câu 4 — Số comment mỗi giờ
- Người mới: gõ `10` (an toàn). Mặc định 15. Đừng để trên 30 kẻo bị khoá.

### Câu 5 — Nhà cung cấp AI
- Gõ `deepseek` (rẻ nhất) rồi Enter.
- Dán **API key** `sk-...` bạn lấy ở phần chuẩn bị.
- "Model override": cứ bấm **Enter** để dùng mặc định.

Cuối cùng nó hỏi **"Auto-start on Windows boot? (Y/n)"** → gõ `Y` rồi Enter để bot tự bật mỗi khi máy khởi động.

Khi thấy dòng **"Setup complete!"** là xong khai báo.

---

## BƯỚC 7 — Bật bot

Gõ:
```
npm start
```
Bấm **Enter**. Bot bắt đầu chạy. Nó sẽ in ra hoạt động và ghi vào file nhật ký `data/run.log`.

> **Quan trọng:** chừng nào cửa sổ đen này còn mở thì bot còn chạy. Đóng cửa sổ = bot dừng. (Nếu ở Bước 6 bạn đã chọn `Y` auto-start thì bot vẫn tự bật lại sau khi khởi động lại máy.)

---

## BƯỚC 8 — Xem bot có đang chạy không

Mở **một cửa sổ Command Prompt khác** ở cùng thư mục (lặp lại Bước 3), gõ:
```
powershell -Command "Get-Content data/run.log -Wait -Tail 30"
```
Bạn sẽ thấy dòng chữ cập nhật liên tục mỗi khi bot comment. Đó là nhật ký sống. Bấm `Ctrl + C` để thoát xem (không làm dừng bot).

---

## Bot có tự chạy mãi không?

- Nếu Bước 6 chọn `Y` auto-start: mỗi lần **bật máy / đăng nhập Windows**, bot tự khởi động. Bạn không phải làm gì.
- Nếu lỡ chọn `n`: mở cửa sổ đen ở thư mục bot rồi gõ lại `npm run install-service` một lần là bật auto-start.
- Máy phải **bật và không sleep** thì bot mới hoạt động. Nên vào Windows Settings → Power → để "Sleep = Never" nếu muốn chạy 24/7.

---

## Khi gặp trục trặc (đối chiếu chữ báo lỗi)

| Bot báo gì | Nghĩa là | Cách xử lý |
|---|---|---|
| `ct0 cookie not found` | Cookies thiếu/sai | Làm lại Bước 5, rồi `npm run setup` câu 1 |
| `SESSION_EXPIRED` hoặc `401/403` | Cookies hết hạn | Export cookies mới (Bước 5), chạy lại `npm run setup` |
| `RATE_LIMITED 429/403` | Comment quá nhanh, bị Twitter chặn tạm | Mở `data/config.json`, giảm `commentsPerHour` xuống 8–10 |
| `AI ... 401` | API key AI sai | Mở `data/config.json`, sửa lại `apiKey` đúng chuỗi `sk-...` |
| `x-client-transaction-id unavailable` | Bình thường, KHÔNG phải lỗi | Bỏ qua. Bot vẫn comment được. |

> File `data/config.json` mở bằng **Notepad** để sửa được. Sửa xong **lưu lại**, rồi tắt bot (`Ctrl + C` ở cửa sổ đang chạy) và `npm start` lại.

---

## Tóm tắt cực ngắn (lần sau chỉ cần nhớ 3 lệnh)

```
npm install      (chỉ lần đầu)
npm run setup    (khai báo / khai báo lại)
npm start        (bật bot)
```

Cần đổi list, đổi giọng văn, đổi rate, đổi cookies → chạy lại `npm run setup`. Xong.
