# System Architecture

Tài liệu này mô tả kiến trúc tổng quan của dự án Mini Hub, giải thích cách các thành phần liên kết với nhau, quy trình xử lý dữ liệu và thiết lập môi trường phát triển (Development) so với môi trường vận hành (Production).

---

## 1. Sơ đồ kiến trúc (System Diagram)

```
                       +-----------------------------------+
                       |        Trình duyệt (Client)       |
                       |  +-----------------------------+  |
                       |  |       Hub Shell (React)     |  |
                       |  |  (State, Routing, UI, Lbd)  |  |
                       |  +--------------+--------------+  |
                       |                 |                 |
                       |                 | postMessage     |
                       |                 v                 |
                       |  +-----------------------------+  |
                       |  |    Iframe Game Container    |  |
                       |  |    (Minesweeper, Dino,...)   |  |
                       |  +-----------------------------+  |
                       +-----------------+-----------------+
                                         |
                                         | HTTP /api
                                         v
                       +-----------------------------------+
                       |        Máy chủ (Backend API)      |
                       |                                   |
                       |   Local: Node.js Express Server   |
                       |   Prod:  Vercel Serverless Funcs  |
                       +-----------------+-----------------+
                                         |
                                         v
                       +-----------------------------------+
                       |         Cơ sở dữ liệu (DB)        |
                       |                                   |
                       |   Supabase (PostgreSQL Cloud)     |
                       +-----------------------------------+
```

---

## 2. Các thành phần chính

### 2.1 Hub Shell (Frontend)
- Được phát triển bằng **React 18** và build bằng **Vite**.
- Nhiệm vụ:
  - Hiển thị màn hình chào mừng yêu cầu nhập và kiểm tra trùng tên (`NameModal`).
  - Hiển thị danh sách các game được thiết kế theo dạng thẻ có animation (`GameGrid`, `GameCard`).
  - Chạy game trong thẻ `<iframe>` độc lập thông qua `GamePlayer`.
  - Lắng nghe và tiếp nhận điểm số từ game truyền lên qua cơ chế `postMessage`.
  - Hiển thị bảng xếp hạng Top 10 của game hiện tại hoặc tất cả các game.
- Giao diện sử dụng hệ thống màu thiết kế đỏ-trắng-đen với Dark Mode làm nền chủ đạo mang lại cảm giác gaming cao cấp.

### 2.2 Game Sandbox (Iframe Games)
- Mỗi game nằm ở một thư mục con hoàn toàn độc lập trong `/public/games/`.
- Không sử dụng các framework nặng để tránh xung đột, khuyến khích sử dụng vanilla HTML5, Canvas API và CSS thông thường.
- Không có quyền truy cập trực tiếp vào cơ sở dữ liệu hoặc localStorage của Hub Shell để đảm bảo bảo mật và tính độc lập. Mọi tương tác đều thông qua giao thức postMessage được quy định sẵn (xem [Game SDK Contract](./sdk-contract.md)).

### 2.3 Backend API
Backend được tối ưu hóa cho cả môi trường chạy local và production để kết nối đồng bộ tới Supabase:

#### Cơ sở dữ liệu Supabase
- Sử dụng cơ sở dữ liệu **Supabase (PostgreSQL Cloud)** làm nơi lưu trữ tập trung dữ liệu cho cả môi trường Local và Production.
- Cấu hình thông qua hai biến môi trường: `SUPABASE_URL` và `SUPABASE_KEY`.

#### Môi trường Local Development
- Sử dụng server **Express.js** chạy độc lập trên cổng `3001` kết nối trực tiếp với Supabase qua SDK `@supabase/supabase-js`.
- Sử dụng Vite proxy (`/api` -> `http://localhost:3001`) để tránh lỗi CORS trong lúc phát triển.

#### Môi trường Production (Vercel)
- Sử dụng **Vercel Serverless Functions** cấu hình trong thư mục `/api/` để xử lý các request, kết nối trực tiếp với Supabase.
- Không cần chạy server NodeJS liên tục 24/7, tiết kiệm chi phí và tối ưu hiệu năng.

---

## 3. Quy trình bảo mật & luồng dữ liệu

### 3.1 Chặn trùng tên (Name Verification)
1. Khi user nhập tên lần đầu, React gửi request `POST /api/players/check` với tên người chơi.
2. Server kiểm tra trong bảng `players`.
   - Nếu chưa tồn tại: Đăng ký tên mới vào DB, lưu thông tin vào `sessionStorage` của trình duyệt.
   - Nếu đã tồn tại: Báo lỗi trùng tên, yêu cầu người dùng chọn tên khác hoặc thêm ký tự đặc biệt.
3. Trong toàn bộ phiên chơi, React dùng tên trong `sessionStorage` làm định danh gửi kèm khi submit điểm.

### 3.2 Cơ chế chống gian lận điểm số cơ bản (Anti-Cheat)
Vì game chạy client-side trong iframe, việc cheat điểm thông qua sửa JS biến số rất dễ xảy ra. Để giảm thiểu:
1. Hub Shell chỉ chấp nhận nhận tin nhắn `GAME_OVER` từ chính cửa sổ iframe đang hoạt động (`event.source === iframe.contentWindow`).
2. Origin gửi tin nhắn phải khớp với origin của trang Hub.
3. Metadata gửi kèm theo điểm số có thể chứa các thông số kiểm tra logic (ví dụ: số lần click chuột trong Minesweeper, thời gian chạy trong Dino) để server-side có thể xác thực lại tính hợp lệ của điểm số (nếu phát triển sâu hơn).
