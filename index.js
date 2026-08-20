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
- DARROV JAVOBGA O'T. Savolni qaytarib aytma, nima so'ralganini takrorlama, sharoitni tasvirlama.
  Taqiqlangan boshlanishlar: "Siz so'radingiz...", "Agar siz ... nazarda tutayotgan bo'lsangiz", "Siz yuborgan faylda...", "Tushundim, siz ... xohlaysiz", "Ushbu savolingizga javob sifatida...".
  Birinchi jumlaning o'zi javob bo'lsin.
- Savol noaniq bo'lsa: eng ehtimolli ma'noni ol, javob ber, oxirida bir qatorda boshqa ma'no bo'lsa aytishini so'ra. Javobdan OLDIN so'rama.
- Ma'lumot yetarli emas bo'lsa (masalan bo'sh fayl): bir jumlada nima yetishmayotganini ayt, uzun tushuntirish yozma.
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
let apiHandler = null;   // Mini App API — pastroqda o'rnatiladi

const port = process.env.PORT || 3000;
http.createServer(async (req, res) => {
    // Mini App so'rovlari
    if (apiHandler) {
        try {
            if (await apiHandler(req, res)) return;
        } catch (e) {
            console.error('API xatosi:', e.message);
        }
    }

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
// Gemini TTS ovozlari
const VOICES = {
    // Erkak
    Charon: 'erkak · chuqur, xotirjam',
    Puck: 'erkak · jonli, tez',
    Fenrir: "erkak · qat'iy, kuchli",
    Orus: 'erkak · ravon, neytral',
    Enceladus: 'erkak · yumshoq, past',
    Iapetus: 'erkak · aniq, quruq',
    Algieba: 'erkak · iliq',
    // Ayol
    Kore: 'ayol · aniq, rasmiy',
    Zephyr: 'ayol · yengil',
    Leda: 'ayol · yosh',
    Aoede: 'ayol · iliq',
};

let currentVoice = process.env.TTS_VOICE || 'Charon';
let voiceStyle = process.env.TTS_STYLE || '';       // "tez", "sekin", "xotirjam", "jonli"
let voiceFull = process.env.VOICE_FULL === 'true';  // uzun javobni bo'lib to'liq o'qish
let voiceMode = false;                              // /suhbat — matnga ham ovozda javob
const VOICE_REPLY = process.env.VOICE_REPLY !== 'false';
const VOICE_MAX_CHARS = parseInt(process.env.VOICE_MAX_CHARS || '1500', 10);

const STYLES = {
    tez: 'Speak quickly and energetically: ',
    sekin: 'Speak slowly and clearly: ',
    xotirjam: 'Speak in a calm, measured tone: ',
    jonli: 'Speak in a warm, lively tone: ',
    rasmiy: 'Speak in a formal, professional tone: ',
};

// PCM → MP3 (sof JS, ffmpeg kerak emas). Telegram sendAudio faqat MP3/M4A qabul qiladi.
let lamejsCache = null;
async function pcmToMp3(pcm, sampleRate) {
    if (!lamejsCache) {
        const mod = await import('@breezystack/lamejs');
        lamejsCache = mod.default || mod;
    }
    const enc = new lamejsCache.Mp3Encoder(1, sampleRate, 64);
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
    const out = [];
    const block = 1152;

    for (let i = 0; i < samples.length; i += block) {
        const chunk = samples.subarray(i, Math.min(i + block, samples.length));
        const buf = enc.encodeBuffer(chunk);
        if (buf.length) out.push(Buffer.from(buf));
    }
    const end = enc.flush();
    if (end.length) out.push(Buffer.from(end));

    return Buffer.concat(out);
}

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

// Bir nechta TTS modelini ketma-ket sinaymiz
const TTS_MODELS = (process.env.TTS_MODEL || 'gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview,gemini-2.5-pro-preview-tts')
    .split(',').map((s) => s.trim()).filter(Boolean);

let lastTtsDebug = null;

async function ttsOnce(modelName, text) {
    const styled = (STYLES[voiceStyle] || '') + text;
    const res = await fetch(`${API_BASE}/models/${modelName}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: styled }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoice } } },
            },
        }),
    });

    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`JSON emas: ${raw.slice(0, 200)}`); }

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error?.message || raw.slice(0, 200)}`);

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const part = parts.find((p) => p.inlineData);

    if (!part) {
        // Nima qaytganini aniq ko'rsatamiz
        const finish = data?.candidates?.[0]?.finishReason || '?';
        const keys = parts.map((p) => Object.keys(p).join('+')).join(', ') || 'parts yo\'q';
        const textPart = parts.find((p) => p.text)?.text?.slice(0, 120) || '';
        throw new Error(`audio yo'q · finishReason=${finish} · parts=[${keys}]${textPart ? ` · matn="${textPart}"` : ''}`);
    }

    const rate = parseInt((part.inlineData.mimeType.match(/rate=(\d+)/) || [])[1] || '24000', 10);
    return { pcm: Buffer.from(part.inlineData.data, 'base64'), rate };
}

async function textToSpeech(text) {
    const errors = [];
    for (const m of TTS_MODELS) {
        try {
            const audio = await ttsOnce(m, text);
            console.log(`TTS muvaffaqiyatli: ${m}`);
            return audio;
        } catch (e) {
            console.warn(`TTS ${m}: ${e.message}`);
            errors.push(`${m} → ${e.message}`);
        }
    }
    lastTtsDebug = errors.join('\n\n');
    throw new Error('Hech bir TTS modeli audio bermadi');
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

// Ovozni Telegram'ga yetkazish.
// Render bepul tarifi Buffer yuklashni o'tkazmaydi, shuning uchun havola birinchi.
async function deliverAudio(ctx, audio, title = 'JARVIS') {
    const errors = [];
    let mp3 = null;

    try {
        mp3 = await pcmToMp3(audio.pcm, audio.rate);
        console.log(`MP3 tayyor: ${(mp3.length / 1024).toFixed(0)} KB`);
    } catch (e) {
        console.warn('MP3 kodlash xatosi:', e.message);
        errors.push(`mp3-encode: ${e.message}`);
    }

    // 1-usul: MP3 havola orqali (Telegram sendAudio faqat MP3/M4A qabul qiladi)
    if (mp3) {
        try {
            const url = await uploadMedia(mp3, 'mp3', 'audio/mpeg');

            // Havola haqiqatan ochiqmi — o'zimiz tekshiramiz
            const check = await fetch(url, { method: 'GET' });
            if (!check.ok) throw new Error(`havola ochilmadi: HTTP ${check.status}`);

            await ctx.replyWithAudio(url, { title });
            return true;
        } catch (e) { errors.push(`mp3/url: ${e.message}`); }
    }

    // 2-usul: MP3 to'g'ridan-to'g'ri
    if (mp3) {
        try {
            await ctx.replyWithAudio({ source: mp3, filename: 'jarvis.mp3' }, { title });
            return true;
        } catch (e) { errors.push(`mp3/buffer: ${e.message}`); }
    }

    // 3-usul: WAV hujjat sifatida havola orqali
    try {
        const wav = pcmToWav(audio.pcm, audio.rate);
        const url = await uploadMedia(wav, 'wav', 'audio/wav');
        await ctx.replyWithDocument(url);
        return true;
    } catch (e) { errors.push(`wav/url: ${e.message}`); }

    console.warn('Audio yuborilmadi:', errors.join(' | '));
    lastMediaError = errors.join('\n');
    return false;
}

let lastMediaError = null;

// Matnni gap chegarasida bo'laklarga bo'lish
function splitForSpeech(text, limit) {
    const parts = [];
    let cur = '';
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        if ((cur + ' ' + sentence).length > limit && cur) {
            parts.push(cur.trim());
            cur = sentence;
        } else {
            cur += (cur ? ' ' : '') + sentence;
        }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
}

async function sendVoiceReply(ctx, rawText, deleteMsgId = null) {
    if (!VOICE_REPLY) return false;

    let speech = textForSpeech(rawText);
    if (!speech) return false;

    const cleanup = async () => {
        if (deleteMsgId) await ctx.telegram.deleteMessage(ctx.chat.id, deleteMsgId).catch(() => {});
    };

    // To'liq o'qish rejimi — bo'laklarga bo'lib yuboramiz
    if (speech.length > VOICE_MAX_CHARS && voiceFull) {
        const chunks = splitForSpeech(speech, VOICE_MAX_CHARS).slice(0, 6);
        let ok = false;
        for (let i = 0; i < chunks.length; i++) {
            try {
                const audio = await textToSpeech(chunks[i]);
                await deliverAudio(ctx, audio, `JARVIS ${i + 1}/${chunks.length}`);
                if (!ok) await cleanup();
                ok = true;
            } catch (e) {
                console.warn(`Ovoz bo'lagi ${i + 1}:`, e.message);
            }
        }
        return ok;
    }

    // Javob uzun bo'lsa — ovoz uchun qisqa xulosa
    if (speech.length > VOICE_MAX_CHARS) {
        try {
            const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
                `Quyidagi javobni OVOZ uchun qisqartir. 700 belgidan oshmasin.\n\n` +
                `Qoidalar:\n- Eng muhim xulosani va aniq raqamlarni saqla\n` +
                `- Ro'yxat bo'lsa, eng muhim 3 tasini ayt\n` +
                `- Oxirida "batafsili matnda" deb qo'sh\n` +
                `- Belgi, emoji, formatlash ishlatma — sof gapiriladigan matn\n\n` +
                `Javob:\n${rawText.slice(0, 6000)}`
            );
            const short = textForSpeech(gen.response.text());
            if (short && short.length <= VOICE_MAX_CHARS) speech = short;
            else return false;
        } catch (e) {
            console.warn('Ovozli xulosa tayyorlanmadi:', e.message);
            return false;
        }
    }

    try {
        const audio = await textToSpeech(speech);
        const ok = await deliverAudio(ctx, audio);
        if (ok) await cleanup();
        return ok;
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
        `🌅 /brifing — kunlik brifing\n` +
        `📌 /vazifalar — ochiq vazifalar\n` +
        `📚 /eng — ingliz tili darsi\n` +
        `🎙 /suhbatlash — ovozli suhbat\n` +
        `❓ /yordam — barcha imkoniyatlar\n\n` +
        `💡 Komanda yozish shart emas — shunchaki gapiring.\n` +
        `"Ertaga soat 3 da Belissimo'ga qo'ng'iroq qilishim kerak" deb yozsangiz, o'zim vazifaga yozib qo'yaman.`,
        voiceKeyboard ? { reply_markup: voiceKeyboard } : undefined
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
        `🎙 Ovoz: ${currentVoice} (${VOICES[currentVoice] || ""})\n` +
        `🧠 Cheksiz xotira: ${process.env.MEMORY_ON === 'false' ? "o'chirilgan" : 'yoqilgan'} — /xotira\n` +
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

        memoryApi.remember(ctx.chat.id, `Hisob-kitob: ${input}\n\nNatija: ${replyText.slice(0, 2500)}`, 'hisob').catch(() => {});

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

        memoryApi.remember(ctx.chat.id, `Xarid tahlili: ${input}\n\n${replyText.slice(0, 2500)}`, 'harid').catch(() => {});

        await sendFormatted(ctx, loadingMsg.message_id, replyText);
    } catch (error) {
        console.error('Harid tahlili xatosi:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `Xatolik: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== /ovozi — ovozni tanlash ====================
bot.command('ovozi', async (ctx) => {
    const arg = ctx.message.text.replace(/^\/ovozi(@\S+)?\s*/i, '').trim();

    if (!arg) {
        const list = Object.entries(VOICES)
            .map(([n, d]) => `${n === currentVoice ? '👉' : '  '} <b>${n}</b> — ${d}`).join('\n');
        return ctx.reply(
            `🎙 <b>Hozirgi ovoz:</b> ${currentVoice}\n` +
            `🎭 <b>Uslub:</b> ${voiceStyle || 'oddiy'}\n` +
            `📖 <b>To'liq o'qish:</b> ${voiceFull ? 'yoqilgan' : "o'chirilgan"}\n\n${list}\n\n` +
            `Almashtirish: /ovozi Puck\n` +
            `Barchasini eshitish: /ovozi sinov\n` +
            `Uslub: /ovozi uslub xotirjam\n` +
            `To'liq o'qish: /ovozi toliq\n` +
            `Ovozli rejim: /suhbat\n\n` +
            `<i>Doimiy qilish: Render'da TTS_VOICE, TTS_STYLE, VOICE_FULL.</i>`,
            { parse_mode: 'HTML' }
        );
    }

    // Uslub
    if (/^uslub/i.test(arg)) {
        const s = arg.replace(/^uslub\s*/i, '').trim().toLowerCase();
        if (!s) {
            return ctx.reply(
                `🎭 Hozirgi uslub: ${voiceStyle || 'oddiy'}\n\n` +
                `Mavjudlari: ${Object.keys(STYLES).join(', ')}, oddiy\n\n` +
                `Misol: /ovozi uslub xotirjam`
            );
        }
        if (s === 'oddiy') { voiceStyle = ''; return ctx.reply('🎭 Uslub: oddiy'); }
        if (!STYLES[s]) return ctx.reply(`"${s}" yo'q. Mavjudlari: ${Object.keys(STYLES).join(', ')}, oddiy`);
        voiceStyle = s;
        return ctx.reply(`🎭 Uslub: ${s}\n\nDoimiy qilish: Render'da TTS_STYLE = ${s}`);
    }

    // To'liq o'qish rejimi
    if (/^to'?liq$/i.test(arg)) {
        voiceFull = !voiceFull;
        return ctx.reply(
            voiceFull
                ? "📖 To'liq o'qish YOQILDI.\nUzun javoblar bo'laklarga bo'linib to'liq o'qiladi."
                : "📝 To'liq o'qish o'chirildi.\nUzun javoblar uchun qisqa ovozli xulosa beriladi."
        );
    }

    // Barcha erkak ovozlarini sinab ko'rish
    if (/^sinov$/i.test(arg)) {
        const males = Object.keys(VOICES).filter((v) => VOICES[v].startsWith('erkak'));
        const msg = await ctx.reply(`${males.length} ta erkak ovozi tayyorlanyapti...`);
        const saved = currentVoice;

        for (const v of males) {
            try {
                currentVoice = v;
                const audio = await textToSpeech(`Salom Humoyun. Men JARVIS. Bu ${v} ovozi.`);
                const mp3 = await pcmToMp3(audio.pcm, audio.rate);
                const url = await uploadMedia(mp3, 'mp3', 'audio/mpeg');
                await ctx.replyWithAudio(url, { title: v, performer: VOICES[v] });
            } catch (e) {
                await ctx.reply(`${v} — xato: ${e.message}`);
            }
        }

        currentVoice = saved;
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
            `Tanlash: /ovozi <nom>\nHozirgi: ${currentVoice}`);
        return;
    }

    // Ovozni almashtirish
    const found = Object.keys(VOICES).find((v) => v.toLowerCase() === arg.toLowerCase());
    if (!found) {
        return ctx.reply(`"${arg}" topilmadi.\n\nMavjudlari: ${Object.keys(VOICES).join(', ')}`);
    }

    currentVoice = found;
    const msg = await ctx.reply(`Ovoz o'zgartirildi: ${found} (${VOICES[found]})\nSinov tayyorlanyapti...`);

    try {
        const audio = await textToSpeech(`Salom Humoyun. Endi men shu ovozda gapiraman.`);
        const mp3 = await pcmToMp3(audio.pcm, audio.rate);
        const url = await uploadMedia(mp3, 'mp3', 'audio/mpeg');
        await ctx.replyWithAudio(url, { title: found });
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
            `🎙 Ovoz: ${found} — ${VOICES[found]}\n\nDoimiy qilish: Render'da TTS_VOICE = ${found}`);
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
            `Ovoz ${found} ga o'zgartirildi, lekin sinov yuborilmadi: ${e.message}`);
    }
});

// ==================== /suhbat — ovozli rejim ====================
bot.command('suhbat', async (ctx) => {
    voiceMode = !voiceMode;
    ctx.reply(
        voiceMode
            ? "🎧 Ovozli rejim YOQILDI.\n\nEndi matn yozsangiz ham javob ovozda ham keladi.\nO'chirish: /suhbat"
            : "💬 Ovozli rejim o'chirildi.\n\nOvozli javob faqat ovozli xabarga beriladi."
    );
});

// ==================== MATN VA OVOZDAN VAZIFA AJRATISH ====================
// Xabarda bajariladigan ish yoki g'oya aytilgan bo'lsa, avtomatik ajratib bazaga yozadi
const CAPTURE_HINT = /(kerak|qilishim|qilaman|unutma|esla|yozib qo|ertaga|indinga|bugun|dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba|g'oya|goya|fikr keldi|qo'ng'iroq|uchrashuv|to'lash|yubor|tekshir|olish kerak)/i;

async function extractFromVoice(ctx, transcriptHint, taskApi) {
    if (!supabase || !taskApi) return null;

    try {
        const { data: projects } = await supabase.from('projects')
            .select('id, slug, name').eq('chat_id', ctx.chat.id);

        const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
            `Bugun: ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date())}\n` +
            `Loyihalar: ${(projects || []).map((p) => `${p.id}=${p.slug}`).join(', ') || "yo'q"}\n\n` +
            `Foydalanuvchi xabari:\n"${transcriptHint}"\n\n` +
            `Bu xabarda BAJARILISHI KERAK BO'LGAN ISHLAR yoki SAQLASH KERAK BO'LGAN G'OYALAR bormi?\n\n` +
            `MUHIM: agar bu shunchaki savol, so'rov yoki suhbat bo'lsa — bo'sh qaytar.\n` +
            `Faqat aniq harakat yoki g'oya aytilgan bo'lsa ajrat.\n\n` +
            `FAQAT JSON:\n` +
            `{"confidence":0.0-1.0,"is_question":true/false,"tasks":[{"title":"...","due_date":"YYYY-MM-DD yoki null","due_time":"HH:MM yoki null","project_id":raqam yoki null,"priority":1-5}],"ideas":[{"text":"...","project_id":raqam yoki null}]}\n\n` +
            `is_question — xabarda javob kutilayotgan savol ham bormi.`
        );

        const clean = gen.response.text().replace(/```json|```/g, '').trim();
        const start = clean.search(/[[{]/);
        if (start === -1) return null;
        const r = JSON.parse(clean.slice(start));

        if (!r || r.confidence < 0.7) return null;
        if (!r.tasks?.length && !r.ideas?.length) return null;

        const saved = { tasks: [], ideas: [], isQuestion: r.is_question !== false };

        for (const t of (r.tasks || []).slice(0, 8)) {
            try {
                const row = await taskApi.addTask(ctx.chat.id, t, 'ovoz');
                saved.tasks.push(row);
            } catch (e) { console.warn('Vazifa yozilmadi:', e.message); }
        }

        for (const i of (r.ideas || []).slice(0, 8)) {
            try {
                await supabase.from('project_notes').insert({
                    chat_id: ctx.chat.id, project_id: i.project_id || null,
                    kind: 'gaoya', body: i.text,
                });
                saved.ideas.push(i.text);
            } catch (e) { console.warn("G'oya yozilmadi:", e.message); }
        }

        return saved;
    } catch (e) {
        console.warn('Ajratish xatosi:', e.message);
        return null;
    }
}

// Saqlanganlar ro'yxatini chiroyli ko'rsatish
function savedSummary(saved) {
    const lines = ['📥 Saqlandi'];
    if (saved.tasks.length) {
        lines.push('', `📌 Vazifalar (${saved.tasks.length}):`);
        saved.tasks.forEach((t) => lines.push(`- ${t.title}${t.due_date ? ` — ${t.due_date}` : ''}`));
    }
    if (saved.ideas.length) {
        lines.push('', `💡 G'oyalar (${saved.ideas.length}):`);
        saved.ideas.forEach((i) => lines.push(`- ${i}`));
    }
    lines.push('', `/vazifalar · keraksizini: /ochir <raqam>`);
    return lines.join('\n');
}

// Oxirgi to'liq javob — /matn uchun
const lastFullAnswer = new Map();

// Ovoz ostiga qo'yiladigan qisqa matn xulosa
async function shortSummary(rawText) {
    const plainText = textForSpeech(rawText);

    // Javob qisqa bo'lsa, o'zini beramiz
    if (plainText.length <= 400) return esc(plainText);

    try {
        const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
            `Quyidagi javobning eng muhim mag'zini 2-3 qatorda yoz.\n\n` +
            `Qoidalar:\n` +
            `- Aniq raqamlar, nomlar va sanalarni ALBATTA saqla (ovozda ular yodda qolmaydi)\n` +
            `- 350 belgidan oshmasin\n` +
            `- Formatlash belgilaridan foydalanma\n` +
            `- Kirish so'z yozma, darrov mag'zidan boshla\n\n` +
            `Javob:\n${rawText.slice(0, 6000)}`
        );
        const s = gen.response.text().trim();
        return esc(s.slice(0, 400));
    } catch (e) {
        console.warn('Qisqa xulosa xatosi:', e.message);
        return esc(plainText.slice(0, 350) + '…');
    }
}

// ==================== /matn — oxirgi javobni to'liq ko'rsatish ====================
bot.command('matn', async (ctx) => {
    const full = lastFullAnswer.get(ctx.chat.id);
    if (!full) return ctx.reply("Oxirgi ovozli javob topilmadi.");

    const msg = await ctx.reply('...');
    await sendFormatted(ctx, msg.message_id, full);
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
        const audio = await textToSpeech(textForSpeech(input));
        const ok = await deliverAudio(ctx, audio);

        if (ok) {
            await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `Ovoz yaratildi (${(audio.pcm.length / 1024).toFixed(0)} KB xom), lekin yuborilmadi.\n\nUrinishlar:\n${lastMediaError}`);
        }
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
            `Ovoz yaratilmadi: ${e.message}\n\n${(lastTtsDebug || '').slice(0, 3000)}`);
    }
});

