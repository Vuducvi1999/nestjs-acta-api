# Message System Reset Script

This script completely resets all message-related data in the database. **This is for DEVELOPMENT USE ONLY!**

## ⚠️ WARNING

This script will **permanently delete** all message data from the database including:

- Messages
- Conversations
- Conversation Members
- Message Attachments (many-to-many relationships)
- Message Mentions (many-to-many relationships)
- Message Seen By (many-to-many relationships)

Make sure you have backups before running this script.

## Installation

The script uses existing dependencies. No additional installation required.

## Usage

### Preview Mode (Default)

```bash
# Using npm script
npm run reset:message-system:preview

# Using ts-node directly
ts-node scripts/reset-message-system.ts preview

# Example
npm run reset:message-system:preview
```

This will show:

- Current statistics of message data
- Sample conversations and messages
- What will be deleted
- Instructions for execution

### Execute Mode (With Confirmation)

```bash
# Using npm script
npm run reset:message-system:execute

# Using ts-node directly
ts-node scripts/reset-message-system.ts execute

# Example
npm run reset:message-system:execute
```

This will:

- Show current statistics
- Display warning messages
- Ask for confirmation
- Execute the reset if confirmed
- Verify the reset was successful

### Quick Mode (No Confirmation)

```bash
# Using npm script
npm run reset:message-system:quick

# Using ts-node directly
ts-node scripts/reset-message-system.ts quick

# Example
npm run reset:message-system:quick
```

**⚠️ DANGEROUS!** This mode executes without any confirmation prompts.

## What gets deleted

When you reset the message system, the following data is deleted in this order:

1. **Pinned Message References** - All pinned message references in conversations
2. **Message-Attachment Relationships** - All many-to-many relationships between messages and attachments
3. **Message-Mention Relationships** - All many-to-many relationships between messages and mentioned users
4. **Message-Seen Relationships** - All many-to-many relationships between messages and users who saw them
5. **Messages** - All message records
6. **Conversation Members** - All conversation member records
7. **Conversations** - All conversation records

## Examples

### Preview current message data

```bash
npm run reset:message-system:preview
```

Output example:

```
🔍 Message System Reset - Preview Mode

📊 Getting message system statistics...

📊 Current Message System Statistics:
==================================================
💬 Conversations: 15
👥 Conversation Members: 45
💭 Messages: 234
📎 Message Attachments: 12
👤 Message Mentions: 8
👀 Message Seen By: 156
📈 Total Records: 470
==================================================

📋 Sample Data Preview:
==================================================

💬 Sample Conversations:
  1. Team Chat (abc123)
     Created by: John Doe (john@example.com)
     Members: 5
     Messages: 12
     Created: 2024-01-15T10:30:00Z
     Is Group: true
     Is Archived: false

💭 Sample Messages:
  1. Message (def456)
     Sender: Jane Smith (jane@example.com)
     Conversation: Team Chat (abc123)
     Content: Hello everyone! How's the project going...
     Images: 0
     Attachments: 1
     Mentions: 2
     Seen by: 4
     Created: 2024-01-15T11:00:00Z

💡 To execute the reset, run:
   npx ts-node scripts/reset-message-system.ts execute
```

### Execute the reset

```bash
npm run reset:message-system:execute
```

Output example:

```
🗑️  Message System Reset - Execute Mode

📊 Current Message System Statistics:
==================================================
💬 Conversations: 15
👥 Conversation Members: 45
💭 Messages: 234
📎 Message Attachments: 12
👤 Message Mentions: 8
👀 Message Seen By: 156
📈 Total Records: 470
==================================================

⚠️  WARNING: This will permanently delete ALL message data!
   This action cannot be undone.

Are you sure you want to proceed? (yes/no)
Proceeding with reset...

🗑️  Starting message system reset...

1️⃣  Clearing message-attachment relationships...
   ✅ Message-attachment relationships cleared

2️⃣  Clearing message-mention relationships...
   ✅ Message-mention relationships cleared

3️⃣  Clearing message-seen relationships...
   ✅ Message-seen relationships cleared

4️⃣  Clearing pinned message references...
   ✅ Pinned message references cleared

5️⃣  Deleting all messages...
   ✅ Deleted 234 messages

6️⃣  Deleting all conversation members...
   ✅ Deleted 45 conversation members

7️⃣  Deleting all conversations...
   ✅ Deleted 15 conversations

🎉 Message system reset completed successfully!
⏱️  Duration: 1250ms
📊 Summary:
   - Conversations deleted: 15
   - Conversation members deleted: 45
   - Messages deleted: 234
   - Relationships cleared: message-attachments, message-mentions, message-seen

🔍 Verifying reset results...

✅ Reset verification successful!
   All message system data has been cleared.
```

## Safety Features

- ✅ Preview mode for all operations
- ✅ Detailed statistics before deletion
- ✅ Sample data preview
- ✅ Confirmation prompts (in execute mode)
- ✅ Proper deletion order to avoid foreign key constraints
- ✅ Verification after reset
- ✅ Detailed logging of all operations
- ✅ Error handling and rollback information

## Troubleshooting

### Error: "Foreign key constraint"

- The script handles foreign key constraints by deleting in the correct order
- If you still get this error, there might be additional relationships not covered

### Error: "Permission denied"

- Make sure you have database access
- Check your database connection settings

### Script runs but data still exists

- Check if there are any transactions that haven't been committed
- Verify you're connected to the correct database
- Check for any triggers or constraints that might be preventing deletion

## Development Notes

This script is designed for development use when:

- You need to clean up test message data
- You want to reset the messaging system for testing
- You're debugging message-related issues
- You want to start fresh with the messaging system

**Never use this script in production!**

## Related Scripts

- `undo-checkout.ts` - Reset checkout/order data
- `backfill-avatar-urls.ts` - Update avatar URLs
- `update-user-status-to-pending-kyc.ts` - Update user KYC status

## Database Schema

The script works with these Prisma models:

```prisma
model Conversation {
  id            String    @id @default(uuid())
  name          String?
  imageUrl      String?
  isGroup       Boolean   @default(false)
  isArchived    Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastMessageAt DateTime?

  members ConversationMember[]
  messages Message[]
  pinnedMessageId String?  @unique
  pinnedMessage   Message? @relation("PinnedMessage")
  createdById String
  createdBy   User   @relation("CreatedConversations")
}

model ConversationMember {
  id        String     @id @default(uuid())
  role      MemberRole @default(MEMBER)
  joinedAt  DateTime   @default(now())
  isMuted   Boolean    @default(false)
  isRemoved Boolean    @default(false)
  isTyping  Boolean    @default(false)
  isHidden  Boolean    @default(false)

  conversationId String
  userId         String
  user         User         @relation
  conversation Conversation @relation
}

model Message {
  id        String   @id @default(uuid())
  content   String?
  imageUrls String[] @default([])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  mentions User[] @relation("MentionedInMessages")
  attachments Attachment[] @relation("MessageAttachments")
  seenBy User[] @relation("SeenMessages")
  pinnedInConversation Conversation? @relation("PinnedMessage")

  conversationId String
  conversation   Conversation @relation
  senderId String
  sender   User   @relation("MessagesSent")
}
```

---

_Last updated: $(date)_
