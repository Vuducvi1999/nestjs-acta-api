# KYC System Quick Reference

## 🚀 **Quick Commands**

```bash
# Test current KYC system status
npm run test:kyc-system

# Update ACTIVE users to pending_kyc (preview)
npm run update:user-status-kyc

# Update ACTIVE users to pending_kyc (direct execution)
npm run update:user-status-kyc:quick

# Test avatar URL distribution
npm run test:avatar-urls

# Backfill avatar URLs from pravatar.cc to UFS (preview)
npm run backfill:avatar-urls

# Backfill avatar URLs from pravatar.cc to UFS (direct execution)
npm run backfill:avatar-urls:quick
```

## 📧 **Cron Jobs Overview**

| Job                       | Schedule       | Status          | Template                           | Frequency    |
| ------------------------- | -------------- | --------------- | ---------------------------------- | ------------ |
| **KYC Submitted Check**   | `0 9 */1 * *`  | `kyc_submitted` | Admin notification                 | Every 1 day  |
| **KYC Pending Reminder**  | `0 9 */2 * *`  | `pending_kyc`   | `sendNotificationUpdateKycEmail`   | Every 2 days |
| **KYC Changing Reminder** | `0 10 */1 * *` | `kyc_changing`  | `sendNotificationChangingKycEmail` | Every 1 day  |

## 🔧 **Admin API Endpoints**

```bash
# Manual triggers (Admin only)
POST /users/admin/kyc/trigger-check                 # Check submitted KYCs
POST /users/admin/kyc/trigger-reminder              # Remind pending_kyc users
POST /users/admin/kyc/trigger-changing-reminder     # Remind kyc_changing users

# Headers required:
Authorization: Bearer <admin-token>
```

## 📊 **User Status Flow**

```
ACTIVE → pending_kyc → KYC_SUBMITTED → ACTIVE (approved)
                    ↓
              kyc_changing (if changes needed)
                    ↓
              KYC_SUBMITTED (resubmitted)
```

## ⚡ **Email Logic Summary**

### pending_kyc (Every 2 days)

- **< 7 days**: Standard reminder
- **7-30 days**: Warning about delays
- **> 30 days**: Critical warning about account restrictions

### kyc_changing (Daily)

- **< 3 days**: Complete update request
- **3-7 days**: Service disruption warning
- **> 7 days**: Final warning - account lock risk

## 🛡️ **Safety Features**

- ✅ Preview mode for all scripts
- ✅ Rate limiting (100ms between emails)
- ✅ Detailed logging
- ✅ Error handling & rollback
- ✅ Batch processing for large datasets
- ✅ Manual admin triggers for testing

## 📈 **Monitoring**

- **Logs**: Check application logs for cron job execution
- **Stats**: JSON formatted statistics in logs
- **Manual Testing**: Use admin API endpoints
- **Preview**: Always test scripts before execution

---

_Quick access to all KYC system functionality_
