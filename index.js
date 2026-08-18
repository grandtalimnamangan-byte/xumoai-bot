require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http');

// ==================== KONFIGURATSIYA ====================
const token = process.env.TELEGRAM_BOT_TOKEN;
const myTelegramId = parseInt(process.env.MY_TELEGRAM_ID, 10);
const geminiApiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const ENABLE_SEARCH = process.env.ENABLE_SEARCH !== 'false'; // xato bersa Render'da 'false' qo'ying

if (!token || !geminiApiKey || !myTelegramId) {
    console.error('XATO: TELEGRAM_BOT_TOKEN / GEMINI_API_KEY / MY_TELEGRAM_ID topilmadi!');
    process.exit(1);
}

const bot = new Telegraf(token);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// ==================== AI SHAXSIYATI ====================
const systemInstruction = `Sen Humoyunning shaxsiy AI agenti va bosh yordamchisisan. Isming — XumoAI. Unga har doim "Humoyun" deb murojaat qil.

QAMROV: Sen universal yordamchisan. Har qanday sohadagi savolga javob berasan — dunyoviy bilimlar, din, matematika va hisob-kitob, tibbiyot, texnologiya, tarix, huquq, biznes.

IXTISOSLASHGAN SOHALARING:
1. Ta'lim tashkilotlari uchun marketing strategiyalari, SMM rejalari, kopirayterlik, Instagram/Telegram postlar.
2. Reels/Shorts uchun kreativ skriptlar, ilgaklar (hooks) va kadrlar.
3. Prompt muhandisligi (Midjourney, DALL-E, Google Veo, Imagen).
4. Ingliz va Arab tillari — tarjima, grammatika, o'quv materiallari tahriri.
5. Vektor grafikasi va web-layoutlar (HTML/Tailwind).

JAVOB BERISH QOIDALARI:
- Hech qachon ma'lumot to'qib chiqarma. Aniq bilmasang — "aniq bilmayman" deb ayt.
- Savolni javobsiz qoldirma: nima ma'lum ekanini ayt, keyin aniq takliflar ber — qayerdan qidirish, kimga murojaat qilish, savolni qanday aniqlashtirish kerak.
- Hisob-kitobni bosqichma-bosqich yech va natijani tekshirib chiq.
- TIBBIYOT: umumiy ma'lumot ber, lekin tashxis qo'yma va dori tayinlama. Shifokorga murojaat qilishni tavsiya qil. Xavfli belgilar bo'lsa — darhol tez yordamga murojaat qilishni ayt.
- DIN: ishonchli manbalarga tayanib ma'lumot ber, turli mazhab va qarashlar bo'lsa ularni ko'rsat. Fatvo talab qiladigan shaxsiy masalalarda — mahalliy olim yoki imomga murojaat qilishni tavsiya qil.
- Humoyun xato qilsa yoki g'oyasida kamchilik ko'rsang — ochiq ayt, shunchaki maqtama.

USLUB: professional, ijodiy, aniq va qisqa. O'zbek tilida (zarurat bo'lsa ingliz/arab tillarida). O'rinli emojilardan foydalan.`;

const modelConfig = { model: MODEL, systemInstruction };
if (ENABLE_SEARCH) modelConfig.tools = [{ googleSearch: {} }];

const model = genAI.getGenerativeModel(modelConfig);
const modelNoTools = genAI.getGenerativeModel({ model: MODEL, systemInstruction }); // zaxira

// ==================== XOTIRA ====================
const chatHistory = new Map();
const MAX_HISTORY = 20; // 10 juft savol-javob

// ==================== RENDER SERVER + UYQUGA QARSHI ====================
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XumoAI Bot ishlamoqda!');
}).listen(port, () => console.log(`Render server port ${port} da ishga tushdi.`));

const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl) {
    setInterval(() => { fetch(selfUrl).catch(() => {}); }, 14 * 60 * 1000);
}

// ==================== XAVFSIZLIK ====================
bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id === myTelegramId) return next();
    return ctx.reply("🔒 Kechirasiz, men faqat o'z egamga (Humoyunga) xizmat qilaman.");
});

// ==================== YORDAMCHILAR ====================
const TG_LIMIT = 4000;

