require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http'); 

const token = process.env.TELEGRAM_BOT_TOKEN;
const myTelegramId = parseInt(process.env.MY_TELEGRAM_ID, 10);
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!token || !geminiApiKey) {
    console.error("XATO: Token yoki Gemini API kalit topilmadi!");
    process.exit(1);
}

const bot = new Telegraf(token);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// --- AI SHAXSIYATI (Persona) ---
const model = genAI.getGenerativeModel({ 
    model: "gemini-3.6-flash",
    systemInstruction: "Sen Humoyunning shaxsiy AI agenti va marketing bo'yicha yordamchisisan. Asosiy vazifang — o'quv markazlari va ta'lim loyihalari uchun ijtimoiy tarmoqlarga qisqa, jozibali postlar yozish, Instagram Reels uchun kreativ skriptlar tuzish, shuningdek matnlar va dizayn g'oyalarini tahlil qilish. Javoblaring aniq, ijodiy va zamonaviy marketing uslubida bo'lishi kerak. Har doim o'zbek tilida, kerakli emojilar bilan javob ber."
}); 

// --- RENDER UCHUN DUMMY SERVER ---
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('XumoAI Super Bot ishlamoqda!');
    res.end();
}).listen(port, () => console.log(`Render server port ${port} da ishga tushdi.`));

// --- XAVFSIZLIK QATLAMI ---
bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id === myTelegramId) {
        return next();
    } else {
        return ctx.reply("🔒 Kechirasiz, men faqat Humoyunga xizmat qilaman.");
    }
});

bot.start((ctx) => ctx.reply('🤖 Salom! Men endi rasmlarni ko\'raman, ovozli xabarlarni eshitaman va postlar yozib beraman. Qanday topshiriq bor?'));

// --- BARCHA XABARLARNI USHLAB OLISH (Matn, Rasm, Ovoz) ---
bot.on('message', async (ctx) => {
    // Agar foydalanuvchi faqat stiker yoki boshqa format yuborsa xato bermasligi uchun tekshiramiz
    if (!ctx.message.text && !ctx.message.photo && !ctx.message.voice) return;

    const loadingMsg = await ctx.reply("⏳ Ishlayapman...");

    try {
        const promptParts = [];
        
        // Matn yoki rasm/ovoz ostidagi yozuvni olish
        let text = ctx.message.text || ctx.message.caption || "Ushbu faylni tahlil qilib, fikringni bildir.";
        promptParts.push(text);

        // 1. Agar rasm yuborilgan bo'lsa
        if (ctx.message.photo) {
            const photo = ctx.message.photo.pop(); // Eng sifatli versiyasini ajratib olish
            const fileLink = await ctx.telegram.getFileLink(photo.file_id);
            const response = await fetch(fileLink.href);
            const buffer = await response.arrayBuffer();
            promptParts.push({
                inlineData: { data: Buffer.from(buffer).toString("base64"), mimeType: "image/jpeg" }
            });
        }

        // 2. Agar ovozli xabar (voice) yuborilgan bo'lsa
        if (ctx.message.voice) {
            const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const response = await fetch(fileLink.href);
            const buffer = await response.arrayBuffer();
            promptParts.push({
                inlineData: { data: Buffer.from(buffer).toString("base64"), mimeType: "audio/ogg" }
            });
        }

        // Gemini'ga barcha ma'lumotlarni yuborish
        const result = await model.generateContent(promptParts);
        const response = await result.response;
        const replyText = response.text();

        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, replyText);
        
    } catch (error) {
        console.error("API Xatolik:", error.message);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, "❌ Faylni o'qishda xatolik yuz berdi. Boshqadan urinib ko'ring.");
    }
});

bot.launch();
console.log('🤖 XumoAI Super Bot bulutli serverda ishga tushdi!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
