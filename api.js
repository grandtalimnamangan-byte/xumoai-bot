// ============================================================
//  JARVIS — MINI APP API
//  Telegram Mini App bilan gaplashadigan qism
// ============================================================

const crypto = require('crypto');

module.exports = function createApi(deps) {
    const {
        genAI, MODEL, token, myTelegramId,
        model, modelNoTools, textToSpeech, pcmToMp3,
        loadHistory, saveHistory, memoryApi, MAX_HISTORY,
    } = deps;

    // ==================== TELEGRAM IMZOSINI TEKSHIRISH ====================
    // Telegram mijoz versiyasiga qarab initData tarkibi farq qiladi,
    // shuning uchun bir necha variantni ketma-ket sinaymiz.
    let lastAuthDebug = null;

    function buildHash(params, exclude) {
        const p = new URLSearchParams(params.toString());
        exclude.forEach((k) => p.delete(k));

        const dataCheck = [...p.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
        return crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
    }

    function checkInitData(initData) {
        if (!initData) { lastAuthDebug = 'initData bo\'sh'; return null; }

        try {
            const params = new URLSearchParams(initData);
            const hash = params.get('hash');
            if (!hash) { lastAuthDebug = 'hash maydoni yo\'q'; return null; }

            // 1-variant: faqat hash chiqariladi (rasmiy hujjat bo'yicha)
            // 2-variant: hash va signature chiqariladi (yangi mijozlar)
            const variants = [['hash'], ['hash', 'signature']];
            let matched = false;
            const calcs = [];

            for (const ex of variants) {
                const calc = buildHash(params, ex);
                calcs.push(`${ex.join('+')}: ${calc.slice(0, 12)}`);
                if (calc === hash) { matched = true; break; }
            }

            if (!matched) {
                lastAuthDebug =
                    `hash mos kelmadi\n` +
                    `kelgan: ${hash.slice(0, 12)}\n` +
                    `hisoblangan → ${calcs.join(' | ')}\n` +
                    `maydonlar: ${[...params.keys()].join(', ')}`;
                console.warn('Mini App imzosi:', lastAuthDebug);
                return null;
            }

            // Eskirgan imzo (24 soatdan oshgan) qabul qilinmaydi
            const authDate = parseInt(params.get('auth_date') || '0', 10);
            if (authDate && Date.now() / 1000 - authDate > 86400) {
                lastAuthDebug = 'imzo eskirgan — Mini App ni qayta oching';
                return null;
            }

            const user = JSON.parse(params.get('user') || '{}');
            if (!user.id) { lastAuthDebug = 'user maydoni yo\'q'; return null; }

            lastAuthDebug = null;
            return user;
        } catch (e) {
            lastAuthDebug = `tekshirishda xato: ${e.message}`;
            return null;
        }
    }

    function json(res, code, obj) {
        const body = JSON.stringify(obj);
        res.writeHead(code, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
    }

    function readBody(req, limit = 12 * 1024 * 1024) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let size = 0;
            req.on('data', (c) => {
                size += c.length;
                if (size > limit) { reject(new Error('Fayl juda katta')); req.destroy(); return; }
                chunks.push(c);
            });
            req.on('end', () => {
                try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
                catch (e) { reject(new Error('JSON xato')); }
            });
            req.on('error', reject);
        });
    }

    // ==================== JAVOB TAYYORLASH ====================
    async function answer(chatId, parts, plainText) {
        const history = await loadHistory(chatId);

        // Cheksiz xotiradan kontekst
        let ctxText = '';
        if (plainText && plainText.length > 8) {
            try {
                const rows = await memoryApi.recall(chatId, plainText);
                ctxText = memoryApi.asContext(rows);
            } catch { /* xotira ishlamasa ham javob beramiz */ }
        }

        const finalParts = [...parts];
        if (ctxText && finalParts[0]?.text) finalParts[0] = { text: finalParts[0].text + ctxText };

        const request = { contents: [...history, { role: 'user', parts: finalParts }] };

        let text;
        try {
            const r = await model.generateContent(request);
            text = r.response.text();
        } catch (e) {
            const r = await modelNoTools.generateContent(request);
            text = r.response.text();
        }

        if (!text) text = "Javob bo'sh qaytdi.";

        await saveHistory(chatId, [
            ...history,
            { role: 'user', parts: [{ text: plainText || '[ovozli xabar]' }] },
            { role: 'model', parts: [{ text }] },
        ].slice(-MAX_HISTORY));

        memoryApi.remember(chatId,
            `Humoyun: ${plainText || '[ovoz]'}\n\nJARVIS: ${text.slice(0, 3000)}`, 'suhbat').catch(() => {});

        return text;
    }

    // Javobni ovozga aylantirish
    async function speak(text) {
        try {
            const clean = text
                .replace(/```[\s\S]*?```/g, ' ')
                .replace(/[*_#`>]/g, '')
                .replace(/https?:\/\/\S+/g, ' havola ')
                .replace(/[\p{Extended_Pictographic}]/gu, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1500);

            if (!clean) return null;
            const audio = await textToSpeech(clean);
            const mp3 = await pcmToMp3(audio.pcm, audio.rate);
            return mp3.toString('base64');
        } catch (e) {
            console.warn('Mini App ovozi yaratilmadi:', e.message);
            return null;
        }
    }

    // ==================== SO'ROVLARNI QABUL QILISH ====================
    return async function handle(req, res) {
        const url = req.url.split('?')[0];
        if (!url.startsWith('/api/')) return false;

        // Brauzer tekshiruvi
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            });
            res.end();
            return true;
        }

        if (url === '/api/health') {
            json(res, 200, { ok: true, name: 'JARVIS' });
            return true;
        }

        if (req.method !== 'POST') {
            json(res, 405, { error: 'POST kerak' });
            return true;
        }

        let body;
        try { body = await readBody(req); }
        catch (e) { json(res, 400, { error: e.message }); return true; }

        const user = checkInitData(body.initData || '');
        if (!user) {
            json(res, 401, { error: `Imzo tekshirilmadi\n\n${lastAuthDebug || ''}` });
            return true;
        }
        if (user.id !== myTelegramId) { json(res, 403, { error: 'Ruxsat yo\'q' }); return true; }

        try {
            // --- Ovozli so'rov ---
            if (url === '/api/voice') {
                if (!body.audio) { json(res, 400, { error: 'Audio yo\'q' }); return true; }

                const parts = [
                    { text: "Foydalanuvchi ovozli savol berdi. Eshit va javob ber. Javob qisqa va aniq bo'lsin — u ovozda tinglanadi." },
                    { inlineData: { data: body.audio, mimeType: body.mime || 'audio/wav' } },
                ];

                const text = await answer(myTelegramId, parts, null);
                const audio = await speak(text);
                json(res, 200, { text, audio });
                return true;
            }

            // --- Matnli so'rov ---
            if (url === '/api/text') {
                const t = (body.text || '').trim();
                if (!t) { json(res, 400, { error: 'Matn yo\'q' }); return true; }

                const text = await answer(myTelegramId, [{ text: t }], t);
                const audio = body.speak === false ? null : await speak(text);
                json(res, 200, { text, audio });
                return true;
            }

            json(res, 404, { error: 'Topilmadi' });
            return true;
        } catch (e) {
            console.error('Mini App xatosi:', e);
            json(res, 500, { error: e.message });
            return true;
        }
    };
};
