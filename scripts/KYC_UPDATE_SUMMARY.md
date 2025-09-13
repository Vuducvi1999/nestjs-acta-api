# KYC System Updates Summary

## 🎯 **Tổng quan thay đổi**

Đã cập nhật hoàn toàn hệ thống KYC với 3 tính năng chính:

1. **Script cập nhật trạng thái user**: Chuyển users từ `ACTIVE` → `pending_kyc`
2. **Cronjob nhắc nhở KYC pending**: Gửi email tự động mỗi 2 ngày
3. **Cronjob nhắc nhở KYC changing**: Gửi email tự động mỗi ngày

---

## 📝 **1. Script Update User Status**

### ✅ **Thay đổi logic chính**

- **Trước**: Cập nhật tất cả non-admin users
- **Sau**: Chỉ cập nhật users có `role != admin` VÀ `status = ACTIVE`

```sql
-- Query tương đương:
UPDATE users
SET
  status = 'pending_kyc',
  updatedAt = NOW()
WHERE
  role != 'admin'
  AND status = 'active';
```

### 🚀 **Cách sử dụng**

```bash
# Preview mode - xem trước users sẽ được update
npm run update:user-status-kyc

# Advanced mode - batch processing cho large DB
npm run update:user-status-kyc:advanced

# Quick mode - thực thi trực tiếp (cẩn thận!)
npm run update:user-status-kyc:quick
```

### 📁 **Files đã cập nhật**

- `scripts/update-user-status-to-pending-kyc.ts` - Script chính
- `scripts/quick-update-user-status.ts` - Script thực thi nhanh
- `scripts/README.md` - Documentation
- `package.json` - NPM scripts

---

## 📧 **2. KYC Reminder Cron Job**

### ✅ **Tính năng mới**

- **Tự động chạy mỗi 2 ngày vào 9:00 AM**
- **Tìm users có status `pending_kyc`**
- **Gửi email nhắc nhở tùy chỉnh theo thời gian**
- **Rate limiting để tránh spam**

### 🎯 **Logic email thông minh**

```typescript
// Tùy chỉnh nội dung theo số ngày pending
if (daysSinceLastUpdate < 7) {
  reason =
    'Vui lòng hoàn thành thông tin KYC để có thể sử dụng đầy đủ tính năng của hệ thống.';
} else if (daysSinceLastUpdate < 30) {
  reason = `Tài khoản của bạn đã ở trạng thái chờ KYC ${daysSinceLastUpdate} ngày...`;
} else {
  reason = `Tài khoản của bạn đã chưa hoàn thành KYC hơn ${daysSinceLastUpdate} ngày...`;
}
```

### 📊 **Cron Schedule**

- **Expression**: `0 9 */2 * *`
- **Frequency**: Mỗi 2 ngày vào 9:00 AM
- **Timezone**: Server timezone

### 🔧 **API Endpoints**

```bash
# Manual trigger cho admin
POST /users/admin/kyc/trigger-reminder
Authorization: Bearer <admin-token>

# Response:
{
  "success": true,
  "message": "KYC reminder emails triggered successfully by admin",
  "pendingUsersCount": 25,
  "triggeredBy": "admin-user-id",
  "triggeredAt": "2024-01-15T09:00:00Z"
}
```

### 📁 **Files đã tạo**

- `src/users/services/user-kyc-reminder-cron.service.ts` - Service chính
- Cập nhật `src/users/users.module.ts` - Đăng ký service
- Cập nhật `src/users/controllers/user.controller.ts` - API endpoint

---

## 📧 **3. KYC Changing Reminder Cron Job (Mới)**

### ✅ **Tính năng mới**
- **Tự động chạy hàng ngày vào 10:00 AM**
- **Tìm users có status `kyc_changing`**
- **Gửi email nhắc nhở tùy chỉnh theo mức độ khẩn cấp**
- **Rate limiting để tránh spam**
- **Urgency tracking cho users lâu ngày**

### 🎯 **Logic email thông minh cho kyc_changing**
```typescript
// Tùy chỉnh nội dung theo số ngày pending
if (daysSinceLastUpdate < 3) {
  message = 'Chúng tôi đã yêu cầu bạn cập nhật thông tin KYC...';
  reviewerName = 'Đội ngũ ACTA';
} else if (daysSinceLastUpdate < 7) {
  message = `Tài khoản đã ở trạng thái cần sửa đổi KYC ${daysSinceLastUpdate} ngày...`;
  reviewerName = 'Đội ngũ ACTA';
} else {
  message = `Đây là nhắc nhở cuối cùng - vui lòng cập nhật ngay để tránh bị tạm khóa...`;
  reviewerName = 'Bộ phận Kiểm duyệt ACTA';
}
```

