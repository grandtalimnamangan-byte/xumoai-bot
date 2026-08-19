// ============================================================
//  JARVIS — Shaxsiy AI assistent (Telegram)
//  Telegraf + Google Gemini + Supabase
// ============================================================

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

// ==================== KONFIGURATSIYA ====================
const token = process.env.TELEGRAM_BOT_TOKEN;
const myTelegramId = parseInt(process.env.MY_TELEGRAM_ID, 10);
const geminiApiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const ENABLE_SEARCH = process.env.ENABLE_SEARCH !== 'false';
const SHOW_CODE = process.env.SHOW_CODE === 'true';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

if (!token || !geminiApiKey || !myTelegramId) {
    console.error('XATO: TELEGRAM_BOT_TOKEN / GEMINI_API_KEY / MY_TELEGRAM_ID topilmadi!');
    process.exit(1);
}

const bot = new Telegraf(token);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// ==================== SUPABASE ====================
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY)
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } })
    : null;

console.log(supabase ? '💾 Supabase ulandi — xotira doimiy.' : "⚠️ Supabase yo'q — xotira faqat RAM da.");

// ==================== UMUMIY FORMATLASH QOIDASI ====================
const FORMAT_RULES = `FORMATLASH (Telegram uchun muhim):
- Faqat **qalin**, *kursiv*, \`kod\` va "-" bilan boshlanadigan oddiy ro'yxatlardan foydalan.
- ### sarlavhalar, --- ajratuvchi chiziqlar, jadvallar va > sitatalardan FOYDALANMA.
- Bo'limlarni ajratish kerak bo'lsa — emoji + **qalin sarlavha** ishlat.`;

// ==================== JARVIS SHAXSIYATI ====================
const systemInstruction = `Sening isming — JARVIS. Sen Humoyunning shaxsiy AI assistentisan, Telegram orqali 24/7 ishlaysan. Unga har doim "Humoyun" deb murojaat qil.

XARAKTER:
Aqlli, xotirjam, aniq, professional. Shaxsiy assistent — korporativ chatbot emas.
Ortiqcha gapirma, lekin savolga to'liq javob ber. Ishonch bilan gapirasan, lekin bilmagan narsangni bilaman demaysan.
O'zingning ichki tuzilishing, modelling yoki texnik ishlashing haqida so'ralmasa gapirma.

IMKONIYATLARING (faqat shularni da'vo qil):
- Matn tushunish va yozish, suhbat konteksti, doimiy xotira
- Rasm ko'rish va tahlil qilish, ovozli xabarlarni tinglash va tushunish
- Prompt muhandisligi, marketing va SMM strategiyasi, kopirayterlik
- Qisqa video skriptlari (Reels, Shorts), ilgaklar, kadrlar rejasi
- Ta'lim va repetitorlik, ingliz va arab tillari
- Yozish va tahrirlash, texnologiya bo'yicha yordam
- Vektor dizayn maslahati, HTML/Tailwind CSS
- Moliyaviy hisob-kitob va xarid ekspertizasi
Bo'lmagan imkoniyatni HECH QACHON o'ylab topma.

PROMPT MUHANDISLIGI (kuchli tarafing):
Midjourney, DALL-E, Google Veo va loyihada mavjud generatorlar uchun tuzilgan promptlar yozasan.
Har promptda quyidagilarni hisobga ol: obyekt, muhit, kompozitsiya, kamera, yorug'lik, atmosfera, vizual uslub, harakat, uzluksizlik, kadr nisbati, texnik cheklovlar.
Mavjud bo'lmagan API yoki integratsiyani o'ylab topma.

SAVDO VA MOLIYA:
- Ustama (markup) va marja (margin) — ikki xil narsa. Aralashtirma, qaysi biri ekanini aniq ayt.
  Ustama = (sotuv - tannarx) / tannarx. Marja = (sotuv - tannarx) / sotuv.
- Tannarxga yashirin xarajatlar kiradi: yetkazish, bojxona, nuqson, saqlash, komissiya, qadoq, reklama.
- Aylanma tezligi foyda foizidan muhimroq bo'lishi mumkin.
- Chegirma foydani foizdan keskinroq kamaytiradi — har chegirma taklifida buni ko'rsat.
- "0% bo'lib to'lash" da yashirin ustama bo'ladi — umumiy summani naqd narx bilan solishtir.
- O'zbekistonda QQS odatda 12%, lekin stavka o'zgargan bo'lishi mumkin — tasdiqlashni ayt.
- Investitsiya yoki foyda kafolatini berma.

HARID EKSPERTIZASI:
- Tovarning asosiy vazifasi va unga haqiqatan ta'sir qiladigan 3 ta parametr.
- Sifat belgilari: material, ishlov, kafolat va uni kim beradi, xizmat markazi, ehtiyot qism.
- Yomon tovar belgilari: haddan arzon narx, noaniq ishlab chiqaruvchi, sertifikat yo'qligi, bir xil uslubdagi sharhlar, internetdan topilmaydigan model raqami.
- Umumiy egalik narxi: sarf materiallari, ta'mir, elektr, o'rnatish.
- Tekshirish ro'yxati va qachon SOTIB OLMASLIK kerakligi. Har savolga "ha, oling" deb javob berma.

JAVOB BERISH QOIDALARI:
- Ma'lumot to'qib chiqarma. Aniq bilmasang — "aniq bilmayman" deb ayt.
- Savolni javobsiz qoldirma: nima ma'lum ekanini ayt, keyin aniq takliflar ber.
- Hisob-kitobni bosqichma-bosqich yech, formulani ko'rsat, natijani tekshir.
- Taxminga asoslangan raqamni "taxmin" deb belgila.
- TIBBIYOT: umumiy ma'lumot ber, tashxis qo'yma, dori tayinlama. Shifokorga murojaat qilishni tavsiya qil.
- DIN: ishonchli manbalarga tayan, turli qarashlarni ko'rsat. Fatvo masalalarida olim yoki imomga murojaat qilishni ayt.
- Humoyun xato qilsa yoki g'oyasida kamchilik ko'rsang — ochiq ayt, shunchaki maqtama.

${FORMAT_RULES}

USLUB: professional, aniq, qisqa. O'zbek tilida (zarurat bo'lsa ingliz/arab tillarida). Emojilardan o'rinli va kam foydalan.`;

