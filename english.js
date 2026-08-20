// ============================================================
//  JARVIS — INGLIZ TILI MODULI v4
//  Grammar · Vocabulary · Chunks · Drill · Pronunciation
//  Listening · Reading · Writing · Speaking · Xatolar jurnali
// ============================================================

const cron = require('node-cron');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const BOX_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };
const MAX_BOX = 5;

const SYLLABUS = `
BOSQICH 1 (kun 1-60) — A1 → A2:
to be, have got, artikllar, Present Simple (3-shaxs -s), Present Continuous, Past Simple (to'g'ri va noto'g'ri fe'llar), ko'plik, sanaladigan/sanalmaydigan, there is/are, so'roq va inkor, sifat tartibi. 800 ta asosiy so'z.

BOSQICH 2 (kun 61-150) — A2 → B1:
Present Perfect va Past Simple farqi, Future (will / going to / Present Continuous), modallar (can, must, should, have to), 1-2 shart gaplar, comparative/superlative, gerund va infinitiv. 2000 so'z.

BOSQICH 3 (kun 151-270) — B1 → B2:
Passive voice, relative clauses, 3-shart va mixed conditionals, reported speech, phrasal verbs, collocations, so'z yasalishi. 4000 so'z. IELTS format bilan tanishuv.

BOSQICH 4 (kun 271-390) — B2, IELTS mashqi:
Listening 4 qism, Reading strategiyalari, Writing Task 1 va 2, Speaking 3 qism. Akademik lug'at, linking words, paraphrasing.

BOSQICH 5 (kun 391-450) — Band 7:
To'liq mock testlar, vaqt boshqaruvi, xatolar ustida ish, murakkab tuzilmalar, ravonlik.
`;

// Haftalik aylanma — har kuni so'z + grammatika, ustiga kunlik fokus
const WEEK_FOCUS = {
    Mon: { name: 'Grammatika + birikmalar', cmd: '/chunk' },
    Tue: { name: 'Tinglash (audio)', cmd: '/audio' },
    Wed: { name: 'Artikl va predloglar', cmd: '/artikl' },
    Thu: { name: 'Writing / Essay', cmd: '/essay' },
    Fri: { name: 'Speaking (IELTS)', cmd: '/ielts' },
    Sat: { name: 'Phrasal verbs + xatolar', cmd: '/phrasal' },
    Sun: { name: 'Haftalik hisobot + yengil takror', cmd: '/hafta' },
};

const FORMAT = `FORMATLASH: faqat **qalin**, *kursiv*, \`kod\` va "-" ro'yxatlardan foydalan. ### sarlavha, --- chiziq, jadval va > sitatadan FOYDALANMA. Bo'lim kerak bo'lsa emoji + **qalin sarlavha**.`;

