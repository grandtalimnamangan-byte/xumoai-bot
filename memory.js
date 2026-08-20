// ============================================================
//  JARVIS — CHEKSIZ XOTIRA (vektor qidiruv)
//  Har suhbat vektor sifatida saqlanadi, keyin ma'no bo'yicha topiladi
//  /esla · /xotira
// ============================================================

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DIM = 768;

// Bir nechta embedding modelini ketma-ket sinaymiz
const EMBED_MODELS = (process.env.EMBED_MODEL || 'text-embedding-004,gemini-embedding-001,embedding-001')
    .split(',').map((s) => s.trim()).filter(Boolean);

module.exports = function registerMemory(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted, geminiApiKey } = deps;

    const RECALL_LIMIT = parseInt(process.env.RECALL_LIMIT || '5', 10);
    const RECALL_THRESHOLD = parseFloat(process.env.RECALL_THRESHOLD || '0.58');
    const MEMORY_ON = process.env.MEMORY_ON !== 'false';

    let workingModel = null;
    let lastEmbedError = null;

    // ==================== VEKTORLASH ====================
    async function embedOnce(modelName, text, taskType) {
        const res = await fetch(`${API_BASE}/models/${modelName}:embedContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${modelName}`,
                content: { parts: [{ text: text.slice(0, 8000) }] },
                taskType,
                outputDimensionality: DIM,
            }),
        });

        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch { throw new Error(`JSON emas: ${raw.slice(0, 150)}`); }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error?.message || raw.slice(0, 150)}`);

        const vec = data?.embedding?.values;
        if (!Array.isArray(vec)) throw new Error('embedding qaytmadi');
        if (vec.length !== DIM) throw new Error(`o'lcham ${vec.length}, kutilgani ${DIM}`);
        return vec;
    }

    async function embed(text, taskType = 'RETRIEVAL_DOCUMENT') {
        if (workingModel) {
            try { return await embedOnce(workingModel, text, taskType); }
            catch (e) { console.warn(`Embed ${workingModel}: ${e.message}`); workingModel = null; }
        }

        const errors = [];
        for (const m of EMBED_MODELS) {
            try {
                const vec = await embedOnce(m, text, taskType);
                workingModel = m;
                console.log(`Embedding modeli tanlandi: ${m}`);
                return vec;
            } catch (e) {
                errors.push(`${m} → ${e.message}`);
            }
        }
        lastEmbedError = errors.join('\n');
        throw new Error('Hech bir embedding modeli ishlamadi');
    }

    // ==================== SAQLASH ====================
    async function remember(chatId, body, kind = 'suhbat') {
        if (!supabase || !MEMORY_ON) return false;
        if (!body || body.trim().length < 40) return false;   // juda qisqa — saqlashga arzimaydi

        try {
            const vec = await embed(body, 'RETRIEVAL_DOCUMENT');
            const { error } = await supabase.from('memories')
                .insert({ chat_id: chatId, kind, body: body.slice(0, 8000), embedding: vec });
            if (error) throw new Error(error.message);
            return true;
        } catch (e) {
            console.warn('Xotiraga yozilmadi:', e.message);
            return false;
        }
    }

    // ==================== QIDIRISH ====================
    async function recall(chatId, query, limit = RECALL_LIMIT, threshold = RECALL_THRESHOLD) {
        if (!supabase || !MEMORY_ON) return [];
        if (!query || query.trim().length < 8) return [];

        try {
            const vec = await embed(query, 'RETRIEVAL_QUERY');
            const { data, error } = await supabase.rpc('match_memories', {
                p_chat_id: chatId,
                p_query: vec,
                p_limit: limit,
                p_threshold: threshold,
            });
            if (error) throw new Error(error.message);
            return data || [];
        } catch (e) {
            console.warn('Xotiradan qidirilmadi:', e.message);
            return [];
        }
    }

    // Topilganlarni promptga qo'shiladigan matnga aylantirish
    function asContext(rows) {
        if (!rows?.length) return '';
        const lines = rows.map((r) => {
            const d = r.created_at ? r.created_at.slice(0, 10) : '';
            return `[${d}] ${r.body.slice(0, 700)}`;
        });
        return `\n\nOLDINGI SUHBATLARDAN TOPILDI (bular eski yozuvlar, kerak bo'lsa foydalan; ` +
            `savolga aloqasi bo'lmasa e'tibor berma):\n${lines.join('\n---\n')}\n`;
    }

    // ==================== /esla ====================
    bot.command(['esla', 'esla'], async (ctx) => {
        if (!supabase) return ctx.reply("⚠️ Supabase ulanmagan.");
        const q = ctx.message.text.replace(/^\/esla(@\S+)?\s*/i, '').trim();

        if (!q) {
            return ctx.reply(
                "🧠 Foydalanish: /esla <mavzu>\n\n" +
                "Misollar:\n" +
                "- /esla Belissimo narxi\n" +
                "- /esla ingliz tili xatolarim\n" +
                "- /esla noutbuk tanlash\n\n" +
                "Butun suhbat tarixidan ma'no bo'yicha qidiradi."
            );
        }

        const msg = await ctx.reply('Xotiradan qidirilyapti...');
        try {
            const rows = await recall(ctx.chat.id, q, 8, 0.5);

            if (!rows.length) {
                return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    `"${q}" bo'yicha hech nima topilmadi.\n\n` +
                    `Xotira yangi to'lib boryapti — eski suhbatlar unda yo'q.`);
            }

            const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
                `Foydalanuvchi so'radi: "${q}"\n\n` +
                `Uning eski suhbatlaridan topilgan parchalar:\n` +
                rows.map((r) => `[${r.created_at.slice(0, 10)}] ${r.body.slice(0, 900)}`).join('\n---\n') +
                `\n\nShu parchalarga tayanib savolga aniq javob ber. Sanalarni ko'rsat. ` +
                `Parchalarda javob bo'lmasa, ochiq ayt. Muqaddima yozma.\n\n` +
                `Faqat **qalin**, *kursiv* va "-" ro'yxat ishlat.`
            );

            await sendFormatted(ctx, msg.message_id,
                `${gen.response.text()}\n\n_${rows.length} ta yozuvdan topildi_`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /xotira ====================
    bot.command('xotira', async (ctx) => {
        if (!supabase) return ctx.reply("⚠️ Supabase ulanmagan.");

        try {
            const { count } = await supabase.from('memories')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);

            const { data: first } = await supabase.from('memories')
                .select('created_at').eq('chat_id', ctx.chat.id)
                .order('created_at').limit(1).maybeSingle();

            const { data: kinds } = await supabase.from('memories')
                .select('kind').eq('chat_id', ctx.chat.id).limit(1000);

            const byKind = {};
            (kinds || []).forEach((k) => { byKind[k.kind] = (byKind[k.kind] || 0) + 1; });

            ctx.reply(
                `🧠 Cheksiz xotira\n\n` +
                `📊 Yozuvlar: ${count || 0} ta\n` +
                `📅 Boshlangan: ${first?.created_at?.slice(0, 10) || '—'}\n` +
                `🔎 Model: ${workingModel || 'hali aniqlanmagan'}\n` +
                `⚙️ Holat: ${MEMORY_ON ? 'yoqilgan' : "o'chirilgan"}\n\n` +
                (Object.keys(byKind).length
                    ? `Turlari:\n${Object.entries(byKind).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n` : '') +
                `Qidirish: /esla <mavzu>` +
                (lastEmbedError ? `\n\n⚠️ Oxirgi xato:\n${lastEmbedError.slice(0, 500)}` : '')
            );
        } catch (e) {
            ctx.reply(`Xatolik: ${e.message}`);
        }
    });

    console.log('🧠 Cheksiz xotira moduli yuklandi (/esla, /xotira).');

    return { remember, recall, asContext, embed };
};