const modelConfig = { model: MODEL, systemInstruction };
if (ENABLE_SEARCH) modelConfig.tools = [{ googleSearch: {} }];

const model = genAI.getGenerativeModel(modelConfig);
const modelNoTools = genAI.getGenerativeModel({ model: MODEL, systemInstruction });

// ==================== ANALITIK MODEL (aniq hisob-kitob) ====================
const analystModel = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: `Sen JARVIS — Humoyunning moliya va savdo bo'yicha analitigisan. Unga "Humoyun" deb murojaat qil.

MUHIM: arifmetikani boshingda hisoblama — har doim kod ishlatib hisobla. Bu majburiy.

Javob tuzilishi:
1. Qanday tushunganingni bir jumlada ayt (kirish ma'lumotlari va farazlar).
2. Kod bilan hisobla.
3. Natijani aniq raqamlarda, birligi bilan yoz (so'm, dona, %, oy).
4. Xulosa va 1-2 ta amaliy tavsiya.

QOIDALAR:
- Ustama va marjani aralashtirma, qaysi biri ekanini aniq yoz.
- Ma'lumot yetishmasa taxmin qil, LEKIN taxminni "faraz" deb belgila va natija unga qanchalik bog'liqligini ayt.
- Bir nechta stsenariy (yomon/o'rtacha/yaxshi) foydali bo'lsa, uchalasini hisobla.
- Katta raqamlarni o'qishli yoz: 12 500 000 so'm.
- Investitsiya yoki foyda kafolatini berma.

${FORMAT_RULES}

O'zbek tilida javob ber.`,
    tools: [{ codeExecution: {} }],
});

const promptEnhancer = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: `Sen rasm generatsiya promptlari bo'yicha mutaxassissan. Foydalanuvchi qisqa g'oya beradi — sen uni professional, batafsil INGLIZ TILIDAGI promptga aylantirasan.
Promptda: obyekt, muhit, kompozitsiya, kamera, yorug'lik, atmosfera, uslub, ranglar, sifat tavsiflari bo'lsin.
FAQAT promptning o'zini qaytar. Izoh, sarlavha, tirnoq yoki qo'shimcha matn YOZMA.`,
});

// ==================== XOTIRA QATLAMI ====================
const cache = new Map();
const MAX_HISTORY = 20;

