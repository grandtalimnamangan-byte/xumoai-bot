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
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3.1-flash-image';
const ENABLE_SEARCH = process.env.ENABLE_SEARCH !== 'false';
const SHOW_CODE = process.env.SHOW_CODE === 'true'; // hisob kodini ko'rsatish
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

// ==================== AI SHAXSIYATI ====================
const systemInstruction = `Sen Humoyunning shaxsiy AI agenti va bosh yordamchisisan. Isming — XumoAI. Unga har doim "Humoyun" deb murojaat qil.

QAMROV: Sen universal yordamchisan. Har qanday sohadagi savolga javob berasan — dunyoviy bilimlar, din, matematika, savdo va moliya, tibbiyot, texnologiya, tarix, huquq.

IXTISOSLASHGAN SOHALARING:
1. Ta'lim tashkilotlari uchun marketing strategiyalari, SMM rejalari, kopirayterlik, Instagram/Telegram postlar.
2. Reels/Shorts uchun kreativ skriptlar, ilgaklar (hooks) va kadrlar.
3. Prompt muhandisligi (Midjourney, DALL-E, Google Veo, Imagen).
4. Ingliz va Arab tillari — tarjima, grammatika, o'quv materiallari tahriri.
5. Vektor grafikasi va web-layoutlar (HTML/Tailwind).
6. SAVDO VA MOLIYA — quyida batafsil.
7. HARID EKSPERTIZASI — quyida batafsil.

SAVDO VA MOLIYA QOIDALARI:
- Ustama (markup) va marja (margin) — ikki xil narsa. Ularni HECH QACHON aralashtirma va har safar qaysi biri hisoblanayotganini aniq ayt.
  Ustama = (sotuv - tannarx) / tannarx. Marja = (sotuv - tannarx) / sotuv.
- Tannarxga faqat tovar narxi emas, yashirin xarajatlar ham kiradi: yetkazib berish, bojxona, yo'qotish/nuqson, saqlash, to'lov tizimi komissiyasi, qadoqlash, reklama. Foydani hisoblashda ularni so'rab ol yoki taxminini alohida belgilab qo'y.
- Aylanma tezligi foyda foizidan muhimroq bo'lishi mumkin — 10% foyda bilan oyiga 5 marta aylangan tovar, 40% foyda bilan yiliga 1 marta aylangandan yaxshiroq. Buni hisobga ol.
- Chegirma foizi foydani foiz bilan emas, ancha keskin kamaytiradi. 20% chegirma 30% marjani 10% ga tushiradi. Har chegirma taklifida shuni ko'rsat.
- "Bo'lib to'lash" va "0% kredit" da yashirin ustama bo'ladi — umumiy to'langan summani naqd narx bilan solishtir.
- O'zbekistonda QQS odatda 12% — lekin stavka o'zgargan bo'lishi mumkin, aniq raqamni tasdiqlashni ayt.
- Investitsiya yoki foyda kafolatini HECH QACHON berma. Faraz va risklarni ochiq yoz.

HARID EKSPERTIZASI (tovar sotib olayotganda):
Tovarni baholaganda quyidagi tartibda yon bos:
- Asosiy vazifasi nima va qaysi 3 ta parametr shu vazifaga haqiqatan ta'sir qiladi.
- Sifat belgilari: material, ishlov sifati, kafolat muddati va kafolat kim tomonidan berilishi, xizmat ko'rsatish markazi bor-yo'qligi, ehtiyot qism topiladimi.
- Yomon tovar belgilari: haddan tashqari arzon narx, noaniq ishlab chiqaruvchi, sertifikat yo'qligi, faqat tashqi ko'rinishga urg'u, sharhlar bir xil uslubda yozilgani, model raqami internetdan topilmasligi.
- Ortiqcha to'lov: brend uchun, keraksiz funksiyalar uchun, "premium" qadoq uchun.
- Umumiy egalik narxi: sarf materiallari, ta'mir, elektr, o'rnatish.
- Aniq tekshirish ro'yxati — do'konda yoki yetkazib berishda nimani o'z ko'zi bilan ko'rish kerak.
- Qachon SOTIB OLMASLIK kerakligini ham ochiq ayt. Har savolga "ha, oling" deb javob berma.
Narx yoki model haqida aniq ma'lumot kerak bo'lsa — Google qidiruvidan foydalan va manba ko'rsat.

JAVOB BERISH QOIDALARI:
- Hech qachon ma'lumot to'qib chiqarma. Aniq bilmasang — "aniq bilmayman" deb ayt.
- Savolni javobsiz qoldirma: nima ma'lum ekanini ayt, keyin aniq takliflar ber.
- Hisob-kitobni bosqichma-bosqich yech, formulani ko'rsat va natijani tekshirib chiq.
- Muhim raqam taxminga asoslangan bo'lsa — "taxmin" deb belgilab qo'y.
- TIBBIYOT: umumiy ma'lumot ber, tashxis qo'yma va dori tayinlama. Shifokorga murojaat qilishni tavsiya qil.
- DIN: ishonchli manbalarga tayan, turli qarashlarni ko'rsat. Fatvo masalalarida olim yoki imomga murojaat qilishni ayt.
- Humoyun xato qilsa yoki g'oyasida kamchilik ko'rsang — ochiq ayt, shunchaki maqtama.

${FORMAT_RULES}

USLUB: professional, ijodiy, aniq va qisqa. O'zbek tilida (zarurat bo'lsa ingliz/arab tillarida). O'rinli emojilardan foydalan.`;