module.exports = function registerEnglish(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted, myTelegramId, geminiApiKey, speak } = deps;
    const TTS_MODEL = process.env.TTS_MODEL || 'gemini-2.5-flash-preview-tts';

    const plain = () => genAI.getGenerativeModel({ model: MODEL });

    // ==================== PERSONALAR ====================
    const teacher = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: `Sen Mr. Grim — Humoyunning jahldor, talabchan ingliz tili ustozisan.

XARAKTER:
- Qattiqqo'l, lekin adolatli. Bo'sh maqtov yo'q.
- XATO uchun HECH QACHON so'kma — xatoni sovuqqonlik bilan tushuntir.
- DANGASALIK uchun (dars qoldirish, yarim ishlash) o'zbekcha hazil qarg'ishlar: "Paloving tuzsiz chiqsin!", "Telefoning 1% da qolib ketsin!". Faqat dangasalikka, hech qachon shaxsga emas.

DARS TUZILISHI:
1. 🔥 **Bugungi maqsad** — 1 jumla.
2. 📖 **Nazariya** — o'zbekcha, 5-7 jumla. Qoidani o'zbek tili bilan solishtir.
3. 🧩 **Mashqlar** — 8-10 ta, turli xil: bo'sh joy, tarjima, xatoni top, qayta yoz.
4. 💬 **Jonli topshiriq** — Humoyun SMM menejer, o'quv markazida ishlaydi, kontent yaratadi. Mashqlarni shu hayotga bog'la.
5. ✍️ **Uy vazifasi** — 1 ta yozma topshiriq.

QOIDALAR:
- Javoblarni BERMA. Humoyun yozgandan keyin tekshirasan.
- Tushuntirish o'zbekcha, mashq inglizcha.
- Har darsda oldingi mavzulardan 2 ta savol takrorla.
- Zerikarli bo'lma: real vaziyatlar, kutilmagan misollar.

MAJBURIY: darsning eng oxirida, alohida qatorda, shu darsda uchragan 6 ta yangi so'zni quyidagi formatda yoz:
WORDS=word1|o'zbekcha ma'no;word2|o'zbekcha ma'no;...

${FORMAT}`,
    });

    const buddy = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: `Sen Danny — Humoyunning ingliz tilida gaplashadigan DO'STIsan. O'qituvchi EMAS.

- Unga "my friend" deb murojaat qil.
- INGLIZ TILIDA gaplash, uning darajasiga moslab (A1-A2: sodda gaplar, keng tarqalgan so'zlar).
- Tushunmasa — o'zbekcha tushuntir, keyin inglizchaga qayt.
- Hazillash, o'zingdan gapir. Suhbat tabiiy bo'lsin, so'roq emas.
- XATO qilsa: suhbatni davom ettir, keyin qavsda qisqa tuzatish + o'zbekcha hazil qarg'ish: "telefoning qizib o'chib qolgur, 'he go' emas 'he goes'!".
- Har javob oxirida bitta savol bo'lsin.
- Uzun ma'ruza yozma — 3-5 jumla.

${FORMAT}`,
    });

    const examiner = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: `Sen IELTS Writing bo'yicha rasmiy imtihonchisan.

MEZONLAR (har biri 0-9): Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.

JAVOB:
1. 🎯 **Umumiy band** — 0.5 aniqlikda.
2. 📊 **Mezonlar** — har biri uchun ball va 1-2 jumla sabab.
3. ❌ **Xatolar** — 5-8 ta: xato → to'g'risi → nega.
4. 🔁 **Kuchaytirilgan variant** — 1 band yuqori versiya.
5. 🎯 **Keyingi safar** — 3 ta aniq harakat.

Ballni oshirib yuborma. Haqiqiy imtihonchi qanday baholasa, shunday. Tushuntirish o'zbekcha, misol inglizcha.

${FORMAT}`,
    });

    // ==================== YORDAMCHILAR ====================
    const noDb = () => "⚠️ Supabase ulanmagan. Render'da SUPABASE_URL va SUPABASE_KEY ni tekshiring.";
    const fmtDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    const today = () => fmtDate(new Date());
    const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmtDate(d); };
    const weekday = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tashkent', weekday: 'short' }).format(new Date());

    async function getProfile(chatId) {
        if (!supabase) return null;
        const { data } = await supabase.from('eng_profile').select('*').eq('chat_id', chatId).maybeSingle();
        if (data) return data;
        const fresh = { chat_id: chatId, level: 'A1', day_number: 0, streak: 0, weak_points: [] };
        await supabase.from('eng_profile').insert(fresh);
        return fresh;
    }

    async function saveProfile(chatId, patch) {
        if (!supabase) return;
        await supabase.from('eng_profile')
            .upsert({ chat_id: chatId, ...patch, updated_at: new Date().toISOString() });
    }

    async function setMode(chatId, mode) {
        if (!supabase) return;
        await supabase.from('eng_profile')
            .update({ mode, mode_at: mode ? new Date().toISOString() : null })
            .eq('chat_id', chatId);
    }

    async function logActivity(chatId, activity, score = null, notes = null) {
        if (!supabase) return;
        await supabase.from('eng_log').insert({ chat_id: chatId, activity, score, notes });
    }

    function parseJson(text) {
        const clean = text.replace(/```json|```/g, '').trim();
        const start = clean.search(/[[{]/);
        if (start === -1) return null;
        try { return JSON.parse(clean.slice(start)); } catch { return null; }
    }

    // Yangi so'zlarni bazaga yozish — ERTAGA takrorga chiqadi
    async function addWords(chatId, words, type = 'word') {
        if (!supabase || !words?.length) return 0;
        const rows = words.map((w) => ({
            chat_id: chatId, word: w.word, meaning: w.meaning,
            example: w.example || null, box: 1, next_review: addDays(1), type,
        }));
        await supabase.from('eng_vocab').upsert(rows, { onConflict: 'chat_id,word' });
        return rows.length;
    }

    // ==================== XATOLAR BAZASI ====================
    // Har tekshiruvdan keyin modeldan MISTAKES= qatorini olib, bazaga yozamiz
    const MISTAKE_SPEC = `
MAJBURIY: javobing eng oxirida, alohida qatorda, o'quvchi qilgan xatolarni shu formatda yoz (xato bo'lmasa MISTAKES=none):
MISTAKES=kategoriya|grammatik mavzu|xato yozgani|to'g'risi;kategoriya|mavzu|xato|to'g'ri;...
kategoriya faqat shulardan biri: grammar, vocab, spelling, structure
mavzu qisqa va aniq bo'lsin, masalan: "3rd person -s", "Past Simple irregular", "article a/an/the", "word order"`;

    function stripMeta(text) {
        return text.replace(/MISTAKES=.*/is, '').replace(/WORDS=.*/is, '').replace(/TOPIC=.*/i, '').trim();
    }

    async function recordMistakes(chatId, text) {
        if (!supabase) return 0;
        const m = text.match(/MISTAKES=(.+)/i);
        if (!m || /^\s*none\s*$/i.test(m[1])) return 0;

        const items = m[1].split(';').map((chunk) => {
            const [category, topic, wrong, correct] = chunk.split('|').map((s) => (s || '').trim());
            if (!topic) return null;
            return {
                category: ['grammar', 'vocab', 'spelling', 'structure'].includes(category) ? category : 'grammar',
                topic: topic.slice(0, 80),
                wrong: (wrong || '').slice(0, 120),
                correct: (correct || '').slice(0, 120),
            };
        }).filter(Boolean);

        for (const it of items) {
            try {
                const { data: ex } = await supabase.from('eng_mistakes')
                    .select('id, count').eq('chat_id', chatId)
                    .eq('topic', it.topic).eq('wrong', it.wrong).maybeSingle();

                if (ex) {
                    await supabase.from('eng_mistakes')
                        .update({ count: ex.count + 1, last_seen: today() }).eq('id', ex.id);
                } else {
                    await supabase.from('eng_mistakes')
                        .insert({ chat_id: chatId, ...it, count: 1, last_seen: today() });
                }
            } catch (e) { console.warn('Xato yozishda muammo:', e.message); }
        }
        return items.length;
    }

    async function getTopMistakes(chatId, limit = 8) {
        if (!supabase) return [];
        const { data } = await supabase.from('eng_mistakes')
            .select('category, topic, wrong, correct, count')
            .eq('chat_id', chatId).order('count', { ascending: false }).limit(limit);
        return data || [];
    }

    // ==================== MAVZULAR JURNALI ====================
    async function recordTopic(chatId, dayNumber, topic) {
        if (!supabase || !topic) return;
        try {
            await supabase.from('eng_topics')
                .insert({ chat_id: chatId, day_number: dayNumber, topic: topic.slice(0, 120) });
        } catch (e) { console.warn('Mavzu yozishda muammo:', e.message); }
    }

    async function getTopics(chatId, limit = 40) {
        if (!supabase) return [];
        const { data } = await supabase.from('eng_topics')
            .select('day_number, topic').eq('chat_id', chatId)
            .order('day_number', { ascending: false }).limit(limit);
        return data || [];
    }

    // ==================== TTS (matndan ovoz) ====================
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

    async function textToSpeech(text, voice = 'Kore') {
        const res = await fetch(`${API_BASE}/models/${TTS_MODEL}:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text }] }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
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

    // Render'da Buffer orqali yuklash ulanishni uzadi — vaqtinchalik faylga yozib, oqim bilan yuboramiz
    async function sendAudioSafe(ctx, wav, caption) {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');

        const sizeMb = (wav.length / 1024 / 1024).toFixed(2);
        const file = path.join(os.tmpdir(), `listen_${ctx.chat.id}_${Date.now()}.wav`);
        console.log(`Audio hajmi: ${sizeMb} MB → ${file}`);

        try {
            fs.writeFileSync(file, wav);
        } catch (e) {
            console.error('Faylga yozib bo\'lmadi:', e.message);
            return false;
        }

        const cleanup = () => { try { fs.unlinkSync(file); } catch {} };

        for (let i = 1; i <= 3; i++) {
            try {
                await ctx.replyWithAudio({ source: fs.createReadStream(file) }, { caption });
                cleanup();
                return true;
            } catch (e) {
                console.warn(`sendAudio urinish ${i}:`, e.message);
                if (i < 3) await new Promise((r) => setTimeout(r, 3000 * i));
            }
        }

        try {
            await ctx.replyWithDocument({ source: fs.createReadStream(file) }, { caption });
            cleanup();
            return true;
        } catch (e) {
            console.error('sendDocument ham xato:', e.message);
            cleanup();
            return false;
        }
    }

    // ==================== SESSIYALAR ====================
    const sessions = new Map(); // chatId -> { type, data }

    async function guardSession(ctx, type) {
        const s = sessions.get(ctx.chat.id);
        if (!s || s.type !== type) {
            await setMode(ctx.chat.id, null);
            await ctx.reply('⚠️ Mashq sessiyasi yo\'qolgan (bot qayta ishga tushgan). Komandani qaytadan yuboring.');
            return null;
        }
        return s.data;
    }

    // ==================== /reja ====================
    bot.command('reja', async (ctx) => {
        const p = await getProfile(ctx.chat.id);
        const wd = weekday();
        const lines = Object.entries(WEEK_FOCUS).map(([k, v]) =>
            `${k === wd ? '👉' : '  '} ${{ Mon: 'Dush', Tue: 'Sesh', Wed: 'Chor', Thu: 'Pay', Fri: 'Jum', Sat: 'Shan', Sun: 'Yak' }[k]} — ${v.name}`
        );
        ctx.reply(
            `📅 Haftalik reja, Humoyun\n\n` +
            `Har kuni doimiy:\n` +
            `  06:40-07:40 — grammatika + yangi so'zlar (/eng)\n` +
            `  ~13:30 — so'z takrori 25 daq (/word)\n` +
            `  21:00-22:00 — kunlik fokus\n\n` +
            `Kunlik fokus:\n${lines.join('\n')}\n\n` +
            `Bugun: ${WEEK_FOCUS[wd].name}${WEEK_FOCUS[wd].cmd ? ` → ${WEEK_FOCUS[wd].cmd}` : ''}\n` +
            `Dastur kuni: ${p?.day_number || 0} / 450`
        );
    });

    // ==================== /eng — BUGUNGI DARS ====================
    bot.command('eng', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('📚 Mr. Grim darsni tayyorlayapti...');

        try {
            const p = await getProfile(ctx.chat.id);

            if (p.last_day === today()) {
                const wd = weekday();
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    `📌 Kun ${p.day_number} darsi bugun allaqachon berilgan.\n\n` +
                    `Bugungi fokus: ${WEEK_FOCUS[wd].name}${WEEK_FOCUS[wd].cmd ? `\n→ ${WEEK_FOCUS[wd].cmd}` : ''}\n\n` +
                    `Takror: /word`);
                return;
            }

            const newDay = p.day_number + 1;
            const streak = (p.last_day === addDays(-1)) ? p.streak + 1 : 1;
            const bestStreak = Math.max(p.best_streak || 0, streak);

            // Uzilish bo'lganmi? 3+ kun tanaffusdan keyin tiklanish rejimi
            let recoveryUntil = p.recovery_until || null;
            let gapDays = 0;
            if (p.last_day) {
                gapDays = Math.round((new Date(today()) - new Date(p.last_day)) / 86400000);
                if (gapDays >= 3) recoveryUntil = addDays(3);
            }
            const inRecovery = recoveryUntil && recoveryUntil >= today();
            const wd = weekday();
            const weak = (p.weak_points || []).join(', ') || 'hali aniqlanmagan';

            const covered = await getTopics(ctx.chat.id, 40);
            const mistakes = await getTopMistakes(ctx.chat.id, 8);

            const coveredList = covered.length
                ? covered.map((t) => `kun ${t.day_number}: ${t.topic}`).join('\n')
                : 'hali yo\'q';

            const mistakeList = mistakes.length
                ? mistakes.map((m) => `- ${m.topic} (${m.count} marta): "${m.wrong}" → "${m.correct}"`).join('\n')
                : 'hali yozilmagan';

            // Spiral takror: 7 va 21 kun oldingi mavzular
            const spiral = covered.filter((t) => [newDay - 7, newDay - 21].includes(t.day_number))
                .map((t) => t.topic).join(', ') || 'yo\'q';

            const result = await teacher.generateContent(
                `Bugungi darsni tuz.

- Kun raqami: ${newDay}
- Daraja: ${p.level}
- Streak: ${streak} kun
- Bugungi haftalik fokus: ${WEEK_FOCUS[wd].name}
- Zaif nuqtalar: ${weak}
${inRecovery ? `\n⚠️ TIKLANISH REJIMI: Humoyun ${gapDays} kun tanaffusdan keyin qaytdi. Bugungi dars YENGIL bo'lsin — 5-6 ta mashq, nazariya qisqa, mavzu oson. Uni koyima, qaytgani muhim. Bir jumlada qaytganini qadrla, keyin darsga o't.\n` : ''}

ALLAQACHON O'TILGAN MAVZULAR (bularni QAYTA berma, yangi mavzu ol):
${coveredList}

TAKRORLANAYOTGAN XATOLAR (mashqlarning kamida 3 tasi aynan shu xatolarga qaratilsin):
${mistakeList}

SPIRAL TAKROR (mashqlarning 2 tasi shu eski mavzulardan bo'lsin): ${spiral}

Dastur rejasi (chetga chiqma):
${SYLLABUS}

Kun ${newDay} qaysi bosqichga to'g'ri kelsa, o'sha bosqichdan hali o'tilmagan BITTA mavzu ol.
Oxirida WORDS= qatori va alohida qatorda TOPIC=<mavzu nomi> yoz.`
            );

            let lesson = result.response.text();

            // Mavzuni yozib qo'yamiz
            const tm = lesson.match(/TOPIC=(.+)/i);
            await recordTopic(ctx.chat.id, newDay, tm ? tm[1].trim() : `kun ${newDay}`);

            // Yangi so'zlarni ajratib olish
            const wm = lesson.match(/WORDS=(.+)/i);
            let added = 0;
            if (wm) {
                const words = wm[1].split(';').map((chunk) => {
                    const [word, meaning] = chunk.split('|');
                    return word && meaning ? { word: word.trim(), meaning: meaning.trim() } : null;
                }).filter(Boolean);
                added = await addWords(ctx.chat.id, words);
            }
            lesson = stripMeta(lesson);

            await saveProfile(ctx.chat.id, {
                level: p.level, day_number: newDay, streak, last_day: today(),
                weak_points: p.weak_points, mode: 'lesson',
                best_streak: bestStreak, recovery_until: recoveryUntil,
            });
            await logActivity(ctx.chat.id, 'lesson', null, `kun ${newDay}`);

            const footer = `\n\n📝 ${added} ta yangi so'z bazaga yozildi — **ertaga** /word da so'raladi.` +
                (WEEK_FOCUS[wd].cmd ? `\n🎯 Bugungi fokus: ${WEEK_FOCUS[wd].name} → ${WEEK_FOCUS[wd].cmd}` : '');

            const daysLeft = p.target_date
                ? Math.round((new Date(p.target_date) - new Date(today())) / 86400000) : null;
            const examTag = daysLeft != null ? ` · 🎯 ${daysLeft} kun` : '';

            const header = inRecovery
                ? `🌱 **Kun ${newDay}** · Tiklanish rejimi · Eng uzun streak: ${bestStreak} kun${examTag}`
                : `🔥 **Kun ${newDay}** · Streak: ${streak}${bestStreak > streak ? ` (rekord: ${bestStreak})` : ''} · Daraja: ${p.level}${examTag}`;

            await sendFormatted(ctx, msg.message_id, `${header}\n\n${lesson}${footer}`);

        } catch (e) {
            console.error('Dars xatosi:', e);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== /word ====================
    bot.command('word', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/word(@\S+)?\s*/i, '').trim();

        if (/^new$/i.test(arg)) {
            const msg = await ctx.reply("📝 Yangi so'zlar tanlanyapti...");
            try {
                const p = await getProfile(ctx.chat.id);
                const { data: existing } = await supabase
                    .from('eng_vocab').select('word').eq('chat_id', ctx.chat.id).limit(500);
                const known = (existing || []).map((r) => r.word).join(', ');

                const gen = await plain().generateContent(
                    `${p.level} darajadagi o'zbek o'quvchisi uchun 10 ta YANGI, kundalik hayotda eng ko'p ishlatiladigan inglizcha so'z tanla.
Allaqachon o'rganilgan, QAYTARMA: ${known || "yo'q"}

FAQAT JSON massiv qaytar:
[{"word":"...","meaning":"o'zbekcha ma'nosi","example":"inglizcha qisqa misol"}]`
                );

                const words = parseJson(gen.response.text());
                if (!Array.isArray(words) || !words.length) throw new Error("So'zlar olinmadi");

                await addWords(ctx.chat.id, words);
                await logActivity(ctx.chat.id, 'vocab_new', words.length);

                await sendFormatted(ctx, msg.message_id,
                    `📝 **10 ta yangi so'z**\n\n` +
                    words.map((w, i) => `${i + 1}. **${w.word}** — ${w.meaning}\n   *${w.example || ''}*`).join('\n\n') +
                    `\n\n⏰ **Ertaga** /word yuboring — shu so'zlar so'raladi.`);
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
            }
            return;
        }

        if (/^add\s+/i.test(arg)) {
            const [word, meaning] = arg.replace(/^add\s+/i, '').split(/\s*[-—]\s*/);
            if (!word || !meaning) return ctx.reply('Format: /word add book - kitob');
            await addWords(ctx.chat.id, [{ word: word.trim(), meaning: meaning.trim() }]);
            return ctx.reply(`✅ ${word.trim()} qo'shildi. Ertaga so'raladi.`);
        }

        const msg = await ctx.reply("🔁 Takror uchun so'zlar olinyapti...");
        try {
            const p = await getProfile(ctx.chat.id);
            const inRecovery = p.recovery_until && p.recovery_until >= today();
            const CAP = inRecovery ? 8 : 12;   // bir seansda maksimum

            // Muddati kelganlarning umumiy soni
            const { count: dueTotal } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', ctx.chat.id).lte('next_review', today());

            // Qoldiq to'planib qolgan bo'lsa — ortiqchasini keyingi kunlarga yoyamiz
            if (dueTotal > CAP * 2) {
                const { data: overflow } = await supabase.from('eng_vocab')
                    .select('id').eq('chat_id', ctx.chat.id).lte('next_review', today())
                    .order('next_review').range(CAP, Math.min(dueTotal - 1, CAP + 199));

                let i = 0;
                for (const row of overflow || []) {
                    const push = 1 + Math.floor(i / CAP);   // har CAP tasini bir kun keyinga
                    await supabase.from('eng_vocab')
                        .update({ next_review: addDays(push) }).eq('id', row.id);
                    i++;
                }
                console.log(`Qoldiq yoyildi: ${i} ta so'z keyingi kunlarga surildi.`);
            }

            const { data: due } = await supabase
                .from('eng_vocab').select('*')
                .eq('chat_id', ctx.chat.id).lte('next_review', today())
                .order('next_review').limit(CAP);

            if (!due?.length) {
                const { count } = await supabase.from('eng_vocab')
                    .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);
                const { data: nxt } = await supabase.from('eng_vocab')
                    .select('next_review').eq('chat_id', ctx.chat.id)
                    .order('next_review').limit(1).maybeSingle();
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    `✅ Bugun takrorlanadigan so'z yo'q.\n\nBazada: ${count || 0} ta\n` +
                    `Keyingi takror: ${nxt?.next_review || '—'}\n\nYangi so'z: /word new`);
                return;
            }

            // Qutiga qarab 3 xil topshiriq turi
            const tasks = due.map((w) => {
                if (w.box <= 2) return { w, type: 'uz2en', q: `${w.meaning} — inglizchasi?` };
                if (w.box === 3) return { w, type: 'en2uz', q: `${w.word} — o'zbekchasi?` };
                return { w, type: 'sentence', q: `${w.word} — shu so'z bilan gap tuzing` };
            });

            sessions.set(ctx.chat.id, { type: 'word_test', data: tasks });
            await setMode(ctx.chat.id, 'word_test');

            const queued = Math.max(0, (dueTotal || 0) - tasks.length);
            const recoveryNote = inRecovery
                ? `🌱 Tiklanish rejimi — yuklama yengillashtirildi.\n\n` : '';
            const queueNote = queued > 0
                ? `\n\n📦 Yana ${queued} ta so'z navbatda — keyingi kunlarga taqsimlandi. Hammasini birdan qilish shart emas.` : '';

            await sendFormatted(ctx, msg.message_id,
                `${recoveryNote}🔁 **So'z takrori — ${tasks.length} ta**\n\n` +
                `Bitta xabarda, raqamlab javob bering:\n\n` +
                tasks.map((t, i) => `${i + 1}. ${t.q}`).join('\n') +
                `\n\n💡 Bilmasangiz "?" qo'ying — taxmin qilmang.${queueNote}`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeWordTest(ctx, answer) {
        const tasks = await guardSession(ctx, 'word_test');
        if (!tasks) return;

        const msg = await ctx.reply('📊 Tekshirilyapti...');
        try {
            const spec = tasks.map((t, i) => {
                if (t.type === 'uz2en') return `${i + 1}. [tarjima uz→en] to'g'ri javob: ${t.w.word}`;
                if (t.type === 'en2uz') return `${i + 1}. [tarjima en→uz] to'g'ri javob: ${t.w.meaning}`;
                return `${i + 1}. [gap tuzish] "${t.w.word}" so'zi grammatik to'g'ri va ma'noli ishlatilgan bo'lsa to'g'ri`;
            }).join('\n');

            const gen = await plain().generateContent(
                `Topshiriqlar:\n${spec}\n\nO'quvchi javobi:\n${answer}\n\n` +
                `Har raqam bo'yicha to'g'ri/noto'g'ri aniqla. 1 harflik imlo xatosi TO'G'RI.\n` +
                `FAQAT JSON: [{"n":1,"correct":true,"given":"yozgani","note":"xato bo'lsa qisqa izoh"}]`
            );

            const results = parseJson(gen.response.text()) || [];
            let right = 0;
            const lines = [];

            for (let i = 0; i < tasks.length; i++) {
                const t = tasks[i];
                const r = results.find((x) => x.n === i + 1);
                const ok = r?.correct === true;
                if (ok) right++;

                const newBox = ok ? Math.min(t.w.box + 1, MAX_BOX) : 1;
                await supabase.from('eng_vocab')
                    .update({ box: newBox, next_review: addDays(BOX_INTERVALS[newBox]) })
                    .eq('id', t.w.id);

                lines.push(ok
                    ? `✅ ${i + 1}. **${t.w.word}** — ${t.w.meaning}`
                    : `❌ ${i + 1}. **${t.w.word}** — ${t.w.meaning}${r?.note ? ` (${r.note})` : ''}`);
            }

            const pct = Math.round((right / tasks.length) * 100);
            const verdict = pct >= 90 ? "Zo'r." : pct >= 70 ? 'Yaxshi, lekin yetarli emas.' : 'Bu so\'zlar ustida yana ishlash kerak.';

            // Xato so'zlarni xatolar bazasiga yozamiz
            const wrongWords = tasks.filter((t, i) => {
                const r = results.find((x) => x.n === i + 1);
                return r?.correct !== true;
            });
            if (wrongWords.length) {
                await recordMistakes(ctx.chat.id,
                    'MISTAKES=' + wrongWords.map((t) =>
                        `vocab|so'z: ${t.w.word}|?|${t.w.word}`).join(';'));
            }

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'vocab_test', pct);

            await sendFormatted(ctx, msg.message_id,
                `📊 **${right}/${tasks.length} (${pct}%)** — ${verdict}\n\n${lines.join('\n')}\n\n` +
                `Xatolar ertaga qaytadi, to'g'rilari keyinroq.`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /listen — manba asosida (fayl yuborilmaydi) ====================
    // Render bepul darajasi Telegram'ga audio yuklashni o'tkazmaydi.
    // Shuning uchun: Humoyun tashqi manbadan tinglaydi, keyin eshitganini qayta aytib beradi.
    const LISTEN_SOURCES = [
        { name: 'BBC Learning English — 6 Minute English', where: 'bbc.co.uk/learningenglish yoki YouTube: "BBC 6 Minute English"', level: 'A2-B2', len: '6 daq' },
        { name: 'VOA Learning English', where: 'learningenglish.voanews.com', level: 'A1-B1', len: '3-5 daq' },
        { name: 'BBC News Review', where: 'YouTube: "BBC News Review"', level: 'B1-B2', len: '7 daq' },
        { name: 'Easy English (street interviews)', where: 'YouTube: "Easy English interviews"', level: 'A2-B1', len: '10 daq' },
        { name: 'TED-Ed', where: 'YouTube: "TED-Ed"', level: 'B1-B2', len: '5 daq' },
    ];

    bot.command('listen', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('🎧 Topshiriq tayyorlanyapti...');

        try {
            const p = await getProfile(ctx.chat.id);
            const src = LISTEN_SOURCES[Math.floor(Math.random() * LISTEN_SOURCES.length)];

            const gen = await plain().generateContent(
                `${p.level} darajadagi o'quvchi uchun listening topshirig'i tuz.

Manba: ${src.name} (${src.where}).

Javob tuzilishi:
1. 🎧 **Manba** — nomi va qayerdan topish.
2. 🎯 **Vazifa** — nimaga e'tibor berish kerak (3 ta aniq nuqta). Masalan: asosiy g'oya, 3 ta yangi so'z, raqamlar/sanalar.
3. 🔁 **Qanday tinglash** — 1-marta subtitrsiz, 2-marta subtitr bilan, 3-marta yana subtitrsiz.
4. ✍️ **Keyin nima qilish** — eshitganini INGLIZ TILIDA 4-6 jumlada qayta aytib berish (matn yoki ovozli xabar).

Qisqa yoz. Aniq mavzu tanlashni o'quvchining o'ziga qoldirma — bitta aniq mavzu tavsiya qil (masalan "climate", "sleep", "money habits").

${FORMAT}`
            );

            sessions.set(ctx.chat.id, { type: 'listen_test', data: { source: src.name } });
            await setMode(ctx.chat.id, 'listen_test');

            await sendFormatted(ctx, msg.message_id,
                `${gen.response.text()}\n\n💡 Tinglab bo'lgach, eshitganingizni **ingliz tilida** yozing yoki ovozli xabar yuboring. Bekor qilish: /stop`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeListen(ctx, answerText, voicePart = null) {
        const d = await guardSession(ctx, 'listen_test');
        if (!d) return;

        const msg = await ctx.reply('📊 Tahlil qilinyapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const parts = [{
                text: `O'quvchi (daraja ${p.level}) "${d.source}" dan biror materialni tingladi va eshitganini qayta aytib beryapti.
${voicePart ? 'Javobi ovozli xabarda.' : `Javobi:\n${answerText}`}

Baholash:
1. 🎯 **Tushunish** — asosiy g'oyani tushunganmi? 1-5 ball.
2. 🗣 **Til sifati** — 5-8 ta xato: xato → to'g'risi → nega (o'zbekcha izoh).
3. 🔁 **Kuchaytirilgan variant** — uning matnini yaxshiroq inglizcha bilan qayta yoz.
4. 🔤 **Yangi so'zlar** — uning mavzusiga oid 5 ta foydali so'z tavsiya qil.

Oxirida:
WORDS=word1|o'zbekcha;word2|o'zbekcha;... (5 ta)
${MISTAKE_SPEC}

${FORMAT}`,
            }];
            if (voicePart) parts.push(voicePart);

            const gen = await plain().generateContent({ contents: [{ role: 'user', parts }] });
            const out = gen.response.text();

            const wm = out.match(/WORDS=(.+)/i);
            let added = 0;
            if (wm) {
                const words = wm[1].split(';').map((c) => {
                    const [word, meaning] = c.split('|');
                    return word && meaning ? { word: word.trim(), meaning: meaning.trim() } : null;
                }).filter(Boolean);
                added = await addWords(ctx.chat.id, words);
            }
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'listening');

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}\n\n📝 ${added} ta so'z bazaga, ${mistakes} ta xato jurnaliga yozildi.`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /read ====================
    bot.command('read', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('📖 Matn tayyorlanyapti...');

        try {
            const p = await getProfile(ctx.chat.id);
            const ielts = p.day_number >= 150;

            const gen = await plain().generateContent(
                `${p.level} darajadagi o'quvchi uchun reading mashqi tuz.

1. ${ielts ? '250-300' : '150-200'} so'zlik inglizcha matn (qiziqarli fakt, ilm-fan, tarix yoki texnologiya).
2. ${ielts
                    ? "6 ta IELTS uslubidagi savol: 2 ta True/False/Not Given, 2 ta bo'sh joyni to'ldirish, 2 ta ko'p tanlovli."
                    : '5 ta oddiy tushunish savoli.'}

FAQAT JSON:
{"passage":"...","questions":["1. ...","2. ..."],"answers":["...","..."]}`
            );

            const data = parseJson(gen.response.text());
            if (!data?.passage) throw new Error('Matn olinmadi');

            sessions.set(ctx.chat.id, { type: 'read_test', data });
            await setMode(ctx.chat.id, 'read_test');

            await sendFormatted(ctx, msg.message_id,
                `📖 **Reading**\n\n${data.passage}\n\n❓ **Savollar**\n${data.questions.join('\n')}\n\n` +
                `Javoblarni bitta xabarda raqamlab yozing.`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeRead(ctx, answer) {
        const d = await guardSession(ctx, 'read_test');
        if (!d) return;

        const msg = await ctx.reply('📊 Tekshirilyapti...');
        try {
            const gen = await plain().generateContent(
                `Matn:\n${d.passage}\n\nSavollar:\n${d.questions.join('\n')}\nTo'g'ri javoblar:\n${d.answers.join('\n')}\n\n` +
                `O'quvchi javoblari:\n${answer}\n\n` +
                `Har savolni tekshir: ✅/❌ + to'g'ri javob + matnning qaysi joyidan ekanini ko'rsat (o'zbekcha izoh). ` +
                `Oxirida **Natija: X/${d.questions.length}** va 1 ta o'qish strategiyasi bo'yicha maslahat.\n\n` +
                `So'ng matndan 5 ta foydali so'z tanlab:\nWORDS=word1|o'zbekcha;...\n${MISTAKE_SPEC}\n\n${FORMAT}`
            );

            const out = gen.response.text();
            const wm = out.match(/WORDS=(.+)/i);
            let added = 0;
            if (wm) {
                const words = wm[1].split(';').map((c) => {
                    const [word, meaning] = c.split('|');
                    return word && meaning ? { word: word.trim(), meaning: meaning.trim() } : null;
                }).filter(Boolean);
                added = await addWords(ctx.chat.id, words);
            }
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'reading');
            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}\n\n📝 ${added} ta so'z bazaga, ${mistakes} ta xato jurnaliga yozildi.`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /essay ====================
    bot.command('essay', async (ctx) => {
        const msg = await ctx.reply('✍️ Mavzu va reja tayyorlanyapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const ielts = p.day_number >= 150;

            const gen = await plain().generateContent(
                `${p.level} darajadagi o'quvchi uchun ${ielts ? 'IELTS Writing Task 2' : "oddiy yozma"} topshirig'i tuz.

Javob tuzilishi:
1. 📝 **Mavzu** — inglizcha savol${ielts ? ' (IELTS formatida)' : ''}.
2. 🗂 **Reja** — abzatslar bo'yicha nima yozish kerakligi (o'zbekcha).
3. 🔤 **Foydali iboralar** — 6-8 ta, tarjimasi bilan.
4. 📏 **Hajm** — ${ielts ? "250 so'z" : "80-120 so'z"}.

Namuna esse YOZMA — o'quvchi o'zi yozadi.\n\n${FORMAT}`
            );

            sessions.set(ctx.chat.id, { type: 'essay', data: { topic: gen.response.text() } });
            await setMode(ctx.chat.id, 'essay');

            await sendFormatted(ctx, msg.message_id,
                `${gen.response.text()}\n\n💡 Esseni yozib, shu yerga yuboring — imtihonchi baholaydi. Bekor qilish: /stop`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeEssay(ctx, text) {
        const d = await guardSession(ctx, 'essay');
        if (!d) return;

        const msg = await ctx.reply('📝 Imtihonchi baholayapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const result = await examiner.generateContent(
                `Topshiriq:\n${d.topic}\n\nO'quvchi darajasi: ${p.level}, dastur kuni: ${p.day_number}.\n\nEssesi:\n${text}\n${MISTAKE_SPEC}`
            );
            const out = result.response.text();
            const band = parseFloat((out.match(/(\d(?:\.\d)?)\s*(?:band|ball)/i) || [])[1]) || null;
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'essay', band, text.slice(0, 200));
            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}\n\n📝 ${mistakes} ta xato jurnaliga yozildi.`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /write (tez baholash) ====================
    bot.command('write', async (ctx) => {
        const input = ctx.message.text.replace(/^\/write(@\S+)?\s*/i, '').trim();
        if (!input) return ctx.reply("✍️ To'liq mashq uchun: /essay\nTayyor matnni baholash uchun: /write <matn>");

        const msg = await ctx.reply('📝 Baholanyapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const result = await examiner.generateContent(
                `O'quvchi darajasi: ${p.level}, kun ${p.day_number}.\n\nMatn:\n${input}`
            );
            const out = result.response.text();
            const band = parseFloat((out.match(/(\d(?:\.\d)?)\s*(?:band|ball)/i) || [])[1]) || null;
            await logActivity(ctx.chat.id, 'writing', band, input.slice(0, 200));
            await sendFormatted(ctx, msg.message_id, out);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== /speak ====================
    bot.command('speak', async (ctx) => {
        const topic = ctx.message.text.replace(/^\/speak(@\S+)?\s*/i, '').trim();
        sessions.set(ctx.chat.id, { type: 'speak', data: [] });
        await setMode(ctx.chat.id, 'speak');

        const msg = await ctx.reply('💬 Danny ulanyapti...');
        try {
            const result = await buddy.generateContent(
                topic ? `Start a casual conversation about: ${topic}. Greet your friend first.`
                    : `Greet your friend and start a casual conversation. Ask what he's been up to today.`
            );
            await sendFormatted(ctx, msg.message_id,
                `${result.response.text()}\n\n_(Suhbat rejimi. Ovozli xabar ham yuboring. Chiqish: /stop)_`);
            await logActivity(ctx.chat.id, 'speak_start');
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    bot.command('stop', async (ctx) => {
        sessions.delete(ctx.chat.id);
        await setMode(ctx.chat.id, null);
        ctx.reply('🛑 Rejim yopildi.');
    });

    // ==================== /test ====================
    bot.command('test', async (ctx) => {
        const msg = await ctx.reply('🎯 Test tayyorlanyapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const gen = await plain().generateContent(
                `Ingliz tili daraja tekshiruvi tuz. Joriy daraja: ${p.level}.

12 ta savol: 6 tasi ${p.level}, 4 tasi bir pog'ona yuqori, 2 tasi ikki pog'ona yuqori.
YOPIQ TEST EMAS — o'quvchi yozib javob bersin. Raqamla. Javoblarni BERMA.
Boshida: "Javoblarni bitta xabarda raqamlab yozing."\n\n${FORMAT}`
            );
            const q = gen.response.text();
            sessions.set(ctx.chat.id, { type: 'level_test', data: q });
            await setMode(ctx.chat.id, 'level_test');
            await sendFormatted(ctx, msg.message_id, q);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeLevelTest(ctx, answer) {
        const questions = await guardSession(ctx, 'level_test');
        if (!questions) return;

        const msg = await ctx.reply('📊 Daraja aniqlanyapti...');
        try {
            const gen = await plain().generateContent(
                `Savollar:\n${questions}\n\nJavoblar:\n${answer}\n\n` +
                `Har javobni tekshir, keyin CEFR darajani aniqla.\n` +
                `1. Har savol: ✅/❌ + to'g'ri javob + izoh\n2. **Natija: X/12**\n3. **Darajangiz: [CEFR]**\n` +
                `4. **Zaif nuqtalar:** 3-5 ta grammatik mavzu\n\n` +
                `Oxirida alohida qatorda:\nLEVEL=<CEFR>|WEAK=<m1>,<m2>,<m3>\n\n${FORMAT}`
            );

            let text = gen.response.text();
            const meta = text.match(/LEVEL=([A-C][12])\|WEAK=(.+)/i);

            if (meta) {
                await saveProfile(ctx.chat.id, {
                    level: meta[1].toUpperCase(),
                    weak_points: meta[2].split(',').map((s) => s.trim()).filter(Boolean),
                    mode: null,
                });
                text = text.replace(/LEVEL=.+/i, '').trim();
            } else {
                await setMode(ctx.chat.id, null);
            }

            sessions.delete(ctx.chat.id);
            await logActivity(ctx.chat.id, 'level_test');
            await sendFormatted(ctx, msg.message_id, text);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /ielts — SPEAKING IMTIHONI ====================
    const speakingExaminer = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: `Sen IELTS Speaking bo'yicha rasmiy imtihonchisan.

MEZONLAR (har biri 0-9): Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation.

Ovozli javob berilsa — talaffuz, urg'u, ravonlik, to'xtalishlar va "uh/um" larni ham baholaysan.

JAVOB:
1. 🎯 **Umumiy band** — 0.5 aniqlikda.
2. 📊 **4 mezon** — har biri uchun ball va 1-2 jumla sabab.
3. 🗣 **Talaffuz** — noto'g'ri talaffuz qilingan so'zlar (ovozli javob bo'lsa).
4. ❌ **Til xatolari** — 5-8 ta: xato → to'g'risi → nega.
5. 🔁 **Band 7 versiyasi** — xuddi shu javobning kuchli varianti.
6. 🎯 **3 ta aniq maslahat.**

Ballni oshirib yuborma. A1-A2 darajali javobga band 4-5 dan yuqori berma.
Tushuntirish o'zbekcha, misol inglizcha.

${FORMAT}`,
    });

    bot.command('ielts', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('🎤 Speaking imtihoni tayyorlanyapti...');

        try {
            const p = await getProfile(ctx.chat.id);
            const gen = await plain().generateContent(
                `IELTS Speaking imtihonining bitta to'liq sessiyasini tuz (daraja ${p.level}).

1. 🎤 **Part 1** — 3 ta oddiy shaxsiy savol (uy, ish, hobbi, ovqat, sayohat).
2. 🗂 **Part 2 — Cue Card** — 1 ta mavzu va ostida 4 ta "You should say" nuqtasi. 1 daqiqa tayyorgarlik, 2 daqiqa gapirish.
3. 💭 **Part 3** — Part 2 mavzusiga bog'liq 2 ta chuqurroq muhokama savoli.

Savollar INGLIZCHA. Boshida qisqa o'zbekcha yo'riqnoma: barcha javoblarni bitta ovozli xabarda ketma-ket aytish kerak.

Namuna javob BERMA.

${FORMAT}`
            );

            const q = gen.response.text();
            sessions.set(ctx.chat.id, { type: 'ielts_speaking', data: { questions: q } });
            await setMode(ctx.chat.id, 'ielts_speaking');

            await sendFormatted(ctx, msg.message_id,
                `${q}\n\n🎤 **Ovozli xabar** yuboring — imtihonchi band ball qo'yadi.\n(Matn bilan ham bo'ladi, lekin talaffuz baholanmaydi.)\nBekor qilish: /stop`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeSpeaking(ctx, answerText, voicePart = null) {
        const d = await guardSession(ctx, 'ielts_speaking');
        if (!d) return;

        const msg = await ctx.reply('🎤 Imtihonchi baholayapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const parts = [{
                text: `Savollar:\n${d.questions}\n\nO'quvchi darajasi: ${p.level}.\n` +
                    (voicePart ? "Javobi ovozli xabarda — talaffuzni ham bahola." : `Javobi (matn):\n${answerText}`) +
                    `\n${MISTAKE_SPEC}`,
            }];
            if (voicePart) parts.push(voicePart);

            const result = await speakingExaminer.generateContent({ contents: [{ role: 'user', parts }] });
            const out = result.response.text();
            const band = parseFloat((out.match(/(\d(?:\.\d)?)\s*(?:band|ball)/i) || [])[1]) || null;
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'speaking', band);

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}\n\n📝 ${mistakes} ta xato jurnaliga yozildi.`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /xato — XATOLAR HISOBOTI ====================
    bot.command('xato', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('📊 Xatolar tahlil qilinyapti...');

        try {
            const mistakes = await getTopMistakes(ctx.chat.id, 15);
            if (!mistakes.length) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    "📊 Xatolar jurnali hozircha bo'sh.\n\nBir necha mashq bajaring — /eng, /read, /essay, /ielts. Har tekshiruvdan keyin xatolar avtomatik yoziladi.");
                return;
            }

            const byCat = {};
            for (const m of mistakes) (byCat[m.category] ||= []).push(m);

            const catName = { grammar: '📐 Grammatika', vocab: '🔤 So\'z boyligi', spelling: '✏️ Imlo', structure: '🏗 Gap tuzilishi' };
            const sections = Object.entries(byCat).map(([cat, items]) =>
                `${catName[cat] || cat}\n` + items.map((m) =>
                    `- **${m.topic}** — ${m.count} marta${m.wrong && m.wrong !== '?' ? `\n  "${m.wrong}" → "${m.correct}"` : ''}`).join('\n')
            ).join('\n\n');

            const top3 = mistakes.slice(0, 3).map((m) => m.topic).join(', ');

            const gen = await plain().generateContent(
                `O'quvchining eng ko'p takrorlanadigan xatolari: ${top3}.\n\n` +
                `Shu 3 ta mavzu bo'yicha 6 ta maqsadli mashq tuz (bo'sh joy, tarjima, xatoni top). ` +
                `Javoblarni berma. Qisqa yoz.\n\n${FORMAT}`
            );

            sessions.set(ctx.chat.id, { type: 'lesson', data: {} });
            await setMode(ctx.chat.id, 'lesson');

            await sendFormatted(ctx, msg.message_id,
                `📊 **Xatolar jurnali**\n\n${sections}\n\n` +
                `🎯 **Shu xatolar bo'yicha mashq**\n\n${gen.response.text()}\n\n` +
                `Javoblarni yozing — tekshiraman.`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== /chunk — SO'Z BIRIKMALARI ====================
    bot.command('chunk', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply("🧱 Birikmalar tanlanyapti...");

        try {
            const p = await getProfile(ctx.chat.id);
            const { data: existing } = await supabase.from('eng_vocab')
                .select('word').eq('chat_id', ctx.chat.id).eq('type', 'chunk').limit(300);
            const known = (existing || []).map((r) => r.word).join('; ');

            const gen = await plain().generateContent(
                `${p.level} darajadagi o'zbek o'quvchisi uchun 8 ta INGLIZCHA SO'Z BIRIKMASI (chunk / collocation) tanla.

MUHIM: yakka so'z EMAS, balki birga ishlatiladigan bo'laklar:
- fe'l + ot: "make a decision", "take a photo", "have breakfast"
- sifat + ot: "heavy rain", "strong coffee"
- turg'un iboralar: "by the way", "as soon as possible"

Allaqachon o'rganilgan, QAYTARMA: ${known || "yo'q"}

Har biri uchun: birikma, o'zbekcha ma'nosi, misol gap (o'quvchi SMM menejer, o'quv markazida ishlaydi — misollarni shu hayotga bog'la).

FAQAT JSON:
[{"word":"make a decision","meaning":"qaror qabul qilmoq","example":"We make a decision every Monday."}]`
            );

            const chunks = parseJson(gen.response.text());
            if (!Array.isArray(chunks) || !chunks.length) throw new Error('Birikmalar olinmadi');

            await addWords(ctx.chat.id, chunks, 'chunk');
            await logActivity(ctx.chat.id, 'chunk_new', chunks.length);

            const list = chunks.map((c, i) =>
                `${i + 1}. **${c.word}** — ${c.meaning}\n   *${c.example || ''}*`).join('\n\n');

            sessions.set(ctx.chat.id, { type: 'chunk_use', data: chunks });
            await setMode(ctx.chat.id, 'chunk_use');

            await sendFormatted(ctx, msg.message_id,
                `🧱 **8 ta so'z birikmasi**\n\n${list}\n\n` +
                `✍️ **Topshiriq:** shu birikmalardan **5 tasini** tanlab, har biri bilan o'z hayotingizdan gap tuzing. ` +
                `Bitta xabarda yuboring.\n\n⏰ Ertaga /word da so'raladi.`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeChunkUse(ctx, answer) {
        const chunks = await guardSession(ctx, 'chunk_use');
        if (!chunks) return;

        const msg = await ctx.reply('📝 Tekshirilyapti...');
        try {
            const list = chunks.map((c) => `${c.word} = ${c.meaning}`).join('\n');
            const gen = await plain().generateContent(
                `Birikmalar:\n${list}\n\nO'quvchi shulardan foydalanib gap tuzdi:\n${answer}\n\n` +
                `Har gapni tekshir:\n- Birikma TO'G'RI shaklda ishlatilganmi (so'z tartibi, predlog, artikl)\n` +
                `- Grammatik xatolar\n- Tabiiy eshitiladimi\n\n` +
                `Har gap uchun: ✅/❌ + tuzatilgan variant + qisqa o'zbekcha izoh. ` +
                `Oxirida umumiy baho va 1 ta maslahat.\n${MISTAKE_SPEC}\n\n${FORMAT}`
            );

            const out = gen.response.text();
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'chunk_use');

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}${mistakes ? `\n\n📝 ${mistakes} ta xato jurnaliga yozildi.` : ''}`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /drill — TEZ TARJIMA ====================
    bot.command('drill', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('⚡ Drill tayyorlanyapti...');

        try {
            const p = await getProfile(ctx.chat.id);
            const topics = await getTopics(ctx.chat.id, 10);
            const mistakes = await getTopMistakes(ctx.chat.id, 5);

            const { data: vocab } = await supabase.from('eng_vocab')
                .select('word, meaning').eq('chat_id', ctx.chat.id)
                .gte('box', 2).limit(40);

            const gen = await plain().generateContent(
                `${p.level} darajadagi o'quvchi uchun TEZ TARJIMA drilli tuz.

15 ta QISQA o'zbekcha gap yoz (har biri 4-8 so'z). O'quvchi ularni tez inglizchaga o'giradi.

Gaplar shulardan tuzilsin:
- O'tilgan mavzular: ${topics.map((t) => t.topic).join(', ') || 'to be, oddiy gaplar'}
- Takrorlanuvchi xatolar (4 ta gap aynan shularga tegsin): ${mistakes.map((m) => m.topic).join(', ') || "yo'q"}
- O'rganilgan so'zlar: ${(vocab || []).map((v) => v.word).slice(0, 25).join(', ') || 'oddiy so\'zlar'}

Gaplar kundalik hayotdan bo'lsin (ish, o'quv markaz, oila, ovqat, telefon).
Raqamlab yoz. Inglizcha javoblarni BERMA.

Boshida bitta qator: "⏱ Sekundomerni yoqing — 15 gap uchun maqsad 5 daqiqa."

${FORMAT}`
            );

            const q = gen.response.text();
            sessions.set(ctx.chat.id, { type: 'drill', data: { questions: q, startedAt: Date.now() } });
            await setMode(ctx.chat.id, 'drill');

            await sendFormatted(ctx, msg.message_id,
                `⚡ **Tez tarjima drilli**\n\n${q}\n\n` +
                `Javoblarni bitta xabarda raqamlab yozing. Lug'atga qaramang — bilmasangiz "?" qo'ying.`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeDrill(ctx, answer) {
        const d = await guardSession(ctx, 'drill');
        if (!d) return;

        const secs = Math.round((Date.now() - d.startedAt) / 1000);
        const mins = Math.floor(secs / 60);
        const msg = await ctx.reply(`📊 Tekshirilyapti... (${mins} daq ${secs % 60} soniya)`);

        try {
            const gen = await plain().generateContent(
                `Topshiriq:\n${d.questions}\n\nO'quvchi tarjimalari:\n${answer}\n\n` +
                `Har gapni tekshir: ✅/❌ + to'g'ri tarjima + xato bo'lsa qisqa o'zbekcha izoh.\n` +
                `Bir nechta to'g'ri variant bo'lsa, o'quvchiniki ham to'g'ri bo'lsa ✅ qo'y.\n` +
                `Oxirida **Natija: X/15** va eng ko'p qoqilgan 2 ta mavzu.\n${MISTAKE_SPEC}\n\n${FORMAT}`
            );

            const out = gen.response.text();
            const score = parseInt((out.match(/Natija:\s*(\d+)\s*\/\s*15/i) || [])[1] || '0', 10);
            const pct = Math.round((score / 15) * 100);
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'drill', pct, `${secs}s`);

            const speed = secs <= 300 ? '🟢 Tezlik yaxshi' : secs <= 480 ? '🟡 Sekinroq — mashq kerak' : '🔴 Juda sekin — bu so\'zlar hali avtomatlashmagan';

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}\n\n⏱ **Vaqt:** ${mins} daq ${secs % 60} soniya — ${speed}\n` +
                `${mistakes ? `📝 ${mistakes} ta xato jurnaliga yozildi.` : ''}`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /talaffuz — TALAFFUZ ====================
    // O'zbek tilida yo'q yoki chalkashadigan tovushlar — tartib bilan
    const SOUNDS = [
        { id: 'th-voiceless', name: '/θ/ — think, three, month', hint: "til uchi tishlar orasida, ovozsiz. O'zbekcha 's' yoki 't' EMAS" },
        { id: 'th-voiced', name: '/ð/ — this, that, weather', hint: "xuddi shunday, lekin ovoz bilan. 'z' yoki 'd' EMAS" },
        { id: 'w-v', name: '/w/ va /v/ — west vs vest', hint: "w — lablar dumaloq, tishlar tegmaydi. v — pastki lab yuqori tishga tegadi" },
        { id: 'long-short-i', name: '/iː/ va /ɪ/ — sheep vs ship', hint: 'uzun va qisqa i. Ma\'no butunlay o\'zgaradi' },
        { id: 'ae', name: '/æ/ — cat, bad, man', hint: "o'zbekcha 'a' va 'e' orasidagi tovush, og'iz keng ochiladi" },
        { id: 'schwa', name: '/ə/ — about, teacher, banana', hint: "urg'usiz bo'g'indagi 'bo'sh' tovush. Ingliz tilidagi eng ko'p tovush" },
        { id: 'ed-endings', name: '-ed oxiri — worked /t/, played /d/, wanted /ɪd/', hint: 'uchta xil o\'qiladi, oldingi tovushga qarab' },
        { id: 's-endings', name: '-s oxiri — cats /s/, dogs /z/, boxes /ɪz/', hint: 'ko\'plik va 3-shaxs uchun uchta variant' },
        { id: 'r-sound', name: '/r/ — red, three, car', hint: "til orqaga tortiladi, tanglayga TEGMAYDI. O'zbekcha titroq 'r' EMAS" },
        { id: 'word-stress', name: "So'z urg'usi — PHOtograph / phoTOgrapher", hint: "urg'u noto'g'ri tushsa, so'z tanilmaydi" },
        { id: 'sentence-stress', name: 'Gap urg\'usi — muhim so\'zlar kuchli', hint: 'ot, fe\'l, sifat kuchli; artikl, predlog zaif' },
        { id: 'linking', name: 'Bog\'lanish — "an apple" → "a-napple"', hint: 'tabiiy nutqda so\'zlar bir-biriga ulanadi' },
    ];

    bot.command('talaffuz', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());

        try {
            const { count } = await supabase.from('eng_log')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', ctx.chat.id).eq('activity', 'pronunciation');

            const s = SOUNDS[(count || 0) % SOUNDS.length];
            const msg = await ctx.reply('🗣 Talaffuz mashqi tayyorlanyapti...');

            const gen = await plain().generateContent(
                `Talaffuz darsi tuz. Bugungi tovush: ${s.name}
Yo'riqnoma: ${s.hint}

Javob tuzilishi:
1. 🗣 **Tovush** — nomi.
2. 👄 **Qanday chiqariladi** — og'iz, til, lablar holati. O'zbekcha, 3-4 jumla. O'zbek tilidagi qaysi tovushga o'xshaydi va nimasi bilan farq qiladi.
3. ⚠️ **O'zbeklar qiladigan xato** — aniq ayt.
4. 🔤 **10 ta so'z** — shu tovush bilan, o'zbekcha ma'nosi bilan.
5. 🎯 **3 ta gap** — shu tovush ko'p uchraydigan qiyin gaplar (tongue twister uslubida).

Qisqa yoz.

${FORMAT}`
            );

            sessions.set(ctx.chat.id, { type: 'pronunciation', data: { sound: s.name, text: gen.response.text() } });
            await setMode(ctx.chat.id, 'pronunciation');

            await sendFormatted(ctx, msg.message_id,
                `${gen.response.text()}\n\n🎤 **10 ta so'z va 3 ta gapni ovozli xabarda o'qing** — tekshiraman.\nBekor qilish: /stop`);
        } catch (e) {
            ctx.reply(`❌ Xatolik: ${e.message}`);
        }
    });

    async function gradePronunciation(ctx, voicePart) {
        const d = await guardSession(ctx, 'pronunciation');
        if (!d) return;

        if (!voicePart) {
            return ctx.reply('🎤 Talaffuzni tekshirish uchun **ovozli xabar** kerak. Matn bilan bo\'lmaydi.');
        }

        const msg = await ctx.reply('🎧 Talaffuz tahlil qilinyapti...');
        try {
            const gen = await plain().generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        {
                            text: `O'quvchi (o'zbek, daraja A1) quyidagi talaffuz mashqini ovozli o'qidi.

Mashq mavzusi: ${d.sound}
Material:\n${d.text}

Ovozni tinglab bahola:
1. 🎯 **Umumiy baho** — 1-10.
2. ✅ **To'g'ri chiqqan** — qaysi so'zlarda tovush to'g'ri.
3. ❌ **Xato chiqqan** — qaysi so'zlarda, nima deb talaffuz qilingan, qanday bo'lishi kerak.
4. 👄 **Nima qilish kerak** — og'iz/til holatini tuzatish bo'yicha 2-3 aniq maslahat.
5. 🔁 **Ertaga takrorlash uchun** — eng qiyin chiqqan 3 ta so'z.

Halol bahola, oshirib yuborma. Izoh o'zbekcha.

${FORMAT}`,
                        },
                        voicePart,
                    ],
                }],
            });

            const out = gen.response.text();
            const score = parseFloat((out.match(/(\d+(?:\.\d)?)\s*(?:\/\s*10|ball)/i) || [])[1]) || null;

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'pronunciation', score, d.sound);

            await sendFormatted(ctx, msg.message_id, out);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /fellar — NOTO'G'RI FE'LLAR ====================
    // Tasodifiy emas, NAQSH guruhlari bo'yicha — miya bir xil o'zgarishni birga eslab qoladi
    const VERB_GROUPS = [
        {
            name: 'Uchalasi bir xil',
            rule: "Hech narsa o'zgarmaydi — eng oson guruh",
            verbs: [['cut', 'cut', 'cut', 'kesmoq'], ['put', 'put', 'put', "qo'ymoq"], ['let', 'let', 'let', "ruxsat bermoq"],
                ['hit', 'hit', 'hit', 'urmoq'], ['cost', 'cost', 'cost', 'turmoq (narx)'], ['shut', 'shut', 'shut', 'yopmoq'],
                ['hurt', 'hurt', 'hurt', "og'ritmoq"], ['set', 'set', 'set', "o'rnatmoq"]],
        },
        {
            name: '-ought / -aught',
            rule: "2 va 3-shakl bir xil, oxiri -ought yoki -aught",
            verbs: [['buy', 'bought', 'bought', 'sotib olmoq'], ['bring', 'brought', 'brought', 'olib kelmoq'],
                ['think', 'thought', 'thought', "o'ylamoq"], ['teach', 'taught', 'taught', "o'rgatmoq"],
                ['catch', 'caught', 'caught', 'ushlamoq'], ['fight', 'fought', 'fought', 'urishmoq']],
        },
        {
            name: '-t bilan tugaydi',
            rule: '2 va 3-shakl bir xil, unli qisqaradi',
            verbs: [['sleep', 'slept', 'slept', 'uxlamoq'], ['keep', 'kept', 'kept', 'saqlamoq'],
                ['feel', 'felt', 'felt', 'his qilmoq'], ['leave', 'left', 'left', 'ketmoq'],
                ['mean', 'meant', 'meant', 'anglatmoq'], ['build', 'built', 'built', 'qurmoq'],
                ['send', 'sent', 'sent', 'yubormoq'], ['spend', 'spent', 'spent', 'sarflamoq']],
        },
        {
            name: 'i → a → u',
            rule: "Unli uch marta o'zgaradi: i, a, u",
            verbs: [['drink', 'drank', 'drunk', 'ichmoq'], ['sing', 'sang', 'sung', 'kuylamoq'],
                ['swim', 'swam', 'swum', 'suzmoq'], ['begin', 'began', 'begun', 'boshlamoq'],
                ['ring', 'rang', 'rung', 'jiringlamoq'], ['sink', 'sank', 'sunk', "cho'kmoq"]],
        },
        {
            name: 'o → oke → oken',
            rule: '3-shakl -en bilan tugaydi',
            verbs: [['speak', 'spoke', 'spoken', 'gapirmoq'], ['break', 'broke', 'broken', 'sindirmoq'],
                ['choose', 'chose', 'chosen', 'tanlamoq'], ['freeze', 'froze', 'frozen', 'muzlatmoq'],
                ['steal', 'stole', 'stolen', "o'g'irlamoq"], ['wake', 'woke', 'woken', "uyg'onmoq"]],
        },
        {
            name: '-ew → -own',
            rule: "2-shakl -ew, 3-shakl -own",
            verbs: [['know', 'knew', 'known', 'bilmoq'], ['grow', 'grew', 'grown', "o'smoq"],
                ['throw', 'threw', 'thrown', 'otmoq'], ['blow', 'blew', 'blown', 'puflamoq'],
                ['fly', 'flew', 'flown', 'uchmoq'], ['draw', 'drew', 'drawn', 'chizmoq']],
        },
        {
            name: 'i → o → i(+en)',
            rule: "3-shakl 1-shaklga qaytadi, -en qo'shiladi",
            verbs: [['drive', 'drove', 'driven', 'haydamoq'], ['write', 'wrote', 'written', 'yozmoq'],
                ['ride', 'rode', 'ridden', 'minmoq'], ['rise', 'rose', 'risen', "ko'tarilmoq"]],
        },
        {
            name: 'Eng kerakli, naqshsiz',
            rule: "Naqsh yo'q — yodlash kerak, lekin eng ko'p ishlatiladi",
            verbs: [['go', 'went', 'gone', 'bormoq'], ['be', 'was/were', 'been', "bo'lmoq"],
                ['do', 'did', 'done', 'qilmoq'], ['have', 'had', 'had', 'ega bo\'lmoq'],
                ['see', 'saw', 'seen', "ko'rmoq"], ['eat', 'ate', 'eaten', 'yemoq'],
                ['take', 'took', 'taken', 'olmoq'], ['come', 'came', 'come', 'kelmoq'],
                ['give', 'gave', 'given', 'bermoq'], ['get', 'got', 'got', 'olmoq']],
        },
    ];

    bot.command('fellar', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());

        try {
            const { count } = await supabase.from('eng_log')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', ctx.chat.id).eq('activity', 'verbs');

            const gi = (count || 0) % VERB_GROUPS.length;
            const g = VERB_GROUPS[gi];
            const msg = await ctx.reply("📘 Fe'llar guruhi tayyorlanyapti...");

            // Fe'llarni so'z bazasiga qo'shamiz — takror tizimiga tushadi
            await addWords(ctx.chat.id, g.verbs.map((v) => ({
                word: `${v[0]} - ${v[1]} - ${v[2]}`,
                meaning: v[3],
                example: null,
            })), 'verb');

            const table = g.verbs.map((v, i) =>
                `${i + 1}. **${v[0]}** → ${v[1]} → ${v[2]} — ${v[3]}`).join('\n');

            const gen = await plain().generateContent(
                `O'zbek o'quvchisi noto'g'ri fe'llarning "${g.name}" guruhini o'rganyapti.
Qoida: ${g.rule}
Fe'llar: ${g.verbs.map((v) => v.join('/')).join(', ')}

Quyidagini tuz:
1. 🧠 **Eslab qolish usuli** — bu guruhni yodda saqlash uchun 2-3 jumlalik amaliy maslahat. Naqshni ko'rsat.
2. 🧩 **8 ta mashq** — gaplarda fe'lni to'g'ri shaklga qo'yish. Aralash: ba'zisi Past Simple (2-shakl), ba'zisi Present Perfect (3-shakl). Qavs ichida 1-shaklni ber.
3. ✍️ **3 ta tarjima** — o'zbekchadan inglizchaga, shu fe'llar bilan.

Javoblarni BERMA. Qisqa yoz.

${FORMAT}`
            );

            sessions.set(ctx.chat.id, { type: 'verbs', data: { group: g.name, verbs: g.verbs, text: gen.response.text() } });
            await setMode(ctx.chat.id, 'verbs');

            await sendFormatted(ctx, msg.message_id,
                `📘 **Noto'g'ri fe'llar — guruh ${gi + 1}/${VERB_GROUPS.length}: ${g.name}**\n` +
                `_${g.rule}_\n\n${table}\n\n${gen.response.text()}\n\n` +
                `📝 ${g.verbs.length} ta fe'l bazaga yozildi — ertaga /word da so'raladi.`);
        } catch (e) {
            ctx.reply(`❌ Xatolik: ${e.message}`);
        }
    });

    async function gradeVerbs(ctx, answer) {
        const d = await guardSession(ctx, 'verbs');
        if (!d) return;

        const msg = await ctx.reply('📊 Tekshirilyapti...');
        try {
            const gen = await plain().generateContent(
                `Guruh: ${d.group}\nFe'llar: ${d.verbs.map((v) => v.join('/')).join(', ')}\n\n` +
                `Topshiriqlar:\n${d.text}\n\nO'quvchi javoblari:\n${answer}\n\n` +
                `Har javobni tekshir: ✅/❌ + to'g'ri shakl + nega shu shakl kerakligi (o'zbekcha, qisqa).\n` +
                `Past Simple va Present Perfect farqiga alohida e'tibor ber.\n` +
                `Oxirida natija va qaysi fe'llarni qayta ko'rish kerakligini ayt.\n${MISTAKE_SPEC}\n\n${FORMAT}`
            );

            const out = gen.response.text();
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'verbs', null, d.group);

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}${mistakes ? `\n\n📝 ${mistakes} ta xato jurnaliga yozildi.` : ''}\n\n` +
                `Keyingi guruh: /fellar`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== HAFTALIK HISOBOT ====================
    async function buildWeeklyReport(chatId) {
        const p = await getProfile(chatId);
        const weekAgo = addDays(-7);

        const { data: logs } = await supabase.from('eng_log')
            .select('activity, score, day, created_at').eq('chat_id', chatId)
            .gte('day', weekAgo).order('created_at', { ascending: false });

        const L = logs || [];
        const activeDays = new Set(L.map((l) => l.day)).size;
        const avg = (name) => {
            const v = L.filter((l) => l.activity === name && l.score != null).map((l) => l.score);
            return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
        };

        const lessons = L.filter((l) => l.activity === 'lesson').length;
        const vocabAvg = avg('vocab_test');
        const drillAvg = avg('drill');
        const pronAvg = avg('pronunciation');
        const bandVals = L.filter((l) => ['essay', 'writing', 'speaking'].includes(l.activity) && l.score != null);
        const bandAvg = bandVals.length
            ? (bandVals.reduce((a, b) => a + b.score, 0) / bandVals.length).toFixed(1) : null;

        // Drill tezligi o'zgarishi
        const drillTimes = L.filter((l) => l.activity === 'drill').map((l) => parseInt(l.notes, 10)).filter(Boolean);

        const { count: vocabTotal } = await supabase.from('eng_vocab')
            .select('*', { count: 'exact', head: true }).eq('chat_id', chatId);
        const { count: vocabStrong } = await supabase.from('eng_vocab')
            .select('*', { count: 'exact', head: true }).eq('chat_id', chatId).gte('box', 4);

        const mistakes = await getTopMistakes(chatId, 5);

        const lines = [
            `📊 **Haftalik hisobot**`,
            ``,
            `📅 Faol kunlar: **${activeDays}/7**${activeDays >= 6 ? ' ✅' : activeDays >= 4 ? ' 🟡' : ' 🔴'}`,
            `📚 Darslar: ${lessons} ta · Dastur kuni: ${p.day_number}/450`,
            `🔥 Streak: ${p.streak}${p.best_streak > p.streak ? ` (rekord: ${p.best_streak})` : ''}`,
            `🎓 Daraja: ${p.level}`,
            ``,
            `🔤 So'z bazasi: ${vocabTotal || 0} ta (mustahkam: ${vocabStrong || 0})`,
            vocabAvg != null ? `🎯 So'z testlari: ${vocabAvg}%` : null,
            drillAvg != null ? `⚡ Drill: ${drillAvg}%${drillTimes.length >= 2 ? ` · vaqt ${drillTimes[drillTimes.length - 1]}s → ${drillTimes[0]}s` : ''}` : null,
            pronAvg != null ? `🗣 Talaffuz: ${pronAvg}/10` : null,
            bandAvg != null ? `📝 O'rtacha band: ${bandAvg}` : null,
        ].filter(Boolean);

        if (mistakes.length) {
            lines.push('', `❌ **Eng ko'p takrorlangan xatolar:**`);
            mistakes.forEach((m) => lines.push(`- ${m.topic} — ${m.count} marta`));
        }

        // Keyingi hafta fokusi — modeldan
        try {
            const gen = await plain().generateContent(
                `O'quvchi haftalik natijasi:\n` +
                `Faol kunlar: ${activeDays}/7, darslar: ${lessons}, daraja: ${p.level}, dastur kuni: ${p.day_number}\n` +
                `So'z testlari: ${vocabAvg ?? '—'}%, drill: ${drillAvg ?? '—'}%, talaffuz: ${pronAvg ?? '—'}/10\n` +
                `Eng ko'p xatolar: ${mistakes.map((m) => `${m.topic} (${m.count}x)`).join(', ') || "yo'q"}\n\n` +
                `Shu ma'lumotga qarab yoz:\n` +
                `1. 🎯 **Keyingi hafta fokusi** — 2-3 ta aniq nuqta.\n` +
                `2. 💬 **Bir jumla xulosa** — halol. Yaxshi bo'lsa tan ol, yomon bo'lsa yumshatmasdan ayt.\n` +
                `Qisqa yoz, 6 qatordan oshmasin.\n\n${FORMAT}`
            );
            lines.push('', gen.response.text());
        } catch (e) {
            console.warn('Haftalik fokus olinmadi:', e.message);
        }

        return lines.join('\n');
    }

    bot.command('hafta', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('📊 Haftalik hisobot tayyorlanyapti...');
        try {
            await sendFormatted(ctx, msg.message_id, await buildWeeklyReport(ctx.chat.id));
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== /audio — HAQIQIY AUDIO TINGLASH ====================
    bot.command(['audio', 'diktant'], async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        if (!speak) return ctx.reply("Ovoz moduli ulanmagan.");

        const arg = ctx.message.text.replace(/^\/(audio|diktant)(@\S+)?\s*/i, '').trim().toLowerCase();
        const isDictation = /diktant|dikt/i.test(arg) || /^\/diktant/i.test(ctx.message.text);

        const msg = await ctx.reply('🎧 Audio tayyorlanyapti...');
        try {
            const p = await getProfile(ctx.chat.id);

            const gen = await plain().generateContent(
                `${p.level} darajadagi o'zbek o'quvchisi uchun ${isDictation ? 'DIKTANT' : 'TINGLASH'} mashqi tuz.\n\n` +
                (isDictation
                    ? `4-6 ta qisqa inglizcha gap yoz (har biri 6-10 so'z). O'quvchi ularni eshitib yozib oladi.\n` +
                      `Gaplar o'quvchining zaif nuqtalariga tegsin: ${(p.weak_points || []).join(', ') || 'oddiy zamonlar'}.\n\n` +
                      `FAQAT JSON: {"script":"gaplar, har biri yangi qatorda","questions":[],"answers":[]}`
                    : `1. 70-100 so'zlik tabiiy inglizcha matn (dialog yoki qisqa hikoya). Kundalik mavzu.\n` +
                      `2. Shu matn bo'yicha 4 ta tushunish savoli (inglizcha).\n\n` +
                      `FAQAT JSON: {"script":"...","questions":["1. ...","2. ..."],"answers":["...","..."]}`)
            );

            const data = parseJson(gen.response.text());
            if (!data?.script) throw new Error('Matn olinmadi');

            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, '🔊 Ovozga aylantirilyapti...');

            const sent = await speak(ctx, data.script);
            if (!sent) throw new Error('Audio yuborilmadi');

            data.isDictation = isDictation;
            sessions.set(ctx.chat.id, { type: 'audio_test', data });
            await setMode(ctx.chat.id, 'audio_test');

            await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});

            await ctx.reply(isDictation
                ? `✍️ Diktant\n\nAudioni tinglang va eshitgan gaplaringizni yozing.\nHar gapni yangi qatordan.\n\n2 marta tinglashingiz mumkin. Bekor qilish: /stop`
                : `🎧 Savollar\n\n${data.questions.join('\n')}\n\nJavoblarni bitta xabarda raqamlab yozing.`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    async function gradeAudio(ctx, answer) {
        const d = await guardSession(ctx, 'audio_test');
        if (!d) return;

        const msg = await ctx.reply('📊 Tekshirilyapti...');
        try {
            const prompt = d.isDictation
                ? `Diktant matni (asl):\n${d.script}\n\nO'quvchi yozgani:\n${answer}\n\n` +
                  `Har gapni asl bilan solishtir:\n` +
                  `- To'liq to'g'ri bo'lsa ✅\n` +
                  `- Farq bo'lsa ❌ va aynan qaysi so'z noto'g'ri eshitilgan yoki yozilganini ko'rsat\n` +
                  `- Imlo xatosini alohida belgila\n\n` +
                  `Oxirida: **Natija: X/${d.script.split('\n').filter(Boolean).length}** va eng ko'p qoqilgan tovush yoki qoida.\n` +
                  `${MISTAKE_SPEC}\n\n${FORMAT}`
                : `Matn:\n${d.script}\n\nSavollar:\n${d.questions.join('\n')}\nTo'g'ri javoblar:\n${d.answers.join('\n')}\n\n` +
                  `O'quvchi javoblari:\n${answer}\n\n` +
                  `Har savolni tekshir: ✅/❌ + to'g'ri javob + matnning qaysi joyidan.\n` +
                  `Oxirida **Natija: X/${d.questions.length}**.\n${MISTAKE_SPEC}\n\n${FORMAT}`;

            const gen = await plain().generateContent(prompt);
            const out = gen.response.text();
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, d.isDictation ? 'dictation' : 'listening');

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}\n\n📄 **Asl matn:**\n${d.script}` +
                `${mistakes ? `\n\n📝 ${mistakes} ta xato jurnaliga yozildi.` : ''}`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    }

    // ==================== /artikl — ARTIKL VA PREDLOGLAR ====================
    // O'zbek tilida artikl yo'q — bu eng ko'p xato qilinadigan joy
    const GRAM_TOPICS = [
        { id: 'a-an', name: 'a / an', rule: "Noaniq artikl. Undosh oldidan a, unli oldidan an. O'zbek tilida yo'q — shuning uchun unutiladi" },
        { id: 'the', name: 'the', rule: 'Aniq artikl. Suhbatda ikkinchi marta eslatilgan yoki yagona narsa oldidan' },
        { id: 'no-article', name: 'Artiklsiz holatlar', rule: "Ko'plik umumiy ma'noda, sanalmaydigan otlar, tillar, mamlakatlar (ko'pchiligi)" },
        { id: 'in-on-at-time', name: 'in / on / at — vaqt', rule: 'at soat, on kun va sana, in oy yil va davr' },
        { id: 'in-on-at-place', name: 'in / on / at — joy', rule: 'in ichida, on ustida yoki sirtida, at aniq nuqtada' },
        { id: 'to-for', name: 'to / for', rule: "to yo'nalish va qabul qiluvchi, for maqsad va foyda" },
        { id: 'of-from', name: 'of / from', rule: 'of tegishlilik, from manba va boshlanish nuqtasi' },
        { id: 'by-with', name: 'by / with', rule: 'by usul va ijrochi, with vosita va hamrohlik' },
        { id: 'verb-prep', name: "Fe'l + predlog", rule: "listen TO, wait FOR, depend ON, look AT — yodlanadi, mantiq yo'q" },
        { id: 'adj-prep', name: 'Sifat + predlog', rule: 'good AT, interested IN, afraid OF, married TO' },
    ];

    bot.command(['artikl', 'gram'], async (ctx) => {
        if (!supabase) return ctx.reply(noDb());

        try {
            const { count } = await supabase.from('eng_log')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', ctx.chat.id).eq('activity', 'grammar_drill');

            const t = GRAM_TOPICS[(count || 0) % GRAM_TOPICS.length];
            const msg = await ctx.reply('📐 Mashq tayyorlanyapti...');

            const gen = await plain().generateContent(
                `O'zbek o'quvchisi uchun "${t.name}" mavzusida mashq tuz.\nQoida: ${t.rule}\n\n` +
                `1. 📖 **Qoida** — o'zbekcha, 4-5 jumla. O'zbek tilida bu qanday ifodalanishini solishtir.\n` +
                `2. ⚠️ **O'zbeklar qiladigan xato** — 2 ta aniq misol: noto'g'ri → to'g'ri.\n` +
                `3. 🧩 **12 ta mashq** — bo'sh joyni to'ldirish. Aralash: oson va qiyin. Ba'zisida hech narsa kerak emas (artiklsiz holat).\n` +
                `4. ✍️ **3 ta tarjima** — o'zbekchadan inglizchaga, shu mavzuga tegishli.\n\n` +
                `Javoblarni BERMA. Qisqa yoz.\n\n${FORMAT}`
            );

            sessions.set(ctx.chat.id, { type: 'gram_drill', data: { topic: t.name, text: gen.response.text() } });
            await setMode(ctx.chat.id, 'gram_drill');

            await sendFormatted(ctx, msg.message_id,
                `📐 **${t.name}** · ${(count || 0) % GRAM_TOPICS.length + 1}/${GRAM_TOPICS.length}\n\n${gen.response.text()}`);
        } catch (e) {
            ctx.reply(`Xatolik: ${e.message}`);
        }
    });

    async function gradeGram(ctx, answer) {
        const d = await guardSession(ctx, 'gram_drill');
        if (!d) return;

        const msg = await ctx.reply('📊 Tekshirilyapti...');
        try {
            const gen = await plain().generateContent(
                `Mavzu: ${d.topic}\n\nTopshiriqlar:\n${d.text}\n\nO'quvchi javoblari:\n${answer}\n\n` +
                `Har javobni tekshir: ✅/❌ + to'g'ri variant + NEGA shunday (qisqa, o'zbekcha).\n` +
                `Artiklsiz holatni to'g'ri topgan bo'lsa alohida ta'kidla.\n` +
                `Oxirida natija va 1 ta eslab qolish usuli.\n${MISTAKE_SPEC}\n\n${FORMAT}`
            );

            const out = gen.response.text();
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'grammar_drill', null, d.topic);

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}${mistakes ? `\n\n📝 ${mistakes} ta xato jurnaliga yozildi.` : ''}\n\nKeyingi mavzu: /artikl`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    }

    // ==================== /phrasal — PHRASAL VERBS ====================
    const PHRASAL_GROUPS = [
        { name: 'get', verbs: ['get up — turmoq', 'get on — chiqmoq (transport)', 'get off — tushmoq', 'get over — yengmoq', 'get along — chiqishmoq', 'get back — qaytmoq'] },
        { name: 'take', verbs: ['take off — uchmoq / yechmoq', 'take on — qabul qilmoq (ish)', 'take up — boshlamoq (mashg\'ulot)', 'take out — olib chiqmoq', 'take after — o\'xshamoq', 'take over — egallamoq'] },
        { name: 'put', verbs: ['put on — kiymoq', 'put off — kechiktirmoq', 'put up with — chidamoq', 'put down — qo\'ymoq', 'put out — o\'chirmoq', 'put together — yig\'moq'] },
        { name: 'look', verbs: ['look for — qidirmoq', 'look after — qaramoq', 'look up — qidirib topmoq', 'look forward to — intizor bo\'lmoq', 'look into — o\'rganmoq', 'look out — ehtiyot bo\'lmoq'] },
        { name: 'go', verbs: ['go on — davom etmoq', 'go out — chiqmoq', 'go through — boshdan kechirmoq', 'go over — ko\'rib chiqmoq', 'go back — qaytmoq', 'go off — portlamoq / buzilmoq'] },
        { name: 'come', verbs: ['come up with — o\'ylab topmoq', 'come across — duch kelmoq', 'come back — qaytmoq', 'come in — kirmoq', 'come out — chiqmoq', 'come over — kelmoq (mehmonga)'] },
        { name: 'turn', verbs: ['turn on — yoqmoq', 'turn off — o\'chirmoq', 'turn up — kelib qolmoq', 'turn down — rad etmoq', 'turn into — aylanmoq', 'turn around — burilmoq'] },
        { name: 'work / run / break', verbs: ['work out — mashq qilmoq / hal bo\'lmoq', 'run out of — tugamoq', 'run into — uchrab qolmoq', 'break down — buzilmoq', 'break up — ajrashmoq', 'break into — bostirib kirmoq'] },
    ];

    bot.command('phrasal', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());

        try {
            const { count } = await supabase.from('eng_log')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', ctx.chat.id).eq('activity', 'phrasal');

            const gi = (count || 0) % PHRASAL_GROUPS.length;
            const g = PHRASAL_GROUPS[gi];
            const msg = await ctx.reply('🔗 Guruh tayyorlanyapti...');

            // Bazaga qo'shamiz — takror tizimiga tushadi
            await addWords(ctx.chat.id, g.verbs.map((v) => {
                const [word, meaning] = v.split(' — ');
                return { word, meaning };
            }), 'chunk');

            const gen = await plain().generateContent(
                `O'zbek o'quvchisi "${g.name}" ildizli phrasal verb larni o'rganyapti.\n` +
                `Iboralar: ${g.verbs.join('; ')}\n\n` +
                `1. 🧠 **Mantiq** — bu guruhda predlog ma'noni qanday o'zgartirishini tushuntir (up, off, out, over ning umumiy mantiqi).\n` +
                `2. 🧩 **8 ta mashq** — gapda to'g'ri phrasal verb ni qo'yish. Kontekst Humoyunning hayotidan: SMM, o'quv markazi, kontent.\n` +
                `3. ✍️ **3 ta tarjima** — o'zbekchadan inglizchaga.\n\n` +
                `Javoblarni BERMA. Qisqa yoz.\n\n${FORMAT}`
            );

            sessions.set(ctx.chat.id, { type: 'phrasal', data: { group: g.name, verbs: g.verbs, text: gen.response.text() } });
            await setMode(ctx.chat.id, 'phrasal');

            await sendFormatted(ctx, msg.message_id,
                `🔗 **Phrasal verbs — ${g.name}** · ${gi + 1}/${PHRASAL_GROUPS.length}\n\n` +
                g.verbs.map((v, i) => `${i + 1}. ${v}`).join('\n') +
                `\n\n${gen.response.text()}\n\n📝 ${g.verbs.length} ta ibora bazaga yozildi.`);
        } catch (e) {
            ctx.reply(`Xatolik: ${e.message}`);
        }
    });

    async function gradePhrasal(ctx, answer) {
        const d = await guardSession(ctx, 'phrasal');
        if (!d) return;

        const msg = await ctx.reply('📊 Tekshirilyapti...');
        try {
            const gen = await plain().generateContent(
                `Guruh: ${d.group}\nIboralar: ${d.verbs.join('; ')}\n\n` +
                `Topshiriqlar:\n${d.text}\n\nO'quvchi javoblari:\n${answer}\n\n` +
                `Har javobni tekshir: ✅/❌ + to'g'ri ibora + ma'no farqi.\n` +
                `Predlog noto'g'ri bo'lsa (get on / get off) alohida ko'rsat.\n` +
                `Oxirida natija.\n${MISTAKE_SPEC}\n\n${FORMAT}`
            );

            const out = gen.response.text();
            const mistakes = await recordMistakes(ctx.chat.id, out);

            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await logActivity(ctx.chat.id, 'phrasal', null, d.group);

            await sendFormatted(ctx, msg.message_id,
                `${stripMeta(out)}${mistakes ? `\n\n📝 ${mistakes} ta xato jurnaliga yozildi.` : ''}\n\nKeyingi guruh: /phrasal`);
        } catch (e) {
            sessions.delete(ctx.chat.id);
            await setMode(ctx.chat.id, null);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    }

    // ==================== /imtihon — SANA VA ORQAGA HISOB ====================
    bot.command('imtihon', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/imtihon(@\S+)?\s*/i, '').trim();
        const p = await getProfile(ctx.chat.id);

        if (!arg) {
            if (!p?.target_date) {
                return ctx.reply(
                    "🎯 Imtihon sanasi belgilanmagan.\n\n" +
                    "Sana qo'yish: /imtihon 2027-06-15\n\n" +
                    "Sana bo'lmasa reja ham bo'lmaydi — JARVIS orqaga hisoblab bosqichlarni belgilaydi."
                );
            }

            const days = Math.round((new Date(p.target_date) - new Date(today())) / 86400000);
            const msg = await ctx.reply('Hisoblanyapti...');

            const { count: vocab } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);
            const { data: bands } = await supabase.from('eng_log')
                .select('score').eq('chat_id', ctx.chat.id)
                .in('activity', ['essay', 'writing', 'speaking'])
                .not('score', 'is', null).order('created_at', { ascending: false }).limit(5);

            const avgBand = bands?.length
                ? (bands.reduce((a, b) => a + b.score, 0) / bands.length).toFixed(1) : null;

            const gen = await plain().generateContent(
                `O'quvchi IELTS ga tayyorlanyapti.\n` +
                `Imtihon sanasi: ${p.target_date} (${days} kun qoldi)\n` +
                `Hozirgi daraja: ${p.level}\n` +
                `Dastur kuni: ${p.day_number}\n` +
                `So'z bazasi: ${vocab || 0} ta\n` +
                `O'rtacha band: ${avgBand || 'hali yo\'q'}\n` +
                `Streak: ${p.streak} kun\n\n` +
                `Yoz:\n` +
                `1. 🎯 **Bosqichlar** — imtihongacha qaysi darajaga qachon chiqish kerak (sanalar bilan, 3-4 bosqich).\n` +
                `2. 📊 **Hozirgi holat** — belgilangan sur'atdan orqadami yoki oldinda. HALOL bahola.\n` +
                `3. ⚡ **Nima o'zgarishi kerak** — 2 ta aniq harakat.\n\n` +
                `${days < 180 ? 'Vaqt kam — buni ochiq ayt.' : ''}\n` +
                `Qisqa yoz. Bo'sh ruhlantirish yozma.\n\n${FORMAT}`
            );

            return sendFormatted(ctx, msg.message_id,
                `🎯 **Imtihongacha ${days} kun** (${p.target_date})\n\n${gen.response.text()}`);
        }

        const d = arg.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!d) return ctx.reply('Format: /imtihon 2027-06-15');

        const target = d[0];
        if (new Date(target) <= new Date(today())) return ctx.reply("Sana kelajakda bo'lishi kerak.");

        await saveProfile(ctx.chat.id, { target_date: target });
        const days = Math.round((new Date(target) - new Date(today())) / 86400000);

        ctx.reply(
            `🎯 Imtihon sanasi: ${target}\n` +
            `⏳ ${days} kun qoldi\n\n` +
            `Endi har darsda qolgan kun ko'rsatiladi.\nReja: /imtihon`
        );
    });

    // ==================== /progress ====================
    bot.command('progress', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        try {
            const p = await getProfile(ctx.chat.id);
            const cnt = async (q) => (await q).count || 0;
            const base = () => supabase.from('eng_vocab').select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);

            const total = await cnt(base());
            const learned = await cnt(base().gte('box', 4));
            const due = await cnt(base().lte('next_review', today()));

            const { data: logs } = await supabase.from('eng_log')
                .select('activity, score').eq('chat_id', ctx.chat.id)
                .not('score', 'is', null).order('created_at', { ascending: false }).limit(20);

            const bands = (logs || []).filter((l) => l.activity === 'essay' || l.activity === 'writing')
                .slice(0, 3).map((l) => l.score).join(' → ') || "hali yo'q";
            const speakBands = (logs || []).filter((l) => l.activity === 'speaking')
                .slice(0, 3).map((l) => l.score).join(' → ') || "hali yo'q";
            const vocabAvg = (() => {
                const v = (logs || []).filter((l) => l.activity === 'vocab_test').slice(0, 5).map((l) => l.score);
                return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) + '%' : "hali yo'q";
            })();

            const weak = (p.weak_points || []).length ? p.weak_points.join(', ') : 'aniqlanmagan (/test)';

            const topM = await getTopMistakes(ctx.chat.id, 3);
            const topMistakes = topM.length
                ? topM.map((m) => `${m.topic} (${m.count}x)`).join(', ')
                : "hali yo'q";
            const { count: topicCount } = await supabase.from('eng_topics')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);
            const { count: chunkCount } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id).eq('type', 'chunk');

            const drills = (logs || []).filter((l) => l.activity === 'drill').slice(0, 3).map((l) => l.score + '%').join(' → ') || "hali yo'q";
            const pron = (logs || []).filter((l) => l.activity === 'pronunciation').slice(0, 3).map((l) => l.score).join(' → ') || "hali yo'q";

            ctx.reply(
                `📈 Statistika, Humoyun\n\n` +
                `🔥 Streak: ${p.streak} kun\n` +
                `📅 Kun: ${p.day_number} / 450\n` +
                `🎓 Daraja: ${p.level}\n` +
                `📖 O'tilgan mavzular: ${topicCount || 0} ta\n` +
                `📚 So'zlar: ${total} ta (mustahkam: ${learned})\n` +
                `🧱 Birikmalar: ${chunkCount || 0} ta\n` +
                `🔁 Bugun takrorga: ${due} ta\n` +
                `🎯 So'z testlari o'rtachasi: ${vocabAvg}\n` +
                `⚡ Drill natijalari: ${drills}\n` +
                `🗣 Talaffuz ballari: ${pron}\n` +
                `✍️ Writing ballari: ${bands}\n` +
                `🎤 Speaking ballari: ${speakBands}\n` +
                `❌ Eng ko'p xatolar: ${topMistakes}\n` +
                `⚠️ Zaif nuqtalar: ${weak}\n\n` +
                `To'liq xatolar hisoboti: /xato`
            );
        } catch (e) {
            ctx.reply(`❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== REJIM USHLAGICHI ====================
    const MODE_TTL_MS = 3 * 60 * 60 * 1000;   // rejim 3 soatdan keyin o'zi yopiladi

    // Dars rejimida faqat javobga o'xshagan xabarni ushlaymiz
    function looksLikeAnswers(t) {
        if (!t) return false;
        const numbered = (t.match(/^\s*\d+[.)]/gm) || []).length;
        if (numbered >= 2) return true;                       // raqamlangan javoblar
        if (/^\s*\d+[.)]/.test(t) && t.length > 15) return true;
        if (/\b(is|are|am|was|were|do|does|did|have|has|will|going to)\b/i.test(t) && t.length > 25) return true;
        return false;
    }

    bot.on('message', async (ctx, next) => {
        if (!supabase) return next();
        if (ctx.message.text && ctx.message.text.startsWith('/')) return next();

        const p = await getProfile(ctx.chat.id);
        if (!p?.mode) return next();

        // Rejim eskirganmi — o'zi yopiladi
        if (p.mode_at && Date.now() - new Date(p.mode_at).getTime() > MODE_TTL_MS) {
            await setMode(ctx.chat.id, null);
            sessions.delete(ctx.chat.id);
            return next();
        }

        // Hujjat, rasm yoki ovoz kelsa — dars rejimi aralashmaydi
        if (p.mode === 'lesson' && (ctx.message.document || ctx.message.photo || ctx.message.voice || ctx.message.audio)) {
            return next();
        }

        const txt = ctx.message.text;

        // Ovozli xabarni tayyorlab qo'yamiz (listening va speaking uchun kerak)
        async function getVoicePart() {
            if (!ctx.message.voice) return null;
            const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const res = await fetch(link.href);
            const buf = await res.arrayBuffer();
            return { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'audio/ogg' } };
        }

        if (p.mode === 'word_test' && txt) return gradeWordTest(ctx, txt);
        if (p.mode === 'level_test' && txt) return gradeLevelTest(ctx, txt);
        if (p.mode === 'read_test' && txt) return gradeRead(ctx, txt);
        if (p.mode === 'essay' && txt) return gradeEssay(ctx, txt);
        if (p.mode === 'chunk_use' && txt) return gradeChunkUse(ctx, txt);
        if (p.mode === 'drill' && txt) return gradeDrill(ctx, txt);
        if (p.mode === 'verbs' && txt) return gradeVerbs(ctx, txt);
        if (p.mode === 'audio_test' && txt) return gradeAudio(ctx, txt);
        if (p.mode === 'gram_drill' && txt) return gradeGram(ctx, txt);
        if (p.mode === 'phrasal' && txt) return gradePhrasal(ctx, txt);

        if (p.mode === 'pronunciation') {
            return gradePronunciation(ctx, await getVoicePart());
        }

        if (p.mode === 'listen_test' && (txt || ctx.message.voice)) {
            return gradeListen(ctx, txt, await getVoicePart());
        }

        if (p.mode === 'ielts_speaking' && (txt || ctx.message.voice)) {
            return gradeSpeaking(ctx, txt, await getVoicePart());
        }

        if (p.mode === 'speak') {
            const msg = await ctx.reply('💬 ...');
            try {
                const s = sessions.get(ctx.chat.id);
                const hist = s?.type === 'speak' ? s.data : [];
                const parts = [];

                if (ctx.message.voice) {
                    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
                    const res = await fetch(link.href);
                    const buf = await res.arrayBuffer();
                    parts.push({ text: "My friend sent a voice message. Listen, reply naturally, and if his pronunciation or grammar has a clear mistake, correct it briefly in brackets." });
                    parts.push({ inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'audio/ogg' } });
                } else {
                    parts.push({ text: txt || '...' });
                }

                const result = await buddy.generateContent({ contents: [...hist, { role: 'user', parts }] });
                const reply = result.response.text();

                sessions.set(ctx.chat.id, {
                    type: 'speak',
                    data: [...hist,
                        { role: 'user', parts: [{ text: txt || '[voice message]' }] },
                        { role: 'model', parts: [{ text: reply }] }].slice(-16),
                });

                await sendFormatted(ctx, msg.message_id, reply);
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
            }
            return;
        }

        if (p.mode === 'lesson' && txt) {
            // Javobga o'xshamasa — oddiy suhbat deb qabul qilamiz
            if (!looksLikeAnswers(txt)) {
                await setMode(ctx.chat.id, null);
                return next();
            }

            const msg = await ctx.reply('📝 Mr. Grim tekshiryapti...');
            try {
                const result = await teacher.generateContent(
                    `Humoyun dars mashqlariga javob berdi (kun ${p.day_number}, daraja ${p.level}).\n\n` +
                    `Javoblari:\n${txt}\n\n` +
                    `Har javobni tekshir: ✅/❌, to'g'ri variant, qisqa izoh. Oxirida umumiy natija va 1 ta tavsiya. ` +
                    `WORDS= va TOPIC= qatorlarini bu safar YOZMA.\n${MISTAKE_SPEC}`
                );
                const out = result.response.text();
                const mistakes = await recordMistakes(ctx.chat.id, out);
                await sendFormatted(ctx, msg.message_id,
                    `${stripMeta(out)}${mistakes ? `\n\n📝 ${mistakes} ta xato jurnaliga yozildi.` : ''}`);
                await logActivity(ctx.chat.id, 'homework');
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
            }
            return;
        }

        return next();
    });

    // ==================== ESLATMALAR (Toshkent) ====================
    const tz = { timezone: 'Asia/Tashkent' };

    cron.schedule('40 6 * * 1-6', async () => {
        try {
            const p = await getProfile(myTelegramId);
            await bot.telegram.sendMessage(myTelegramId,
                `☀️ 06:40 — ertalabki blok.\n\n60 daqiqa: grammatika + yangi so'zlar.\nStreak: ${p?.streak || 0} kun\n\n/eng`);
        } catch (e) { console.error('Ertalabki eslatma:', e.message); }
    }, tz);

    cron.schedule('30 13 * * 1-6', async () => {
        try {
            const { count } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', myTelegramId).lte('next_review', today());
            if (count > 0) {
                await bot.telegram.sendMessage(myTelegramId,
                    `🔁 Takror vaqti — ${count} ta so'z kutyapti. 25 daqiqa.\n\n/word`);
            }
        } catch (e) { console.error('Kunduzgi eslatma:', e.message); }
    }, tz);

    cron.schedule('0 21 * * 1-6', async () => {
        try {
            const f = WEEK_FOCUS[weekday()];
            await bot.telegram.sendMessage(myTelegramId,
                `🌙 21:00 — kechki blok.\n\nBugungi fokus: ${f.name}${f.cmd ? `\n\n${f.cmd}` : ''}`);
        } catch (e) { console.error('Kechki eslatma:', e.message); }
    }, tz);

    // Yakshanba 20:00 — haftalik hisobot o'zi keladi
    cron.schedule('0 20 * * 0', async () => {
        try {
            if (!supabase) return;
            const report = await buildWeeklyReport(myTelegramId);
            const chunks = report.match(/[\s\S]{1,3500}/g) || [report];
            for (const c of chunks) {
                await bot.telegram.sendMessage(myTelegramId, c).catch(() => {});
            }
        } catch (e) { console.error('Haftalik hisobot xatosi:', e.message); }
    }, tz);

    cron.schedule('30 22 * * 1-6', async () => {
        try {
            const p = await getProfile(myTelegramId);
            if (p?.last_day !== today()) {
                await bot.telegram.sendMessage(myTelegramId,
                    `😤 Humoyun. Bugun dars bo'lmadi.\n\n${p?.streak || 0} kunlik streak bir kunlik dangasalikka arziydimi? Paloving tuzsiz chiqsin!\n\nHali kech emas: /eng`);
            }
        } catch (e) { console.error('Tungi eslatma:', e.message); }
    }, tz);

    console.log('📚 Ingliz tili moduli v4 yuklandi (grammar, vocab, chunk, drill, talaffuz, listening, reading, essay, speaking).');
};
