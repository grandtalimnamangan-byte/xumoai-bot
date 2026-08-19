// ============================================================
//  JARVIS — VAZIFALAR
//  /vazifa · /vazifalar · /bajardim · /ochir
//  Ovozli xabardan ajratilgan vazifalar ham shu yerga tushadi
// ============================================================

const cron = require('node-cron');

module.exports = function registerTasks(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted, myTelegramId } = deps;

    const plain = () => genAI.getGenerativeModel({ model: MODEL });
    const noDb = () => "⚠️ Supabase ulanmagan — vazifalar ishlamaydi.";
    const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    const today = () => fmt(new Date());
    const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };

    function parseJson(text) {
        const clean = text.replace(/```json|```/g, '').trim();
        const start = clean.search(/[[{]/);
        if (start === -1) return null;
        try { return JSON.parse(clean.slice(start)); } catch { return null; }
    }

    // Matndan vazifa ma'lumotlarini ajratish
    async function parseTask(chatId, input) {
        const { data: projects } = await supabase.from('projects')
            .select('id, slug, name').eq('chat_id', chatId);

        const gen = await plain().generateContent(
            `Bugun: ${today()} (${new Intl.DateTimeFormat('uz', { weekday: 'long' }).format(new Date())})\n\n` +
            `Loyihalar: ${(projects || []).map((p) => `${p.id}=${p.slug}`).join(', ') || "yo'q"}\n\n` +
            `Foydalanuvchi vazifa qo'shyapti: "${input}"\n\n` +
            `Ajrat. FAQAT JSON:\n` +
            `{"title":"qisqa aniq vazifa","due_date":"YYYY-MM-DD yoki null","due_time":"HH:MM yoki null","project_id":raqam yoki null,"priority":1-5}\n\n` +
            `"ertaga"=${addDays(1)}, "indinga"=${addDays(2)}. Hafta kuni aytilsa eng yaqin shu kunni hisobla.\n` +
            `Sana aytilmasa null qoldir. priority: 1 shoshilinch, 3 oddiy, 5 keyinroq.`
        );

        return parseJson(gen.response.text());
    }

    async function addTask(chatId, parsed, source = 'matn') {
        const { data, error } = await supabase.from('tasks').insert({
            chat_id: chatId,
            title: parsed.title,
            due_date: parsed.due_date || null,
            due_time: parsed.due_time || null,
            project_id: parsed.project_id || null,
            priority: parsed.priority || 3,
            source,
        }).select().single();
        if (error) throw new Error(error.message);
        return data;
    }

    function taskLine(t, i) {
        const overdue = t.due_date && t.due_date < today();
        const when = t.due_date
            ? (t.due_date === today() ? 'bugun' : t.due_date === addDays(1) ? 'ertaga' : t.due_date)
            : '';
        const time = t.due_time ? ` ${t.due_time}` : '';
        const mark = overdue ? '🔴' : t.priority <= 2 ? '🔥' : '▫️';
        return `${mark} ${i}. ${t.title}${when ? ` — _${when}${time}_` : ''}`;
    }

    // ==================== /vazifa ====================
    bot.command('vazifa', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const input = ctx.message.text.replace(/^\/vazifa(@\S+)?\s*/i, '').trim();

        if (!input) {
            return ctx.reply(
                "📌 Foydalanish: /vazifa <matn>\n\n" +
                "Misollar:\n" +
                "- /vazifa ertaga 15:00 shifokorga qo'ng'iroq\n" +
                "- /vazifa juma kuni Belissimo mijoziga smeta yuborish\n" +
                "- /vazifa noutbuk narxlarini ko'rish\n\n" +
                "Ro'yxat: /vazifalar"
            );
        }

        const msg = await ctx.reply('Saqlanyapti...');
        try {
            const parsed = await parseTask(ctx.chat.id, input);
            if (!parsed?.title) throw new Error('Vazifa aniqlanmadi');

            const t = await addTask(ctx.chat.id, parsed);
            const when = t.due_date ? `${t.due_date}${t.due_time ? ` ${t.due_time}` : ''}` : 'sanasiz';

            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `📌 ${t.title}\n🗓 ${when}\n\nRo'yxat: /vazifalar`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /vazifalar ====================
    bot.command('vazifalar', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('Olinyapti...');

        try {
            const { data: tasks } = await supabase.from('tasks')
                .select('*, projects(name)').eq('chat_id', ctx.chat.id).eq('done', false)
                .order('due_date', { nullsFirst: false }).order('priority');

            if (!tasks?.length) {
                return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    "✅ Ochiq vazifa yo'q.\n\nQo'shish: /vazifa <matn>");
            }

            const overdue = tasks.filter((t) => t.due_date && t.due_date < today());
            const now = tasks.filter((t) => t.due_date === today());
            const soon = tasks.filter((t) => t.due_date && t.due_date > today());
            const nodate = tasks.filter((t) => !t.due_date);

            const lines = [];
            let n = 0;
            const block = (title, arr) => {
                if (!arr.length) return;
                lines.push('', `**${title}**`);
                arr.forEach((t) => lines.push(taskLine(t, ++n)));
            };

            block(`🔴 Kechikkan (${overdue.length})`, overdue);
            block(`📍 Bugun (${now.length})`, now);
            block(`📅 Oldinda (${soon.length})`, soon);
            block(`📋 Sanasiz (${nodate.length})`, nodate);

            // Tartib raqami bo'yicha bajarish uchun ro'yxatni eslab qolamiz
            order.set(ctx.chat.id, [...overdue, ...now, ...soon, ...nodate].map((t) => t.id));

            lines.push('', `Bajarildi: /bajardim <raqam>\nO'chirish: /ochir <raqam>`);
            await sendFormatted(ctx, msg.message_id, `📌 **Vazifalar — ${tasks.length} ta**\n${lines.join('\n')}`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    const order = new Map();

    async function byNumber(ctx, arg) {
        const ids = order.get(ctx.chat.id);
        const n = parseInt(arg, 10);

        if (ids && n >= 1 && n <= ids.length) {
            const { data } = await supabase.from('tasks').select('*').eq('id', ids[n - 1]).maybeSingle();
            return data;
        }

        // Raqam emas — matn bo'yicha qidiramiz
        const { data } = await supabase.from('tasks').select('*')
            .eq('chat_id', ctx.chat.id).eq('done', false)
            .ilike('title', `%${arg}%`).limit(1).maybeSingle();
        return data;
    }

    // ==================== /bajardim ====================
    bot.command('bajardim', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/bajardim(@\S+)?\s*/i, '').trim();
        if (!arg) return ctx.reply('Format: /bajardim 2\nyoki: /bajardim smeta');

        const t = await byNumber(ctx, arg);
        if (!t) return ctx.reply('Topilmadi. /vazifalar orqali raqamni ko\'ring.');

        await supabase.from('tasks')
            .update({ done: true, done_at: new Date().toISOString() }).eq('id', t.id);

        const { count } = await supabase.from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', ctx.chat.id).eq('done', false);

        ctx.reply(`✅ ${t.title}\n\nQoldi: ${count} ta ochiq vazifa.`);
    });

    // ==================== /ochir ====================
    bot.command('ochir', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/ochir(@\S+)?\s*/i, '').trim();
        if (!arg) return ctx.reply('Format: /ochir 2');

        const t = await byNumber(ctx, arg);
        if (!t) return ctx.reply('Topilmadi.');

        await supabase.from('tasks').delete().eq('id', t.id);
        ctx.reply(`🗑 O'chirildi: ${t.title}`);
    });

    // ==================== ESLATMALAR ====================
    const tz = { timezone: 'Asia/Tashkent' };

    // Kechikkan va bugungi vazifalar — 09:00
    cron.schedule('0 9 * * *', async () => {
        try {
            if (!supabase) return;
            const { data: tasks } = await supabase.from('tasks')
                .select('*').eq('chat_id', myTelegramId).eq('done', false)
                .lte('due_date', today()).order('due_date');

            if (!tasks?.length) return;

            const overdue = tasks.filter((t) => t.due_date < today());
            const now = tasks.filter((t) => t.due_date === today());

            let text = '📌 Vazifalar\n';
            if (overdue.length) text += `\n🔴 Kechikkan (${overdue.length}):\n` + overdue.map((t) => `- ${t.title}`).join('\n');
            if (now.length) text += `\n\n📍 Bugun (${now.length}):\n` + now.map((t) => `- ${t.title}${t.due_time ? ` (${t.due_time})` : ''}`).join('\n');
            text += '\n\n/vazifalar';

            await bot.telegram.sendMessage(myTelegramId, text).catch(() => {});
        } catch (e) { console.error('Vazifa eslatmasi:', e.message); }
    }, tz);

    console.log('📌 Vazifalar moduli yuklandi (/vazifa, /vazifalar, /bajardim, /ochir).');

    // Ovozli ajratish uchun tashqariga beramiz
    return { parseTask, addTask };
};
