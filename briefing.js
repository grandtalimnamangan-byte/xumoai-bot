// ============================================================
//  JARVIS — ERTALABKI BRIFING
//  Barcha modullardan ma'lumot yig'ib, bitta xabarda beradi
//  /brifing · avtomatik 07:00 (Toshkent)
// ============================================================

const cron = require('node-cron');

// Namangan koordinatalari
const LAT = 40.9983;
const LON = 71.6726;

const WEATHER_CODE = {
    0: 'Ochiq', 1: 'Asosan ochiq', 2: 'Bulutli', 3: 'To\'liq bulutli',
    45: 'Tuman', 48: 'Qirov tuman',
    51: 'Yengil shivalama', 53: 'Shivalama', 55: 'Kuchli shivalama',
    61: 'Yengil yomg\'ir', 63: 'Yomg\'ir', 65: 'Kuchli yomg\'ir',
    71: 'Yengil qor', 73: 'Qor', 75: 'Kuchli qor',
    80: 'Yomg\'ir yog\'ishi', 81: 'Jala', 82: 'Kuchli jala',
    95: 'Momaqaldiroq', 96: 'Do\'l bilan momaqaldiroq',
};

const WEEK_UZ = { Mon: 'Dushanba', Tue: 'Seshanba', Wed: 'Chorshanba', Thu: 'Payshanba', Fri: 'Juma', Sat: 'Shanba', Sun: 'Yakshanba' };