async function loadHistory(chatId) {
    if (cache.has(chatId)) return cache.get(chatId);
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('chat_memory').select('history').eq('chat_id', chatId).maybeSingle();
            if (error) throw error;
            const history = data?.history || [];
            cache.set(chatId, history);
            return history;
        } catch (e) {
            console.error("Supabase o'qish xatosi:", e.message);
        }
    }
    cache.set(chatId, []);
    return [];
}

async function saveHistory(chatId, history) {
    cache.set(chatId, history);
    if (!supabase) return;
    try {
        const { error } = await supabase.from('chat_memory')
            .upsert({ chat_id: chatId, history, updated_at: new Date().toISOString() });
        if (error) throw error;
    } catch (e) {
        console.error('Supabase yozish xatosi:', e.message);
    }
}

async function clearHistory(chatId) {
    cache.set(chatId, []);
    if (!supabase) return;
    try { await supabase.from('chat_memory').delete().eq('chat_id', chatId); }
    catch (e) { console.error("Supabase o'chirish xatosi:", e.message); }
}

// ==================== SERVER + UYQUGA QARSHI PING ====================
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('JARVIS ishlamoqda.');
}).listen(port, () => console.log(`Server port ${port} da ishga tushdi.`));

const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl) setInterval(() => { fetch(selfUrl).catch(() => {}); }, 5 * 60 * 1000);

// ==================== XAVFSIZLIK ====================
bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id === myTelegramId) return next();
    return ctx.reply('🔒 Bu shaxsiy assistent. Faqat egasi bilan ishlayman.');
});

// ==================== MARKDOWN → TELEGRAM HTML ====================
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mdToHtml(md) {
    const blocks = [], inlines = [];
    let t = md;

    t = t.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (_, code) => {
        blocks.push(code); return `\u0000B${blocks.length - 1}\u0000`;
    });
    t = t.replace(/`([^`\n]+)`/g, (_, code) => {
        inlines.push(code); return `\u0000I${inlines.length - 1}\u0000`;
    });

    t = esc(t);
    t = t.replace(/^\s*([-*_]\s?){3,}\s*$/gm, '');
    t = t.replace(/^#{1,6}\s*(.+)$/gm, (_, h) => `<b>${h.trim()}</b>`);
    t = t.replace(/^\s*&gt;\s?/gm, '');
    t = t.replace(/^(\s*)[*+-]\s+/gm, '$1• ');
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    t = t.replace(/__([^_\n]+)__/g, '<b>$1</b>');
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    t = t.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>');
    t = t.replace(/\u0000I(\d+)\u0000/g, (_, i) => `<code>${esc(inlines[+i])}</code>`);
    t = t.replace(/\u0000B(\d+)\u0000/g, (_, i) => `<pre><code>${esc(blocks[+i])}</code></pre>`);

    return t.replace(/\n{3,}/g, '\n\n').trim();
}

function splitText(text, limit = 3800) {
    const out = [];
    let cur = '';
    for (const line of text.split('\n')) {
        if (line.length > limit) {
            if (cur) { out.push(cur); cur = ''; }
            for (let i = 0; i < line.length; i += limit) out.push(line.slice(i, i + limit));
        } else if ((cur ? cur.length + 1 : 0) + line.length > limit) {
            out.push(cur); cur = line;
        } else {
            cur = cur ? cur + '\n' + line : line;
        }
    }
    if (cur) out.push(cur);
    return out.length ? out : ["(bo'sh javob)"];
}

async function sendFormatted(ctx, loadingMsgId, raw) {
    const htmlChunks = splitText(mdToHtml(raw));
    const plainChunks = splitText(raw);
    for (let i = 0; i < htmlChunks.length; i++) {
        const html = htmlChunks[i];
        const plain = plainChunks[i] || html.replace(/<[^>]+>/g, '');
        try {
            if (i === 0) await ctx.telegram.editMessageText(ctx.chat.id, loadingMsgId, undefined, html, { parse_mode: 'HTML' });
            else await ctx.reply(html, { parse_mode: 'HTML' });
        } catch (e) {
            console.warn("HTML parse xato, plain rejimga o'tildi:", e.message);
            if (i === 0) await ctx.telegram.editMessageText(ctx.chat.id, loadingMsgId, undefined, plain);
            else await ctx.reply(plain);
        }
    }
}

async function fileToPart(ctx, fileId, mimeType) {
    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    const buffer = await res.arrayBuffer();
    return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType } };
}

function extractParts(response) {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    let out = '';
    for (const p of parts) {
        if (p.text) out += p.text;
        else if (p.executableCode && SHOW_CODE) out += `\n\`\`\`\n${p.executableCode.code}\n\`\`\`\n`;
        else if (p.codeExecutionResult && SHOW_CODE) out += `\n\`\`\`\n${p.codeExecutionResult.output}\n\`\`\`\n`;
    }
    return out.trim();
}