### 📊 **Cron Schedule**
- **Expression**: `0 10 * * *`
- **Frequency**: Hàng ngày vào 10:00 AM
- **Template**: `sendNotificationChangingKycEmail`
- **Email Component**: `NotificationChangingKycEmail.tsx`

### 🔧 **API Endpoints**
```bash
# Manual trigger cho admin
POST /users/admin/kyc/trigger-changing-reminder
Authorization: Bearer <admin-token>

# Response:
{
  "success": true,
  "message": "KYC changing reminder emails triggered successfully by admin",
  "kycChangingUsersCount": 15,
  "urgencyBreakdown": {
    "total": 15,
    "urgent": 3,    // > 7 days
    "warning": 5,   // 3-7 days  
    "recent": 7     // < 3 days
  },
  "triggeredBy": "admin-user-id",
  "triggeredAt": "2024-01-15T10:00:00Z"
}
```

### 📁 **Files đã tạo**
- `src/users/services/user-kyc-changing-reminder-cron.service.ts` - Service chính
- Cập nhật `src/users/users.module.ts` - Đăng ký service  
- Cập nhật `src/users/controllers/user.controller.ts` - API endpoint mới

---

## 🛡️ **Tính năng bảo mật & Monitoring**

### 🔍 **Logging chi tiết**

```typescript
// Example logs
✅ Sent KYC reminder to John Doe (john@example.com)
📊 KYC reminder job completed: 25 sent, 0 failed
📈 KYC Reminder Stats: {"timestamp": "...", "totalPendingUsers": 25, "emailsSent": 25, "successRate": "100.00"}
```

### 🚦 **Rate Limiting**

- 100ms delay giữa các email
- Batch processing cho performance tốt
- Error handling tự động

### 📈 **Statistics**

- Track success/failure rates
- Monitor pending users count
- Performance metrics

---

## 🚀 **Deployment Steps**

### 1. **Backup Database**

```bash
# Backup trước khi deploy
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. **Deploy Code**

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build project
npm run build

# Restart services
pm2 restart api
```

### 3. **Verify Cron Jobs**

```bash
# Check logs để verify cron đã hoạt động
tail -f logs/application.log | grep "KYC"
```

### 4. **Test Scripts**

```bash
# Test script trong preview mode
npm run update:user-status-kyc

# Test manual trigger (admin API)
curl -X POST "your-api-url/users/admin/kyc/trigger-reminder" \
  -H "Authorization: Bearer admin-token"
```

---

## ⚠️ **Important Notes**

### 🔥 **Critical Warnings**

1. **BACKUP DATABASE** trước khi chạy scripts
2. **Test trên staging** trước production
3. **Scripts KHÔNG THỂ UNDO** - cẩn thận khi chạy
4. **Monitor email limits** để tránh bị block

### 🎛️ **Configuration**

```env
# .env variables cần thiết
FRONTEND_URL=https://your-frontend-url.com
MAIL_SERVICE_API_KEY=your-resend-api-key
```

### 📊 **Performance Considerations**

- Script xử lý batch 100 users/lần
- Email gửi với delay 100ms/email
- Monitor memory usage với large datasets

---

## 📚 **Documentation Links**

- **Script Documentation**: `scripts/README.md`
- **API Documentation**: Swagger UI tại `/api/docs`
- **Email Templates**: `src/mail/templates/`
- **Cron Jobs**: `src/users/services/*-cron.service.ts`

---

## 🔄 **Future Enhancements**

### 💡 **Suggestions**

1. **Database table cho tracking**: Lưu lại lịch sử gửi email
2. **Admin dashboard**: UI để monitor KYC stats
3. **Email templates**: Tùy chỉnh theo user segments
4. **SMS notifications**: Backup cho email failures
5. **A/B testing**: Different reminder strategies

### 🎯 **Metrics to Track**

- KYC completion rate after reminders
- Email open/click rates
- User response time to reminders
- System performance impact

---

_Last updated: $(date)_
