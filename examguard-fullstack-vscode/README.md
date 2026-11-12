# ExamGuard — Hệ thống Thi Trắc Nghiệm Trực Tuyến Chống Gian Lận (Full-Stack VS Code)

Dự án được tách thành 4 phân hệ rõ ràng đúng theo cấu trúc:
- `database/`: Chứa file `db_exam_fixed.sql` (đã sửa lỗi thiếu dấu `;` ở dòng `CREATE database db`) và dữ liệu mẫu `seeds/seed_examguard.sql`.
- `ai-service/`: Python + FastAPI + OpenCV (`verify-face`, `proctor-frame`, tính khoảng cách Euclidean và phát hiện 0 người / 1 người / nhiều người).
- `server/`: Node.js + Express + `mysql2` + JWT + `Socket.IO` (Xác thực, tạo lượt thi, lưu đáp án tự động, chấm điểm tại Backend, ghi `proctoring_logs`).
- `client/`: ReactJS + Vite chạy ở cổng `5174` (Giao diện `Đăng nhập phòng thi`, `Xác minh khuôn mặt`, `Phòng thi`, và `Giám thị Proctoring Dashboard`).

## Đăng nhập giáo viên

Sau khi khởi tạo schema ExamGuard, chạy `database/seed_teacher.sql` để thêm tài khoản giáo viên demo. Mật khẩu được lưu dưới dạng bcrypt hash; có thể mở cổng đăng nhập giáo viên từ trang đăng nhập thí sinh. Các API dashboard yêu cầu JWT hợp lệ với vai trò `TEACHER`.

## Đường dẫn giao diện

Giao diện dùng React Router; mở trực tiếp hoặc tải lại các đường dẫn sau:
- `/student/login` và `/student/dashboard`
- `/student/verify` và `/student/exam`
- `/teacher/login` và `/teacher/dashboard`

Các trang dashboard và phòng thi yêu cầu phiên đăng nhập tương ứng.
