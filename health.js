// ============================================================
//  JARVIS — SHAXSIY TRENER VA NUTRITSIOLOG
//  /tana · /ovqat · /suv · /menyu · /sport · /vazn · /tahlil
//  O'zbek taomlariga moslashtirilgan, uy sharoitida mashq
// ============================================================

const cron = require('node-cron');

// Taxminiy qiymatlar — modelga tayanch nuqta sifatida beriladi
const UZ_FOOD_REF = `
O'zbek taomlari — taxminiy qiymatlar (1 porsiya):
- Osh (palov) 1 kosa: ~650 kkal, oqsil 20g
- Mastava 1 kosa: ~250 kkal, oqsil 12g
- Sho'rva 1 kosa: ~350 kkal, oqsil 25g
- Lag'mon 1 kosa: ~500 kkal, oqsil 22g
- Manti 1 dona: ~130 kkal, oqsil 6g
- Somsa 1 dona: ~300 kkal, oqsil 10g
- Chuchvara 1 kosa: ~400 kkal, oqsil 18g
- Norin 1 kosa: ~450 kkal, oqsil 25g
- Dimlama 1 porsiya: ~400 kkal, oqsil 22g
- Obi non 1 ta: ~280 kkal, oqsil 8g (chorak ~70 kkal)
- Patir 1 ta: ~350 kkal
- Qaymoq 1 osh qoshiq: ~90 kkal
- Suzma 100g: ~90 kkal, oqsil 10g
- Qatiq 1 stakan: ~120 kkal, oqsil 8g
- Sut 1 stakan: ~130 kkal, oqsil 8g
- Tuxum 1 dona: ~70 kkal, oqsil 6g
- Tovuq go'shti (pishgan) 100g: ~165 kkal, oqsil 31g
- Mol go'shti 100g: ~250 kkal, oqsil 26g
- Qo'y go'shti 100g: ~290 kkal, oqsil 25g
- Baliq 100g: ~150 kkal, oqsil 22g
- Guruch (pishgan) 100g: ~130 kkal
- Kartoshka (qovurilgan) 100g: ~310 kkal
- Achchiq-chuchuk salat 1 porsiya: ~60 kkal
- Choy shakarsiz: 0 kkal, 1 choy qoshiq shakar: ~20 kkal
Bular taxminiy — pishirish usuli va yog' miqdoriga qarab farq qiladi.`;

const LEVELS = {
    boshlangich: 'Boshlang\'ich',
    ortacha: "O'rtacha",
    ilgor: "Ilg'or",
};

// Uy sharoitida 4 kunlik bo'linma
const SPLIT = {
    1: { name: 'Yuqori tana A — itarish', focus: 'ko\'krak, yelka, trisеps' },
    2: { name: 'Pastki tana A', focus: 'son oldi, dumba, boldir' },
    3: { name: 'Yuqori tana B — tortish', focus: 'orqa, biseps' },
    4: { name: 'Pastki tana B + qorin', focus: 'son orqasi, dumba, qorin' },
};

