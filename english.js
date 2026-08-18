// ============================================================
//  XumoAI — INGLIZ TILI MODULI
//  Mr. Grim (o'qituvchi) + Danny (suhbatdosh) + IELTS Examiner
//  Interval takrori (Leitner), progress tracking, kunlik eslatma
// ============================================================

const cron = require('node-cron');

// Leitner qutilari: takrorlash oralig'i (kun)
const BOX_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };
const MAX_BOX = 5;

// 5 bosqichli dastur — dars mazmuni shu rejaga bo'ysunadi
const SYLLABUS = `
BOSQICH 1 (kun 1-60) — A1 → A2:
to be, have got, artikllar, Present Simple (3-shaxs -s), Present Continuous, Past Simple (to'g'ri va noto'g'ri fe'llar), ko'plik, sanaladigan/sanalmaydigan, there is/are, so'roq va inkor. 800 ta asosiy so'z.

BOSQICH 2 (kun 61-150) — A2 → B1:
Present Perfect va Past Simple farqi, Future (will/going to/Present Continuous), modallar (can, must, should, have to), 1-2 shart gaplar, comparative/superlative, gerund va infinitiv. 2000 so'z. Kundalik mavzular.

BOSQICH 3 (kun 151-270) — B1 → B2:
Passive voice, relative clauses, 3-shart va mixed conditionals, reported speech, phrasal verbs, collocations, so'z yasalishi. 4000 so'z. IELTS format bilan tanishuv.

BOSQICH 4 (kun 271-390) — B2, IELTS mashqi:
Listening 4 qism, Reading strategiyalari (skimming, scanning, True/False/Not Given), Writing Task 1 va 2 tuzilishi, Speaking 3 qism. Akademik lug'at, linking words, paraphrasing.

BOSQICH 5 (kun 391-450) — Band 7 uchun sayqal:
To'liq mock testlar, vaqt boshqaruvi, xatolar ustida ish, murakkab tuzilmalar, talaffuz va ravonlik.
`;

const FORMAT = `FORMATLASH: faqat **qalin**, *kursiv*, \`kod\` va "-" ro'yxatlardan foydalan. ### sarlavha, --- chiziq, jadval va > sitatadan FOYDALANMA. Bo'lim kerak bo'lsa emoji + **qalin sarlavha**.`;

