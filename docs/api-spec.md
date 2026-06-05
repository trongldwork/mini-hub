# API Specification

Tài liệu này đặc tả chi tiết các HTTP REST API endpoints phục vụ cho tính năng xác thực tên người chơi và lưu trữ/hiển thị Leaderboard toàn cầu.

---

## 1. Cơ sở dữ liệu (Database Schema)

Hệ thống hỗ trợ 2 môi trường:
- **Local Development**: SQLite (sử dụng thư viện `better-sqlite3`).
- **Production (Vercel)**: Vercel Postgres (Neon Cloud Postgres).

Cấu trúc bảng (Schema) tương đương nhau:

### Bảng `players`
Lưu trữ thông tin người chơi duy nhất (chặn trùng tên).

```sql
CREATE TABLE players (
  id SERIAL PRIMARY KEY, -- SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- SQLite: DATETIME
);
```

### Bảng `scores`
Lưu lịch sử điểm số của tất cả các lượt chơi.

```sql
CREATE TABLE scores (
  id SERIAL PRIMARY KEY, -- SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
  game_id VARCHAR(50) NOT NULL,
  player_name VARCHAR(50) NOT NULL,
  score DOUBLE PRECISION NOT NULL, -- SQLite: REAL
  metadata TEXT, -- Lưu chuỗi JSON các thông tin bổ sung (difficulty, level,...)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- SQLite: DATETIME
  FOREIGN KEY (player_name) REFERENCES players(name) ON DELETE CASCADE
);

-- Index tối ưu hóa việc truy vấn top score của từng game
CREATE INDEX idx_scores_game_score ON scores(game_id, score);
```

---

## 2. Danh sách Endpoints

### 2.1 Kiểm tra và đăng ký tên người chơi

Dùng để xác thực tên trước khi cho phép vào giao diện chính của Hub.

- **URL**: `/api/players/check`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "KienPro123"
  }
  ```
- **Phản hồi**:
  - **200 OK** (Tên hợp lệ & chưa ai sử dụng -> API sẽ tự động đăng ký tên này vào DB):
    ```json
    {
      "available": true,
      "message": "Player registered successfully",
      "name": "KienPro123"
    }
    ```
  - **400 Bad Request** (Tên trống hoặc ký tự không hợp lệ):
    ```json
    {
      "available": false,
      "error": "Player name must be between 3 and 20 alphanumeric characters"
    }
    ```
  - **409 Conflict** (Tên đã bị người khác đăng ký trước đó):
    ```json
    {
      "available": false,
      "error": "This player name is already taken"
    }
    ```

---

### 2.2 Gửi điểm số mới (Submit Score)

Game gửi kết quả lượt chơi lên để lưu trữ.

- **URL**: `/api/scores`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "gameId": "minesweeper",
    "playerName": "KienPro123",
    "score": 42.5,
    "metadata": {
      "difficulty": "medium",
      "clicks": 55
    }
  }
  ```
- **Phản hồi**:
  - **201 Created** (Lưu điểm thành công):
    ```json
    {
      "success": true,
      "id": 184,
      "playerName": "KienPro123",
      "score": 42.5,
      "rank": 3 // Xếp hạng hiện tại của người chơi trong game này
    }
    ```
  - **400 Bad Request** (Thiếu hoặc sai định dạng dữ liệu đầu vào):
    ```json
    {
      "error": "Invalid score data submitted"
    }
    ```
  - **403 Forbidden** (Tên player chưa được đăng ký trong hệ thống):
    ```json
    {
      "error": "Player name does not exist. Please register first."
    }
    ```

---

### 2.3 Lấy bảng xếp hạng (Leaderboard)

Lấy danh sách **Top 10** điểm cao nhất của một game cụ thể.

- **URL**: `/api/scores`
- **Method**: `GET`
- **Query Parameters**:
  - `gameId` (string, bắt buộc): ID của game (ví dụ: `minesweeper`, `dino`, `snake`).
  - `limit` (number, tùy chọn): Giới hạn số lượng kết quả. Mặc định là `10`.
- **Phản hồi**:
  - **200 OK**:
    ```json
    [
      {
        "rank": 1,
        "playerName": "DinoMaster",
        "score": 10820,
        "metadata": { "speed": "high" },
        "date": "2026-06-05T02:15:30.000Z"
      },
      {
        "rank": 2,
        "playerName": "KienPro123",
        "score": 8500,
        "metadata": {},
        "date": "2026-06-05T03:08:12.000Z"
      }
    ]
    ```
  
> [!NOTE]
> Cách tính Rank/Xếp hạng phụ thuộc vào trường `scoreDirection` trong manifest `game.json` của từng game:
> - `higher-is-better` (ví dụ: Dino, Snake): Sắp xếp điểm giảm dần (`DESC`).
> - `lower-is-better` (ví dụ: Minesweeper - tính theo giây): Sắp xếp điểm tăng dần (`ASC`).

---

### 2.4 Lấy danh sách games đăng ký

Lấy thông tin đăng ký của các game đang hoạt động.

- **URL**: `/api/games`
- **Method**: `GET`
- **Phản hồi**:
  - **200 OK**:
    ```json
    [
      {
        "id": "minesweeper",
        "name": "Minesweeper",
        "description": "Clear the minefield without detonating any mines",
        "icon": "💣",
        "color": "#E63946",
        "scoreLabel": "Time",
        "scoreDirection": "lower-is-better"
      },
      {
        "id": "dino",
        "name": "Dino Runner",
        "description": "Jump over obstacles as an endless runner dino",
        "icon": "🦖",
        "color": "#4ade80",
        "scoreLabel": "Distance",
        "scoreDirection": "higher-is-better"
      }
    ]
    ```
