# Maya Vo — nhân vật nội dung gốc trên X

Mục tiêu: một tài khoản X đăng nội dung **gốc** về đời sống một mình ở thành phố (ăn uống, một ngày, gym, tiền bạc), tăng follower thật và đủ điều kiện **X Original Content Rewards** (chương trình thay Creator Revenue Sharing từ 08/2026).

File trong thư mục này:
- `README.md` — hồ sơ nhân vật, bio, bài ghim, lịch đăng, quy tắc (file này)
- `config.modeE.example.json` — khối `modeE` + `ai` mẫu để dán vào `data/config.json`
- `seed-posts.md` — 20 bài viết tay cho 2 tuần đầu (đăng tay, kèm ảnh thật)

Prompt cho bot nằm ở `prompts/maya/`.

---

## 1. Hồ sơ nhân vật (tóm tắt để giữ giọng)

| | |
|---|---|
| Tên hiển thị | Maya Vo |
| Tuổi cảm nhận | 26 |
| Sống | một mình, thành phố |
| Làm | remote, tài chính / research crypto |
| Thói quen | gym 4 buổi/tuần, thích ăn, không ăn kiêng cực đoan |
| Một câu | Cô gái châu Á chỉn chu, có tập, sống chậm, kể tiền bạc như kể chuyện đi làm, không dạy đời. |

Giọng viết trên X (chuyển từ giọng video sang chữ):
- Câu ngắn. Giọng đều. Một ý một dòng.
- Tự tin, không flirt thẳng, không câu kéo kiểu "ai muốn xem thêm thì…".
- Crypto là công việc, không phải personality.
- Viết thường, ít emoji (0–1), không slang kiểu "ae", "fen".
- **Từ cấm**: "x10", "vào lệnh ngay", "signal", "kèo", "to the moon", link sàn, mã ref, số dư ví, % lãi lỗ cá nhân.

## 2. Bio trên X

Giới hạn 160 ký tự. Ba phương án, chọn một:

**A (khuyến nghị)**
```
26. Sống một mình, làm remote.
Ăn nhiều, tập 4 buổi/tuần, tiền thì chia trước tiêu sau.
Không dạy đời.
```

**B (gọn hơn)**
```
Ăn, tập, làm việc. Một mình ở thành phố.
Thỉnh thoảng kể chuyện tiền như kể chuyện đi làm.
```

**C (nghiêng về công việc)**
```
Làm research tài chính, remote.
Ngoài giờ: nấu ăn, gym, đi bộ tối.
Không signal. Không ref.
```

Các ô còn lại:
- **Tên hiển thị**: `Maya Vo`
- **Handle gợi ý**: `@mayavo_`, `@mayavo_daily`, `@itsmayavo` (chọn cái còn trống, tránh số).
- **Vị trí**: tên thành phố, hoặc "Sài Gòn" / "Hà Nội". Không để trống.
- **Website**: menu món hay nấu, hoặc playlist **"1 ngày của Maya"** (đã sửa từ "Lina"). Không link group, không link sàn trong 30 ngày đầu.
- **Ảnh đại diện**: mặt + vai, ánh sáng cửa sổ, nền trơn. Cùng một người với ảnh trong bài.
- **Ảnh bìa**: bàn ăn cạnh cửa sổ (bối cảnh quen thuộc số 1).

## 3. Bài ghim

```
Mình là Maya.
Sống một mình, làm remote mảng tài chính.
Ở đây có: đồ mình nấu, set gym ngắn, một ngày bình thường.
Thỉnh thoảng nói chuyện tiền. Không signal, không khoe ví.
```
Kèm 4 ảnh: bàn ăn cửa sổ, góc gym, bàn laptop, một món ăn.

## 4. Chuyển persona video sang X

Trên X, chữ phải đứng được một mình; ảnh làm bài dừng cuộn tốt hơn nhưng ảnh phải là **ảnh thật của tài khoản**, đăng tay.

| Nhóm | Tỷ lệ | Trên X trông thế nào | Ai đăng |
|---|---|---|---|
| Ăn uống | 40% | 1 ảnh món + 2–4 dòng: giá, nguyên liệu, no hay không | Tay (có ảnh) + bot (chữ) |
| Một ngày / chill | 25% | Dòng thời gian ngắn, cảm nhận trong ngày | Bot |
| Gym | 20% | Set tập dạng danh sách, không số đo | Tay (ảnh giày/góc gym) + bot |
| Tiền bạc / crypto | 15%, **tối đa 1 bài/tuần** | Cách chia lương, bài học, update rất ngắn | Bot hoặc tay, Chủ nhật |

Bot (Mode E) chỉ **soạn nháp chữ**, không tự đăng: config mẫu bật `modeE.approval`, mỗi nháp được gửi qua Telegram và chỉ lên X khi người đứng tên bấm **Đăng** (xem mục 6). Cấu hình mẫu đặt `reuseSourceMedia: false` để bot **không đăng lại ảnh của người khác** (tránh "repost gái khác" và vi phạm bản quyền).

### Lịch đăng gợi ý

3 bài/ngày do bot + 1 bài có ảnh đăng tay mỗi ngày.

| Khung | Giờ | Nhóm do bot chọn |
|---|---|---|
| `morning` | 07:00–08:30 | ăn uống / một ngày |
| `noon` | 11:30–13:00 | ăn uống |
| `evening` | 19:30–21:00 | một ngày / gym |