// ==================== CHEKSIZ XOTIRA ====================
const memoryApi = require('./memory')(bot, { genAI, MODEL, supabase, sendFormatted, geminiApiKey });

// ==================== MINI APP ====================
const WEBAPP_URL = process.env.WEBAPP_URL || '';

// Maxfiy kalit — Telegram imzosi ishlamagan holatlar uchun zaxira yo'l.
// Faqat bot yuborgan havolada bo'ladi, ya'ni faqat siz bilasiz.
const APP_KEY = process.env.WEBAPP_KEY || require('crypto').randomBytes(16).toString('hex');
const webappLink = WEBAPP_URL
    ? WEBAPP_URL + (WEBAPP_URL.includes('?') ? '&' : '?') + 'k=' + APP_KEY
    : '';

apiHandler = require('./api')({
    genAI, MODEL, token, myTelegramId, appKey: APP_KEY,
    model, modelNoTools, textToSpeech, pcmToMp3,
    loadHistory, saveHistory, memoryApi, MAX_HISTORY,
});
console.log(WEBAPP_URL ? `📱 Mini App ulandi: ${WEBAPP_URL}` : '📱 Mini App URL qo\'yilmagan (WEBAPP_URL)');

// Xabar maydoni tepasida doimiy turadigan tugma
const voiceKeyboard = webappLink ? {
    keyboard: [[{ text: '🎙 Ovozli suhbat', web_app: { url: webappLink } }]],
    resize_keyboard: true,
    is_persistent: true,
} : undefined;

