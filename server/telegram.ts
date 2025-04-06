import fetch from 'node-fetch';

// Get Telegram bot token from environment variable with fallback
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

// Send a notification to a Telegram chat
export async function sendTelegramNotification(chatId: string, message: string): Promise<boolean> {
  try {
    // Validate inputs
    if (!chatId || !message) {
      throw new Error('Chat ID and message are required');
    }

    // Make API request to Telegram
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result.ok === true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    throw error;
  }
}
