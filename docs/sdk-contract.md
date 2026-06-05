# Game SDK Contract

Tài liệu này định nghĩa chuẩn giao tiếp (API contract) giữa **Hub Shell (React)** và các **Games (vanilla iframe)**. Tất cả các game tích hợp vào Mini Hub đều bắt buộc tuân thủ chuẩn này.

---

## 1. Đầu vào (Hub → Game)

Khi người dùng mở một game, Hub sẽ load game đó trong một thẻ `<iframe>` và truyền các tham số trực tiếp qua URL query parameters:

```
/games/<game-id>/index.html?player=<tên_người_chơi>&theme=dark
```

### Tham số URL

| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `player` | `string` | **Có** | Tên người chơi đã được đăng ký và xác thực (unique) trên Hub. |
| `theme` | `string` | Không | Theme hiện tại của Hub (`dark` hoặc `light`). Mặc định là `dark`. |

### Cách đọc tham số trong Game (JS)

```javascript
// Lấy thông tin người chơi từ URL
const urlParams = new URLSearchParams(window.location.search);
const playerName = urlParams.get('player') || 'Anonymous';
const currentTheme = urlParams.get('theme') || 'dark';

console.log(`Chào mừng ${playerName} tham gia game với theme ${currentTheme}!`);
```

---

## 2. Đầu ra (Game → Hub)

Mọi giao tiếp gửi dữ liệu từ game lên Hub được thực hiện thông qua `window.parent.postMessage()`.

> [!WARNING]
> Cần sử dụng `window.parent` vì game đang chạy bên trong iframe. Luôn gửi kèm thuộc tính `type` để Hub phân loại sự kiện.

### Các loại Message (Event Types)

#### A. `GAME_READY`
Gửi ngay sau khi game đã load xong tài nguyên (assets, DOM, logic) và sẵn sàng cho người dùng tương tác. Lúc này Hub sẽ ẩn màn hình loading.

```javascript
window.parent.postMessage({
  type: 'GAME_READY'
}, '*');
```

#### B. `GAME_OVER`
Gửi khi lượt chơi kết thúc (thua cuộc, thắng cuộc, hoàn thành màn chơi). Message này sẽ kích hoạt Hub gọi API lưu điểm và hiển thị Leaderboard.

```javascript
window.parent.postMessage({
  type: 'GAME_OVER',
  score: 1250, // Kiểu số (number). Bắt buộc.
  metadata: {  // Đối tượng tùy chọn chứa ngữ cảnh của điểm số.
    difficulty: 'hard', // ví dụ: chế độ khó
    levelReached: 8,    // level đạt tới
    durationSeconds: 120 // thời gian chơi (nếu cần)
  }
}, '*');
```

#### C. `GAME_RESTART`
Gửi khi người dùng nhấn nút "Chơi lại" (Play Again) nằm trong giao diện của chính game đó. Hub sẽ reload iframe hoặc reset trạng thái chơi.

```javascript
window.parent.postMessage({
  type: 'GAME_RESTART'
}, '*');
```

---

## 3. Lệnh điều khiển (Hub → Game)

Hub có thể gửi các lệnh điều khiển xuống game thông qua `postMessage` vào `contentWindow` của iframe (ví dụ: khi người dùng pause game từ Hub, hoặc mở bảng xếp hạng đè lên game).

Game cần đăng ký lắng nghe sự kiện `message` để xử lý các lệnh này:

```javascript
window.addEventListener('message', (event) => {
  // Khuyến khích kiểm tra origin nếu cần bảo mật nâng cao
  
  const { type } = event.data;
  
  switch (type) {
    case 'PAUSE':
      // Thực hiện dừng logic game (dừng loop, pause timer, v.v.)
      pauseMyGame();
      break;
      
    case 'RESUME':
      // Thực hiện tiếp tục game
      resumeMyGame();
      break;
      
    default:
      break;
  }
});

function pauseMyGame() {
  console.log("Game tạm dừng.");
}

function resumeMyGame() {
  console.log("Game tiếp tục.");
}
```