// ==================== MEDIA YUBORISH (Supabase Storage orqali) ====================
// Render bepul tarifi Telegram'ga to'g'ridan-to'g'ri fayl yuklashni o'tkazmaydi
// ("socket hang up"). Shuning uchun faylni Supabase'ga yuklab, Telegram'ga
// faqat havolani beramiz — faylni Telegram o'zi olib keladi.
const BUCKET = process.env.STORAGE_BUCKET || 'media';

async function uploadMedia(buffer, ext, contentType) {
    if (!supabase) throw new Error('Supabase ulanmagan — media yuborib bo\'lmaydi.');

    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET)
        .upload(path, buffer, { contentType, upsert: false });

    if (error) throw new Error(`Storage: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Storage havolasi olinmadi.');

    // Telegram havolani bir necha soniyada yuklab oladi — keyin fayl keraksiz
    setTimeout(() => {
        supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    }, 90_000);

    return data.publicUrl;
}

// ==================== OVOZ SINTEZI ====================
const TTS_MODEL = process.env.TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const TTS_VOICE = process.env.TTS_VOICE || 'Kore';
const VOICE_REPLY = process.env.VOICE_REPLY !== 'false';
const VOICE_MAX_CHARS = parseInt(process.env.VOICE_MAX_CHARS || '1200', 10);

function pcmToWav(pcm, sampleRate) {
    const channels = 1, bits = 16;
    const h = Buffer.alloc(44);
    h.write('RIFF', 0);
    h.writeUInt32LE(36 + pcm.length, 4);
    h.write('WAVE', 8);
    h.write('fmt ', 12);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(channels, 22);
    h.writeUInt32LE(sampleRate, 24);
    h.writeUInt32LE(sampleRate * channels * bits / 8, 28);
    h.writeUInt16LE(channels * bits / 8, 32);
    h.writeUInt16LE(bits, 34);
    h.write('data', 36);
    h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}

async function textToSpeech(text) {
    const res = await fetch(`${API_BASE}/models/${TTS_MODEL}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
            },
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `TTS HTTP ${res.status}`);

    const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
    if (!part) throw new Error('TTS audio qaytarmadi.');

    const rate = parseInt((part.inlineData.mimeType.match(/rate=(\d+)/) || [])[1] || '24000', 10);
    return pcmToWav(Buffer.from(part.inlineData.data, 'base64'), rate);
}

// Ovoz uchun matnni tozalash — belgilar o'qib berilmasligi kerak
function textForSpeech(md) {
    return md
        .replace(/```[\s\S]*?```/g, ' Kod bloki. ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*|__|\*|_|#{1,6}\s*/g, '')
        .replace(/^\s*[-•+]\s*/gm, '')
        .replace(/https?:\/\/\S+/g, ' havola ')
        .replace(/[\p{Extended_Pictographic}]/gu, '')
        .replace(/\n{2,}/g, '. ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Ovozni Telegram'ga yuborish — uch xil usulni ketma-ket sinaymiz
async function deliverAudio(ctx, wav, title = 'JARVIS') {
    const errors = [];

    // 1-usul: to'g'ridan-to'g'ri Buffer (Matnshunos shu yo'l bilan ishlagan)
    try {
        await ctx.replyWithVoice({ source: wav, filename: 'jarvis.ogg' });
        return true;
    } catch (e) { errors.push(`voice/buffer: ${e.message}`); }

    // 2-usul: audio sifatida Buffer
    try {
        await ctx.replyWithAudio({ source: wav, filename: 'jarvis.wav' }, { title });
        return true;
    } catch (e) { errors.push(`audio/buffer: ${e.message}`); }

    // 3-usul: Supabase Storage havolasi orqali
    try {
        const url = await uploadMedia(wav, 'wav', 'audio/wav');
        await ctx.replyWithAudio(url, { title });
        return true;
    } catch (e) { errors.push(`audio/url: ${e.message}`); }

    console.warn('Audio yuborilmadi:', errors.join(' | '));
    lastMediaError = errors.join('\n');
    return false;
}

let lastMediaError = null;

async function sendVoiceReply(ctx, rawText) {
    if (!VOICE_REPLY) return false;

    const speech = textForSpeech(rawText);
    if (!speech || speech.length > VOICE_MAX_CHARS) return false;

    try {
        const wav = await textToSpeech(speech);
        return await deliverAudio(ctx, wav);
    } catch (e) {
        console.warn('Ovozli javob yaratilmadi:', e.message);
        lastMediaError = e.message;
        return false;
    }
}

// ==================== KOMANDALAR ====================
bot.start(async (ctx) => {
    await clearHistory(ctx.chat.id);
    const hour = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false }).format(new Date()), 10);
    const salom = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

    ctx.reply(
        `${salom}, Humoyun. Men JARVIS — sizning shaxsiy AI assistentingizman.\n\n` +
        `Matn, rasm va ovozni tushunaman. Suhbat kontekstini eslab qolaman.\n\n` +
        `🧮 /hisob — moliyaviy hisob-kitob\n` +
        `🛒 /harid — tovar tahlili\n` +
        `🎬 /prompt — AI vositalar uchun prompt\n` +
        `📚 /eng — ingliz tili darsi\n` +
        `📅 /reja — haftalik reja\n` +
        `⚙️ /status — tizim holati\n\n` +
        `To'liq ro'yxat: "/" tugmasi.`
    );
});

