# Hướng dẫn Phát triển Game cho Mini Hub (Game Developer Guide)

Chào mừng bạn đến với tài liệu hướng dẫn phát triển game cho Mini Hub! Hệ thống Mini Hub cung cấp thiết kế dạng **Plugin/Shell**, cho phép bất kỳ lập trình viên nào cũng có thể phát triển các mini game độc lập bằng các công nghệ web cơ bản (HTML, CSS, JS) và tích hợp dễ dàng vào nền tảng.

Tài liệu này bao gồm mọi thứ bạn cần biết để tạo, cấu hình, kết nối SDK và đưa game của bạn lên hệ thống Admin.

---

## 1. Cấu trúc Thư mục & Tệp tin của một Game

Mỗi game trên hệ thống Mini Hub thực chất là một mini-website độc lập. Nó sẽ chạy bên trong một `<iframe>` của Hub chính. Do đó, game của bạn cần được chứa hoàn toàn trong một thư mục và các tệp tin tĩnh (static files).

Một game cơ bản sẽ có cấu trúc thư mục tối thiểu như sau:

```text
my-awesome-game/
├── game.json      (Bắt buộc: Khai báo manifest thông tin của game)
├── index.html     (Bắt buộc: Tệp entry chính của game)
├── game.js        (Logic của game)
├── style.css      (Giao diện)
└── assets/        (Hình ảnh, âm thanh, icon)
    ├── icon.png
    └── bgm.mp3
```

---

## 2. File Khai báo `game.json` (Manifest)

Đây là tệp tin cực kỳ quan trọng, giúp Mini Hub nhận diện thông tin, hình ảnh và cách hệ thống xếp hạng điểm số (leaderboard) cho game của bạn.

> **Lưu ý:** Nếu bạn upload qua Admin Panel, tên của game ID trên hệ thống sẽ tự động được gán bằng tên file gốc (trừ khi hệ thống tự random, nhưng ID trong config giúp phân biệt dễ dàng). Tuy nhiên ID chính thức sẽ do Admin Panel ghi nhận lúc upload.

**Ví dụ một file `game.json` chuẩn:**
```json
{
  "id": "my-awesome-game",
  "name": "Super Awesome Game",
  "description": "Né tránh chướng ngại vật và sống sót lâu nhất có thể!",
  "version": "1.0.0",
  "icon": "🚀",
  "color": "#e63946",
  "scoreLabel": "Thời gian (s)",
  "scoreDirection": "higher-is-better"
}
```

### Chi tiết các trường (Fields):
* `id` *(string)*: ID tham chiếu của game. Nên viết thường, không dấu, liền nhau hoặc dùng gạch ngang (không bắt buộc nhưng tốt cho quản lý nội bộ).
* `name` *(string)*: Tên hiển thị công khai trên giao diện Mini Hub.
* `description` *(string)*: Mô tả ngắn gọn cách chơi.
* `icon` *(string)*: Tùy ý dùng Emoji (VD: `🚀`) hoặc URL tham chiếu tới ảnh (VD: `./assets/icon.png`).
* `color` *(string)*: Mã màu HEX chủ đạo, dùng để trang trí UI (viền, hover).
* `scoreLabel` *(string)*: Nhãn hiển thị điểm số trên Leaderboard (VD: "Điểm", "Thời gian (s)", "Lượt di chuyển").
* `scoreDirection` *(string)*: 
  * `"higher-is-better"`: Điểm số nào cao hơn sẽ xếp hạng nhất (điển hình: trò đào vàng, bắn ruồi).
  * `"lower-is-better"`: Điểm số nào thấp hơn sẽ xếp hạng nhất (điển hình: tốc độ chạy, phá mìn nhanh nhất).

---

## 3. Giao tiếp với Hub (SDK Contract)

Vì Game nằm trong `<iframe>`, game không thể trực tiếp truy cập vào cơ sở dữ liệu. Nó cần phải giao tiếp với Hub App thông qua URL Parameters và Javascript `window.parent.postMessage`.

### 3.1. Nhận thông tin Đầu vào (Input Params)
Hub sẽ truyền đối số URL vào `index.html` của bạn: `?player=TenNguoiChoi`
Bạn cần lấy tên người chơi đó để hiển thị nếu muốn.

**Mã nguồn mẫu đọc URL trong `game.js`:**
```javascript
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Guest';

console.log(`Bắt đầu chơi với người chơi: ${playerName}`);
```

### 3.2. Báo cáo Trạng thái cho Hub
Game cần bắn (emit) các sự kiện lên cho Hub để Hub xử lý (ẩn loading, hiện màn GameOver, lưu điểm...).

* **Báo game đã Load xong (`GAME_READY`):**
  Bạn nên gọi lệnh này khi các resources (ảnh, nhạc) và DOM đã sẵn sàng vẽ lên Canvas/Screen. Hub sẽ từ từ ẩn màn hình chờ đi.
  ```javascript
  window.parent.postMessage({ type: 'GAME_READY' }, '*');
  ```