// Chat menyusidagi tugmani ham Mini App ga bog'lash (ixtiyoriy)
if (webappLink && process.env.WEBAPP_MENU === 'true') {
    bot.telegram.setChatMenuButton({
        chatId: myTelegramId,
        menuButton: { type: 'web_app', text: 'JARVIS', web_app: { url: webappLink } },
    }).then(() => console.log('📱 Menyu tugmasi Mini App ga bog\'landi.'))
        .catch((e) => console.warn('Menyu tugmasi:', e.message));
}

bot.command(['suhbatlash', 'app', 'tugma'], async (ctx) => {
    if (!WEBAPP_URL) {
        return ctx.reply(
            "📱 Mini App manzili qo'yilmagan.\n\n" +
            "Render'da WEBAPP_URL o'zgaruvchisiga sahifa manzilini yozing."
        );
    }
    await ctx.reply('🎙 Tugma qo\'yildi — endi xabar maydoni tepasida turadi.', {
        reply_markup: voiceKeyboard,
    });
});

// ==================== VAZIFALAR ====================
const taskApi = require('./tasks')(bot, { genAI, MODEL, supabase, sendFormatted, myTelegramId });

// ==================== ERTALABKI BRIFING ====================
require('./briefing')(bot, { genAI, MODEL, supabase, sendFormatted, myTelegramId, sendVoiceReply });

