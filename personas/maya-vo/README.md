# Maya Vo — nhân vật nội dung gốc trên X

Mục tiêu: một tài khoản X đăng nội dung **gốc** về đời sống một mình ở thành phố (ăn uống, một ngày, gym, tiền bạc), tăng follower thật và đủ điều kiện **X Creator Revenue Sharing**.

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

Bot (Mode E) chỉ viết chữ. Cấu hình mẫu đặt `reuseSourceMedia: false` để bot **không đăng lại ảnh của người khác** (tránh "repost gái khác" và vi phạm bản quyền).

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
- Bật `replyBack` để trả lời bình luận dưới bài của mình (prompt riêng `prompts/maya/reply_back.txt`).
- Sau 30 bài: định dạng nào có views cao nhất thì nhân đôi (bật `autoTune`), giữ tiền bạc ở 1 bài/tuần.

## 6. Cài đặt bot cho Maya

1. Đăng nhập X bằng tài khoản Maya, xuất cookie vào `data/cookies.json` (`guides/01-get-cookies.md`).
2. Tạo 1–4 list X (đặt riêng tư) gồm các tài khoản food / lifestyle / fitness / tài chính cá nhân tiếng Việt. Bot chỉ đọc list để lấy cảm hứng, không đăng lại nội dung hay ảnh của họ. ID list là dãy số cuối URL `x.com/i/lists/<ID>`.
3. Mở `config.modeE.example.json`, thay `YOUR_*_LIST_ID` và `ownUsername`, rồi dán `mode`, `modeE`, `postsPerDay`, `commentsPerHour` vào `data/config.json`. Có thể dùng một list cho cả 4 nhóm.
4. `npm run update-config` để thêm các khoá còn thiếu, rồi `npm start`. Xem bài nào chạy tốt bằng `npm run report`.

## 7. Việc không làm trong 30 ngày đầu

- Không đăng ảnh hở để câu tương tác; ảnh có mặt + tay + món ăn / set tập.
- Không repost ảnh người khác.
- Không nhận deal sàn, không link ref, không group tín hiệu.
- Không đổi concept sang drama / trend nhảy.
- Không mua follower, không follow-unfollow hàng loạt (X phạt reach và có thể loại khỏi chương trình doanh thu).

## 8. Quy định của X cần biết (đọc trước khi chạy)

Kiểm tra lại trên trang chính sách của X vì điều kiện thay đổi thường xuyên.

- **Nhân vật hư cấu / ảnh AI**: X cấm giả mạo người thật và cấm danh tính gây hiểu lầm nhằm lừa người xem. Nếu Maya là nhân vật dựng (người mẫu thật đóng vai thì ổn hơn; ảnh tạo bằng AI thì rủi ro hơn), nên ghi rõ trong bio, ví dụ "nhân vật / AI persona", và đánh dấu ảnh do AI tạo. Ảnh AI không gắn nhãn có thể bị gắn cờ theo chính sách nội dung tổng hợp (synthetic media).
- **Tài khoản tự động**: X yêu cầu tài khoản đăng bằng bot bật nhãn "Automated" trong Settings > Your account > Automation. Bot này đăng qua cookie trình duyệt, nên dễ bị coi là hành vi spam nếu đăng dày; giữ 3–4 bài/ngày, không trả lời hàng loạt.
- **Creator Revenue Sharing** (điều kiện mình biết gần nhất, cần xác minh trong Settings > Monetization): có X Premium, khoảng 5 triệu impressions tự nhiên trong 3 tháng, ít nhất 500 follower Premium, tài khoản đủ 3 tháng tuổi, xác minh danh tính, và quốc gia nhận tiền được hỗ trợ. Tài khoản vi phạm quy định về spam / thao túng tương tác / danh tính gây hiểu lầm có thể bị loại.
- **Tài chính**: không hứa lợi nhuận, không lời khuyên mua bán. Nội dung tiền bạc của Maya đã thiết kế theo hướng này.
