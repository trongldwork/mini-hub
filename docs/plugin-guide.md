# Plugin Guide — Thêm Game Mới

Tài liệu này hướng dẫn từng bước cách lập trình và tích hợp một game độc lập mới vào hệ thống Mini Hub.

---

## Các bước thực hiện

### Bước 1: Tạo thư mục game mới
Tạo một thư mục con mới bên trong `public/games/` với tên viết thường không dấu, không khoảng cách (đây sẽ là ID của game):

```bash
mkdir public/games/digger
```

### Bước 2: Tạo Manifest `game.json`
Tạo file `game.json` bên trong thư mục vừa tạo để khai báo thông tin game cho Hub nhận diện.

```json
{
  "id": "digger",
  "name": "Gold Digger",
  "description": "Drop your hook at the right time to pull up gold and diamonds!",
  "version": "1.0.0",
  "icon": "⛏️",
  "color": "#f1c40f",
  "scoreLabel": "Gold Coins",
  "scoreDirection": "higher-is-better"
}
```

#### Các trường thông tin trong manifest:
- `id`: Phải trùng khớp hoàn toàn với tên thư mục game.
- `name`: Tên hiển thị trên các thẻ trò chơi và bảng xếp hạng.
- `description`: Mô tả ngắn gọn cách chơi hoặc nội dung game.
- `icon`: Biểu tượng emoji hoặc đường dẫn tương đối tới ảnh icon nằm trong thư mục game.
- `color`: Mã màu HEX đại diện (dùng làm viền/hiệu ứng hover trên Hub).
- `scoreLabel`: Tên nhãn hiển thị cho điểm số (ví dụ: `Points`, `Seconds`, `Meters`).
- `scoreDirection`: 
  - `higher-is-better`: Điểm càng cao xếp hạng càng tốt (như Snake, Dino).
  - `lower-is-better`: Điểm càng thấp xếp hạng càng tốt (như Minesweeper tính theo giây).

---

### Bước 3: Lập trình giao diện & logic game
Tạo các file `index.html`, `game.js`, `style.css` trong thư mục game của bạn.

#### Cấu trúc tối thiểu của `index.html`:
```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Gold Digger</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="game-container">
        <h1>Gold Digger</h1>
        <p>Người chơi: <span id="player-name">Đang tải...</span></p>
        <button id="btn-win">Giả lập Thắng (100 điểm)</button>
    </div>

    <script src="game.js"></script>
</body>
</html>
```

#### Xử lý logic giao tiếp tối thiểu trong `game.js`:
```javascript
// 1. Đọc tên người chơi từ URL
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';
document.getElementById('player-name').innerText = playerName;

// 2. Báo cáo với Hub là game đã load xong hoàn toàn
window.addEventListener('load', () => {
    window.parent.postMessage({
        type: 'GAME_READY'
    }, '*');
});

// 3. Xử lý logic kết thúc game & gửi điểm số
function gameOver(finalScore) {
    window.parent.postMessage({
        type: 'GAME_OVER',
        score: finalScore,
        metadata: {
            mode: 'classic',
            timePlayed: Date.now()
        }
    }, '*');
}

// Lắng nghe nút bấm test
document.getElementById('btn-win').addEventListener('click', () => {
    gameOver(100);
});

// 4. Lắng nghe các lệnh điều khiển từ Hub (Tùy chọn)
window.addEventListener('message', (event) => {
    const { type } = event.data;
    if (type === 'PAUSE') {
        // Tạm dừng game
        console.log('Game paused by Hub');
    }
    if (type === 'RESUME') {
        // Chạy tiếp game
        console.log('Game resumed by Hub');
    }
});
```

---

### Bước 4: Đăng ký game vào Hub
Mở file `public/games.json` ở root thư mục client, thêm ID thư mục game của bạn vào danh sách để Hub tự động quét:

```json
[
  "minesweeper",
  "dino",
  "snake",
  "digger"
]
```

### Bước 5: Chạy thử và kiểm tra
1. Chạy server phát triển cục bộ (`npm run dev`).
2. Mở trình duyệt, nhập tên và bạn sẽ thấy game mới xuất hiện trong danh sách lựa chọn.
3. Chơi thử và kiểm tra xem điểm số gửi lên có hiển thị chính xác trong Leaderboard không.

---

## Một số lưu ý quan trọng khi dev game
- **Tương thích di động (Mobile Responsive)**: Đảm bảo thiết kế game của bạn hoạt động tốt trên cả màn hình cảm ứng di động. Sử dụng touch events (`touchstart`, `touchend`) thay vì chỉ dùng các phím bàn phím (`keydown`).
- **Tài nguyên tĩnh (Static Assets)**: Tất cả ảnh, âm thanh, font chữ của game phải để trong thư mục game đó (ví dụ: `public/games/digger/assets/`) và sử dụng đường dẫn tương đối để tránh lỗi đường dẫn khi deploy.
- **Kích thước nhẹ**: Hạn chế dùng các thư viện nặng. Khuyến khích viết code thuần (vanilla JS) hoặc dùng canvas 2D để game load nhanh nhất.
