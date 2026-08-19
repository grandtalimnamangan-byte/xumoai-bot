// ============================================================
//  JARVIS — LOYIHALAR MIYASI va G'OYALAR QUTISI
//  /loyiha · /gaoya · /holat · /bugun
// ============================================================

const STATUS_LABEL = {
    faol: '🟢 Faol',
    kutmoqda: '🟡 Kutmoqda',
    toxtagan: '🔴 To\'xtagan',
    tugagan: '✅ Tugagan',
};

const CATEGORY_LABEL = {
    ish: '🏢 Ish',
    dasturlash: '💻 Dasturlash',
    kontent: '🎬 Kontent',
    brend: '🏷 Brend',
    shaxsiy: '👤 Shaxsiy',
    boshqa: '📁 Boshqa',
};

module.exports = function registerProjects(bot, deps) {
    const { genAI, MODEL, supabase, sendFormatted } = deps;

    const plain = () => genAI.getGenerativeModel({ model: MODEL });
    const noDb = () => "⚠️ Supabase ulanmagan — loyihalar bazasi ishlamaydi.";
    const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());

    function parseJson(text) {
        const clean = text.replace(/```json|```/g, '').trim();
        const start = clean.search(/[[{]/);
        if (start === -1) return null;
        try { return JSON.parse(clean.slice(start)); } catch { return null; }
    }

    function daysSince(dateStr) {
        if (!dateStr) return null;
        return Math.round((new Date(today()) - new Date(dateStr)) / 86400000);
    }

    async function allProjects(chatId) {
        const { data } = await supabase.from('projects').select('*')
            .eq('chat_id', chatId).order('priority').order('name');
        return data || [];
    }

    async function findProject(chatId, query) {
        const q = query.trim().toLowerCase();

        // Aniq slug yoki nom
        const { data: exact } = await supabase.from('projects').select('*')
            .eq('chat_id', chatId).or(`slug.eq.${q},name.ilike.${q}`).maybeSingle();
        if (exact) return exact;

        // Qisman moslik
        const { data: like } = await supabase.from('projects').select('*')
            .eq('chat_id', chatId).or(`slug.ilike.%${q}%,name.ilike.%${q}%`).limit(2);
        if (like?.length === 1) return like[0];
        if (like?.length > 1) return { ambiguous: like };

        return null;
    }

    // Modeldan loyihani aniqlashni so'raymiz
    async function guessProject(chatId, text) {
        const list = await allProjects(chatId);
        if (!list.length) return null;

        const gen = await plain().generateContent(
            `Loyihalar ro'yxati:\n` +
            list.map((p) => `${p.slug} — ${p.name}: ${p.description || ''}`).join('\n') +
            `\n\nQuyidagi yozuv qaysi loyihaga tegishli?\n"${text}"\n\n` +
            `FAQAT JSON: {"slug":"...","confidence":0.0-1.0}\n` +
            `Hech qaysiga tegishli bo'lmasa: {"slug":null,"confidence":0}`
        );

        const r = parseJson(gen.response.text());
        if (!r?.slug || r.confidence < 0.5) return null;
        return list.find((p) => p.slug === r.slug) || null;
    }

    // ==================== /loyiha ====================
    bot.command('loyiha', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const arg = ctx.message.text.replace(/^\/loyiha(@\S+)?\s*/i, '').trim();

        // --- yangi loyiha ---
        if (/^yangi\s+/i.test(arg)) {
            const name = arg.replace(/^yangi\s+/i, '').trim();
            if (!name) return ctx.reply('Format: /loyiha yangi Belissimo yangi turkum');

            const msg = await ctx.reply('Loyiha kartasi tuzilyapti...');
            try {
                const gen = await plain().generateContent(
                    `Yangi loyiha ochilyapti: "${name}"\n\n` +
                    `Nomdan kelib chiqib taxminiy karta tuz. FAQAT JSON:\n` +
                    `{"slug":"lotin-harflar-chiziqcha","name":"...","category":"ish|dasturlash|kontent|brend|shaxsiy","description":"1 jumla","next_step":"birinchi qadam","priority":1-5}`
                );
                const p = parseJson(gen.response.text());
                if (!p?.slug) throw new Error('Karta tuzilmadi');

                const { error } = await supabase.from('projects').insert({
                    chat_id: ctx.chat.id, slug: p.slug, name: p.name || name,
                    category: p.category || 'boshqa', status: 'faol',
                    description: p.description, next_step: p.next_step,
                    priority: p.priority || 3, last_touched: today(),
                });
                if (error) throw new Error(error.message);

                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    `✅ Loyiha ochildi: ${p.name || name}\n\n` +
                    `Slug: ${p.slug}\n${p.description || ''}\n\n` +
                    `Keyingi qadam: ${p.next_step || '—'}\n\n` +
                    `Ko'rish: /loyiha ${p.slug}`);
            } catch (e) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
            }
            return;
        }

        // --- loyihani o'chirish ---
        if (/^ochir\s+/i.test(arg) || /^o'chir\s+/i.test(arg)) {
            const slug = arg.replace(/^o'?chir\s+/i, '').trim();
            const found = await findProject(ctx.chat.id, slug);

            if (!found || found.ambiguous) {
                return ctx.reply(`"${slug}" topilmadi yoki bir nechta moslik bor. Aniq slug yozing.`);
            }

            await supabase.from('projects').delete().eq('id', found.id);
            return ctx.reply(`🗑 "${found.name}" o'chirildi.\n\nUnga biriktirilgan g'oyalar ham o'chdi.`);
        }

        // --- bitta loyiha kartasi ---
        if (arg) {
            const found = await findProject(ctx.chat.id, arg);

            if (!found) {
                return ctx.reply(`"${arg}" topilmadi.\n\nBarcha loyihalar: /loyiha\nYangi ochish: /loyiha yangi ${arg}`);
            }
            if (found.ambiguous) {
                return ctx.reply(
                    `Bir nechta moslik topildi:\n\n` +
                    found.ambiguous.map((p) => `- ${p.slug} — ${p.name}`).join('\n') +
                    `\n\nAniqroq yozing.`
                );
            }

            const { data: notes } = await supabase.from('project_notes')
                .select('*').eq('project_id', found.id)
                .order('created_at', { ascending: false }).limit(8);

            const ideas = (notes || []).filter((n) => n.kind === 'gaoya');
            const records = (notes || []).filter((n) => n.kind !== 'gaoya');
            const idle = daysSince(found.last_touched);

            const lines = [
                `${STATUS_LABEL[found.status] || found.status} · ${CATEGORY_LABEL[found.category] || found.category}`,
                `**${found.name}**`,
                '',
                found.description || '',
                '',
                `▶️ **Keyingi qadam:** ${found.next_step || '— aniqlanmagan'}`,
            ];

            if (found.blocker) lines.push(`⛔ **To'siq:** ${found.blocker}`);
            lines.push(`🕐 Oxirgi harakat: ${idle === 0 ? 'bugun' : idle === null ? '—' : `${idle} kun oldin`}`);

            if (ideas.length) {
                lines.push('', `💡 **G'oyalar (${ideas.length}):**`);
                ideas.slice(0, 5).forEach((n) => lines.push(`- ${n.body}`));
            }

            if (records.length) {
                lines.push('', `📝 **Oxirgi yozuvlar:**`);
                records.slice(0, 5).forEach((n) =>
                    lines.push(`- ${n.created_at.slice(5, 10)} — ${n.body}`));
            }

            lines.push('', `G'oya qo'shish: /gaoya ${found.slug} <matn>`);
            return sendFormatted(ctx, (await ctx.reply('...')).message_id, lines.join('\n'));
        }

        // --- umumiy ro'yxat ---
        const msg = await ctx.reply('Loyihalar olinyapti...');
        try {
            const list = await allProjects(ctx.chat.id);
            if (!list.length) {
                return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    "Loyihalar bazasi bo'sh.\n\nBirinchi loyiha: /loyiha yangi <nom>");
            }

            const { data: ideaCounts } = await supabase.from('project_notes')
                .select('project_id').eq('chat_id', ctx.chat.id).eq('kind', 'gaoya');
            const ideaMap = {};
            (ideaCounts || []).forEach((n) => { ideaMap[n.project_id] = (ideaMap[n.project_id] || 0) + 1; });

            const groups = { faol: [], kutmoqda: [], toxtagan: [], tugagan: [] };
            list.forEach((p) => (groups[p.status] || groups.kutmoqda).push(p));

            const lines = [`📁 **Loyihalar — ${list.length} ta**`];

            for (const [status, items] of Object.entries(groups)) {
                if (!items.length) continue;
                lines.push('', `${STATUS_LABEL[status]} (${items.length})`);
                items.forEach((p) => {
                    const idle = daysSince(p.last_touched);
                    const stale = idle > 14 ? ` · ${idle}k` : '';
                    const ideas = ideaMap[p.id] ? ` · 💡${ideaMap[p.id]}` : '';
                    lines.push(`- **${p.slug}** — ${p.name}${stale}${ideas}`);
                });
            }

            lines.push('', `Karta: /loyiha <slug>\nYangi: /loyiha yangi <nom>\nO'chirish: /loyiha ochir <slug>\nG'oya: /gaoya <matn>\nHolat: /holat <matn>`);
            await sendFormatted(ctx, msg.message_id, lines.join('\n'));
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /gaoya ====================
    bot.command(['gaoya', 'goya', 'idea'], async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        let input = ctx.message.text.replace(/^\/(gaoya|goya|idea)(@\S+)?\s*/i, '').trim();

        if (!input) {
            return ctx.reply(
                "💡 Foydalanish: /gaoya <matn>\n\n" +
                "Loyihani o'zim aniqlayman. Aniq belgilash uchun boshiga slug yozing:\n" +
                "/gaoya belissimo pizza kesilayotgan sekin kadr"
            );
        }

        const msg = await ctx.reply('Saqlanyapti...');
        try {
            // Birinchi so'z slug bo'lishi mumkin
            const first = input.split(/\s+/)[0].toLowerCase();
            let project = await findProject(ctx.chat.id, first);
            if (project && !project.ambiguous) {
                input = input.slice(first.length).trim() || input;
            } else {
                project = await guessProject(ctx.chat.id, input);
            }

            if (!project || project.ambiguous) {
                // Loyihasiz g'oya — bo'sh qutiga tushadi
                await supabase.from('project_notes').insert({
                    chat_id: ctx.chat.id, project_id: null, kind: 'gaoya', body: input,
                });
                return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    `💡 Saqlandi (loyihasiz).\n\nQaysi loyihaga tegishli ekanini aytsangiz biriktiraman:\n/gaoya <slug> ${input.slice(0, 40)}...`);
            }

            await supabase.from('project_notes').insert({
                chat_id: ctx.chat.id, project_id: project.id, kind: 'gaoya', body: input,
            });

            const { count } = await supabase.from('project_notes')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', project.id).eq('kind', 'gaoya');

            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `💡 ${project.name} → saqlandi.\n\nBu loyihada jami ${count} ta g'oya.\nKo'rish: /loyiha ${project.slug}`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /holat ====================
    bot.command('holat', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const input = ctx.message.text.replace(/^\/holat(@\S+)?\s*/i, '').trim();

        if (!input) {
            return ctx.reply(
                "🔄 Foydalanish: /holat <nima bo'ldi>\n\n" +
                "Misollar:\n" +
                "- /holat maktab CRM da davomat moduli tugadi, endi baholash qoldi\n" +
                "- /holat belissimo to'xtadi, mijoz javob bermayapti\n" +
                "- /holat jarvis loyihalar bazasi ishga tushdi"
            );
        }

        const msg = await ctx.reply('Yangilanyapti...');
        try {
            const project = await guessProject(ctx.chat.id, input);
            if (!project) {
                return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                    "Qaysi loyiha ekanini aniqlay olmadim.\n\nSlug bilan yozing: /loyiha <slug>");
            }

            const gen = await plain().generateContent(
                `Loyiha: ${project.name}\n` +
                `Hozirgi holat: ${project.status}\n` +
                `Hozirgi keyingi qadam: ${project.next_step || '—'}\n` +
                `Hozirgi to'siq: ${project.blocker || '—'}\n\n` +
                `Yangi ma'lumot: "${input}"\n\n` +
                `Shu ma'lumotga qarab kartani yangila. FAQAT JSON:\n` +
                `{"status":"faol|kutmoqda|toxtagan|tugagan","next_step":"...","blocker":"... yoki null","note":"jurnalga yoziladigan qisqa yozuv"}\n` +
                `O'zgarmagan maydonni eski qiymatida qoldir.`
            );

            const u = parseJson(gen.response.text());
            if (!u) throw new Error('Yangilanish tuzilmadi');

            await supabase.from('projects').update({
                status: u.status || project.status,
                next_step: u.next_step || project.next_step,
                blocker: u.blocker || null,
                last_touched: today(),
            }).eq('id', project.id);

            await supabase.from('project_notes').insert({
                chat_id: ctx.chat.id, project_id: project.id,
                kind: 'holat', body: u.note || input,
            });

            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined,
                `🔄 ${project.name} yangilandi\n\n` +
                `Holat: ${STATUS_LABEL[u.status] || u.status}\n` +
                `Keyingi qadam: ${u.next_step || '—'}\n` +
                (u.blocker ? `To'siq: ${u.blocker}\n` : '') +
                `\nKarta: /loyiha ${project.slug}`);
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    // ==================== /bugun ====================
    bot.command('bugun', async (ctx) => {
        if (!supabase) return ctx.reply(noDb());
        const msg = await ctx.reply('Tahlil qilinyapti...');

        try {
            const list = await allProjects(ctx.chat.id);
            const active = list.filter((p) => ['faol', 'kutmoqda'].includes(p.status));

            if (!active.length) {
                return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 'Faol loyiha yo\'q.');
            }

            const rows = active.map((p) => {
                const idle = daysSince(p.last_touched);
                return `${p.slug} | ${p.name} | ustuvorlik ${p.priority} | ${idle ?? '?'} kun tegilmagan | keyingi: ${p.next_step || '—'}${p.blocker ? ` | to'siq: ${p.blocker}` : ''}`;
            }).join('\n');

            const gen = await plain().generateContent(
                `Humoyunning faol loyihalari:\n${rows}\n\n` +
                `Bugun uchun 3 ta ustuvor ishni tanla. Tanlashda hisobga ol:\n` +
                `- ustuvorlik raqami (1 eng yuqori)\n` +
                `- qancha vaqt tegilmagani (uzoq turgan loyiha o'lib ketadi)\n` +
                `- to'siqli loyihani birinchi qo'yma, agar to'siq boshqa odamga bog'liq bo'lsa\n\n` +
                `Javob:\n🎯 **Bugungi 3 ish**\nHar biri: loyiha nomi + aniq bitta harakat (1 jumla).\n` +
                `Keyin: ⚠️ **Diqqat** — eng uzoq tegilmagan loyihani bir jumlada eslatib qo'y.\n\n` +
                `Qisqa yoz. Faqat **qalin**, *kursiv* va "-" ro'yxat ishlat.`
            );

            await sendFormatted(ctx, msg.message_id, gen.response.text());
        } catch (e) {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Xatolik: ${e.message}`);
        }
    });

    console.log('📁 Loyihalar moduli yuklandi (/loyiha, /gaoya, /holat, /bugun).');
};