* **Cập nhật kích thước khung (`GAME_RESIZE`) - Tuỳ chọn:**
  Nếu game của bạn tự động dãn dài theo dọc, bạn có thể xin Hub đổi chiều cao iframe để không bị scroll.
  ```javascript
  window.parent.postMessage({ type: 'GAME_RESIZE', height: document.body.scrollHeight }, '*');
  ```

* **Kết thúc game và Gửi điểm (`GAME_OVER`):**
  Bước bắt buộc, ngay khi người chơi mất mạng hoặc thắng cuộc, gửi con số điểm lên Hub. Hub sẽ tự động kết nối Supabase API để lưu điểm cho Leaderboard.
  ```javascript
  window.parent.postMessage({
    type: 'GAME_OVER',
    score: 1530, // KIỂU SỐ (NUMBER) - BẮT BUỘC
    metadata: {  // THÔNG TIN BỔ SUNG - TÙY CHỌN CHỨA DỮ LIỆU ĐỂ HIỂN THỊ
      level: 15,
      mode: 'Hardcore'
    }
  }, '*');
  ```

* **Yêu cầu chơi lại (`GAME_RESTART`):**
  Trong giao diện game nội bộ đôi khi bạn có nút "Chơi lại", bạn chỉ cần gửi lệnh này để Hub reset lại tiến trình của Hub nếu cần.
  ```javascript
  window.parent.postMessage({ type: 'GAME_RESTART' }, '*');
  ```

### 3.3. Nhận Lệnh từ Hub (Hub to Game)
Hub có thể gửi lệnh Yêu cầu Game Tạm Dừng hoặc Tiếp Tục.

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'PAUSE') {
      // Logic để tạm dừng vòng lặp (requestAnimationFrame) hoặc Timer
      console.log('Hub yêu cầu tạm dừng trò chơi');
  }
  if (event.data.type === 'RESUME') {
      // Logic chơi tiếp
      console.log('Hub yêu cầu tiếp tục trò chơi');
  }
});
```

---

## 4. Kiểm tra & Tích hợp (Phát hành) Game Mới

### Cách 1: Dev & Test Local (Dành cho Dev trong Team)
1. Thêm folder game mới tĩnh (ví dụ: `my-game/`) vào bên trong mảng `public/games/`.
2. Sửa khai báo file `public/games.json` (nằm ở môi trường client) để đăng ký ID của game.
3. Chạy `npm run dev` để kiểm tra.

### Cách 2: Publish thông qua công cụ Admin Panel (Trực tiếp với Vercel / Remote Storage)
Đây là tính năng độc đáo cho phép upload động thêm game vào kho chứa online.
1. Bạn hoàn thành logic game và tổ chức cấu trúc file như **Ví dụ 1**.
2. Gom tất cả toàn bộ các root file lại thành một tệp tin `.zip`.
   > **Lưu ý CỰC KỲ QUAN TRỌNG:** Tệp `.zip` trực tiếp chứa `index.html` và `game.json` ở cấp cao nhất (root). KHÔNG nén thư mục (folder) chứa các file này. Nếu giải nén tệp zip ra mà lại có thêm một folder khác bên ngoài bao bọc `index.html` là **SAI**.
3. Đi tới trang Mini Hub và mở khóa truy cập Admin Panel.
4. Chọn mục `Upload New Game`, chọn tệp `.zip` hệ thống sẽ tự đọc config, bung nén, upload lên Cloud Storage Supabase tự động cho server truy cập!
5. Game sẽ tự động xuất hiện ở ngay trên Menu Home và các người dùng có thể chơi ngay lập tức!

---

## 5. Các "Quy tắc vàng" & Tips (Best Practices)

- **Mobile First**: Người chơi trên di động là chủ yếu. Nếu dùng Canvas, hãy lắng nghe `touchstart` thay vì chỉ dùng Keyboards như `W A S D`. Support Layout linh động qua CSS lưới là tốt nhất.
- **Không dùng LocalStorage cho tên người chơi:** Hãy luôn luôn sử dụng query `?player=` từ trên url do iFrame nhận được. Vì iFrame Storage đôi khi bị chặn (cross-origin).
- **Thiết kế màu sắc Mini Hub Palette:** Để khớp game vào giao diện chung, bạn nên cân nhắc theme dark màu Charcoal `(#1D1D1D)`, chữ White `(#F1FAEE)` và highlight màu Đỏ `(#E63946)`.
- **Tránh External Assets:** Các ảnh nên để dưới `assets/` dưới dạng file tĩnh thay vì URL ở host khác, tránh trường hợp link bị chết hoặc tải chậm. Không dùng các thư viện Framework UI cồng kềnh (như React/Vue) cho 1 mini-game vì sẽ làm thời gian khởi tạo (Load) game trên iframe rất chậm. Sử dụng Vanilla Javascript hoặc thư viện lightweight (như PhaserJS, PixiJS...).

---

*Chúc sự sáng tạo của bạn bay cao và tạo ra nhiều trò chơi cực chất lượng!*
