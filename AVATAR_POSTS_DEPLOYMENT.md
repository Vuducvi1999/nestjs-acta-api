# Avatar Posts Feature Deployment Guide

This guide covers deploying the avatar posts feature to production.

## 🚀 Pre-Deployment Checklist

### 1. Database Schema
Ensure your database has the latest schema with all required fields:
```bash
npx prisma db push
# or
npx prisma migrate deploy
```

### 2. Environment Variables
No new environment variables are required for this feature.

### 3. Dependencies
All required dependencies are already in package.json.

## 📦 Deployment Steps

### Step 1: Deploy Code
Deploy your updated codebase with the avatar posts feature to production.

### Step 2: Run User Config Migration
**IMPORTANT**: Run this migration ONCE after deploying the code:

```bash
# Option 1: Using npm script
npm run migrate:user-config

# Option 2: Direct execution
npx ts-node scripts/migrate-user-config.ts
```

### Step 3: Verify Migration
The migration script will automatically validate the results, but you can also check manually:

```sql
-- Check users with avatar_posts config
SELECT 
  u.id,
  u."fullName",
  uc.config->'avatar_posts' as avatar_posts_config
FROM users u
LEFT JOIN user_configs uc ON u.id = uc."userId"
WHERE uc.config ? 'avatar_posts';

-- Count users with/without config
SELECT 
  COUNT(*) as total_users,
  COUNT(uc.id) as users_with_config,
  COUNT(*) - COUNT(uc.id) as users_without_config
FROM users u
LEFT JOIN user_configs uc ON u.id = uc."userId";
```

## 🔧 Migration Details

### What the Migration Does
1. **Existing Users with Config**: Adds `avatar_posts` configuration to existing user configs
2. **Users without Config**: Creates complete user config with all default settings
3. **Batch Processing**: Processes users in batches of 50 to avoid database overload
4. **Error Handling**: Continues processing even if individual users fail
5. **Validation**: Automatically validates migration results

### Default Avatar Posts Configuration
```json
{
  "enabled": true,
  "postType": "simple",
  "autoPublish": true,
  "customMessage": null,
  "notifyFollowers": true,
  "includeComparison": false
}
```

### Complete Default User Config
```json
{
  "language": "vi",
  "avatar_posts": { /* avatar posts config */ },
  "payment_methods": [],
  "profile_privacy": "private",
  "security_settings": { "twoFA": false },
  "email_subscription": true,
  "shipping_preferences": {},
  "information_publicity": "private",
  "notification_settings": { "sms": true, "push": true }
}
```

## 🧪 Post-Deployment Testing

### 1. Test Avatar Update Flow
1. Login as a test user
2. Update avatar through the API or frontend
3. Verify automatic post creation
4. Check post content and settings

### 2. Test Configuration UI
1. Open user profile modal
2. Navigate to Settings tab
3. Verify "Bài viết ảnh đại diện" section appears
4. Test all configuration options
5. Save changes and verify they persist

### 3. Test API Endpoints
```bash
# Test avatar update
curl -X PATCH http://your-domain/users/update-avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avatarUrl": "https://example.com/new-avatar.jpg"}'

# Test config update
curl -X PUT http://your-domain/users-config/avatar_posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

## 📊 Monitoring

### Application Logs
Monitor for these log messages:
- ✅ `Avatar post created successfully for user {userId}: {postId}`
- ⚠️ `Avatar post skipped for user {userId}: {reason}`
- ❌ `Failed to create avatar post for user {userId}: {error}`

### Database Monitoring
- Monitor `posts` table for new avatar-related posts
- Check `user_configs` table for proper configuration updates
- Watch for any database errors related to avatar updates

## 🔄 Rollback Plan

If issues occur, you can disable the feature:

### 1. Disable Globally
Update `AVATAR_POST_CONSTANTS.ENABLED` to `false` in:
`src/users/constants/avatar-post.constants.ts`

### 2. Disable for Specific Users
```sql
UPDATE user_configs 
SET config = jsonb_set(config, '{avatar_posts,enabled}', 'false')
WHERE "userId" = 'USER_ID';
```

### 3. Disable for All Users
```sql
UPDATE user_configs 
SET config = jsonb_set(config, '{avatar_posts,enabled}', 'false')
WHERE config ? 'avatar_posts';
```

## 🎯 Success Criteria

✅ Migration completes without errors  
✅ All users have avatar_posts configuration  
✅ Avatar updates create posts automatically  
✅ Users can configure settings through UI  
✅ No performance degradation  
✅ Application logs show successful operations  

## 🆘 Troubleshooting

### Migration Fails
- Check database connectivity
- Verify Prisma schema is up to date
- Check for any database constraints
- Review error logs for specific issues

### Posts Not Created
- Check `AVATAR_POST_CONSTANTS.ENABLED` setting
- Verify user has `enabled: true` in their config
- Check rate limiting (5 posts/day, 30min interval)
- Review application logs for errors

### UI Not Showing
- Verify frontend deployment includes updated files
- Check browser cache (hard refresh)
- Verify API endpoints are accessible
- Check for JavaScript errors in browser console

## 📞 Support

If you encounter issues during deployment:
1. Check application logs
2. Review this deployment guide
3. Test with a single user first
4. Contact development team if needed

---

**Remember**: Run the migration script only ONCE per environment!
