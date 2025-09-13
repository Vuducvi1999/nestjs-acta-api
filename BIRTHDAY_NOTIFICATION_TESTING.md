# Birthday Notification Testing Guide

This guide shows you how to test the birthday notification system both manually and automatically.

## 🎂 How Birthday Notifications Work

### System Overview

- **Automatic Schedule**: Runs daily at 12:00 AM (midnight) via cron job
- **Notification Threshold**: 3 days before birthday (`BIRTHDAY_REMINDER_DAYS: 3`)
- **Recipients**: Referrer, direct referrals, and indirect referrals of the birthday user
- **Notification Types**: In-app notifications (not email)
- **Performance**: Uses referral closure table for efficient querying (single batch query vs multiple individual queries)

### Notification Messages

1. **To Referrer**: "Sinh nhật của {fullName} sẽ diễn ra trong {days} ngày nữa. Đừng quên gửi lời chúc mừng!"
2. **To Direct Referrals**: "Sinh nhật của người giới thiệu {fullName} sẽ diễn ra trong {days} ngày nữa. Hãy gửi lời chúc mừng để thể hiện sự biết ơn!"
3. **To Indirect Referrals**: "Sinh nhật của {fullName} trong mạng lưới giới thiệu sẽ diễn ra trong {days} ngày nữa. Hãy gửi lời chúc mừng!"

## 🧪 Manual Testing Methods

### Method 1: API Endpoint (Recommended)

```bash
# Trigger birthday notifications manually (Admin only)
curl -X POST http://localhost:3000/kyc-cron/trigger/birthday-notification \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Expected Response:
{
  "success": true,
  "message": "Birthday notification triggered successfully"
}
```

### Method 2: Check Birthday Notification Stats

```bash
# Get current birthday notification statistics
curl -X GET http://localhost:3000/kyc-cron/stats/birthday-notification \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected Response:
{
  "success": true,
  "data": {
    "totalUsersWithUpcomingBirthdays": 2,
    "totalNotificationsSent": 8,
    "notificationsByType": {
      "referrer": 2,
      "directReferral": 3,
      "indirectReferral": 3
    },
    "success": 2,
    "failed": 0,
    "successRate": "100%"
  }
}
```

## 🎯 Test Data Setup

### Step 1: Create Test Users with Birthdays

You need users with birthdays in 3 days from today. Update user DOB in database:

```sql
-- Set a user's birthday to 3 days from now
UPDATE users
SET dob = DATE(NOW() + INTERVAL (3 - DAYOFYEAR(NOW()) + DAYOFYEAR(DATE(NOW() + INTERVAL 3 DAY))) DAY)
WHERE id = 'YOUR_TEST_USER_ID';

-- Or set to a specific date (e.g., 3 days from today)
UPDATE users
SET dob = '1990-08-12'  -- Replace with date 3 days from today
WHERE id = 'YOUR_TEST_USER_ID';
```

### Step 2: Set Up Referral Relationships

```sql
-- Make user A refer user B (B's birthday will trigger notification to A)
UPDATE users
SET "referrerId" = 'USER_A_ID'
WHERE id = 'USER_B_ID';
```

### Step 3: Verify Test Data

```sql
-- Check users with upcoming birthdays (3 days)
SELECT
  id,
  "fullName",
  dob,
  "referrerId",
  DATEDIFF(
    DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(dob), '-', DAY(dob))),
    CURDATE()
  ) as days_until_birthday
FROM users
WHERE
  DATEDIFF(
    DATE(CONCAT(YEAR(CURDATE()), '-', MONTH(dob), '-', DAY(dob))),
    CURDATE()
  ) = 3;
```

## 📊 Monitoring & Verification

### Check Application Logs

Look for these log messages:

```
✅ Success:
[UserKYCCronService] Starting birthday notification job...
[UserKYCCronService] Found X users with upcoming birthdays in 3 days
[UserKYCCronService] === BIRTHDAY NOTIFICATION STATS ===
[UserKYCCronService] Total users with upcoming birthdays: X
[UserKYCCronService] Total notifications sent: X

❌ Errors:
[UserKYCCronService] Error in birthday notification job: ...
[UserKYCCronService] Error processing birthday notifications for user X: ...
```

### Check Database Notifications

```sql
-- Check created notifications
SELECT
  n.id,
  n.message,
  n."userId",
  n."relatedModelId",
  n.action,
  n."createdAt",
  u."fullName" as recipient_name
FROM notifications n
JOIN users u ON n."userId" = u.id
WHERE n.action = 'system_alert'
  AND n.message LIKE '%sinh nhật%'
ORDER BY n."createdAt" DESC
LIMIT 10;
```

### Check User Notifications via API

```bash
# Get notifications for a specific user
curl -X GET http://localhost:3000/notifications \
  -H "Authorization: Bearer USER_TOKEN"
```

## 🔧 Troubleshooting

### Common Issues

#### 1. No Notifications Created

**Possible Causes:**

- No users have birthdays in exactly 3 days
- Users don't have referral relationships
- Database connection issues

**Solutions:**

```bash
# Check if any users have upcoming birthdays
curl -X GET http://localhost:3000/kyc-cron/stats/birthday-notification \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### 2. Notifications Not Appearing in Frontend

**Check:**

- User is logged in correctly
- Notifications API endpoint is working
- Frontend is polling/listening for notifications

#### 3. Cron Job Not Running

**Check:**

- Application is running
- Cron scheduler is enabled
- No errors in application logs

### Debug Commands

```bash
# Check current time and cron schedule
date

# Check if any users have DOB set
curl -X GET "http://localhost:3000/users?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data[].dob'

# Manually trigger and check logs immediately
curl -X POST http://localhost:3000/kyc-cron/trigger/birthday-notification \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" && \
tail -f logs/application.log | grep -i birthday
```

## 🎮 Complete Test Scenario

### Scenario: Test Birthday Notifications for User Network

1. **Setup Test Users**

   ```sql
   -- User A (will have birthday in 3 days)
   UPDATE users SET dob = DATE_ADD(CURDATE(), INTERVAL 3 DAY) WHERE id = 'user-a-id';

   -- User B (referrer of User A)
   UPDATE users SET "referrerId" = 'user-b-id' WHERE id = 'user-a-id';

   -- User C (referred by User A)
   UPDATE users SET "referrerId" = 'user-a-id' WHERE id = 'user-c-id';
   ```

2. **Trigger Notifications**

   ```bash
   curl -X POST http://localhost:3000/kyc-cron/trigger/birthday-notification \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Verify Results**

   - User B should receive: "Sinh nhật của User A sẽ diễn ra trong 3 ngày nữa..."
   - User C should receive: "Sinh nhật của người giới thiệu User A sẽ diễn ra trong 3 ngày nữa..."

4. **Check Stats**
   ```bash
   curl -X GET http://localhost:3000/kyc-cron/stats/birthday-notification \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## ✅ Success Criteria

- ✅ API endpoint responds successfully
- ✅ Notifications are created in database
- ✅ Correct notification messages are generated
- ✅ All referral relationships receive notifications
- ✅ Stats show accurate counts
- ✅ No errors in application logs
- ✅ Users can see notifications in frontend

## 📅 Production Considerations

- Birthday notifications run automatically at midnight daily
- System handles timezone considerations
- Failed notifications are logged but don't stop the process
- Notifications are created for active users only
- System respects user notification preferences (if implemented)

---

**Note**: The birthday notification system is fully functional and ready for testing. Use the manual trigger endpoint for immediate testing without waiting for the daily cron job.
