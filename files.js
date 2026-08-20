// ============================================================
//  JARVIS — FAYL VA HAVOLA O'QISH
//  Word, Excel, PowerPoint, CSV va veb-sahifalar
// ============================================================

const MAX_CHARS = 60000;

// ==================== HAVOLA O'QISH ====================
function stripHtml(html) {
    return html
        // Keraksiz bloklarni butunlay olib tashlaymiz
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        // Blok teglarini qator ajratgichga aylantiramiz
        .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        // Qolgan teglarni olib tashlaymiz
        .replace(/<[^>]+>/g, ' ')
        // HTML belgilarini tiklaymiz
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&[a-z]+;/gi, ' ')
        // Bo'shliqlarni tartibga solamiz
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getTitle(html) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return t ? t[1].trim() : '';
}

async function fetchLink(url, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            signal: ctrl.signal,
            redirect: 'follow',
            headers: {
                // Ba'zi saytlar brauzersiz so'rovni rad etadi
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
                'Accept-Language': 'uz,en;q=0.9,ru;q=0.8',
            },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const type = (res.headers.get('content-type') || '').toLowerCase();
        const raw = await res.text();

        if (type.includes('json')) {
            return { title: url, text: raw.slice(0, MAX_CHARS), kind: 'json' };
        }
        if (type.includes('html')) {
            const text = stripHtml(raw);
            if (text.length < 120) throw new Error("sahifada matn topilmadi (JavaScript bilan yuklanadigan sayt bo'lishi mumkin)");
            return { title: getTitle(raw) || url, text: text.slice(0, MAX_CHARS), kind: 'html' };
        }
        return { title: url, text: raw.slice(0, MAX_CHARS), kind: 'text' };
    } finally {
        clearTimeout(timer);
    }
}

// Matndan havolalarni ajratib olish
function findLinks(text) {
    const m = text.match(/https?:\/\/[^\s<>"')]+/gi) || [];
    return [...new Set(m)].slice(0, 3);
}

// ==================== FAYL O'QISH ====================
const OFFICE = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/msword': 'doc',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.ms-powerpoint': 'ppt',
};

function kindOf(mime, filename = '') {
    if (OFFICE[mime]) return OFFICE[mime];
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'csv', 'txt', 'md', 'json'].includes(ext)) return ext;
    if (mime.includes('csv')) return 'csv';
    if (mime.startsWith('text/')) return 'txt';
    return null;
}

async function extractDocument(buffer, mime, filename = '') {
    const kind = kindOf(mime, filename);

    if (kind === 'docx') {
        const mammoth = require('mammoth');
        const r = await mammoth.extractRawText({ buffer });
        const text = (r.value || '').trim();
        if (!text) throw new Error('Hujjatda matn topilmadi');
        return { kind: 'Word hujjati', text: text.slice(0, MAX_CHARS) };
    }

    if (kind === 'xlsx' || kind === 'xls' || kind === 'csv') {
        const XLSX = require('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        let out = '';

        for (const name of wb.SheetNames) {
            const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
            if (!csv.trim()) continue;
            out += `\n=== Varaq: ${name} ===\n${csv}\n`;
            if (out.length > MAX_CHARS) break;
        }

        if (!out.trim()) throw new Error("Jadvalda ma'lumot topilmadi");
        return { kind: `Excel (${wb.SheetNames.length} varaq)`, text: out.slice(0, MAX_CHARS) };
    }

    if (kind === 'pptx') {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buffer);

        const slides = Object.keys(zip.files)
            .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
            .sort((a, b) => {
                const na = parseInt(a.match(/slide(\d+)/)[1], 10);
                const nb = parseInt(b.match(/slide(\d+)/)[1], 10);
                return na - nb;
            });

        let out = '';
        for (let i = 0; i < slides.length; i++) {
            const xml = await zip.file(slides[i]).async('string');
            const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1].trim()).filter(Boolean);
            if (texts.length) out += `\n=== Slayd ${i + 1} ===\n${texts.join('\n')}\n`;
            if (out.length > MAX_CHARS) break;
        }

        if (!out.trim()) throw new Error('Taqdimotda matn topilmadi');
        return { kind: `PowerPoint (${slides.length} slayd)`, text: out.slice(0, MAX_CHARS) };
    }

    if (kind === 'txt' || kind === 'md' || kind === 'json') {
        return { kind: 'Matn fayli', text: buffer.toString('utf8').slice(0, MAX_CHARS) };
    }

    if (kind === 'doc' || kind === 'xls' || kind === 'ppt') {
        throw new Error("Eski format (97-2003). Faylni .docx / .xlsx / .pptx sifatida saqlab qayta yuboring.");
    }

    return null;   // bu tur qo'llab-quvvatlanmaydi — Gemini o'zi ko'radi
}

module.exports = { fetchLink, findLinks, extractDocument, kindOf, stripHtml };