async function sendLongReply(ctx, loadingMsgId, text) {
    const chunks = [];
    for (let i = 0; i < text.length; i += TG_LIMIT) chunks.push(text.slice(i, i + TG_LIMIT));
    if (chunks.length === 0) chunks.push("(bo'sh javob)");

    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsgId, undefined, chunks[0]);
    for (const chunk of chunks.slice(1)) await ctx.reply(chunk);
}

async function fileToPart(ctx, fileId, mimeType) {
    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    const buffer = await res.arrayBuffer();
    return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType } };
}

// ==================== KOMANDALAR ====================
bot.start((ctx) => {
    chatHistory.set(ctx.chat.id, []);
    ctx.reply("🤖 Salom Humoyun! Men XumoAI — sizning universal yordamchingizman.\n\n✅ Xotira faol\n✅ Rasm, ovoz va hujjat tahlili\n\n/clear — xotirani tozalash\n/status — holat");
});

bot.command('clear', (ctx) => {
    chatHistory.set(ctx.chat.id, []);
    ctx.reply('🧹 Xotira tozalandi, Humoyun.');
});

bot.command('status', (ctx) => {
    const len = (chatHistory.get(ctx.chat.id) || []).length;
    ctx.reply(`⚙️ Model: ${MODEL}\n🧠 Xotirada: ${len / 2} ta savol-javob\n🌐 Qidiruv: ${ENABLE_SEARCH ? 'yoqilgan' : "o'chirilgan"}`);
});

// ==================== ASOSIY ISHLOVCHI ====================
bot.on('message', async (ctx) => {
    const m = ctx.message;
    if (!m.text && !m.photo && !m.voice && !m.audio && !m.document) return;

    const loadingMsg = await ctx.reply('⏳ Tahlil qilyapman...');

    try {
        const history = chatHistory.get(ctx.chat.id) || [];
        const text = m.text || m.caption || "Ushbu faylni batafsil tahlil qilib, xulosa va g'oyalaringni yozib ber.";
        const parts = [{ text }];
        let mediaNote = '';

        if (m.photo) {
            const photo = m.photo[m.photo.length - 1];
            parts.push(await fileToPart(ctx, photo.file_id, 'image/jpeg'));
            mediaNote = ' [rasm yuborilgan]';
        }

        if (m.voice) {
            parts.push(await fileToPart(ctx, m.voice.file_id, 'audio/ogg'));
            mediaNote = ' [ovozli xabar yuborilgan]';
        }

        if (m.audio) {
            parts.push(await fileToPart(ctx, m.audio.file_id, m.audio.mime_type || 'audio/mpeg'));
            mediaNote = ' [audio yuborilgan]';
        }

        if (m.document) {
            const mime = m.document.mime_type || '';
            const supported = ['application/pdf', 'text/plain', 'text/csv', 'text/markdown'];
            if (supported.includes(mime) && m.document.file_size < 15 * 1024 * 1024) {
                parts.push(await fileToPart(ctx, m.document.file_id, mime));
                mediaNote = ' [hujjat yuborilgan]';
            } else {
                await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
                    `⚠️ Bu format hozircha qo'llab-quvvatlanmaydi (${mime || "noma'lum"}). PDF, TXT yoki CSV yuboring.`);
                return;
            }
        }

        const request = { contents: [...history, { role: 'user', parts }] };

        let replyText;
        try {
            const result = await model.generateContent(request);
            replyText = result.response.text();
        } catch (searchErr) {
            // Qidiruv vositasi qo'llab-quvvatlanmasa — vositasiz qayta urinamiz
            console.warn("Tools bilan xato, zaxiraga o'tildi:", searchErr.message);
            const result = await modelNoTools.generateContent(request);
            replyText = result.response.text();
        }

        if (!replyText) replyText = "Javob bo'sh qaytdi. Savolni boshqacha shaklda bering.";

        // Xotiraga faqat matn saqlanadi (base64 fayllar xotirani to'ldirmasligi uchun)
        const newHistory = [
            ...history,
            { role: 'user', parts: [{ text: text + mediaNote }] },
            { role: 'model', parts: [{ text: replyText }] },
        ];
        chatHistory.set(ctx.chat.id, newHistory.slice(-MAX_HISTORY));

        await sendLongReply(ctx, loadingMsg.message_id, replyText);

    } catch (error) {
        console.error('API Xatolik:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `❌ Xatolik: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== ISHGA TUSHIRISH ====================
bot.launch().then(() => console.log('🤖 XumoAI Bot ishga tushdi!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
