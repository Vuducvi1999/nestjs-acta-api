# Scripts Documentation

## Backfill Avatar URLs

Script để cập nhật tất cả user avatar attachments từ URL cũ (pravatar.cc) sang URL mới (UFS).

### 🚀 Cách sử dụng

#### 1. Xem trước (Preview Mode)

```bash
# Mode đơn giản - xem attachments nào sẽ được update
npm run backfill:avatar-urls

# Mode nâng cao - xem thống kê chi tiết
npm run backfill:avatar-urls:advanced
```

#### 2. Thực thi (Execution Mode)

**⚠️ QUAN TRỌNG:** Trước khi chạy thật:

1. **Backup database** trước khi thực hiện
2. **Uncomment** phần code trong script file
3. **Test trên môi trường development** trước

```bash
# Chỉnh sửa file script để uncomment phần update
vim scripts/backfill-avatar-urls.ts

# Sau đó chạy lại command
npm run backfill:avatar-urls
```

### 📊 Các chế độ

#### Simple Mode (Mặc định)

- Hiển thị danh sách attachments sẽ được update
- Update tất cả attachments cùng lúc
- Phù hợp với database nhỏ/trung bình

#### Advanced Mode

- Hiển thị thống kê chi tiết theo URL
- Update theo batch (50 attachments/lần)
- Phù hợp với database lớn
- Tránh memory issues

### 🎯 Logic của script

```sql
-- Script sẽ thực hiện query tương đương:
UPDATE attachments
SET
  fileUrl = 'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b',
  updatedAt = NOW()
WHERE
  fileUrl = 'https://i.pravatar.cc/150?img=58';
```

### 📝 Output mẫu

```bash
🚀 Starting avatar URL backfill script...
📝 Target: Update all attachments with fileUrl "https://i.pravatar.cc/150?img=58"
📝 New URL: "https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b"
📊 Found 25 attachments to update

📋 Attachments to be updated:
1. Attachment ID: abc123 - John Doe (john@example.com) - us-11001
2. Attachment ID: def456 - Jane Smith (jane@example.com) - us-11002
...

⚠️  Are you sure you want to proceed? (This will update the database)
💡 To continue, please uncomment the update section in the script.
```

### 🛡️ Tính năng bảo mật

1. **Preview Mode mặc định** - không update cho đến khi uncomment
2. **Detailed logging** - log tất cả thay đổi
3. **Verification** - kiểm tra lại sau khi update
4. **Error handling** - rollback nếu có lỗi
5. **Batch processing** - tránh timeout với large datasets

### ⚡ Quick Mode - Thực thi trực tiếp

Nếu bạn muốn chạy script nhanh không cần preview:

```bash
# ⚠️ CẢNH BÁO: Script này sẽ update trực tiếp database!
npm run backfill:avatar-urls:quick
```

**Quick mode sẽ:**

- Update tất cả attachments ngay lập tức
- Hiển thị thống kê thời gian thực hiện
- Hiển thị kết quả cuối cùng
- Không có preview hay confirmation

**⚠️ Lưu ý cho Quick Mode:**

1. **BACKUP DATABASE** bắt buộc trước khi chạy
2. **Test trên staging** trước
3. **Double-check** môi trường (dev/prod)
4. Script này **KHÔNG THỂ UNDO**

---

## Update User Status to Pending KYC

Script để thay đổi status của user có role khác admin và đang có status `ACTIVE` sang `pending_kyc`.

### 🚀 Cách sử dụng

#### 1. Xem trước (Preview Mode)

```bash
# Mode đơn giản - xem user nào sẽ được update
npm run update:user-status-kyc

# Mode nâng cao - xem thống kê chi tiết
npm run update:user-status-kyc:advanced
```

#### 2. Thực thi (Execution Mode)

**⚠️ QUAN TRỌNG:** Trước khi chạy thật:

1. **Backup database** trước khi thực hiện
2. **Uncomment** phần code trong script file
3. **Test trên môi trường development** trước

```bash
# Chỉnh sửa file script để uncomment phần update
vim scripts/update-user-status-to-pending-kyc.ts

# Sau đó chạy lại command
npm run update:user-status-kyc
```

### 📊 Các chế độ

#### Simple Mode (Mặc định)

- Hiển thị danh sách users sẽ được update
- Update tất cả non-admin users cùng lúc
- Phù hợp với database nhỏ/trung bình

#### Advanced Mode

- Hiển thị thống kê chi tiết theo role và status
- Update theo batch (100 users/lần)
- Phù hợp với database lớn
- Tránh memory issues

### 🎯 Logic của script

```sql
-- Script sẽ thực hiện query tương đương:
UPDATE users
SET
  status = 'pending_kyc',
  updatedAt = NOW()
WHERE
  role != 'admin'
  AND status = 'active';
```

### 📝 Output mẫu

```bash
🚀 Starting user status update script...
📊 Found 150 non-admin users to update

📋 Users to be updated:
1. John Doe (john@example.com) - Current status: active → pending_kyc
2. Jane Smith (jane@example.com) - Current status: pending → pending_kyc
...

⚠️  Are you sure you want to proceed? (This will update the database)
💡 To continue, please uncomment the update section in the script.
```