// ==================== SOG'LIQ MODULI ====================
require('./health')(bot, { genAI, MODEL, supabase, sendFormatted, myTelegramId });

// ==================== LOYIHALAR MIYASI ====================
require('./projects')(bot, { genAI, MODEL, supabase, sendFormatted });

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

        // Matnda vazifa yoki g'oya aytilganmi — komandasiz ham tushunamiz
        if (m.text && CAPTURE_HINT.test(text) && text.length < 600) {
            const saved = await extractFromVoice(ctx, text, taskApi);
            if (saved && (saved.tasks.length || saved.ideas.length)) {
                await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, savedSummary(saved));
                if (!saved.isQuestion) return;   // faqat yozib qo'yish edi — javob shart emas
            }
        }

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

        // Cheksiz xotiradan mavzuga oid eski yozuvlarni topamiz
        let recalled = [];
        if (m.text && !m.photo && !m.document) {
            recalled = await memoryApi.recall(ctx.chat.id, text);
        }

        const contextText = recalled.length ? memoryApi.asContext(recalled) : '';
        if (contextText) parts[0].text = text + contextText;

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

        // Cheksiz xotiraga yozamiz (fon rejimida — javobni kutdirmaydi)
        memoryApi.remember(
            ctx.chat.id,
            `Humoyun: ${text}${mediaNote}\n\nJARVIS: ${replyText.slice(0, 3000)}`,
            'suhbat'
        ).catch(() => {});

        // Ovozli xabarga javob: OVOZ birinchi, ostiga qisqa matn xulosa
        if (m.voice) {
            lastFullAnswer.set(ctx.chat.id, replyText);

            const spoken = await sendVoiceReply(ctx, replyText, loadingMsg.message_id);

            if (spoken) {
                const summary = await shortSummary(replyText);
                await ctx.reply(`${summary}\n\n📄 To'liq matn: /matn`, { parse_mode: 'HTML' })
                    .catch(() => ctx.reply(`${summary.replace(/<[^>]+>/g, '')}\n\nTo'liq matn: /matn`));
            } else {
                // Ovoz chiqmadi — matnni to'liq beramiz
                await sendFormatted(ctx, loadingMsg.message_id, replyText);
            }
        } else {
            await sendFormatted(ctx, loadingMsg.message_id, replyText);
            if (voiceMode) await sendVoiceReply(ctx, replyText);
        }

        // Ovozli xabarda vazifa yoki g'oya aytilgan bo'lsa — ajratib yozamiz
        if (m.voice) {
            const saved = await extractFromVoice(ctx, text + ' ' + replyText.slice(0, 500), taskApi);
            if (saved && (saved.tasks.length || saved.ideas.length)) {
                await ctx.reply(savedSummary(saved));
            }
        }
    } catch (error) {
        console.error('API Xatolik:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `Xatolik: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== BO'LIMLAR ====================
bot.command(['ingliz', 'english'], (ctx) => ctx.reply(
    `📚 Ingliz tili\n\n` +
    `/eng — bugungi dars\n` +
    `/word — so'z takrori (new / add)\n` +
    `/chunk — so'z birikmalari\n` +
    `/fellar — noto'g'ri fe'llar\n` +
    `/drill — tez tarjima drilli\n` +
    `/talaffuz — talaffuz mashqi\n` +
    `/read — o'qish mashqi\n` +
    `/listen — tinglash topshirig'i\n` +
    `/essay — esse: mavzu + baholash\n` +
    `/write — tayyor matnni baholash\n` +
    `/ielts — IELTS Speaking imtihoni\n` +
    `/speak — suhbat mashqi\n` +
    `/xato — xatolar hisoboti\n` +
    `/test — daraja tekshiruvi\n` +
    `/progress — statistika\n` +
    `/hafta — haftalik hisobot\n` +
    `/reja — haftalik reja`
));

bot.command(['soglik', 'sogliq'], (ctx) => ctx.reply(
    `🏋️ Sog'liq\n\n` +
    `/menyu — bugungi ovqat rejasi\n` +
    `/ovqat — yeganingizni yozish\n` +
    `/suv — +1 stakan\n` +
    `/sport — bugungi mashq\n` +
    `/vazn — vaznni yozish\n` +
    `/tahlil — haftalik tahlil\n` +
    `/tana — tana sozlamalari`
));

bot.command(['ishlar', 'loyihalar'], (ctx) => ctx.reply(
    `📁 Ishlar\n\n` +
    `/bugun — bugungi 3 ta ustuvor ish\n` +
    `/loyiha — loyihalar holati\n` +
    `/gaoya — g'oyani saqlash\n` +
    `/holat — loyiha holatini yangilash\n` +
    `/hisob — moliyaviy hisob-kitob\n` +
    `/harid — tovar tahlili\n` +
    `/prompt — AI vositalar uchun prompt`
));

bot.command('sozlama', (ctx) => ctx.reply(
    `⚙️ Sozlamalar\n\n` +
    `/ovozi — ovozni tanlash\n` +
    `/ovoz — matnni ovozga aylantirish\n` +
    `/suhbat — ovozli rejim\n` +
    `/matn — oxirgi javobni matnda\n` +
    `/xotira — xotira holati\n` +
    `/status — tizim holati\n` +
    `/models — mavjud modellar\n` +
    `/clear — xotirani tozalash\n` +
    `/stop — rejimdan chiqish`
));

bot.command(['yordam', 'help'], (ctx) => ctx.reply(
    `JARVIS — bo'limlar\n\n` +
    `📚 /ingliz — ingliz tili (17 ta mashq)\n` +
    `🏋️ /soglik — ovqat, suv, mashq\n` +
    `📁 /ishlar — loyihalar, g'oyalar, hisob-kitob\n` +
    `⚙️ /sozlama — ovoz, xotira, tizim\n\n` +
    `Kundalik:\n` +
    `/brifing · /vazifalar · /eng · /suhbatlash\n\n` +
    `💡 Komanda yozish shart emas — shunchaki gapiring:\n` +
    `"ertaga soat 3 da Belissimo'ga qo'ng'iroq qilishim kerak"\n` +
    `deb yozsangiz, o'zim vazifaga yozib qo'yaman.`
));

// ==================== KOMANDALAR MENYUSI ====================
const COMMANDS = [
    { command: 'brifing', description: '🌅 Kunlik brifing' },
    { command: 'vazifalar', description: '📌 Ochiq vazifalar' },
    { command: 'bajardim', description: '✅ Vazifani yopish' },
    { command: 'suhbatlash', description: '🎙 Ovozli suhbat' },
    { command: 'eng', description: '📚 Bugungi dars' },
    { command: 'word', description: "🔁 So'z takrori" },
    { command: 'esla', description: '🧠 Eski suhbatlardan qidirish' },
    { command: 'ingliz', description: '📖 Ingliz tili bo\'limi' },
    { command: 'soglik', description: "🏋️ Sog'liq bo'limi" },
    { command: 'ishlar', description: '📁 Ishlar bo\'limi' },
    { command: 'sozlama', description: '⚙️ Sozlamalar' },
    { command: 'yordam', description: '❓ Barcha imkoniyatlar' },
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