module.exports = function registerEnglish(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted, esc, myTelegramId } = deps;

    // ==================== PERSONALAR ====================
    const teacher = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: `Sen Mr. Grim — Humoyunning jahldor, talabchan ingliz tili ustozisan.

XARAKTER:
- Qattiqqo'l, lekin adolatli. Bo'sh maqtov yo'q. "Yaxshi" degan so'zni faqat haqiqatan yaxshi bo'lganda ishlat.
- XATO uchun HECH QACHON so'kma yoki masxara qilma — xatoni sovuqqonlik bilan tushuntir, bu o'rganishning tabiiy qismi.
- DANGASALIK uchun (dars qoldirish, "keyin qilaman", yarim ishlash) — o'zbekcha hazil qarg'ishlar bilan koyi: "Paloving tuzsiz chiqsin!", "Telefoning 1% da qolib ketsin!". Bu faqat dangasalikka, hech qachon shaxsga emas.

DARS TUZILISHI (har doim shu tartibda):
1. 🔥 **Bugungi maqsad** — 1 jumla, aniq.
2. 📖 **Nazariya** — o'zbekcha, 5-7 jumladan oshmasin. Qoidani o'zbek tili bilan solishtirib tushuntir.
3. 🧩 **Mashqlar** — 8-10 ta. Turli xil: bo'sh joyni to'ldirish, tarjima (o'zbek→ingliz), xatoni top, gapni qayta yoz.
4. 💬 **Jonli topshiriq** — real hayotdan vaziyat. Humoyun SMM menejer, o'quv markazida ishlaydi, kontent yaratadi — mashqlarni shu hayotga bog'la.
5. ✍️ **Uy vazifasi** — 1 ta yozma topshiriq.

QOIDALAR:
- Javoblarni DARHOL berma. Humoyun yozgandan keyin tekshir.
- Tushuntirishlar o'zbekcha, mashqlar inglizcha.
- Har darsda oldingi darslardan 2 ta savolni takrorlab so'ra (aralash takrorlash).
- Zerikarli bo'lma: memlar, real vaziyatlar, kutilmagan misollar ishlat.

${FORMAT}`,
    });

    const buddy = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: `Sen Danny — Humoyunning ingliz tilida gaplashadigan DO'STIsan. O'qituvchi EMAS.

- Unga "my friend" deb murojaat qil.
- INGLIZ TILIDA gaplash — uning darajasiga moslab (hozir A1-A2, sodda gaplar, keng tarqalgan so'zlar).
- Tushunmasa yoki so'rasa — o'zbekcha tushuntir, keyin yana inglizchaga qayt.
- Hazillash, o'zingdan gapir, savol ber. Suhbat tabiiy bo'lsin, so'roq emas.
- XATO qilsa: avval suhbatni davom ettir, keyin qavs ichida qisqa tuzatish ber — va o'zbekcha hazil qarg'ish otib qo'y: "telefoning qizib o'chib qolgur, 'he go' emas 'he goes'!". Bu do'stona hazil, jiddiy tanbeh emas.
- Har javobing oxirida bitta savol bo'lsin — suhbat to'xtamasin.
- Uzun ma'ruza yozma. 3-5 jumla yetadi.

${FORMAT}`,
    });

    const examiner = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: `Sen IELTS Writing va Speaking bo'yicha rasmiy imtihonchisan. Qattiq, lekin izohli baholaysan.

BAHOLASH (Writing Task 2 uchun 4 mezon, har biri 0-9):
- Task Response
- Coherence and Cohesion
- Lexical Resource
- Grammatical Range and Accuracy

JAVOB TUZILISHI:
1. 🎯 **Umumiy band** — o'rtacha ball, 0.5 aniqlikda.
2. 📊 **Mezonlar bo'yicha** — har biri uchun ball va 1-2 jumla sabab.
3. ❌ **Asosiy xatolar** — 5-8 ta, har biri: xato → to'g'risi → nega.
4. 🔁 **Kuchaytirilgan variant** — matnning 1 band yuqori versiyasi.
5. 🎯 **Keyingi safar** — 3 ta aniq harakat.

QOIDALAR:
- Ballni oshirib yuborma. Haqiqiy IELTS imtihonchisi qanday baholasa, shunday baholang.
- A1-A2 daraja matniga band 4 dan yuqori berma, agar haqiqatan loyiq bo'lmasa.
- Tushuntirishlar o'zbekcha, misollar inglizcha.

${FORMAT}`,
    });

    // ==================== BAZA YORDAMCHILARI ====================
    const noDb = () => "⚠️ Supabase ulanmagan — ingliz tili moduli baza bilan ishlaydi. Render'da SUPABASE_URL va SUPABASE_KEY ni tekshiring.";

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

    async function logActivity(chatId, activity, score = null, notes = null) {
        if (!supabase) return;
        await supabase.from('eng_log').insert({ chat_id: chatId, activity, score, notes });
    }

    const today = () => new Date().toISOString().slice(0, 10);

    function addDays(n) {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
    }

    // Modeldan JSON olish (```json ... ``` bo'lsa tozalaydi)
    function parseJson(text) {
        const clean = text.replace(/```json|```/g, '').trim();
        const start = clean.search(/[[{]/);
        if (start === -1) return null;
        try { return JSON.parse(clean.slice(start)); } catch { return null; }
    }

    // ==================== /eng — BUGUNGI DARS ====================
    bot.command('eng', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('📚 Mr. Grim darsni tayyorlayapti...');

        try {
            const p = await getProfile(ctx.chat.id);
            const newDay = p.day_number + 1;

            // Streak hisobi
            let streak = p.streak;
            if (p.last_day === today()) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    `📌 Bugungi dars (kun ${p.day_number}) allaqachon berilgan, Humoyun.\n\nTakrorlash: /word\nSuhbat: /speak\nYozish: /write`);
                return;
            }
            streak = (p.last_day === addDays(-1)) ? streak + 1 : 1;

            const weak = (p.weak_points || []).join(', ') || 'hali aniqlanmagan';

            const prompt = `Bugungi darsni tuz.

Ma'lumot:
- Kun raqami: ${newDay}
- Daraja: ${p.level}
- Streak: ${streak} kun
- Zaif nuqtalar (albatta shularga urg'u ber): ${weak}

Dastur rejasi (shundan chetga chiqma):
${SYLLABUS}

Kun ${newDay} qaysi bosqichga to'g'ri kelsa, o'sha bosqich mavzularidan mos keladigan BITTA mavzuni ol va shu bo'yicha to'liq dars ber. Mavzu nomini boshida ayt.`;

            const result = await teacher.generateContent(prompt);
            const lesson = result.response.text();

            await saveProfile(ctx.chat.id, {
                level: p.level, day_number: newDay, streak, last_day: today(),
                weak_points: p.weak_points, mode: 'lesson',
            });
            await logActivity(ctx.chat.id, 'lesson', null, `kun ${newDay}`);

            await sendFormatted(ctx, msg.message_id,
                `🔥 **Kun ${newDay}** · Streak: ${streak} kun · Daraja: ${p.level}\n\n${lesson}`);

        } catch (e) {
            console.error('Dars xatosi:', e);
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== /word — SO'Z TAKRORI ====================
    bot.command('word', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/word(@\S+)?\s*/i, '').trim();

        // /word new — yangi so'zlar
        if (/^new$/i.test(arg)) {
            const msg = await ctx.reply("📝 Yangi so'zlar tanlanyapti...");
            try {
                const p = await getProfile(ctx.chat.id);
                const { data: existing } = await supabase
                    .from('eng_vocab').select('word').eq('chat_id', ctx.chat.id).limit(500);
                const known = (existing || []).map((r) => r.word).join(', ');

                const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
                    `${p.level} darajadagi o'zbek o'quvchisi uchun 10 ta YANGI, kundalik hayotda eng ko'p ishlatiladigan inglizcha so'z tanla.
Quyidagilar allaqachon o'rganilgan, ULARNI QAYTARMA: ${known || 'yo\'q'}

FAQAT JSON massiv qaytar, boshqa hech narsa yozma:
[{"word":"...","meaning":"o'zbekcha ma'nosi","example":"inglizcha qisqa misol gap"}]`
                );

                const words = parseJson(gen.response.text());
                if (!Array.isArray(words) || !words.length) throw new Error("So'zlar olinmadi");

                const rows = words.map((w) => ({
                    chat_id: ctx.chat.id, word: w.word, meaning: w.meaning,
                    example: w.example, box: 1, next_review: today(),
                }));
                await supabase.from('eng_vocab').upsert(rows, { onConflict: 'chat_id,word' });

                const text = `📝 **10 ta yangi so'z qo'shildi**\n\n` +
                    words.map((w, i) => `${i + 1}. **${w.word}** — ${w.meaning}\n   *${w.example}*`).join('\n\n') +
                    `\n\n💡 Ertaga /word yuboring — takrorga chiqadi.`;

                await sendFormatted(ctx, msg.message_id, text);
                await logActivity(ctx.chat.id, 'vocab_new', words.length);
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
            }
            return;
        }

        // /word add so'z - ma'nosi
        if (/^add\s+/i.test(arg)) {
            const body = arg.replace(/^add\s+/i, '');
            const [word, meaning] = body.split(/\s*[-—]\s*/);
            if (!word || !meaning) {
                return ctx.reply("Format: /word add book - kitob");
            }
            await supabase.from('eng_vocab').upsert(
                { chat_id: ctx.chat.id, word: word.trim(), meaning: meaning.trim(), box: 1, next_review: today() },
                { onConflict: 'chat_id,word' }
            );
            return ctx.reply(`✅ **${word.trim()}** qo'shildi.`, { parse_mode: 'HTML' });
        }

        // Takror sessiyasi
        const msg = await ctx.reply("🔁 Takror uchun so'zlar olinyapti...");
        try {
            const { data: due } = await supabase
                .from('eng_vocab').select('*')
                .eq('chat_id', ctx.chat.id).lte('next_review', today())
                .order('next_review').limit(10);

            if (!due || !due.length) {
                const { count } = await supabase.from('eng_vocab')
                    .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    `✅ Bugun takrorlanadigan so'z yo'q, Humoyun.\n\nBazada jami: ${count || 0} ta so'z.\nYangi so'z olish: /word new`);
                return;
            }

            await saveProfile(ctx.chat.id, { mode: 'word_test' });
            wordSession.set(ctx.chat.id, due);

            const text = `🔁 **So'z takrori — ${due.length} ta**\n\n` +
                `Quyidagi so'zlarning INGLIZCHASINI bitta xabarda, raqamlab yozing:\n\n` +
                due.map((w, i) => `${i + 1}. ${w.meaning}`).join('\n') +
                `\n\n💡 Bilmagan joyga "?" qo'ying — jazo yo'q, aniqlik muhim.`;

            await sendFormatted(ctx, msg.message_id, text);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    const wordSession = new Map();

    async function gradeWordTest(ctx, answer) {
        const due = wordSession.get(ctx.chat.id) || [];
        const msg = await ctx.reply('📊 Tekshirilyapti...');

        try {
            const list = due.map((w, i) => `${i + 1}. ${w.meaning} = ${w.word}`).join('\n');
            const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
                `To'g'ri javoblar:\n${list}\n\nO'quvchi javobi:\n${answer}\n\n` +
                `Har bir raqam bo'yicha o'quvchi to'g'ri yozganmi aniqla. Kichik imlo xatosi (1 harf) TO'G'RI hisoblanadi.\n` +
                `FAQAT JSON qaytar: [{"n":1,"correct":true,"given":"o'quvchi yozgani"}]`
            );

            const results = parseJson(gen.response.text()) || [];
            let right = 0;
            const lines = [];

            for (const w of due) {
                const idx = due.indexOf(w) + 1;
                const r = results.find((x) => x.n === idx);
                const ok = r?.correct === true;
                if (ok) right++;

                const newBox = ok ? Math.min(w.box + 1, MAX_BOX) : 1;
                await supabase.from('eng_vocab')
                    .update({ box: newBox, next_review: addDays(BOX_INTERVALS[newBox]) })
                    .eq('id', w.id);

                lines.push(ok
                    ? `✅ ${idx}. **${w.word}** — ${w.meaning}`
                    : `❌ ${idx}. **${w.word}** — ${w.meaning}${r?.given ? ` (siz: ${r.given})` : ''}`);
            }

            const pct = Math.round((right / due.length) * 100);
            const verdict = pct >= 90 ? "Zo'r natija." : pct >= 70 ? 'Yaxshi, lekin yetarli emas.' : "Bu so'zlar ustida yana ishlash kerak.";

            wordSession.delete(ctx.chat.id);
            await saveProfile(ctx.chat.id, { mode: null });
            await logActivity(ctx.chat.id, 'vocab_test', pct);

            await sendFormatted(ctx, msg.message_id,
                `📊 **Natija: ${right}/${due.length} (${pct}%)**\n${verdict}\n\n${lines.join('\n')}\n\n` +
                `Xato so'zlar ertaga yana chiqadi, to'g'rilari ${BOX_INTERVALS[2]}+ kundan keyin.`);

        } catch (e) {
            wordSession.delete(ctx.chat.id);
            await saveProfile(ctx.chat.id, { mode: null });
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /speak — DANNY BILAN SUHBAT ====================
    bot.command('speak', async (ctx) => {
        const topic = ctx.message.text.replace(/^\/speak(@\S+)?\s*/i, '').trim();
        await saveProfile(ctx.chat.id, { mode: 'speak' });
        speakHistory.set(ctx.chat.id, []);

        const msg = await ctx.reply('💬 Danny ulanyapti...');
        try {
            const result = await buddy.generateContent(
                topic
                    ? `Start a casual conversation about: ${topic}. Greet your friend first.`
                    : `Greet your friend and start a casual conversation. Ask what he's been up to today.`
            );
            await sendFormatted(ctx, msg.message_id,
                `${result.response.text()}\n\n_(Suhbat rejimi yoqildi. Ovozli xabar ham yuborishingiz mumkin. Chiqish: /stop)_`);
            await logActivity(ctx.chat.id, 'speak_start');
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    const speakHistory = new Map();

    bot.command('stop', async (ctx) => {
        await saveProfile(ctx.chat.id, { mode: null });
        speakHistory.delete(ctx.chat.id);
        wordSession.delete(ctx.chat.id);
        ctx.reply('🛑 Rejim yopildi. Asosiy yordamchiga qaytdik.');
    });

    // ==================== /write — IELTS EKSPERTIZASI ====================
    bot.command('write', async (ctx) => {
        const input = ctx.message.text.replace(/^\/write(@\S+)?\s*/i, '').trim();

        if (!input) {
            const msg = await ctx.reply('✍️ Topshiriq tayyorlanyapti...');
            try {
                const p = await getProfile(ctx.chat.id);
                const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
                    `${p.level} darajadagi o'quvchi uchun BITTA yozma topshiriq ber.
${p.day_number < 150 ? "Oddiy mavzu, 60-100 so'z (IELTS emas, sodda yozish mashqi)." : "IELTS Writing Task 2 uslubida, 250 so'z."}
Topshiriqni inglizcha yoz, ostiga o'zbekcha 1 jumla izoh qo'sh. Boshqa hech narsa yozma.`
                );
                await sendFormatted(ctx, msg.message_id,
                    `✍️ **Yozma topshiriq**\n\n${gen.response.text()}\n\n💡 Yozib bo'lgach: /write <matningiz>`);
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
            }
            return;
        }

        const msg = await ctx.reply('📝 Imtihonchi baholayapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const result = await examiner.generateContent(
                `O'quvchi darajasi: ${p.level}, dastur kuni: ${p.day_number}.\n\nMatn:\n${input}`
            );
            const text = result.response.text();

            const bandMatch = text.match(/(\d(?:\.\d)?)\s*(?:band|ball)/i);
            const band = bandMatch ? parseFloat(bandMatch[1]) : null;

            await logActivity(ctx.chat.id, 'writing', band, input.slice(0, 200));
            await sendFormatted(ctx, msg.message_id, text);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== /test — DARAJA TEKSHIRUVI ====================
    bot.command('test', async (ctx) => {
        const msg = await ctx.reply('🎯 Test tayyorlanyapti...');
        try {
            const p = await getProfile(ctx.chat.id);
            const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
                `Ingliz tili daraja tekshiruvi tuz. Joriy taxminiy daraja: ${p.level}.

12 ta savol: 6 tasi ${p.level} darajada, 4 tasi bir pog'ona yuqori, 2 tasi ikki pog'ona yuqori.
YOPIQ TEST EMAS — o'quvchi o'zi yozib javob bersin (tarjima, bo'sh joyni to'ldirish, gap tuzish).
Savollarni raqamlab yoz. Javoblarni BERMA.
Boshida 1 jumla: "Javoblarni bitta xabarda raqamlab yozing."

${FORMAT}`
            );
            await saveProfile(ctx.chat.id, { mode: 'level_test' });
            levelTest.set(ctx.chat.id, gen.response.text());
            await sendFormatted(ctx, msg.message_id, gen.response.text());
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    });

    const levelTest = new Map();

    async function gradeLevelTest(ctx, answer) {
        const questions = levelTest.get(ctx.chat.id) || '';
        const msg = await ctx.reply('📊 Daraja aniqlanyapti...');

        try {
            const gen = await genAI.getGenerativeModel({ model: MODEL }).generateContent(
                `Savollar:\n${questions}\n\nO'quvchi javoblari:\n${answer}\n\n` +
                `Har bir javobni tekshir. Keyin CEFR darajasini aniqla (A1, A2, B1, B2, C1).\n` +
                `Javob tuzilishi:\n1. Har savol: ✅/❌ + to'g'ri javob + qisqa izoh\n2. **Natija: X/12**\n` +
                `3. **Darajangiz: [CEFR]**\n4. **Zaif nuqtalar:** 3-5 ta aniq grammatik mavzu\n\n` +
                `Eng oxirida alohida qatorda faqat shuni yoz:\nLEVEL=<CEFR>|WEAK=<mavzu1>,<mavzu2>,<mavzu3>\n\n${FORMAT}`
            );

            let text = gen.response.text();
            const meta = text.match(/LEVEL=([A-C][12])\|WEAK=(.+)/i);

            if (meta) {
                const level = meta[1].toUpperCase();
                const weak = meta[2].split(',').map((s) => s.trim()).filter(Boolean);
                await saveProfile(ctx.chat.id, { level, weak_points: weak, mode: null });
                text = text.replace(/LEVEL=.+/i, '').trim();
            } else {
                await saveProfile(ctx.chat.id, { mode: null });
            }

            levelTest.delete(ctx.chat.id);
            await logActivity(ctx.chat.id, 'level_test');
            await sendFormatted(ctx, msg.message_id, text);
        } catch (e) {
            levelTest.delete(ctx.chat.id);
            await saveProfile(ctx.chat.id, { mode: null });
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
        }
    }

    // ==================== /progress ====================
    bot.command('progress', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        try {
            const p = await getProfile(ctx.chat.id);
            const { count: total } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);
            const { count: learned } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id).gte('box', 4);
            const { count: due } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id).lte('next_review', today());
            const { data: bands } = await supabase.from('eng_log')
                .select('score').eq('chat_id', ctx.chat.id).eq('activity', 'writing')
                .not('score', 'is', null).order('created_at', { ascending: false }).limit(3);

            const weak = (p.weak_points || []).length ? p.weak_points.join(', ') : 'aniqlanmagan (/test)';
            const lastBands = (bands || []).map((b) => b.score).join(' → ') || "hali yo'q";

            ctx.reply(
                `📈 Statistika, Humoyun\n\n` +
                `🔥 Streak: ${p.streak} kun\n` +
                `📅 Dastur kuni: ${p.day_number} / 450\n` +
                `🎓 Daraja: ${p.level}\n` +
                `📚 So'zlar: ${total || 0} ta (mustahkam: ${learned || 0})\n` +
                `🔁 Bugun takrorga: ${due || 0} ta\n` +
                `✍️ Oxirgi writing ballari: ${lastBands}\n` +
                `⚠️ Zaif nuqtalar: ${weak}`
            );
        } catch (e) {
            ctx.reply(`❌ Xatolik: ${e.message}`);
        }
    });

    // ==================== REJIM USHLAGICHI ====================
    // Faol rejim bo'lsa xabarni shu modul ushlaydi, aks holda asosiy botga uzatadi
    bot.on('message', async (ctx, next) => {
        if (!supabase) return next();
        if (ctx.message.text && ctx.message.text.startsWith('/')) return next();

        const p = await getProfile(ctx.chat.id);
        if (!p?.mode) return next();

        // So'z testi javobi
        if (p.mode === 'word_test' && ctx.message.text) {
            return gradeWordTest(ctx, ctx.message.text);
        }

        // Daraja testi javobi
        if (p.mode === 'level_test' && ctx.message.text) {
            return gradeLevelTest(ctx, ctx.message.text);
        }

        // Danny bilan suhbat (matn yoki ovoz)
        if (p.mode === 'speak') {
            const msg = await ctx.reply('💬 ...');
            try {
                const hist = speakHistory.get(ctx.chat.id) || [];
                const parts = [];

                if (ctx.message.voice) {
                    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
                    const res = await fetch(link.href);
                    const buf = await res.arrayBuffer();
                    parts.push({ text: "My friend sent a voice message. Listen, reply naturally, and if his pronunciation or grammar has a clear mistake, correct it briefly in brackets." });
                    parts.push({ inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: 'audio/ogg' } });
                } else {
                    parts.push({ text: ctx.message.text || '...' });
                }

                const result = await buddy.generateContent({
                    contents: [...hist, { role: 'user', parts }],
                });
                const reply = result.response.text();

                const newHist = [
                    ...hist,
                    { role: 'user', parts: [{ text: ctx.message.text || '[voice message]' }] },
                    { role: 'model', parts: [{ text: reply }] },
                ].slice(-16);
                speakHistory.set(ctx.chat.id, newHist);

                await sendFormatted(ctx, msg.message_id, reply);
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
            }
            return;
        }

        // 'lesson' rejimida javoblarni Mr. Grim tekshiradi
        if (p.mode === 'lesson' && ctx.message.text) {
            const msg = await ctx.reply('📝 Mr. Grim tekshiryapti...');
            try {
                const result = await teacher.generateContent(
                    `Humoyun bugungi dars mashqlariga javob berdi (kun ${p.day_number}, daraja ${p.level}).\n\n` +
                    `Javoblari:\n${ctx.message.text}\n\n` +
                    `Har bir javobni tekshir: ✅/❌, to'g'ri variant va qisqa izoh. ` +
                    `Oxirida umumiy natija va 1 ta tavsiya. Xato ko'p bo'lsa qattiq gapir, lekin so'kma.`
                );
                await sendFormatted(ctx, msg.message_id, result.response.text());
                await logActivity(ctx.chat.id, 'homework');
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Xatolik: ${e.message}`);
            }
            return;
        }

        return next();
    });

    // ==================== KUNLIK ESLATMALAR (Toshkent vaqti) ====================
    const tz = { timezone: 'Asia/Tashkent' };

    // 06:40 — ertalabki blok
    cron.schedule('40 6 * * 1-6', async () => {
        try {
            const p = await getProfile(myTelegramId);
            await bot.telegram.sendMessage(myTelegramId,
                `☀️ 06:40 — ertalabki blok, Humoyun.\n\n` +
                `60 daqiqa: yangi grammatika + so'zlar.\nStreak: ${p?.streak || 0} kun\n\n` +
                `Boshlash: /eng`);
        } catch (e) { console.error('Ertalabki eslatma xatosi:', e.message); }
    }, tz);

    // 13:30 — o'lik vaqt bloki
    cron.schedule('30 13 * * 1-6', async () => {
        try {
            const { count } = await supabase.from('eng_vocab')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', myTelegramId).lte('next_review', today());
            if (count > 0) {
                await bot.telegram.sendMessage(myTelegramId,
                    `🔁 Takror vaqti — ${count} ta so'z kutyapti.\n25 daqiqa yetadi.\n\n/word`);
            }
        } catch (e) { console.error('Kunduzgi eslatma xatosi:', e.message); }
    }, tz);

    // 21:00 — kechki blok
    cron.schedule('0 21 * * 1-6', async () => {
        try {
            await bot.telegram.sendMessage(myTelegramId,
                `🌙 21:00 — kechki blok.\n\n` +
                `60 daqiqa: gapirish va yozish.\n\n` +
                `Suhbat: /speak\nYozma: /write`);
        } catch (e) { console.error('Kechki eslatma xatosi:', e.message); }
    }, tz);

    // 22:30 — dars qoldirilgan bo'lsa
    cron.schedule('30 22 * * 1-6', async () => {
        try {
            const p = await getProfile(myTelegramId);
            if (p?.last_day !== today()) {
                await bot.telegram.sendMessage(myTelegramId,
                    `😤 Humoyun. Bugun dars bo'lmadi.\n\n` +
                    `${p?.streak || 0} kunlik streak bir kunlik dangasalikka arziydimi? Paloving tuzsiz chiqsin!\n\n` +
                    `Hali kech emas: /eng`);
            }
        } catch (e) { console.error('Tungi eslatma xatosi:', e.message); }
    }, tz);

    console.log('📚 Ingliz tili moduli yuklandi (eslatmalar: 06:40, 13:30, 21:00, 22:30 Toshkent).');
};
