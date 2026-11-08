# Mochi - Spaced Repetition English Flashcards

Ứng dụng học từ vựng tiếng Anh theo phương pháp Spaced Repetition (Lặp lại ngắt quãng) lấy cảm hứng từ MochiCards, xây dựng bằng React Native (Expo SDK 54) và thuật toán FSRS (Free Spaced Repetition Scheduler).

## Tính năng nổi bật

- **Thuật toán Spaced Repetition FSRS chuẩn**:
  - Tối ưu hóa chu kỳ nhớ từ với ts-fsrs.
  - Bảo vệ chống over-scheduling trong cùng ngày (Same-day review protection).
  - Vòng lặp học lại khi quên (Again) trong cùng phiên ôn tập.
  - Giới hạn 20 thẻ mới mỗi ngày để việc học đều đặn, không bị quá tải.
  - Hỗ trợ Undo (hoàn tác) và khôi phục trạng thái ôn tập.
  - Đặt lại lịch ôn tập từng bộ thẻ về mới tinh.

- **Mặt ẩn đa nghĩa thông minh**:
  - Tự động gợi ý từ và trích xuất đa nghĩa (danh từ, động từ, tính từ,...).
  - Kèm câu ví dụ thực tế và bản dịch tiếng Việt cho từng nét nghĩa.
  - Tra từ/cụm trong câu ví dụ: chạm vào bất kỳ từ nào để nghe phát âm ngay và xem popup giải nghĩa nổi không làm xô lệch giao diện.

- **Phiên âm IPA chuẩn xác**:
  - Tích hợp tra IPA cho mọi dạng biến thể của từ (inflected forms: past tense, plural, participle,...).

- **Phát âm Native Offline**:
  - Tích hợp System TTS qua `expo-speech`, chạy ổn định trên iOS và Android.

- **Lưu trữ dữ liệu Offline**:
  - Cơ sở dữ liệu SQLite cục bộ đảm bảo tốc độ cao và hoạt động hoàn toàn không cần kết nối mạng sau khi tải từ.

## Hướng dẫn cài đặt & Khởi chạy

```bash
# Cài đặt dependencies
npm install

# Chạy ứng dụng qua Expo
npm start

# Chạy test
npm test

# Kiểm tra kiểu TypeScript
npm run typecheck
```