bot.command('clear', async (ctx) => {
    await clearHistory(ctx.chat.id);
    ctx.reply('Xotira tozalandi. Toza varaqdan boshlaymiz.');
});

bot.command('status', async (ctx) => {
    const h = await loadHistory(ctx.chat.id);
    ctx.reply(
        `JARVIS — tizim holati\n\n` +
        `⚙️ Matn modeli: ${MODEL}\n` +
        `🧠 Xotirada: ${h.length / 2} ta savol-javob\n` +
        `💾 Doimiy xotira: ${supabase ? 'yoqilgan (Supabase)' : "o'chirilgan (RAM)"}\n` +
        `🌐 Qidiruv: ${ENABLE_SEARCH ? 'yoqilgan' : "o'chirilgan"}\n` +
        `🔊 Ovozli javob: ${VOICE_REPLY && supabase ? 'yoqilgan' : "o'chirilgan"}\n` +
        `📦 Media ombori: ${supabase ? BUCKET : "yo'q"}\n` +
        `🧮 Hisob kodi ko'rinishi: ${SHOW_CODE ? 'yoqilgan' : "o'chirilgan"}`
    );
});

bot.command('models', async (ctx) => {
    const msg = await ctx.reply("Modellar ro'yxati olinyapti...");
    try {
        const res = await fetch(`${API_BASE}/models?key=${geminiApiKey}&pageSize=200`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

        const names = (data.models || []).map((m) => m.name.replace('models/', ''));
        const images = names.filter((n) => /imagen|image|veo/i.test(n));
        const texts = names.filter((n) => !/imagen|image|veo|embedding|aqa/i.test(n));

        await sendFormatted(ctx, msg.message_id,
            `🎨 **Rasm/video modellari (${images.length}):**\n` +
            (images.length ? images.map((n) => `- ${n}`).join('\n') : '- topilmadi') +
            `\n\n💬 **Matn modellari (${texts.length}):**\n` +
            texts.map((n) => `- ${n}`).join('\n'));
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
    }
});

// ==================== /hisob ====================
bot.command('hisob', async (ctx) => {
    const input = ctx.message.text.replace(/^\/hisob(@\S+)?\s*/i, '').trim();

    if (!input) {
        return ctx.reply(
            "🧮 Foydalanish: /hisob <masala>\n\n" +
            "Misollar:\n" +
            "- /hisob 45000 ga oldim, 68000 ga sotyapman. Marja va ustama qancha?\n" +
            "- /hisob 200 dona, dona 12$, yetkazish 300$, bojxona 15%. Tannarx qancha?\n" +
            "- /hisob 30% marjam bor, 20% chegirma qilsam foyda nima bo'ladi?\n" +
            "- /hisob 12 mln, 12 oyga 0% bo'lib to'lash, naqd narxi 9.8 mln. Foydalimi?"
        );
    }

    const loadingMsg = await ctx.reply('Hisoblanyapti...');
    try {
        const history = await loadHistory(ctx.chat.id);
        const result = await analystModel.generateContent({
            contents: [...history, { role: 'user', parts: [{ text: input }] }],
        });

        const replyText = extractParts(result.response) || "Hisob natijasi bo'sh qaytdi.";

        await saveHistory(ctx.chat.id, [
            ...history,
            { role: 'user', parts: [{ text: `[hisob] ${input}` }] },
            { role: 'model', parts: [{ text: replyText }] },
        ].slice(-MAX_HISTORY));

        await sendFormatted(ctx, loadingMsg.message_id, replyText);
    } catch (error) {
        console.error('Hisob xatosi:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `Hisoblab bo'lmadi: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== /harid ====================
bot.command('harid', async (ctx) => {
    const input = ctx.message.text.replace(/^\/harid(@\S+)?\s*/i, '').trim();

    if (!input) {
        return ctx.reply(
            "🛒 Foydalanish: /harid <tovar yoki savol>\n\n" +
            "Misollar:\n" +
            "- /harid o'quv markazi uchun proyektor, byudjet 5 mln\n" +
            "- /harid montaj uchun noutbuk, 12 mln gacha\n\n" +
            "Byudjet va maqsadni yozsangiz, javob aniqroq bo'ladi."
        );
    }

    const loadingMsg = await ctx.reply('Tahlil qilinyapti...');
    try {
        const history = await loadHistory(ctx.chat.id);
        const framed = `Quyidagi xarid bo'yicha to'liq ekspertiza qil.

So'rov: ${input}

Javobda albatta shu bo'limlar bo'lsin:
1. Bu tovarda haqiqatan muhim 3 ta parametr.
2. Sifatli namunaning belgilari.
3. Sifatsiz namunaning belgilari — nimadan qochish kerak.
4. Real narx oralig'i (bilmasang qidiruvdan foydalanib manba ko'rsat; topilmasa "aniq bilmayman" de).
5. Umumiy egalik narxi.
6. Sotib olishdan oldingi tekshirish ro'yxati.
7. Qachon bu tovarni OLMASLIK kerak — muqobil bilan.`;

        let replyText;
        try {
            const result = await model.generateContent({
                contents: [...history, { role: 'user', parts: [{ text: framed }] }],
            });
            replyText = result.response.text();
        } catch (e) {
            console.warn("Tools bilan xato, zaxiraga o'tildi:", e.message);
            const result = await modelNoTools.generateContent({
                contents: [...history, { role: 'user', parts: [{ text: framed }] }],
            });
            replyText = result.response.text();
        }

        if (!replyText) replyText = "Javob bo'sh qaytdi. So'rovni aniqroq yozing.";

        await saveHistory(ctx.chat.id, [
            ...history,
            { role: 'user', parts: [{ text: `[harid] ${input}` }] },
            { role: 'model', parts: [{ text: replyText }] },
        ].slice(-MAX_HISTORY));

        await sendFormatted(ctx, loadingMsg.message_id, replyText);
    } catch (error) {
        console.error('Harid tahlili xatosi:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `Xatolik: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== /prompt — tashqi AI vositalar uchun prompt ====================
bot.command('prompt', async (ctx) => {
    let input = ctx.message.text.replace(/^\/prompt(@\S+)?\s*/i, '').trim();

    if (!input) {
        return ctx.reply(
            '🎬 Foydalanish: /prompt <g\'oya>\n\n' +
            'Vosita nomini boshiga yozing:\n' +
            '- /prompt veo bozorda savdo qilayotgan chol, kunduzgi yorug\'lik\n' +
            '- /prompt mj o\'quv markazi logotipi, minimalist\n' +
            '- /prompt banana bu rasmdagi fonni almashtir\n\n' +
            'Yozmasangiz, g\'oyaga qarab o\'zim tanlayman.\n' +
            'Rasm yuborib, ostiga /prompt yozsangiz — rasmni tahlil qilib prompt tuzaman.'
        );
    }

    const TOOLS = {
        veo: 'Google Veo (video)', mj: 'Midjourney (rasm)', midjourney: 'Midjourney (rasm)',
        dalle: 'DALL-E (rasm)', banana: 'Nano Banana (rasm tahriri)', sora: 'Sora (video)',
        kling: 'Kling (video)', runway: 'Runway (video)', flux: 'Flux (rasm)',
    };

    let tool = null;
    const first = input.split(/\s+/)[0].toLowerCase();
    if (TOOLS[first]) {
        tool = TOOLS[first];
        input = input.slice(first.length).trim();
    }

    const msg = await ctx.reply('Prompt tuzilyapti...');
    try {
        const guide = `Sen professional prompt muhandisisan. Humoyun uchun tayyor, ko'chirib qo'yiladigan prompt yozasan.

Vosita: ${tool || "g'oyaga qarab eng mosini o'zing tanla va nega tanlaganingni bir jumlada ayt"}

G'oya: ${input}

Javob tuzilishi:
1. 🎯 **Vosita** — qaysi vosita va nega (1 jumla).
2. 📋 **PROMPT** — inglizcha, kod bloki ichida, ko'chirishga tayyor.
3. ⚙️ **Sozlamalar** — aspect ratio, davomiylik, versiya, boshqa parametrlar.
4. 🔁 **Variant** — bitta muqobil yo'nalish (qisqacha, prompt shaklida emas, g'oya sifatida).

PROMPT ichida albatta bo'lsin: obyekt, muhit, kompozitsiya, kamera (rakurs, obyektiv, harakat), yorug'lik, atmosfera, vizual uslub, ranglar, sifat tavsiflari. Video bo'lsa — harakat va kadr uzluksizligi ham.

Prompt ingliz tilida, qolgan izohlar o'zbekcha. Qisqa va aniq yoz.`;

        const parts = [{ text: guide }];

        // Javob berilgan rasm bo'lsa — uni ham tahlil qilamiz
        const replyPhoto = ctx.message.reply_to_message?.photo;
        if (replyPhoto) {
            const photo = replyPhoto[replyPhoto.length - 1];
            parts.push(await fileToPart(ctx, photo.file_id, 'image/jpeg'));
            parts[0].text += '\n\nHumoyun rasm ham berdi — uslubi, ranglari va kompozitsiyasini tahlil qilib, promptga singdir.';
        }

        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        await sendFormatted(ctx, msg.message_id, result.response.text());
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
    }
});

// ==================== /ovoz — matnni ovozga aylantirish ====================
bot.command('ovoz', async (ctx) => {
    const input = ctx.message.text.replace(/^\/ovoz(@\S+)?\s*/i, '').trim();

    if (!input) {
        return ctx.reply(
            '🔊 Foydalanish: /ovoz <matn>\n\n' +
            'Ovozli xabar yuborsangiz, javob avtomatik ovozda ham keladi.\n' +
            "O'chirish: Render'da VOICE_REPLY = false"
        );
    }

    const msg = await ctx.reply('Ovoz tayyorlanyapti...');
    try {
        lastMediaError = null;
        const wav = await textToSpeech(textForSpeech(input));
        const ok = await deliverAudio(ctx, wav);

        if (ok) {
            await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `Ovoz yaratildi (${(wav.length / 1024 / 1024).toFixed(2)} MB), lekin yuborilmadi.\n\nUrinishlar:\n${lastMediaError}`);
        }
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
            `Ovoz yaratilmadi: ${e.message}`);
    }
});

// ==================== INGLIZ TILI MODULI ====================
require('./english')(bot, { genAI, MODEL, supabase, sendFormatted, esc, myTelegramId, geminiApiKey });

// ==================== HISOB-KITOBNI AVTOMATIK ANIQLASH ====================
const CALC_HINT = /(hisobla|hisob-kitob|foiz|foyda|zarar|chegirma|marja|ustama|tannarx|qqs|nds|kredit|bo['’]?lib to['’]?lash|oylik to['’]?lov|jami qancha|qancha bo['’]?ladi|necha foiz|rentabellik|aylanma)/i;
const hasNumber = (s) => /\d/.test(s);

// ==================== ASOSIY ISHLOVCHI ====================
bot.on('message', async (ctx) => {
    const m = ctx.message;
    if (!m.text && !m.photo && !m.voice && !m.audio && !m.document) return;
    if (m.text && m.text.startsWith('/')) return;

    const loadingMsg = await ctx.reply('Tahlil qilinyapti...');

    try {
        const history = await loadHistory(ctx.chat.id);
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
                    `Bu format qo'llab-quvvatlanmaydi (${mime || "noma'lum"}). PDF, TXT yoki CSV yuboring.`);
                return;
            }
        }

        const request = { contents: [...history, { role: 'user', parts }] };
        const isCalc = !m.photo && !m.voice && !m.audio && !m.document
            && hasNumber(text) && CALC_HINT.test(text);

        let replyText;

        if (isCalc) {
            try {
                await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, 'Hisoblanyapti...');
                const result = await analystModel.generateContent(request);
                replyText = extractParts(result.response);
            } catch (e) {
                console.warn('Analitik model xatosi, asosiy modelga qaytildi:', e.message);
            }
        }

        if (!replyText) {
            try {
                const result = await model.generateContent(request);
                replyText = result.response.text();
            } catch (searchErr) {
                console.warn("Tools bilan xato, zaxiraga o'tildi:", searchErr.message);
                const result = await modelNoTools.generateContent(request);
                replyText = result.response.text();
            }
        }

        if (!replyText) replyText = "Javob bo'sh qaytdi. Savolni boshqacha shaklda bering.";

        await saveHistory(ctx.chat.id, [
            ...history,
            { role: 'user', parts: [{ text: text + mediaNote }] },
            { role: 'model', parts: [{ text: replyText }] },
        ].slice(-MAX_HISTORY));

        await sendFormatted(ctx, loadingMsg.message_id, replyText);

        // Ovozli xabarga — ovozli javob ham (matn baribir yuqorida qoladi)
        if (m.voice) await sendVoiceReply(ctx, replyText);
    } catch (error) {
        console.error('API Xatolik:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `Xatolik: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== KOMANDALAR MENYUSI ====================
const COMMANDS = [
    { command: 'eng', description: '📚 Bugungi dars' },
    { command: 'word', description: "🔁 So'z takrori (new / add)" },
    { command: 'chunk', description: "🧱 So'z birikmalari" },
    { command: 'drill', description: '⚡ Tez tarjima drilli' },
    { command: 'talaffuz', description: '🗣 Talaffuz mashqi' },
    { command: 'xato', description: '📊 Xatolar hisoboti + mashq' },
    { command: 'read', description: "📖 O'qish mashqi" },
    { command: 'listen', description: "🎧 Tinglash topshirig'i" },
    { command: 'essay', description: '✍️ Esse: mavzu + baholash' },
    { command: 'ielts', description: '🎤 IELTS Speaking imtihoni' },
    { command: 'speak', description: '💬 Suhbat mashqi' },
    { command: 'write', description: '📝 Tayyor matnni baholash' },
    { command: 'test', description: '🎯 Daraja tekshiruvi' },
    { command: 'progress', description: '📈 Statistika' },
    { command: 'reja', description: '📅 Haftalik reja' },
    { command: 'hisob', description: '🧮 Moliyaviy hisob-kitob' },
    { command: 'harid', description: '🛒 Tovar tahlili' },
    { command: 'prompt', description: '🎬 AI vositalar uchun prompt' },
    { command: 'ovoz', description: '🔊 Matnni ovozga aylantirish' },
    { command: 'fellar', description: "📘 Noto'g'ri fe'llar" },
    { command: 'hafta', description: '📊 Haftalik hisobot' },
    { command: 'stop', description: '🛑 Rejimdan chiqish' },
    { command: 'clear', description: '🧹 Xotirani tozalash' },
    { command: 'status', description: '⚙️ Tizim holati' },
    { command: 'models', description: '📋 Mavjud modellar' },
    { command: 'start', description: '🤖 Boshlash' },
];

bot.telegram.setMyCommands(COMMANDS)
    .then(() => console.log('📋 Komandalar menyusi o\'rnatildi.'))
    .catch((e) => console.warn('Menyu o\'rnatilmadi:', e.message));

// ==================== ISHGA TUSHIRISH ====================
async function startBot(attempt = 1) {
    try {
        console.log(`JARVIS ishga tushyapti (urinish ${attempt})...`);
        await bot.launch({ dropPendingUpdates: true });
    } catch (e) {
        console.error(`Ishga tushirish xatosi (${attempt}):`, e.message);
        if (attempt < 12) {
            const delay = Math.min(attempt * 5000, 30000);
            console.log(`${delay / 1000}s dan keyin qayta urinaman...`);
            setTimeout(() => startBot(attempt + 1), delay);
        } else {
            console.error("JARVIS ishga tushmadi — boshqa nusxa ishlayotgan bo'lishi mumkin.");
        }
    }
}
startBot();

process.on('unhandledRejection', (r) => console.error('Ushlanmagan rad etish:', r?.message || r));
process.on('uncaughtException', (e) => console.error('Ushlanmagan xato:', e?.message || e));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
