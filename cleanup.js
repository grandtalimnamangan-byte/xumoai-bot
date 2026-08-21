// ============================================================
//  JARVIS — HAFTALIK TOZALASH
//  Eskirgan vazifa, loyiha va g'oyalarni ko'rib chiqish
//  /tozalash · avtomatik yakshanba 19:00
// ============================================================

const cron = require('node-cron');

module.exports = function registerCleanup(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted, myTelegramId } = deps;

    const plain = () => genAI.getGenerativeModel({ model: MODEL });
    const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
    const today = () => fmt(new Date());
    const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
    const daysSince = (s) => (s ? Math.round((new Date(today()) - new Date(s)) / 86400000) : null);

    // ==================== MA'LUMOT YIG'ISH ====================
    async function collect(chatId) {
        const out = { tasks: [], projects: [], ideas: [], done: [], oldDone: 0 };

        // 14 kundan ortiq turgan ochiq vazifalar
        const { data: tasks } = await supabase.from('tasks')
            .select('*').eq('chat_id', chatId).eq('done', false)
            .lte('created_at', addDays(-14) + 'T23:59:59')
            .order('created_at').limit(15);
        out.tasks = tasks || [];

        // 30 kun tegilmagan faol loyihalar
        const { data: projects } = await supabase.from('projects')
            .select('*').eq('chat_id', chatId).in('status', ['faol', 'kutmoqda'])
            .lte('last_touched', addDays(-30)).order('last_touched').limit(10);
        out.projects = projects || [];

        // Loyihaga biriktirilmagan g'oyalar
        const { data: ideas } = await supabase.from('project_notes')
            .select('*').eq('chat_id', chatId).eq('kind', 'gaoya')
            .is('project_id', null).order('created_at').limit(10);
        out.ideas = ideas || [];

        // Shu hafta bajarilganlar
        const { data: done } = await supabase.from('tasks')
            .select('title, done_at').eq('chat_id', chatId).eq('done', true)
            .gte('done_at', addDays(-7) + 'T00:00:00').order('done_at', { ascending: false }).limit(20);
        out.done = done || [];

        // 60 kundan eski bajarilganlar — arxivga tayyor
        const { count } = await supabase.from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chatId).eq('done', true)
            .lte('done_at', addDays(-60) + 'T00:00:00');
        out.oldDone = count || 0;

        return out;
    }

    // ==================== HISOBOT TUZISH ====================
    async function buildReport(chatId) {
        const d = await collect(chatId);
        const lines = ['🧹 **Haftalik tozalash**'];

        const nothing = !d.tasks.length && !d.projects.length && !d.ideas.length && !d.oldDone;
        if (nothing) {
            lines.push('', `✅ Baza toza — eskirgan yozuv yo'q.`);
            if (d.done.length) lines.push('', `Bu hafta ${d.done.length} ta vazifa bajarildi.`);
            return { text: lines.join('\n'), empty: true, data: d };
        }

        // Hafta yakuni
        if (d.done.length) {
            lines.push('', `✅ **Bu hafta bajarildi: ${d.done.length} ta**`);
            d.done.slice(0, 5).forEach((t) => lines.push(`- ${t.title}`));
            if (d.done.length > 5) lines.push(`_va yana ${d.done.length - 5} ta_`);
        }

        // Eskirgan vazifalar
        if (d.tasks.length) {
            lines.push('', `⏳ **${d.tasks.length} ta vazifa 2 haftadan ortiq turibdi:**`);
            d.tasks.forEach((t, i) => {
                const age = daysSince(t.created_at.slice(0, 10));
                lines.push(`${i + 1}. ${t.title} — _${age} kun_`);
            });
            lines.push(`\nKeraksizini o'chiring: /ochir <raqam>`);
        }

        // Uzoq turgan loyihalar
        if (d.projects.length) {
            lines.push('', `📁 **${d.projects.length} ta loyiha uzoq tegilmagan:**`);
            d.projects.forEach((p) => {
                lines.push(`- **${p.slug}** — ${daysSince(p.last_touched)} kun` +
                    (p.blocker ? ` · to'siq: ${p.blocker}` : ''));
            });
            lines.push(`\nTo'xtatish: /holat <slug> to'xtadi`);
        }

        // Biriktirilmagan g'oyalar
        if (d.ideas.length) {
            lines.push('', `💡 **${d.ideas.length} ta g'oya loyihasiz:**`);
            d.ideas.forEach((i) => lines.push(`- ${i.body.slice(0, 80)}`));
            lines.push(`\nBiriktirish: /gaoya <slug> <matn>`);
        }

        // Arxivga tayyor
        if (d.oldDone) {
            lines.push('', `🗄 ${d.oldDone} ta bajarilgan vazifa 2 oydan eski — arxivlash mumkin: /arxiv`);
        }

        // Bitta xulosa
        try {
            const gen = await plain().generateContent(
                `Humoyunning haftalik holati:\n` +
                `- Bajarilgan vazifalar: ${d.done.length}\n` +
                `- 2 haftadan ortiq turgan vazifalar: ${d.tasks.length}\n` +
                `- Uzoq tegilmagan loyihalar: ${d.projects.length} (${d.projects.map((p) => p.slug).join(', ')})\n` +
                `- Loyihasiz g'oyalar: ${d.ideas.length}\n\n` +
                `Bitta jumla yoz — eng muhim kuzatuv yoki savol. Halol bo'lsin, maqtov emas.\n` +
                `Masalan: "Belissimo 40 kundan beri turibdi — yopasizmi yoki qaytasizmi?"\n` +
                `Faqat o'sha jumlani qaytar.`
            );
            const tip = gen.response.text().trim().replace(/^["']|["']$/g, '');
            if (tip && tip.length < 250) lines.push('', `— ${tip}`);
        } catch { /* xulosa bo'lmasa ham hisobot qoladi */ }

        return { text: lines.join('\n'), empty: false, data: d };
    }

    // ==================== /tozalash ====================
    bot.command(['tozalash', 'tozala'], async (ctx) => {
        if (!supabase) return ctx.reply("⚠️ Supabase ulanmagan.");
        const msg = await ctx.reply('Tekshirilyapti...');
        try {
            const r = await buildReport(ctx.chat.id);
            await sendFormatted(ctx, msg.message_id, r.text);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /arxiv — eski bajarilganlarni tozalash ====================
    bot.command('arxiv', async (ctx) => {
        if (!supabase) return ctx.reply("⚠️ Supabase ulanmagan.");

        try {
            const cutoff = addDays(-60) + 'T00:00:00';
            const { count } = await supabase.from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', ctx.chat.id).eq('done', true).lte('done_at', cutoff);

            if (!count) return ctx.reply("Arxivlanadigan vazifa yo'q (2 oydan eski bajarilganlar).");

            await supabase.from('tasks').delete()
                .eq('chat_id', ctx.chat.id).eq('done', true).lte('done_at', cutoff);

            ctx.reply(`🗄 ${count} ta eski bajarilgan vazifa o'chirildi.\n\nOchiq vazifalarga tegilmadi.`);
        } catch (e) {
            ctx.reply(`Xatolik: ${e.message}`);
        }
    });

    // ==================== AVTOMATIK — yakshanba 19:00 ====================
    cron.schedule('0 19 * * 0', async () => {
        try {
            if (!supabase) return;
            const r = await buildReport(myTelegramId);
            if (r.empty && !r.data.done.length) return;   // aytadigan narsa bo'lmasa jim turadi

            const chunks = r.text.match(/[\s\S]{1,3500}/g) || [r.text];
            for (const c of chunks) {
                await bot.telegram.sendMessage(myTelegramId, c.replace(/\*\*/g, '').replace(/_/g, ''))
                    .catch(() => {});
            }
        } catch (e) { console.error('Haftalik tozalash xatosi:', e.message); }
    }, { timezone: 'Asia/Tashkent' });

    console.log('🧹 Tozalash moduli yuklandi (/tozalash, /arxiv, yakshanba 19:00).');
};