module.exports = function registerHealth(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted, myTelegramId } = deps;

    const plain = () => genAI.getGenerativeModel({ model: MODEL });
    const noDb = () => '⚠️ Supabase ulanmagan — sog\'liq moduli ishlamaydi.';
    const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    const addDays = (n) => {
        const d = new Date(); d.setDate(d.getDate() + n);
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    };

    function parseJson(text) {
        const clean = text.replace(/```json|```/g, '').trim();
        const start = clean.search(/[[{]/);
        if (start === -1) return null;
        try { return JSON.parse(clean.slice(start)); } catch { return null; }
    }

    const MEDICAL_NOTE = "\n\n_Bu umumiy tavsiya. Surunkali kasallik, dori qabul qilish yoki jarohat bo'lsa — avval shifokorga ko'rsating._";

    async function getProfile(chatId) {
        const { data } = await supabase.from('health_profile').select('*').eq('chat_id', chatId).maybeSingle();
        return data;
    }

    // Mifflin-St Jeor + faollik koeffitsienti
    function calcTargets({ height_cm, weight_kg, age, activity }) {
        const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
        const factor = { past: 1.2, ortacha: 1.45, yuqori: 1.65 }[activity] || 1.45;
        const tdee = bmr * factor;

        // Rekompozitsiya: yengil taqchillik (-10%), lekin pastki chegaradan tushmaydi
        let kcal = Math.round(tdee * 0.9);
        const floor = Math.round(bmr * 1.1);
        if (kcal < floor) kcal = floor;
        if (kcal < 1600) kcal = 1600;

        return {
            kcal_target: kcal,
            protein_target: Math.round(weight_kg * 1.8),
            water_target: Math.round((weight_kg * 35 + 500) / 250), // stakan hisobida
        };
    }

    // ==================== /tana — sozlash ====================
    bot.command('tana', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/tana(@\S+)?\s*/i, '').trim();

        if (!arg) {
            const p = await getProfile(ctx.chat.id);
            if (!p) {
                return ctx.reply(
                    "🏋️ **Sozlash kerak.**\n\n" +
                    "Bir qatorda yozing: bo'y, vazn, yosh, faollik\n\n" +
                    "Misol:\n`/tana 178 82 29 ortacha`\n\n" +
                    "Faollik: `past` (kun bo'yi o'tirish), `ortacha` (biroz yurish), `yuqori` (jismoniy mehnat)",
                    { parse_mode: 'Markdown' }
                );
            }
            return ctx.reply(
                `🏋️ Sizning me'yorlaringiz\n\n` +
                `Bo'y: ${p.height_cm} sm · Vazn: ${p.weight_kg} kg · Yosh: ${p.age}\n` +
                `Faollik: ${p.activity} · Maqsad: rekompozitsiya\n\n` +
                `🔥 Kaloriya: ${p.kcal_target} kkal/kun\n` +
                `🥩 Oqsil: ${p.protein_target} g/kun\n` +
                `💧 Suv: ${p.water_target} stakan (~${Math.round(p.water_target * 0.25 * 10) / 10} L)\n` +
                `🏋️ Mashq: haftada ${p.workout_days} kun · daraja: ${LEVELS[p.level] || p.level}\n\n` +
                `Yangilash: /tana 178 82 29 ortacha`
            );
        }

        const nums = arg.match(/\d+(\.\d+)?/g);
        if (!nums || nums.length < 3) {
            return ctx.reply("Format: /tana <bo'y> <vazn> <yosh> [past|ortacha|yuqori]\nMisol: /tana 178 82 29 ortacha");
        }

        const activity = (arg.match(/past|ortacha|yuqori/i) || ['ortacha'])[0].toLowerCase();
        const body = {
            height_cm: parseInt(nums[0], 10),
            weight_kg: parseFloat(nums[1]),
            age: parseInt(nums[2], 10),
            activity,
        };

        if (body.height_cm < 120 || body.height_cm > 230 || body.weight_kg < 35 || body.weight_kg > 250) {
            return ctx.reply("Raqamlar mantiqsiz ko'rinyapti. Tekshirib qayta yuboring.");
        }

        const targets = calcTargets(body);

        await supabase.from('health_profile').upsert({
            chat_id: ctx.chat.id, ...body, ...targets,
            goal: 'rekomp', updated_at: new Date().toISOString(),
        });
        await supabase.from('weight_log').upsert({ chat_id: ctx.chat.id, day: today(), weight: body.weight_kg });

        ctx.reply(
            `✅ Sozlandi.\n\n` +
            `🔥 Kaloriya: ${targets.kcal_target} kkal/kun\n` +
            `🥩 Oqsil: ${targets.protein_target} g/kun\n` +
            `💧 Suv: ${targets.water_target} stakan\n\n` +
            `Rekompozitsiya uchun eng muhimi shu ikkisi: **oqsil normasi** va **mashq muntazamligi**. ` +
            `Kaloriya biroz oshib ketsa halokat emas, oqsil yetmasa — muskul o'smaydi.\n\n` +
            `Boshlash: /menyu · /sport`,
            { parse_mode: 'Markdown' }
        );
    });

    // ==================== /ovqat ====================
    bot.command('ovqat', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const input = ctx.message.text.replace(/^\/ovqat(@\S+)?\s*/i, '').trim();

        // Argumentsiz — bugungi hisobot
        if (!input) {
            const p = await getProfile(ctx.chat.id);
            const { data: rows } = await supabase.from('food_log')
                .select('*').eq('chat_id', ctx.chat.id).eq('day', today()).order('created_at');

            if (!rows?.length) {
                return ctx.reply(
                    "🍽 Bugun hech narsa yozilmagan.\n\n" +
                    "Yeganingizni yozing:\n/ovqat bir kosa osh va achchiq-chuchuk\n/ovqat 3 ta tuxum, yarim non, choy"
                );
            }

            const kcal = rows.reduce((a, r) => a + (r.kcal || 0), 0);
            const prot = rows.reduce((a, r) => a + (r.protein || 0), 0);
            const kcalLeft = p ? p.kcal_target - kcal : null;
            const protLeft = p ? p.protein_target - prot : null;

            return ctx.reply(
                `🍽 Bugungi ovqatlanish\n\n` +
                rows.map((r) => `- ${r.description} — ${r.kcal} kkal, ${r.protein}g`).join('\n') +
                `\n\n🔥 Jami: ${kcal} kkal${p ? ` / ${p.kcal_target}` : ''}\n` +
                `🥩 Oqsil: ${prot} g${p ? ` / ${p.protein_target}` : ''}\n` +
                (p ? `\n${kcalLeft > 0 ? `Qoldi: ${kcalLeft} kkal` : `⚠️ ${-kcalLeft} kkal oshdi`}\n` +
                    `${protLeft > 0 ? `Oqsil yetishmaydi: ${protLeft} g` : '✅ Oqsil normasi bajarildi'}` : '')
            );
        }

        const msg = await ctx.reply('Hisoblanyapti...');
        try {
            const gen = await plain().generateContent(
                `${UZ_FOOD_REF}\n\n` +
                `Foydalanuvchi yedi: "${input}"\n\n` +
                `Kaloriya va oqsilni hisobla. Porsiya aytilmasa, o'rtacha porsiya deb ol.\n` +
                `FAQAT JSON: {"meal":"nonushta|tushlik|kechki|gazak","kcal":000,"protein":00,"clean":"qisqa tavsif","note":"1 jumla izoh yoki null"}`
            );

            const r = parseJson(gen.response.text());
            if (!r) throw new Error('Hisoblab bo\'lmadi');

            await supabase.from('food_log').insert({
                chat_id: ctx.chat.id, day: today(), meal: r.meal,
                description: r.clean || input, kcal: r.kcal, protein: r.protein,
            });

            const p = await getProfile(ctx.chat.id);
            const { data: rows } = await supabase.from('food_log')
                .select('kcal, protein').eq('chat_id', ctx.chat.id).eq('day', today());

            const kcal = (rows || []).reduce((a, x) => a + (x.kcal || 0), 0);
            const prot = (rows || []).reduce((a, x) => a + (x.protein || 0), 0);

            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `✅ ${r.clean || input}\n+${r.kcal} kkal · +${r.protein}g oqsil\n\n` +
                (p ? `Bugun: ${kcal}/${p.kcal_target} kkal · ${prot}/${p.protein_target}g oqsil\n` : `Bugun: ${kcal} kkal · ${prot}g oqsil\n`) +
                (r.note ? `\n💡 ${r.note}` : ''));
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /suv ====================
    bot.command('suv', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/suv(@\S+)?\s*/i, '').trim();
        const add = arg ? (parseInt(arg, 10) || 1) : 1;

        const { data: cur } = await supabase.from('water_log')
            .select('glasses').eq('chat_id', ctx.chat.id).eq('day', today()).maybeSingle();

        const glasses = Math.max(0, (cur?.glasses || 0) + add);
        await supabase.from('water_log').upsert({ chat_id: ctx.chat.id, day: today(), glasses });

        const p = await getProfile(ctx.chat.id);
        const target = p?.water_target || 10;
        const bar = '💧'.repeat(Math.min(glasses, target)) + '⚪'.repeat(Math.max(0, target - glasses));

        ctx.reply(
            `${bar}\n\n${glasses} / ${target} stakan (~${Math.round(glasses * 0.25 * 10) / 10} L)\n` +
            (glasses >= target ? '✅ Kunlik norma bajarildi.' : `Qoldi: ${target - glasses} stakan`)
        );
    });

    // ==================== /menyu ====================
    bot.command('menyu', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const p = await getProfile(ctx.chat.id);
        if (!p) return ctx.reply('Avval /tana orqali sozlang.');

        const msg = await ctx.reply('Menyu tuzilyapti...');
        try {
            const month = new Date().getMonth() + 1;
            const season = [12, 1, 2].includes(month) ? 'qish' : [3, 4, 5].includes(month) ? 'bahor'
                : [6, 7, 8].includes(month) ? 'yoz' : 'kuz';

            const gen = await plain().generateContent(
                `${UZ_FOOD_REF}\n\n` +
                `O'zbekistonda yashovchi erkak uchun BUGUNGI ovqat rejasini tuz.\n\n` +
                `Me'yorlar: ${p.kcal_target} kkal, oqsil ${p.protein_target} g.\n` +
                `Maqsad: rekompozitsiya — yog' kamayishi va muskul o'sishi bir vaqtda.\n` +
                `Mavsum: ${season}.\n\n` +
                `QOIDALAR:\n` +
                `- Faqat O'zbekistonda oson topiladigan mahsulotlar. Avokado, kinoa, chia kabi narsalarni taklif qilma.\n` +
                `- Milliy taomlarni taqiqlama — qanday qilib me'yorga sig'dirishni ko'rsat.\n` +
                `- Har taomning yoniga taxminiy kkal va oqsil yoz.\n` +
                `- Oqsil normasiga yetish eng muhim vazifa — buni ta'kidla.\n\n` +
                `Javob:\n` +
                `🌅 **Nonushta** (08:00)\n🍽 **Tushlik** (13:00)\n🥗 **Gazak** (16:30)\n🌙 **Kechki** (19:30)\n` +
                `Har biri: taom + miqdor + kkal/oqsil.\n` +
                `Oxirida: **Jami** va bitta amaliy maslahat.\n\n` +
                `Qisqa yoz. Faqat **qalin**, *kursiv* va "-" ro'yxat ishlat.`
            );

            await sendFormatted(ctx, msg.message_id, gen.response.text() + MEDICAL_NOTE);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /sport ====================
    bot.command('sport', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const p = await getProfile(ctx.chat.id);
        if (!p) return ctx.reply('Avval /tana orqali sozlang.');

        const arg = ctx.message.text.replace(/^\/sport(@\S+)?\s*/i, '').trim();

        // /sport bajardim — mashqni belgilash
        if (/bajardim|tugadi|done/i.test(arg)) {
            await supabase.from('workout_log').insert({
                chat_id: ctx.chat.id, day: today(), kind: 'mashq', done: true,
            });
            const { count } = await supabase.from('workout_log')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);

            // Har 12 mashqda daraja oshadi
            const levels = ['boshlangich', 'ortacha', 'ilgor'];
            const newLevel = levels[Math.min(Math.floor((count || 0) / 12), 2)];
            if (newLevel !== p.level) {
                await supabase.from('health_profile').update({ level: newLevel }).eq('chat_id', ctx.chat.id);
                return ctx.reply(`✅ Yozildi. Jami ${count} ta mashq.\n\n🎉 Daraja oshdi: ${LEVELS[newLevel]}\nKeyingi mashqlar og'irlashadi.`);
            }
            return ctx.reply(`✅ Yozildi. Jami ${count} ta mashq.\nDaraja: ${LEVELS[p.level]}`);
        }

        const msg = await ctx.reply('Mashq tayyorlanyapti...');
        try {
            const { count } = await supabase.from('workout_log')
                .select('*', { count: 'exact', head: true }).eq('chat_id', ctx.chat.id);

            const dayIndex = ((count || 0) % 4) + 1;
            const s = SPLIT[dayIndex];

            const { data: recent } = await supabase.from('workout_log')
                .select('day').eq('chat_id', ctx.chat.id)
                .gte('day', addDays(-7));

            const gen = await plain().generateContent(
                `Uy sharoitida mashq dasturi tuz. Jihoz yo'q yoki minimal (gantel bo'lishi mumkin, lekin majburiy emas).\n\n` +
                `Bugungi kun: ${s.name} (${s.focus})\n` +
                `Daraja: ${LEVELS[p.level]}\n` +
                `Maqsad: rekompozitsiya — muskul saqlash va o'stirish, yog' kamaytirish.\n` +
                `Oxirgi 7 kunda ${(recent || []).length} ta mashq bajarilgan.\n\n` +
                `Javob:\n` +
                `🔥 **Isinish** — 5 daqiqa, 3-4 harakat.\n` +
                `💪 **Asosiy qism** — 5-6 mashq. Har biri: nomi, necha yondashuv × necha takror, dam olish vaqti.\n` +
                `   Har mashq yoniga qavs ichida texnika bo'yicha 1 ta muhim eslatma.\n` +
                `🧘 **Cho'zilish** — 3 daqiqa.\n` +
                `📈 **Progressiya** — keyingi safar nimani og'irlashtirish kerak (1 jumla).\n\n` +
                `QOIDALAR:\n` +
                `- Faqat uyda bajariladigan mashqlar. Trenajyor talab qilma.\n` +
                `- Daraja "${LEVELS[p.level]}" ga mos og'irlik. Boshlang'ichga tizzada push-up, ilg'orga bir oyoqli variantlar.\n` +
                `- Umumiy davomiylik 35-45 daqiqa.\n` +
                `- Jarohat xavfi bor mashqlarni (masalan to'liq burpee tizza og'rig'ida) ehtiyot bilan bering.\n\n` +
                `Qisqa yoz. Faqat **qalin**, *kursiv* va "-" ro'yxat ishlat.`
            );

            await sendFormatted(ctx, msg.message_id,
                `🏋️ **${s.name}** · ${LEVELS[p.level]}\n\n${gen.response.text()}\n\n` +
                `Bajargach: /sport bajardim${MEDICAL_NOTE}`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /vazn ====================
    bot.command('vazn', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/vazn(@\S+)?\s*/i, '').trim();

        if (!arg) {
            const { data: rows } = await supabase.from('weight_log')
                .select('*').eq('chat_id', ctx.chat.id).order('day', { ascending: false }).limit(10);

            if (!rows?.length) return ctx.reply('Vazn yozilmagan.\n\nYozish: /vazn 81.5');

            const first = rows[rows.length - 1];
            const last = rows[0];
            const diff = (last.weight - first.weight).toFixed(1);

            return ctx.reply(
                `⚖️ Vazn tarixi\n\n` +
                rows.map((r) => `${r.day} — ${r.weight} kg`).join('\n') +
                `\n\nO'zgarish: ${diff > 0 ? '+' : ''}${diff} kg\n\n` +
                `Eslatma: rekompozitsiyada vazn deyarli o'zgarmasligi mumkin — yog' kamayib, muskul o'sadi. ` +
                `Ko'zgu va kiyim o'lchami tarozidan ko'ra to'g'riroq ko'rsatkich.`
            );
        }

        const w = parseFloat(arg.replace(',', '.'));
        if (!w || w < 35 || w > 250) return ctx.reply('Format: /vazn 81.5');

        await supabase.from('weight_log').upsert({ chat_id: ctx.chat.id, day: today(), weight: w });

        const p = await getProfile(ctx.chat.id);
        if (p) {
            const targets = calcTargets({ ...p, weight_kg: w });
            await supabase.from('health_profile').update({ weight_kg: w, ...targets }).eq('chat_id', ctx.chat.id);
            return ctx.reply(`⚖️ ${w} kg yozildi.\n\nMe'yorlar yangilandi:\n🔥 ${targets.kcal_target} kkal · 🥩 ${targets.protein_target}g · 💧 ${targets.water_target} stakan`);
        }
        ctx.reply(`⚖️ ${w} kg yozildi.`);
    });

    // ==================== /tahlil ====================
    bot.command('tahlil', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const p = await getProfile(ctx.chat.id);
        if (!p) return ctx.reply('Avval /tana orqali sozlang.');

        const msg = await ctx.reply('Tahlil qilinyapti...');
        try {
            const from = addDays(-7);

            const { data: food } = await supabase.from('food_log')
                .select('day, kcal, protein').eq('chat_id', ctx.chat.id).gte('day', from);
            const { data: water } = await supabase.from('water_log')
                .select('day, glasses').eq('chat_id', ctx.chat.id).gte('day', from);
            const { data: work } = await supabase.from('workout_log')
                .select('day').eq('chat_id', ctx.chat.id).gte('day', from);
            const { data: weights } = await supabase.from('weight_log')
                .select('day, weight').eq('chat_id', ctx.chat.id).order('day', { ascending: false }).limit(14);

            // Kunlar bo'yicha yig'ish
            const byDay = {};
            (food || []).forEach((f) => {
                byDay[f.day] = byDay[f.day] || { kcal: 0, prot: 0 };
                byDay[f.day].kcal += f.kcal || 0;
                byDay[f.day].prot += f.protein || 0;
            });

            const days = Object.keys(byDay);
            const avgKcal = days.length ? Math.round(days.reduce((a, d) => a + byDay[d].kcal, 0) / days.length) : 0;
            const avgProt = days.length ? Math.round(days.reduce((a, d) => a + byDay[d].prot, 0) / days.length) : 0;
            const avgWater = (water || []).length
                ? Math.round((water.reduce((a, w) => a + w.glasses, 0) / water.length) * 10) / 10 : 0;
            const workoutDays = new Set((work || []).map((w) => w.day)).size;

            const protDays = days.filter((d) => byDay[d].prot >= p.protein_target * 0.9).length;

            const wTrend = weights?.length >= 2
                ? `${weights[weights.length - 1].weight} → ${weights[0].weight} kg`
                : "ma'lumot yetarli emas";

            const stats =
                `📊 **Haftalik tahlil**\n\n` +
                `📅 Ovqat yozilgan kunlar: ${days.length}/7\n` +
                `🔥 O'rtacha kaloriya: ${avgKcal} / ${p.kcal_target}\n` +
                `🥩 O'rtacha oqsil: ${avgProt} / ${p.protein_target} g\n` +
                `   Norma bajarilgan kunlar: ${protDays}/${days.length || 7}\n` +
                `💧 O'rtacha suv: ${avgWater} / ${p.water_target} stakan\n` +
                `🏋️ Mashqlar: ${workoutDays} / ${p.workout_days} kun\n` +
                `⚖️ Vazn: ${wTrend}`;

            const gen = await plain().generateContent(
                `Rekompozitsiya ustida ishlayotgan odamning haftalik ma'lumoti:\n${stats.replace(/\*\*/g, '')}\n\n` +
                `Tahlil qil:\n` +
                `1. ✅ **Nima yaxshi ketyapti** — 1-2 nuqta.\n` +
                `2. ⚠️ **Asosiy muammo** — bitta eng muhim nuqta. Yumshatmasdan ayt.\n` +
                `3. 🎯 **Keyingi hafta** — 2 ta aniq harakat.\n\n` +
                `Rekompozitsiyada oqsil va mashq muntazamligi kaloriyadan muhimroq — shuni hisobga ol.\n` +
                `Ma'lumot kam bo'lsa, ochiq ayt: "yozuvlar kam, xulosa ishonchsiz".\n` +
                `Qisqa yoz, 8 qatordan oshmasin.`
            );

            await sendFormatted(ctx, msg.message_id, `${stats}\n\n${gen.response.text()}`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== ESLATMALAR ====================
    const tz = { timezone: 'Asia/Tashkent' };
    const safeSend = (text) => bot.telegram.sendMessage(myTelegramId, text).catch(() => {});

    // Suv — ovqat vaqtlariga bog'lanmagan paytlarda
    cron.schedule('0 10,15 * * *', async () => {
        try {
            if (!supabase) return;
            const { data } = await supabase.from('water_log')
                .select('glasses').eq('chat_id', myTelegramId).eq('day', today()).maybeSingle();
            const p = await getProfile(myTelegramId);
            const g = data?.glasses || 0;
            const t = p?.water_target || 10;
            if (g < t) safeSend(`💧 Suv vaqti — ${g}/${t} stakan.\n\n1 stakan iching, keyin /suv bosing.`);
        } catch (e) { console.error('Suv eslatmasi:', e.message); }
    }, tz);

    // Ovqat vaqtlari
    cron.schedule('0 8 * * *', () => safeSend('🌅 Nonushta vaqti.\n\nOqsil bilan boshlang — tuxum, suzma yoki qatiq.\nMenyu: /menyu'), tz);
    cron.schedule('0 13 * * *', () => safeSend('🍽 Tushlik vaqti.\n\nYegach yozing: /ovqat <nima yedingiz>'), tz);
    cron.schedule('30 19 * * *', () => safeSend('🌙 Kechki ovqat.\n\nKechqurun oqsil va sabzavot, uglevod kamroq.'), tz);

    // Mashq — dushanba, seshanba, payshanba, juma
    cron.schedule('0 18 * * 1,2,4,5', async () => {
        try {
            if (!supabase) return;
            const { data } = await supabase.from('workout_log')
                .select('id').eq('chat_id', myTelegramId).eq('day', today()).limit(1);
            if (!data?.length) safeSend('🏋️ Mashq kuni.\n\n40 daqiqa. Boshlash: /sport');
        } catch (e) { console.error('Mashq eslatmasi:', e.message); }
    }, tz);

    // Kunlik yakun
    cron.schedule('0 22 * * *', async () => {
        try {
            if (!supabase) return;
            const p = await getProfile(myTelegramId);
            if (!p) return;

            const { data: food } = await supabase.from('food_log')
                .select('kcal, protein').eq('chat_id', myTelegramId).eq('day', today());
            const { data: water } = await supabase.from('water_log')
                .select('glasses').eq('chat_id', myTelegramId).eq('day', today()).maybeSingle();

            const kcal = (food || []).reduce((a, f) => a + (f.kcal || 0), 0);
            const prot = (food || []).reduce((a, f) => a + (f.protein || 0), 0);

            if (!food?.length && !water?.glasses) return;

            safeSend(
                `🌃 Kunlik yakun\n\n` +
                `🔥 ${kcal} / ${p.kcal_target} kkal\n` +
                `🥩 ${prot} / ${p.protein_target} g oqsil${prot < p.protein_target * 0.8 ? ' ⚠️' : ' ✅'}\n` +
                `💧 ${water?.glasses || 0} / ${p.water_target} stakan\n\n` +
                (prot < p.protein_target * 0.8
                    ? 'Oqsil past qoldi. Ertaga nonushtaga tuxum yoki suzma qo\'shing.'
                    : 'Yaxshi kun.')
            );
        } catch (e) { console.error('Kunlik yakun:', e.message); }
    }, tz);

    console.log('🏋️ Sog\'liq moduli yuklandi (/tana, /ovqat, /suv, /menyu, /sport, /vazn, /tahlil).');
};
