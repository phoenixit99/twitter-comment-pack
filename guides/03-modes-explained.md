# Năm chế độ A / B / C / D / E

## Mode A — List comment

**Bot làm gì**: định kỳ crawl các Twitter list bạn cấu hình, lấy mọi tweet mới chưa comment, dùng AI sinh comment phù hợp ngôn ngữ + style/persona bạn đặt, rồi reply.

**Phù hợp cho**:
- Build presence trong cộng đồng nhỏ (list crypto, list trader, list dev...)
- Tăng engagement với account trong list
- Học cách comment theo nhiều ngôn ngữ khác nhau

**Cấu hình cần**:
- `listIds`: ID của list (lấy từ URL list, vd `https://x.com/i/lists/1234567890` → `1234567890`)
- `language`: `auto` (auto-detect mỗi tweet) hoặc cố định `en|ja|ko|zh`
- `stylePrompt`: persona / style. Vd: `"trader chuyên nghiệp, ngắn gọn dưới 200 ký tự, không dùng emoji"`

**Ưu / nhược**:
- (+) An toàn nhất, tweet trong list = đối tượng có chọn lọc
- (+) Tự nhiên, không spam reach
- (-) Tăng follower chậm hơn Mode B

---

## Mode B — Amplify own posts

**Bot làm gì**: theo dõi tweet mới nhất của bạn (`ownerUsername`). Khi bạn vừa post, bot tìm các tweet hashtag hot (vd `#XAUUSD`, `#Crypto`) và comment vào đó kèm link đến tweet của bạn → kéo người xem về tweet bạn.

**CHỈ phù hợp cho** (đọc kỹ):
- Video viral
- Tutorial / hướng dẫn
- Signal trade (gold, crypto, forex)
- On-chain analysis
- Technical analysis

**KHÔNG dùng cho**:
- Spam tin tức (news repost)
- Quảng cáo lung tung
- Nội dung không có giá trị thật cho người đọc tweet hashtag

→ Twitter sẽ restrict / shadowban nếu bạn dùng Mode B sai mục đích. Thuật toán nhận diện rất nhanh.

**Cấu hình cần**:
- `ownerUsername`: @username của BẠN (không có @)
- `hashtags`: danh sách hashtag để scan (mặc định `#XAUUSD,#Gold,#Crypto,#Bitcoin`)
- `crossPostListId`: optional, ID list để cross-post

**Ưu / nhược**:
- (+) Tăng reach nhanh khi tweet bạn có giá trị
- (-) Rủi ro bị restrict nếu spam
- (-) Tốn nhiều quota AI hơn (mỗi reply phải sinh)

---

## Mode C — Hybrid

**Bot làm gì**: luân phiên Mode A và Mode B mỗi cycle.

**Phù hợp cho**: ai muốn cả 2 mục tiêu (engage list + amplify own posts).

**Lưu ý**: tổng số comment vẫn bị giới hạn bởi `commentsPerHour`. Nên đặt rate cao hơn (vd 20-25/hr) để có chỗ cho cả 2 mode.

---

## Mode D — Auto Post

**Bot làm gì**: Định kỳ crawl các Twitter list được cấu hình, chọn ra các tweet có lượt tương tác (favoriteCount) cao nhất làm nguồn cảm hứng (inspiration), và dùng AI để viết lại thành một bài đăng hoàn toàn mới trên timeline của bạn.

**Phù hợp cho**:
- Người dùng muốn duy trì luồng bài đăng thường xuyên mà không cạn ý tưởng.
- Tài khoản muốn chia sẻ các góc nhìn tương tự hoặc mở rộng từ các tweet hot trong ngành.

**Lưu ý**: Chế độ này KHÔNG reply mà là đăng bài mới.

---

## Mode E — Autonomous Post (Dual Loop)

**Bot làm gì**: Bot tự động thu thập các tweet hot nhất từ các `listIds` bạn thiết lập, dùng chúng làm bối cảnh (research context) và "tin tức" để AI tự động phân tích và tạo bài viết (post) mới hoàn toàn.
Điều khác biệt là Mode E chạy **song song 2 tiến trình** (dual loop):
1. **Tiến trình đăng bài (Post Loop)**: Định kỳ tạo bài viết mới.
2. **Tiến trình đi comment (Comment Loop)**: Chạy giống Mode A (list comment).

**Tính năng an toàn**: Sau khi đăng thành công một bài post mới, tiến trình comment sẽ tự động tạm dừng trong 20 phút để mô phỏng hành vi người thật, tránh rủi ro spam account.

**Phù hợp cho**:
- Tài khoản muốn "thả rông" hoàn toàn: vừa tự tạo content thu hút trên tường nhà, vừa chủ động đi tương tác (comment) với cộng đồng để kéo reach.

---

## Tôi nên chọn cái nào?

| Mục tiêu | Chọn |
|---|---|
| Mới bắt đầu, sợ bị ban | A |
| Có content viral / signal trade chất lượng | B |
| Account đã warm-up, muốn tương tác full power | C |
| Muốn tự động đăng content dựa trên trend từ list | D |
| Giải pháp "All-in-one": vừa tự đăng bài lấy tin tức từ list vừa tự đi comment | E |
| Test thử bot trước khi commit | A với 1 list nhỏ + rate 5/hr |