const modelConfig = { model: MODEL, systemInstruction };
if (ENABLE_SEARCH) modelConfig.tools = [{ googleSearch: {} }];

const model = genAI.getGenerativeModel(modelConfig);
const modelNoTools = genAI.getGenerativeModel({ model: MODEL, systemInstruction });

// ==================== ANALITIK MODEL (aniq hisob-kitob) ====================
// codeExecution — model taxmin qilmaydi, haqiqiy kod ishlatib hisoblaydi
const analystInstruction = `Sen Humoyunning moliya va savdo bo'yicha analitigisan. Unga "Humoyun" deb murojaat qil.

MUHIM: har qanday arifmetikani BOSHINGDA hisoblama — har doim kod ishlatib hisobla. Bu majburiy.

Javob tuzilishi:
1. Qanday tushunganingni bir jumlada ayt (kirish ma'lumotlari va farazlar).
2. Kod bilan hisobla.
3. Natijani aniq raqamlarda yoz — birligi bilan (so'm, dona, %, oy).
4. Xulosa va 1-2 ta amaliy tavsiya.

QOIDALAR:
- Ustama (markup) va marja (margin) ni aralashtirma, qaysi biri ekanini aniq yoz.
- Ma'lumot yetishmasa — taxmin qil, LEKIN taxminni ochiq "faraz" deb belgila va natija unga qanchalik bog'liqligini ayt.
- Bir nechta stsenariy (yomon/o'rtacha/yaxshi) foydali bo'lsa, uchalasini ham hisobla.
- Katta raqamlarni o'qishli yoz: 12 500 000 so'm.
- Investitsiya yoki foyda kafolatini berma.

${FORMAT_RULES}

O'zbek tilida javob ber.`;

const analystModel = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: analystInstruction,
    tools: [{ codeExecution: {} }],
});

