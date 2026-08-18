require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const token = process.env.TELEGRAM_BOT_TOKEN;
const myTelegramId = parseInt(process.env.MY_TELEGRAM_ID, 10);
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!token || !geminiApiKey) {
    console.error("XATO: Token yoki Gemini API kalit topilmadi!");
    process.exit(1);
}

const bot = new Telegraf(token);
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

bot.start((ctx) => ctx.reply('🤖 Salom! XumoAI agentingiz (Gemini) 24/7 rejimda ishga tushdi. Menga istalgan topshiriqni bering!'));

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const loadingMsg = await ctx.reply("⏳ O'ylayapman...");

    try {
        const prompt = `Sen mening shaxsiy AI agentimsan. Isming - XumoAI. Qisqa, aniq va foydali javob ber. Savol: ${text}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const replyText = response.text();

        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, replyText);
        
    } catch (error) {
        console.error("API Xatolik:", error.message);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, "❌ Xatolik yuz berdi. API ulanishini tekshiring.");
    }
});

bot.launch();
console.log('🤖 XumoAI (Gemini) bot bulutli serverda ishga tushdi!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