module.exports = function registerBriefing(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted, myTelegramId, sendVoiceReply } = deps;
    const VOICE_BRIEFING = process.env.VOICE_BRIEFING === 'true';

    const plain = () => genAI.getGenerativeModel({ model: MODEL });
    const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    const addDays = (n) => {
        const d = new Date(); d.setDate(d.getDate() + n);
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    };
    const weekday = () => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tashkent', weekday: 'short' }).format(new Date());

    // ==================== OB-HAVO ====================
    async function getWeather() {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
                `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max` +
                `&current=temperature_2m,weathercode&timezone=Asia%2FTashkent&forecast_days=1`;

            const res = await fetch(url);
            if (!res.ok) return null;
            const d = await res.json();

            return {
                now: Math.round(d.current?.temperature_2m),
                max: Math.round(d.daily?.temperature_2m_max?.[0]),
                min: Math.round(d.daily?.temperature_2m_min?.[0]),
                code: d.daily?.weathercode?.[0],
                rain: d.daily?.precipitation_probability_max?.[0],
            };
        } catch (e) {
            console.warn('Ob-havo olinmadi:', e.message);
            return null;
        }
    }

    // ==================== MA'LUMOT YIG'ISH ====================
    async function collect(chatId) {
        const data = { weather: await getWeather() };
        if (!supabase) return data;

        // --- Loyihalar ---
        try {
            const { data: projects } = await supabase.from('projects').select('*')
                .eq('chat_id', chatId).in('status', ['faol', 'kutmoqda']).order('priority');
            data.projects = projects || [];

            const { data: ideas } = await supabase.from('project_notes')
                .select('id').eq('chat_id', chatId).eq('kind', 'gaoya').is('project_id', null);
            data.looseIdeas = (ideas || []).length;
        } catch (e) { console.warn('Loyihalar:', e.message); }

        // --- Ingliz tili ---
        try {
            const { data: eng } = await supabase.from('eng_profile')
                .select('*').eq('chat_id', chatId).maybeSingle();
            data.eng = eng;

            if (eng) {
                const { count } = await supabase.from('eng_vocab')
                    .select('*', { count: 'exact', head: true })
                    .eq('chat_id', chatId).lte('next_review', today());
                data.engDue = count || 0;
                data.engDoneToday = eng.last_day === today();
                data.engMissedYesterday = eng.last_day && eng.last_day < addDays(-1);
            }
        } catch (e) { console.warn('Ingliz:', e.message); }

        return data;
    }

    // ==================== BRIFING TUZISH ====================
    async function buildBriefing(chatId) {
        const d = await collect(chatId);
        const wd = weekday();
        const hour = parseInt(new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false,
        }).format(new Date()), 10);

        const salom = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
        const lines = [`${salom}, Humoyun.`, `📅 ${WEEK_UZ[wd]}, ${today()}`];

        // --- Ob-havo ---
        if (d.weather) {
            lines.push('', `🌤 **Namangan:** ${d.weather.now}° hozir · ${d.weather.min}…${d.weather.max}° · ${WEATHER_CODE[d.weather.code] || ''}` +
                (d.weather.rain >= 40 ? ` · yog'ingarchilik ehtimoli ${d.weather.rain}%` : ''));
        }

        // --- Ustuvor ishlar ---
        if (d.projects?.length) {
            const scored = d.projects.map((p) => {
                const idle = p.last_touched
                    ? Math.round((new Date(today()) - new Date(p.last_touched)) / 86400000) : 99;
                return { ...p, idle, score: (6 - p.priority) * 10 + Math.min(idle, 30) - (p.blocker ? 15 : 0) };
            }).sort((a, b) => b.score - a.score);

            const top = scored.slice(0, 3);
            lines.push('', `🎯 **Bugungi 3 ta ish**`);
            top.forEach((p, i) => {
                lines.push(`${i + 1}. **${p.name}** — ${p.next_step || 'keyingi qadam aniqlanmagan'}` +
                    (p.idle > 14 ? ` _(${p.idle} kun tegilmagan)_` : ''));
            });

            const stale = scored.filter((p) => p.idle > 21);
            if (stale.length) {
                lines.push('', `⚠️ ${stale.length} ta loyiha 3 haftadan ortiq turibdi: ${stale.slice(0, 3).map((p) => p.name).join(', ')}`);
            }
            if (d.looseIdeas > 0) {
                lines.push(`💡 ${d.looseIdeas} ta g'oya loyihaga biriktirilmagan`);
            }
        }

        // --- Ingliz tili ---
        if (d.eng) {
            const parts = [`Kun ${d.eng.day_number + (d.engDoneToday ? 0 : 1)}`, `streak ${d.eng.streak}`];
            if (d.engDue) parts.push(`${d.engDue} ta so'z takrorga`);
            lines.push('', `📚 **Ingliz tili:** ${parts.join(' · ')}`);
            if (d.engDoneToday) lines.push(`✅ Bugungi dars bajarilgan`);
            else lines.push(`▶️ /eng — bugungi dars`);
            if (d.engMissedYesterday) lines.push(`⚠️ Kecha dars bo'lmagan — streak xavf ostida`);
        }

        // --- Yakuniy jumla ---
        try {
            const gen = await plain().generateContent(
                `Quyidagi ertalabki brifing tuzildi:\n\n${lines.join('\n').replace(/\*\*/g, '')}\n\n` +
                `Oxiriga BITTA jumla qo'sh — bugun uchun eng muhim narsani ta'kidlaydigan yoki ` +
                `e'tibor qaratish kerak bo'lgan nuqtani ko'rsatadigan. ` +
                `Bo'sh ruhlantirish emas, aniq va foydali bo'lsin. Maqtov yoki shior yozma.\n` +
                `Faqat o'sha jumlani qaytar, boshqa hech narsa yozma.`
            );
            const tip = gen.response.text().trim().replace(/^["']|["']$/g, '');
            if (tip && tip.length < 300) lines.push('', `— ${tip}`);
        } catch (e) { console.warn('Yakuniy jumla:', e.message); }

        return lines.join('\n');
    }

    // ==================== /brifing ====================
    bot.command(['brifing', 'kun'], async (ctx) => {
        const arg = ctx.message.text.replace(/^\/(brifing|kun)(@\S+)?\s*/i, '').trim();
        const msg = await ctx.reply('Brifing tayyorlanyapti...');
        try {
            const text = await buildBriefing(ctx.chat.id);
            await sendFormatted(ctx, msg.message_id, text);

            // /brifing ovoz — ovozda ham eshitish
            if (/^ovoz$/i.test(arg) && sendVoiceReply) await sendVoiceReply(ctx, text);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== AVTOMATIK 07:00 ====================
    cron.schedule('0 7 * * *', async () => {
        try {
            const text = await buildBriefing(myTelegramId);
            const chunks = text.match(/[\s\S]{1,3500}/g) || [text];
            for (const c of chunks) {
                await bot.telegram.sendMessage(myTelegramId, c, { parse_mode: 'HTML' })
                    .catch(() => bot.telegram.sendMessage(myTelegramId, c.replace(/\*\*/g, '')).catch(() => {}));
            }

            // Ovozli brifing — uyg'onganda telefonni ushlamasdan tinglash uchun
            if (VOICE_BRIEFING && sendVoiceReply) {
                const fakeCtx = {
                    chat: { id: myTelegramId },
                    replyWithAudio: (...a) => bot.telegram.sendAudio(myTelegramId, ...a),
                    replyWithDocument: (...a) => bot.telegram.sendDocument(myTelegramId, ...a),
                };
                await sendVoiceReply(fakeCtx, text);
            }
        } catch (e) { console.error('Ertalabki brifing xatosi:', e.message); }
    }, { timezone: 'Asia/Tashkent' });

    console.log('🌅 Brifing moduli yuklandi (/brifing, avtomatik 07:00).');
};