const promptEnhancer = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: `Sen rasm generatsiya promptlari bo'yicha mutaxassissan. Foydalanuvchi qisqa g'oya beradi — sen uni professional, batafsil INGLIZ TILIDAGI promptga aylantirasan.
Promptga kadr turi, yorug'lik, kompozitsiya, uslub, ranglar va sifat tavsiflarini qo'sh.
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

// ==================== RENDER SERVER ====================
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('XumoAI Bot ishlamoqda!');
}).listen(port, () => console.log(`Render server port ${port} da ishga tushdi.`));

const selfUrl = process.env.RENDER_EXTERNAL_URL;
if (selfUrl) setInterval(() => { fetch(selfUrl).catch(() => {}); }, 14 * 60 * 1000);

// ==================== XAVFSIZLIK ====================
bot.use((ctx, next) => {
    if (ctx.from && ctx.from.id === myTelegramId) return next();
    return ctx.reply("🔒 Kechirasiz, men faqat o'z egamga (Humoyunga) xizmat qilaman.");
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

// codeExecution javobidan matn, kod va natijalarni yig'ish
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

// ==================== RASM GENERATSIYA ====================
async function generateImages(prompt, aspectRatio) {
    const isImagen = /imagen/i.test(IMAGE_MODEL);
    const url = `${API_BASE}/models/${IMAGE_MODEL}:${isImagen ? 'predict' : 'generateContent'}?key=${geminiApiKey}`;

    if (isImagen) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio } }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
        const preds = data.predictions || [];
        if (!preds.length) throw new Error('Model rasm qaytarmadi.');
        return preds.map((p) => Buffer.from(p.bytesBase64Encoded, 'base64'));
    }

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const contentsWithHint = [{ role: 'user', parts: [{ text: `${prompt}\n\nAspect ratio: ${aspectRatio}` }] }];

    const attempts = [
        { contents, generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } } },
        { contents, generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
        { contents: contentsWithHint },
    ];

    let lastErr;
    for (const body of attempts) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

            const rParts = data?.candidates?.[0]?.content?.parts || [];
            const images = rParts.filter((p) => p.inlineData).map((p) => Buffer.from(p.inlineData.data, 'base64'));
            if (!images.length) {
                const reason = data?.candidates?.[0]?.finishReason || '';
                throw new Error(`Model rasm qaytarmadi. ${reason}`.trim());
            }
            return images;
        } catch (e) {
            lastErr = e;
            console.warn('Rasm urinishi muvaffaqiyatsiz:', e.message);
        }
    }
    throw lastErr;
}

// ==================== KOMANDALAR ====================
bot.start(async (ctx) => {
    await clearHistory(ctx.chat.id);
    ctx.reply(
        "🤖 Salom Humoyun! Men XumoAI — sizning universal yordamchingizman.\n\n" +
        "🧮 /hisob — aniq moliyaviy hisob-kitob\n" +
        "🛒 /harid — tovar tahlili va xarid maslahati\n" +
        "🎨 /img — rasm chizish\n" +
        "🧹 /clear — xotirani tozalash\n" +
        "⚙️ /status — holat\n" +
        "📋 /models — mavjud modellar"
    );
});

bot.command('clear', async (ctx) => {
    await clearHistory(ctx.chat.id);
    ctx.reply('🧹 Xotira tozalandi, Humoyun.');
});

bot.command('status', async (ctx) => {
    const h = await loadHistory(ctx.chat.id);
    ctx.reply(
        `⚙️ Matn modeli: ${MODEL}\n` +
        `🎨 Rasm modeli: ${IMAGE_MODEL}\n` +
        `🧠 Xotirada: ${h.length / 2} ta savol-javob\n` +
        `💾 Doimiy xotira: ${supabase ? 'yoqilgan (Supabase)' : "o'chirilgan (RAM)"}\n` +
        `🌐 Qidiruv: ${ENABLE_SEARCH ? 'yoqilgan' : "o'chirilgan"}\n` +
        `🧮 Hisob kodi ko'rinishi: ${SHOW_CODE ? 'yoqilgan' : "o'chirilgan"}`
    );
});

