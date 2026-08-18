require('dotenv').config();
const { Telegraf } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');

// Render'dan muhit o'zgaruvchilarini qabul qilish
const token = process.env.TELEGRAM_BOT_TOKEN;
const myTelegramId = parseInt(process.env.MY_TELEGRAM_ID, 10);
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!token || !anthropicApiKey) {
    console.error("XATO: Token yoki API kalit topilmadi!");
    process.exit(1);
}

const bot = new Telegraf(token);
const anthropic = new Anthropic({ apiKey: anthropicApiKey });

// --- XAVFSIZLIK QATLAMI ---
bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id === myTelegramId) {
        return next();
    } else {
        console.log(`Begona kirish: ${ctx.from?.id}`);
        return ctx.reply("🔒 Kechirasiz, men faqat Ihlasuddinga xizmat qilaman.");
    }
});
// --------------------------

bot.start((ctx) => ctx.reply('🤖 Salom! XumoAI agentingiz 24/7 rejimda ishga tushdi.'));

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const loadingMsg = await ctx.reply("⏳ O'ylayapman...");

    try {
        const msgResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620", 
            max_tokens: 1024,
            messages: [{ role: "user", content: text }],
            system: "Sen mening shaxsiy AI agentimsan. Isming - XumoAI. Qisqa, aniq va foydali javob ber."
        });

        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, msgResponse.content[0].text);
        
    } catch (error) {
        console.error("Xatolik:", error.message);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, "❌ Xatolik yuz berdi.");
    }
});

bot.launch();
console.log('🤖 XumoAI bot bulutli serverda ishga tushdi!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
