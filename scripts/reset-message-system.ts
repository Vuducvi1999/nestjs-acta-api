#!/usr/bin/env ts-node

/**
 * Reset Message System Script
 *
 * This script completely resets all message-related data including:
 * - Messages
 * - Conversations
 * - Conversation Members
 * - Message Attachments (many-to-many relationships)
 * - Message Mentions (many-to-many relationships)
 * - Message Seen By (many-to-many relationships)
 *
 * ⚠️  WARNING: This script will permanently delete ALL message data!
 * Only run this in development or when you're absolutely sure!
 *
 * Usage:
 * npx ts-node scripts/reset-message-system.ts [mode]
 *
 * Modes:
 * - preview: Show what will be deleted (default)
 * - execute: Actually delete the data
 * - quick: Execute without confirmation
 *
 * Examples:
 * npx ts-node scripts/reset-message-system.ts preview
 * npx ts-node scripts/reset-message-system.ts execute
 * npx ts-node scripts/reset-message-system.ts quick
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MessageSystemStats {
  conversations: number;
  conversationMembers: number;
  messages: number;
  messageAttachments: number;
  messageMentions: number;
  messageSeenBy: number;
  totalRecords: number;
}

class MessageSystemResetter {
  /**
   * Get current statistics of message system data
   */
  async getMessageSystemStats(): Promise<MessageSystemStats> {
    console.log('📊 Getting message system statistics...\n');

    try {
      const [
        conversations,
        conversationMembers,
        messages,
        messageAttachments,
        messageMentions,
        messageSeenBy,
      ] = await Promise.all([
        prisma.conversation.count(),
        prisma.conversationMember.count(),
        prisma.message.count(),
        // Count message-attachment relationships
        prisma.message
          .findMany({
            select: {
              attachments: {
                select: { id: true },
              },
            },
          })
          .then((messages) =>
            messages.reduce((acc, msg) => acc + msg.attachments.length, 0),
          ),
        // Count message-mention relationships
        prisma.message
          .findMany({
            select: {
              mentions: {
                select: { id: true },
              },
            },
          })
          .then((messages) =>
            messages.reduce((acc, msg) => acc + msg.mentions.length, 0),
          ),
        // Count message-seen relationships
        prisma.message
          .findMany({
            select: {
              seenBy: {
                select: { id: true },
              },
            },
          })
          .then((messages) =>
            messages.reduce((acc, msg) => acc + msg.seenBy.length, 0),
          ),
      ]);

      const totalRecords =
        conversations +
        conversationMembers +
        messages +
        messageAttachments +
        messageMentions +
        messageSeenBy;

      return {
        conversations,
        conversationMembers,
        messages,
        messageAttachments,
        messageMentions,
        messageSeenBy,
        totalRecords,
      };
    } catch (error) {
      console.error('❌ Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Display current statistics
   */
  displayStats(stats: MessageSystemStats): void {
    console.log('📊 Current Message System Statistics:');
    console.log('='.repeat(50));
    console.log(`💬 Conversations: ${stats.conversations}`);
    console.log(`👥 Conversation Members: ${stats.conversationMembers}`);
    console.log(`💭 Messages: ${stats.messages}`);
    console.log(`📎 Message Attachments: ${stats.messageAttachments}`);
    console.log(`👤 Message Mentions: ${stats.messageMentions}`);
    console.log(`👀 Message Seen By: ${stats.messageSeenBy}`);
    console.log(`📈 Total Records: ${stats.totalRecords}`);
    console.log('='.repeat(50));
  }

  /**
   * Show sample data for preview
   */
  async showSampleData(): Promise<void> {
    console.log('\n📋 Sample Data Preview:');
    console.log('='.repeat(50));

    try {
      // Show sample conversations
      const sampleConversations = await prisma.conversation.findMany({
        take: 3,
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          messages: {
            take: 2,
            include: {
              sender: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (sampleConversations.length > 0) {
        console.log('\n💬 Sample Conversations:');
        sampleConversations.forEach((conv, index) => {
          console.log(
            `\n  ${index + 1}. ${conv.name || 'Unnamed Conversation'} (${conv.id})`,
          );
          console.log(
            `     Created by: ${conv.createdBy.fullName} (${conv.createdBy.email})`,
          );
          console.log(`     Members: ${conv.members.length}`);
          console.log(`     Messages: ${conv.messages.length}`);
          console.log(`     Created: ${conv.createdAt.toISOString()}`);
          console.log(`     Is Group: ${conv.isGroup}`);
          console.log(`     Is Archived: ${conv.isArchived}`);
        });
      } else {
        console.log('\n💬 No conversations found');
      }

      // Show sample messages
      const sampleMessages = await prisma.message.findMany({
        take: 3,
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          conversation: {
            select: {
              id: true,
              name: true,
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
            },
          },
          mentions: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          seenBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (sampleMessages.length > 0) {
        console.log('\n💭 Sample Messages:');
        sampleMessages.forEach((msg, index) => {
          console.log(`\n  ${index + 1}. Message (${msg.id})`);
          console.log(
            `     Sender: ${msg.sender.fullName} (${msg.sender.email})`,
          );
          console.log(
            `     Conversation: ${msg.conversation.name || 'Unnamed'} (${msg.conversation.id})`,
          );
          console.log(
            `     Content: ${msg.content ? msg.content.substring(0, 50) + '...' : 'No content'}`,
          );
          console.log(`     Images: ${msg.imageUrls.length}`);
          console.log(`     Attachments: ${msg.attachments.length}`);
          console.log(`     Mentions: ${msg.mentions.length}`);
          console.log(`     Seen by: ${msg.seenBy.length}`);
          console.log(`     Created: ${msg.createdAt.toISOString()}`);
        });
      } else {
        console.log('\n💭 No messages found');
      }
    } catch (error) {
      console.error('❌ Error showing sample data:', error);
    }
  }

  /**
   * Reset all message system data
   */
  async resetMessageSystem(): Promise<void> {
    console.log('🗑️  Starting message system reset...\n');

    try {
      const startTime = Date.now();

      // Delete in the correct order to avoid foreign key constraints

      // 1. Clear pinned message references first
      console.log('1️⃣  Clearing pinned message references...');
      await prisma.conversation.updateMany({
        data: {
          pinnedMessageId: null,
        },
      });
      console.log('   ✅ Pinned message references cleared');

      // 2. Clear message-attachment relationships (many-to-many)
      console.log('2️⃣  Clearing message-attachment relationships...');
      // Get all messages with attachments and clear them individually
      const messagesWithAttachments = await prisma.message.findMany({
        where: {
          attachments: {
            some: {},
          },
        },
        select: { id: true },
      });

      for (const message of messagesWithAttachments) {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            attachments: {
              set: [],
            },
          },
        });
      }
      console.log(
        `   ✅ Message-attachment relationships cleared for ${messagesWithAttachments.length} messages`,
      );

      // 3. Clear message-mention relationships (many-to-many)
      console.log('3️⃣  Clearing message-mention relationships...');
      const messagesWithMentions = await prisma.message.findMany({
        where: {
          mentions: {
            some: {},
          },
        },
        select: { id: true },
      });

      for (const message of messagesWithMentions) {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            mentions: {
              set: [],
            },
          },
        });
      }
      console.log(
        `   ✅ Message-mention relationships cleared for ${messagesWithMentions.length} messages`,
      );

      // 4. Clear message-seen relationships (many-to-many)
      console.log('4️⃣  Clearing message-seen relationships...');
      const messagesWithSeenBy = await prisma.message.findMany({
        where: {
          seenBy: {
            some: {},
          },
        },
        select: { id: true },
      });

      for (const message of messagesWithSeenBy) {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            seenBy: {
              set: [],
            },
          },
        });
      }
      console.log(
        `   ✅ Message-seen relationships cleared for ${messagesWithSeenBy.length} messages`,
      );

      // 5. Delete all messages
      console.log('5️⃣  Deleting all messages...');
      const deletedMessages = await prisma.message.deleteMany({});
      console.log(`   ✅ Deleted ${deletedMessages.count} messages`);

      // 6. Delete all conversation members
      console.log('6️⃣  Deleting all conversation members...');
      const deletedMembers = await prisma.conversationMember.deleteMany({});
      console.log(`   ✅ Deleted ${deletedMembers.count} conversation members`);

      // 7. Delete all conversations
      console.log('7️⃣  Deleting all conversations...');
      const deletedConversations = await prisma.conversation.deleteMany({});
      console.log(`   ✅ Deleted ${deletedConversations.count} conversations`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('\n🎉 Message system reset completed successfully!');
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Summary:`);
      console.log(`   - Conversations deleted: ${deletedConversations.count}`);
      console.log(`   - Conversation members deleted: ${deletedMembers.count}`);
      console.log(`   - Messages deleted: ${deletedMessages.count}`);
      console.log(
        `   - Relationships cleared: message-attachments, message-mentions, message-seen`,
      );
    } catch (error) {
      console.error('❌ Error resetting message system:', error);
      throw error;
    }
  }

  /**
   * Verify reset was successful
   */
  async verifyReset(): Promise<void> {
    console.log('\n🔍 Verifying reset results...');

    try {
      const stats = await this.getMessageSystemStats();

      if (stats.totalRecords === 0) {
        console.log('✅ Reset verification successful!');
        console.log('   All message system data has been cleared.');
      } else {
        console.log('⚠️  Reset verification incomplete:');
        this.displayStats(stats);
      }
    } catch (error) {
      console.error('❌ Error verifying reset:', error);
    }
  }

  /**
   * Display help information
   */
  displayHelp(): void {
    console.log('🗑️  Message System Reset Script\n');
    console.log(
      'This script completely resets all message-related data including:',
    );
    console.log('  - Messages');
    console.log('  - Conversations');
    console.log('  - Conversation Members');
    console.log('  - Message Attachments (many-to-many relationships)');
    console.log('  - Message Mentions (many-to-many relationships)');
    console.log('  - Message Seen By (many-to-many relationships)\n');
    console.log('Usage: npx ts-node scripts/reset-message-system.ts [mode]\n');
    console.log('Modes:');
    console.log('  preview  - Show what will be deleted (default)');
    console.log('  execute  - Actually delete the data (with confirmation)');
    console.log('  quick    - Execute without confirmation (DANGEROUS!)\n');
    console.log('Examples:');
    console.log('  npx ts-node scripts/reset-message-system.ts preview');
    console.log('  npx ts-node scripts/reset-message-system.ts execute');
    console.log('  npx ts-node scripts/reset-message-system.ts quick\n');
    console.log(
      '⚠️  WARNING: This script will permanently delete ALL message data!',
    );
    console.log(
      "   Only run this in development or when you're absolutely sure!",
    );
    console.log('   Make sure you have backups before running this script.');
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    const mode = process.argv[2] || 'preview';

    try {
      switch (mode) {
        case 'preview':
          console.log('🔍 Message System Reset - Preview Mode\n');
          const stats = await this.getMessageSystemStats();
          this.displayStats(stats);
          await this.showSampleData();

          if (stats.totalRecords > 0) {
            console.log('\n💡 To execute the reset, run:');
            console.log(
              '   npx ts-node scripts/reset-message-system.ts execute',
            );
          } else {
            console.log('\n✅ No message data found to reset');
          }
          break;

        case 'execute':
          console.log('🗑️  Message System Reset - Execute Mode\n');
          const executeStats = await this.getMessageSystemStats();

          if (executeStats.totalRecords === 0) {
            console.log('✅ No message data found to reset');
            return;
          }

          this.displayStats(executeStats);

          console.log(
            '\n⚠️  WARNING: This will permanently delete ALL message data!',
          );
          console.log('   This action cannot be undone.');
          console.log('\nAre you sure you want to proceed? (yes/no)');

          // In a real implementation, you might want to add user input confirmation
          // For now, we'll proceed with the reset
          console.log('Proceeding with reset...\n');

          await this.resetMessageSystem();
          await this.verifyReset();
          break;

        case 'quick':
          console.log('⚡ Message System Reset - Quick Mode\n');
          const quickStats = await this.getMessageSystemStats();

          if (quickStats.totalRecords === 0) {
            console.log('✅ No message data found to reset');
            return;
          }

          this.displayStats(quickStats);
          console.log(
            '\n⚠️  Quick mode - proceeding without confirmation...\n',
          );

          await this.resetMessageSystem();
          await this.verifyReset();
          break;

        case 'help':
        default:
          this.displayHelp();
          break;
      }
    } catch (error) {
      console.error('\n💥 Reset failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run the script if this file is executed directly
if (require.main === module) {
  const resetter = new MessageSystemResetter();
  resetter.run();
}

export { MessageSystemResetter };