Bài tiền bạc (tối đa 1/tuần) **đăng tay** tối Chủ nhật, lấy từ `seed-posts.md` hoặc chạy prompt `prompts/maya/post_money.txt`. Lý do: bot chưa phân biệt ngày trong tuần, slot nào cũng chạy mỗi ngày. Trong config mẫu, pillar `money` có `weight: 0` và không slot nào ghim nó, nên bot không bao giờ tự đăng bài tiền bạc. Muốn cho bot viết thì tạm thêm một slot `{ "name": "sunday_money", "start": "20:00", "end": "21:30", "pillar": "money" }` vào tối Chủ nhật rồi xoá đi.

## 5. Tăng follower trên X

- Tuần 1–2: đăng tay `seed-posts.md` có ảnh, bật bot 2 bài/ngày. Theo dõi `npm run report`.
- Reply là kênh tăng follower nhanh nhất ở giai đoạn đầu: trả lời bài của tài khoản food / gym / remote-work Việt Nam lớn hơn mình, giọng Maya, không xin follow. Có thể dùng Mode A với `stylePrompt` lấy từ giọng ở mục 1.
- Trả lời bình luận bằng tay (config mẫu tắt `replyBack`). Trả lời tự động dễ bị coi là tương tác nhân tạo; prompt `prompts/maya/reply_back.txt` vẫn còn nếu sau này muốn dùng để gợi ý câu trả lời.
- Sau 30 bài: định dạng nào có views cao nhất thì nhân đôi (bật `autoTune`), giữ tiền bạc ở 1 bài/tuần.

## 6. Cài đặt bot cho Maya

1. Đăng nhập X bằng tài khoản Maya, xuất cookie vào `data/cookies.json` (`guides/01-get-cookies.md`).
2. Tạo 1–4 list X (đặt riêng tư) gồm các tài khoản food / lifestyle / fitness / tài chính cá nhân tiếng Việt. Bot chỉ đọc list để lấy cảm hứng, không đăng lại nội dung hay ảnh của họ. ID list là dãy số cuối URL `x.com/i/lists/<ID>`.
3. Mở `config.modeE.example.json`, thay `YOUR_*_LIST_ID` và `ownUsername`, rồi dán `mode`, `modeE`, `postsPerDay`, `commentsPerHour` vào `data/config.json`. Có thể dùng một list cho cả 4 nhóm.
4. Điền `telegram.botToken` và `telegram.chatId` (`guides/02-get-telegram-token.md`). Bắt buộc, vì chế độ duyệt cần Telegram; thiếu thì bot không soạn bài.
5. `npm run update-config` để thêm các khoá còn thiếu, rồi `npm start`. Xem bài nào chạy tốt bằng `npm run report`.

### Duyệt bài qua Telegram (`modeE.approval`)

Mỗi khung giờ, bot soạn **một** nháp và gửi về Telegram:

- **✅ Đăng**: đăng nguyên văn lên X.
- **🗑 Bỏ**: không đăng, khung giờ đó bỏ qua (bot không soạn lại).
- **Sửa**: trả lời (reply) tin nhắn nháp bằng nội dung mới. Bot gửi lại bản mới kèm nút, bấm Đăng để đăng bản đã sửa.
- Nháp không được xử lý sau `expireMinutes` (mặc định 12 giờ) sẽ hết hạn và không đăng.

Chỉ chat có ID bằng `telegram.chatId` mới bấm được. Nháp lưu ở `data/drafts.json`; bài đã duyệt ghi vào lịch sử với `approved: true` (và `edited: true` nếu đã sửa).

Vì sao cần: X không trả thưởng nội dung gốc cho bài "đăng bằng phương tiện tự động". Với chế độ này, người đứng tên đọc, sửa và quyết định từng bài. Nên sửa ít nhất một chi tiết thật của ngày hôm đó (giá, món, giờ) trước khi đăng.

## 7. Việc không làm trong 30 ngày đầu

- Không đăng ảnh hở để câu tương tác; ảnh có mặt + tay + món ăn / set tập.
- Không repost ảnh người khác.
- Không nhận deal sàn, không link ref, không group tín hiệu.
- Không đổi concept sang drama / trend nhảy.
- Không mua follower, không follow-unfollow hàng loạt (X phạt reach và có thể loại khỏi chương trình doanh thu).

## 8. Quy định của X cần biết (đọc trước khi chạy)

Kiểm tra lại trên trang chính sách của X vì điều kiện thay đổi thường xuyên.

- **Nhân vật hư cấu / ảnh AI**: X cấm giả mạo người thật và cấm danh tính gây hiểu lầm nhằm lừa người xem. Nếu Maya là nhân vật dựng (người mẫu thật đóng vai thì ổn hơn; ảnh tạo bằng AI thì rủi ro hơn), nên ghi rõ trong bio, ví dụ "nhân vật / AI persona", và đánh dấu ảnh do AI tạo. Ảnh AI không gắn nhãn có thể bị gắn cờ theo chính sách nội dung tổng hợp (synthetic media).
- **Tài khoản tự động**: bài do bot tự đăng **không đủ điều kiện** nhận Original Content Rewards. Vì vậy config mẫu bật chế độ duyệt (mục 6): người đứng tên đọc, sửa và bấm Đăng. Không trả lời bình luận hàng loạt bằng bot.
- **Original Content Rewards** (theo trang trợ giúp X, kiểm tra lại trong Creator Studio): Premium, ≥500 follower verified, ≥500.000 impression Home Timeline từ người dùng verified trong 90 ngày (impression từ reply không tính), đăng nội dung gốc đều đặn. Tiền chỉ tính impression từ người dùng Premium. Chi tiết ở `analysis/robertnguyen99-ke-hoach-kiem-tien-x.md` trong thư mục dự án.
- **Tài chính**: không hứa lợi nhuận, không lời khuyên mua bán. Nội dung tiền bạc của Maya đã thiết kế theo hướng này.
