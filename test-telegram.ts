import { sendTelegramNotification } from './server/telegram';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Simple script to test Telegram notifications
 * To use:
 * 1. Start a chat with your bot on Telegram
 * 2. Run this script with a chat ID
 * 3. If successful, you should receive a test message
 */
async function testTelegramNotification(chatId: string) {
  console.log('Testing Telegram notification...');
  console.log(`Using bot token: ${TELEGRAM_BOT_TOKEN?.substring(0, 5)}...${TELEGRAM_BOT_TOKEN?.substring(TELEGRAM_BOT_TOKEN.length - 4)}`);
  console.log(`Sending to chat ID: ${chatId}`);
  
  try {
    const success = await sendTelegramNotification(chatId, '🔄 Test notification from PriceSync!');
    
    if (success) {
      console.log('✅ Notification sent successfully!');
    } else {
      console.log('❌ Failed to send notification.');
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Get chat ID from command line arguments
const chatId = process.argv[2];

if (!chatId) {
  console.log('Usage: npx tsx test-telegram.ts <chat_id>');
  console.log('');
  console.log('To get your Telegram Chat ID:');
  console.log('1. Start a chat with @userinfobot on Telegram');
  console.log('2. The bot will reply with your Chat ID');
  console.log('3. Run this script with that ID');
  process.exit(1);
}

testTelegramNotification(chatId);