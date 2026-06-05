# Implementation Plan

Tài liệu này vạch ra kế hoạch phát triển dự án Mini Hub qua các giai đoạn từ thiết lập cơ sở dữ liệu, viết Backend, phát triển giao diện chính (Shell) bằng React, cho đến xây dựng các game độc lập và hoàn thiện hệ thống.

---

## 1. Công nghệ sử dụng (Tech Stack)

| Thành phần | Local Development | Production (Vercel) |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite (Dev Server) | Vercel Static Hosting |
| **Backend API** | Node.js Express.js | Vercel Serverless Functions (`/api/`) |
| **Cơ sở dữ liệu** | SQLite (`better-sqlite3`) | Vercel Postgres (Neon Cloud) |
| **Games** | Vanilla HTML5 / CSS3 / ES6 JS | Như trên (Phục vụ dưới dạng tài nguyên tĩnh) |

---

## 2. Thiết kế chủ đạo (Design System)

- **Màu sắc chủ đạo**: Đỏ (`#E63946`), Trắng (`#F1FAEE`), và Đen (`#1D1D1D`).
- **Giao diện**: Mặc định là Dark Mode cho toàn bộ Shell nhằm tối ưu trải nghiệm gaming.
- **Font chữ**: Inter (Google Fonts).

---

## 3. Quy trình phát triển (Phases)

### Giai đoạn 1: Khởi tạo Backend & Cơ sở dữ liệu
Thiết lập API Server cho phép lưu trữ điểm và kiểm tra trùng tên người chơi.

1. **Khởi tạo project**: Tạo `package.json` ở root và cài đặt các dependencies cần thiết (`express`, `better-sqlite3`, `cors`).
2. **Cấu hình Cơ sở dữ liệu local**: Tạo file `server/db.js` để khởi tạo SQLite, tự động tạo các bảng `players` và `scores`.
3. **Viết REST API local**: Tạo `server/index.js` định nghĩa các endpoints:
   - `POST /api/players/check`: Đăng ký & kiểm tra tên.
   - `POST /api/scores`: Lưu điểm số.
   - `GET /api/scores`: Lấy bảng xếp hạng Top 10.
4. **Cấu hình Vercel Serverless (Production)**:
   - Tạo thư mục `/api/` với các hàm serverless handler: `players.js`, `scores.js`, `games.js`.
   - Tạo file cấu hình `vercel.json` phục vụ việc routing và redirect tài nguyên tĩnh.

---

### Giai đoạn 2: Phát triển React Shell (Frontend)
Xây dựng giao diện chính của Web Portal.

1. **Setup Vite + React**: Thiết lập khung dự án, cài đặt `react-router-dom` cho việc chuyển trang.
2. **Cấu hình Proxy**: Thiết lập `vite.config.js` proxy toàn bộ request `/api/*` sang `http://localhost:3001` để tránh CORS khi chạy ở local.
3. **Xây dựng Stylesheet (`App.css`)**: Thiết lập các biến CSS màu chủ đạo (`#E63946`, `#F1FAEE`, `#1D1D1D`), font chữ, và các lớp tiện ích hiệu ứng hover.
4. **Xây dựng các Component cốt lõi**:
   - `NameModal`: Overlay chặn tương tác ban đầu, buộc người dùng nhập tên và xác thực thông qua API. Lưu tên hợp lệ vào `sessionStorage`.
   - `Header`: Hiển thị logo, tên người chơi hiện tại, và nút điều hướng về trang chủ.
   - `GameGrid` & `GameCard`: Hiển thị danh sách các game dưới dạng grid card, sử dụng thông tin từ `public/games.json`.
   - `GamePlayer`: Chứa thẻ `<iframe>` để tải game, thiết lập listener lắng nghe tin nhắn `postMessage` từ game con gửi lên.
   - `Leaderboard`: Bảng xếp hạng Top 10 hiển thị động tùy thuộc vào chế độ chấm điểm (`higher-is-better` hoặc `lower-is-better`).

---

### Giai đoạn 3: Phát triển 3 Games độc lập ban đầu
Xây dựng các game con độc lập nằm trong `/public/games/`.

1. **Minesweeper (Dò mìn)**:
   - Chế độ chơi: Grid 2D thuần, hỗ trợ 3 độ khó (Dễ, Trung bình, Khó).
   - Logic: Đếm thời gian từ lúc click ô đầu tiên đến khi mở hết ô an toàn.
   - Giao tiếp: Gửi điểm (thời gian tính bằng giây) lên Hub khi thắng cuộc (`lower-is-better`).
2. **Dino Runner**:
   - Chế độ chơi: Sử dụng thẻ Canvas vẽ khủng long nhảy tránh xương rồng.
   - Logic: Tốc độ chạy tăng dần theo thời gian.
   - Giao tiếp: Gửi điểm (khoảng cách chạy được) lên Hub khi đâm vào chướng ngại vật (`higher-is-better`).
3. **Snake (Rắn săn mồi)**:
   - Chế độ chơi: Rắn di chuyển trên lưới, ăn mồi để tăng chiều dài.
   - Logic: Tự đâm vào đuôi hoặc đâm tường (tùy cài đặt) dẫn đến game over.
   - Giao tiếp: Gửi điểm (chiều dài tối đa đạt được) lên Hub khi chết (`higher-is-better`).

---

### Giai đoạn 4: Đánh giá, Tối ưu & Triển khai
1. **Responsive**: Tối ưu hóa layout Hub Shell cho thiết bị di động.
2. **Hỗ trợ Touch Control**: Tích hợp các nút ảo điều hướng hoặc vuốt chạm trong các game để chơi được trên điện thoại.
3. **Chuyển đổi DB**: Thay đổi cơ chế từ SQLite sang Vercel Postgres thông qua biến môi trường để phục vụ deploy online.
4. **Deploy**: Đẩy code lên GitHub và kết nối với Vercel.