bot.command('models', async (ctx) => {
    const msg = await ctx.reply("⏳ Modellar ro'yxati olinyapti...");
    try {
        const res = await fetch(`${API_BASE}/models?key=${geminiApiKey}&pageSize=200`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

        const names = (data.models || []).map((m) => m.name.replace('models/', ''));
        const images = names.filter((n) => /imagen|image|veo/i.test(n));
        const texts = names.filter((n) => !/imagen|image|veo|embedding|aqa/i.test(n));

        const text =
            `🎨 **Rasm/video modellari (${images.length}):**\n` +
            (images.length ? images.map((n) => `- ${n}`).join('\n') : '- topilmadi') +
            `\n\n💬 **Matn modellari (${texts.length}):**\n` +
            texts.map((n) => `- ${n}`).join('\n');

        await sendFormatted(ctx, msg.message_id, text);
    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
    }
});

// ==================== /hisob — aniq hisob-kitob ====================
bot.command('hisob', async (ctx) => {
    const input = ctx.message.text.replace(/^\/hisob(@\S+)?\s*/i, '').trim();

    if (!input) {
        return ctx.reply(
            "🧮 Foydalanish: /hisob <masala>\n\n" +
            "Misollar:\n" +
            "- /hisob 45000 so'mga oldim, 68000 ga sotyapman. Marja va ustama qancha?\n" +
            "- /hisob 200 dona tovar, dona 12$, yetkazish 300$, bojxona 15%. Tannarx qancha?\n" +
            "- /hisob 30% marjam bor, 20% chegirma qilsam foyda nima bo'ladi?\n" +
            "- /hisob 12 mln so'm, 12 oyga 0% bo'lib to'lash, naqd narxi 9.8 mln. Foydalimi?"
        );
    }

    const loadingMsg = await ctx.reply('🧮 Hisoblanyapti...');

    try {
        const history = await loadHistory(ctx.chat.id);
        const result = await analystModel.generateContent({
            contents: [...history, { role: 'user', parts: [{ text: input }] }],
        });

        const replyText = extractParts(result.response) || "Hisob natijasi bo'sh qaytdi.";

        const newHistory = [
            ...history,
            { role: 'user', parts: [{ text: `[hisob] ${input}` }] },
            { role: 'model', parts: [{ text: replyText }] },
        ].slice(-MAX_HISTORY);

        await saveHistory(ctx.chat.id, newHistory);
        await sendFormatted(ctx, loadingMsg.message_id, replyText);

    } catch (error) {
        console.error('Hisob xatosi:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `❌ Hisoblab bo'lmadi: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== /harid — tovar ekspertizasi ====================
bot.command('harid', async (ctx) => {
    const input = ctx.message.text.replace(/^\/harid(@\S+)?\s*/i, '').trim();

    if (!input) {
        return ctx.reply(
            "🛒 Foydalanish: /harid <tovar yoki savol>\n\n" +
            "Misollar:\n" +
            "- /harid o'quv markazi uchun proyektor, byudjet 5 mln so'm\n" +
            "- /harid montaj uchun noutbuk, 12 mln gacha\n" +
            "- /harid bu changyutgichni olsam bo'ladimi? [model nomi]\n\n" +
            "Byudjet va foydalanish maqsadini yozsangiz, javob aniqroq bo'ladi."
        );
    }

    const loadingMsg = await ctx.reply('🛒 Tahlil qilyapman...');

    try {
        const history = await loadHistory(ctx.chat.id);

        const framed = `Quyidagi xarid bo'yicha to'liq ekspertiza qil.

So'rov: ${input}

Javobda albatta shu bo'limlar bo'lsin:
1. Bu tovarda haqiqatan muhim 3 ta parametr (qolganlari marketing shovqini).
2. Sifatli namunaning belgilari.
3. Yomon/sifatsiz namunaning belgilari — nimadan qochish kerak.
4. Real narx oralig'i (bilmasang, qidiruvdan foydalanib manba ko'rsat; topilmasa "aniq bilmayman" deb ayt).
5. Umumiy egalik narxi — keyinchalik qanday xarajat chiqadi.
6. Sotib olishdan oldingi tekshirish ro'yxati (do'konda nimani o'z ko'zi bilan ko'rish kerak).
7. Qachon BU TOVARNI OLMASLIK kerak — muqobil variant bilan.`;

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

        const newHistory = [
            ...history,
            { role: 'user', parts: [{ text: `[harid] ${input}` }] },
            { role: 'model', parts: [{ text: replyText }] },
        ].slice(-MAX_HISTORY);

        await saveHistory(ctx.chat.id, newHistory);
        await sendFormatted(ctx, loadingMsg.message_id, replyText);

    } catch (error) {
        console.error('Harid tahlili xatosi:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `❌ Xatolik: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== /img ====================
bot.command('img', async (ctx) => {
    let input = ctx.message.text.replace(/^\/img(@\S+)?\s*/i, '').trim();

    if (!input) {
        return ctx.reply(
            "🎨 Foydalanish: /img <tavsif>\n\n" +
            "Nisbat bilan: /img 9:16 tog'da quyosh chiqishi\n" +
            "Qo'llab-quvvatlanadi: 1:1, 3:4, 4:3, 9:16, 16:9\n" +
            "Promptni o'zgartirmasdan: /img ! your exact english prompt"
        );
    }

    let aspectRatio = '1:1';
    const ratioMatch = input.match(/^(1:1|3:4|4:3|9:16|16:9)\s+/);
    if (ratioMatch) {
        aspectRatio = ratioMatch[1];
        input = input.slice(ratioMatch[0].length).trim();
    }

    let raw = false;
    if (input.startsWith('!')) { raw = true; input = input.slice(1).trim(); }

    const loadingMsg = await ctx.reply('🎨 Prompt tayyorlanyapti...');

    try {
        let finalPrompt = input;

        if (!raw) {
            try {
                const enhanced = await promptEnhancer.generateContent(input);
                const t = enhanced.response.text().trim();
                if (t) finalPrompt = t.replace(/^["'`]+|["'`]+$/g, '');
            } catch (e) {
                console.warn('Prompt kuchaytirish xatosi, asl matn ishlatildi:', e.message);
            }
        }

        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '🖌 Rasm chizilyapti...');

        const images = await generateImages(finalPrompt, aspectRatio);
        const caption = `🎨 <b>Prompt:</b>\n${esc(finalPrompt).slice(0, 900)}`;

        await ctx.replyWithPhoto({ source: images[0] }, { caption, parse_mode: 'HTML' });
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    } catch (error) {
        console.error('Rasm generatsiya xatosi:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `❌ Rasm chizilmadi: ${(error.message || "noma'lum").slice(0, 400)}\n\nModel: ${IMAGE_MODEL}`);
    }
});

// ==================== HISOB-KITOBNI AVTOMATIK ANIQLASH ====================
// Komandasiz yozilgan hisob-kitob savollarini ham analitik modelga yo'naltiramiz
const CALC_HINT = /(hisobla|hisob-kitob|foiz|foyda|zarar|chegirma|marja|ustama|tannarx|qqs|nds|kredit|bo['’]?lib to['’]?lash|oylik to['’]?lov|jami qancha|qancha bo['’]?ladi|necha foiz|rentabellik|aylanma)/i;
const hasNumber = (s) => /\d/.test(s);
// ==================== INGLIZ TILI MODULI ====================
require('./english')(bot, { genAI, MODEL, supabase, sendFormatted, esc, myTelegramId, geminiApiKey });

// ==================== ASOSIY ISHLOVCHI ====================
bot.on('message', async (ctx) => {
    const m = ctx.message;
    if (!m.text && !m.photo && !m.voice && !m.audio && !m.document) return;
    if (m.text && m.text.startsWith('/')) return;

    const loadingMsg = await ctx.reply('⏳ Tahlil qilyapman...');

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
                    `⚠️ Bu format hozircha qo'llab-quvvatlanmaydi (${mime || "noma'lum"}). PDF, TXT yoki CSV yuboring.`);
                return;
            }
        }

        const request = { contents: [...history, { role: 'user', parts }] };
        const isCalc = !m.photo && !m.voice && !m.audio && !m.document
            && hasNumber(text) && CALC_HINT.test(text);

        let replyText;

        if (isCalc) {
            // Aniq hisob talab qiladigan savol — analitik modelga
            try {
                await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, '🧮 Hisoblanyapti...');
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

        const newHistory = [
            ...history,
            { role: 'user', parts: [{ text: text + mediaNote }] },
            { role: 'model', parts: [{ text: replyText }] },
        ].slice(-MAX_HISTORY);

        await saveHistory(ctx.chat.id, newHistory);
        await sendFormatted(ctx, loadingMsg.message_id, replyText);

    } catch (error) {
        console.error('API Xatolik:', error);
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `❌ Xatolik: ${(error.message || "noma'lum").slice(0, 300)}`);
    }
});

// ==================== ISHGA TUSHIRISH ====================
async function startBot(attempt = 1) {
    try {
        console.log(`🤖 XumoAI Bot ishga tushyapti (urinish ${attempt})...`);
        await bot.launch({ dropPendingUpdates: true });
    } catch (e) {
        console.error(`Ishga tushirish xatosi (${attempt}):`, e.message);
        if (attempt < 12) {
            const delay = Math.min(attempt * 5000, 30000);
            console.log(`${delay / 1000}s dan keyin qayta urinaman...`);
            setTimeout(() => startBot(attempt + 1), delay);
        } else {
            console.error("Bot ishga tushmadi — boshqa nusxa ishlayotgan bo'lishi mumkin.");
        }
    }
}

// ==================== KOMANDALAR MENYUSI ====================
const COMMANDS = [
    { command: 'eng',      description: "📚 Bugungi dars" },
    { command: 'word',     description: "🔁 So'z takrori (new / add)" },
    { command: 'xato',     description: "📊 Xatolar hisoboti + mashq" },
    { command: 'read',     description: "📖 O'qish mashqi" },
    { command: 'listen',   description: "🎧 Tinglash topshirig'i" },
    { command: 'essay',    description: "✍️ Esse: mavzu + baholash" },
    { command: 'ielts',    description: "🎤 IELTS Speaking imtihoni" },
    { command: 'speak',    description: "💬 Danny bilan suhbat" },
    { command: 'write',    description: "📝 Tayyor matnni baholash" },
    { command: 'test',     description: "🎯 Daraja tekshiruvi" },
    { command: 'progress', description: "📈 Statistika" },
    { command: 'reja',     description: "📅 Haftalik reja" },
    { command: 'hisob',    description: "🧮 Moliyaviy hisob-kitob" },
    { command: 'harid',    description: "🛒 Tovar tahlili" },
    { command: 'img',      description: "🎨 Rasm chizish" },
    { command: 'stop',     description: "🛑 Rejimdan chiqish" },
    { command: 'clear',    description: "🧹 Xotirani tozalash" },
    { command: 'status',   description: "⚙️ Bot holati" },
    { command: 'models',   description: "📋 Mavjud modellar" },
    { command: 'start',    description: "🤖 Boshlash" },
        { command: 'chunk',    description: "🧱 So'z birikmalari" },
    { command: 'drill',    description: "⚡ Tez tarjima drilli" },
    { command: 'talaffuz', description: "🗣 Talaffuz mashqi" },
];

bot.telegram.setMyCommands(COMMANDS)
    .then(() => console.log('📋 Komandalar menyusi o\'rnatildi.'))
    .catch((e) => console.warn('Menyu o\'rnatilmadi:', e.message));
startBot();

process.on('unhandledRejection', (r) => console.error('Ushlanmagan rad etish:', r?.message || r));
process.on('uncaughtException', (e) => console.error('Ushlanmagan xato:', e?.message || e));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