### 🛡️ Tính năng bảo mật

1. **Preview Mode mặc định** - không update cho đến khi uncomment
2. **Detailed logging** - log tất cả thay đổi
3. **Verification** - kiểm tra lại sau khi update
4. **Error handling** - rollback nếu có lỗi
5. **Batch processing** - tránh timeout với large datasets

### 🔧 Tùy chỉnh

Để chỉ update users với status cụ thể, edit script và uncomment phần:

```typescript
// status: {
//   in: [UserStatus.active, UserStatus.pending, UserStatus.pending_admin]
// }
```

### ⚠️ Lưu ý quan trọng

1. **BACKUP DATABASE** trước khi chạy
2. **Test trên staging** trước khi chạy production
3. **Chạy vào giờ thấp điểm** để tránh ảnh hưởng users
4. **Monitor logs** trong quá trình chạy
5. **Inform team** trước khi thực hiện

### 🐛 Troubleshooting

#### Lỗi "Connection timeout"

- Sử dụng advanced mode với batch processing
- Giảm BATCH_SIZE trong script

#### Lỗi "Permission denied"

- Kiểm tra database user có quyền UPDATE
- Kiểm tra connection string

#### Script chạy nhưng không update gì

- Kiểm tra đã uncomment phần update chưa
- Kiểm tra có users non-admin nào không

### ⚡ Quick Mode - Thực thi trực tiếp

Nếu bạn muốn chạy script nhanh không cần preview:

```bash
# ⚠️ CẢNH BÁO: Script này sẽ update trực tiếp database!
npm run update:user-status-kyc:quick
```

**Quick mode sẽ:**

- Update tất cả non-admin users ngay lập tức
- Hiển thị thống kê thời gian thực hiện
- Hiển thị kết quả cuối cùng
- Không có preview hay confirmation

**⚠️ Lưu ý cho Quick Mode:**

1. **BACKUP DATABASE** bắt buộc trước khi chạy
2. **Test trên staging** trước
3. **Double-check** môi trường (dev/prod)
4. Script này **KHÔNG THỂ UNDO**

## KYC Reminder Cron Jobs

Hệ thống đã được cài đặt 3 cronjob tự động gửi email nhắc nhở KYC:

### 📧 0. KYC Submitted Check (Mỗi 1 ngày)

- **Chạy mỗi 1 ngày vào 9:00 AM**
- **Tìm tất cả KYC có status `kyc_submitted`**
- **Gửi email thông báo cho admins**
- **Kiểm tra userConfig.EMAIL_SUBSCRIPTION của admins**

### 📧 1. KYC Pending Reminder (Mỗi 2 ngày)

- **Chạy mỗi 2 ngày vào 9:00 AM**
- **Tìm tất cả user có status `pending_kyc`**
- **Kiểm tra userConfig.EMAIL_SUBSCRIPTION trước khi gửi email**
- **Gửi email nhắc nhở sử dụng template `sendNotificationUpdateKycEmail`**
- **Tùy chỉnh nội dung theo số ngày đã pending**

#### 🎯 Logic email pending_kyc

- **< 7 ngày**: Nhắc nhở thông thường
- **7-30 ngày**: Cảnh báo về thời gian chờ
- **> 30 ngày**: Cảnh báo nghiêm trọng về hạn chế tài khoản

### 📧 2. KYC Changing Reminder (Mỗi 1 ngày)

- **Chạy mỗi 1 ngày vào 10:00 AM**
- **Tìm tất cả user có status `kyc_changing`**
- **Kiểm tra userConfig.EMAIL_SUBSCRIPTION trước khi gửi email**
- **Gửi email nhắc nhở sử dụng template `sendNotificationChangingKycEmail`**
- **Tùy chỉnh nội dung theo mức độ khẩn cấp**

#### 🎯 Logic email kyc_changing

- **< 3 ngày**: Nhắc nhở hoàn tất cập nhật
- **3-7 ngày**: Cảnh báo về gián đoạn dịch vụ
- **> 7 ngày**: Cảnh báo cuối cùng - nguy cơ khóa tài khoản

### 🔧 Manual Testing

```bash
# Test hệ thống KYC trước khi chạy scripts
npm run test:kyc-system

# Trigger manual pending_kyc reminder (Admin only via API)
POST /users/admin/kyc/trigger-reminder
Authorization: Bearer <admin-token>

# Trigger manual kyc_changing reminder (Admin only via API)
POST /users/admin/kyc/trigger-changing-reminder
Authorization: Bearer <admin-token>
```

### 📊 Cron Schedules

- **Submitted KYC**: `0 9 */1 * *` (9:00 AM mỗi 1 ngày)
- **Pending KYC**: `0 9 */2 * *` (9:00 AM mỗi 2 ngày)
- **Changing KYC**: `0 10 */1 * *` (10:00 AM mỗi 1 ngày)
- **Services**: `UserKYCCronService`, `UserKYCReminderCronService`, `UserKYCChangingReminderCronService`
- **Templates**: `KYCPendingNotificationEmail.tsx`, `NotificationUpdateKycEmail.tsx`, `NotificationChangingKycEmail.tsx`
