// ==UserScript==
// @name         Fourmizzz — Export Messagerie 
// @namespace    https://github.com/LeTristoune81/Messagerie
// @version      2.0
// @description  Export messagerie : objet, participants officiels, horodatage, départs/rejoins, formats Texte / BBCode Fzzz / Markdown Discord.
// @match        http://*.fourmizzz.fr/*messagerie.php*
// @match        https://*.fourmizzz.fr/*messagerie.php*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/LeTristoune81/Messagerie
// @supportURL   https://github.com/LeTristoune81/Messagerie/issues
// @downloadURL  https://raw.githubusercontent.com/LeTristoune81/Messagerie/main/export-messagerie.user.js
// @updateURL    https://raw.githubusercontent.com/LeTristoune81/Messagerie/main/export-messagerie.user.js
// ==/UserScript==

function ze_HTML_to_BBcode(html, fourmizzz) {
  html = String(html).replace(/\n/g, '');
  if (fourmizzz) {
    html = html.replace(/<img src="images\/smiley\/(.*?)\.gif">/g, '{$1}')
               .replace(/<a href="Membre\.php\?Pseudo=(.*?)".*?>.*?<\/a>/g, '[player]$1[/player]')
               .replace(/<a href="classementAlliance\.php\?alliance=(.*?)".*?>.*?<\/a>/g, '[ally]$1[/ally]');
  } else {
    html = html.replace(/<img src="images\/smiley\/(.*?)\.gif">/g, '[img]http://s1.fourmizzz.fr/images/smiley/$1.gif[/img]')
               .replace(/<a href="Membre\.php\?Pseudo=(.*?)".*?>.*?<\/a>/g, '[b]$1[/b]')
               .replace(/<a href="classementAlliance\.php\?alliance=(.*?)".*?>.*?<\/a>/g, '[b]$1[/b]');
  }
  return html.replace(/<br\s*\/?>/gi, '\n')
             .replace(/<img src="(.*?)">/g, '[img]$1[/img]')
             .replace(/<a href="(.*?)" target="_blank">(.*?)<\/a>/g, '[url=$1]$2[/url]')
             .replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/g, '[b]$1[/b]')
             .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/g, '[i]$1[/i]')
             .replace(/<font color="(.*?)">(.*?)<\/font>/g, '[color=$1]$2[/color]')
             .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '[quote]$1[/quote]')
             .replace(/<div[^>]*align="center"[^>]*>([\s\S]*?)<\/div>/g, '[center]$1[/center]')
             .replace(/</g, '[').replace(/>/g, ']');
}

// HTML -> Markdown (Discord)
// (garde les smileys Fourmizzz comme :pouce:, :smile:, etc.)
function htmlToMarkdown(html) {
  return String(html || '')
    .replace(/<div class="date_envoi">[\s\S]*?<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<img[^>]*src="images\/smiley\/([^"]+)\.gif"[^>]*>/gi, ':$1:')     // smileys Fzzz -> :nom:
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, ' ![]($1) ')                     // autres images -> Markdown
    .replace(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')          // liens
    .replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<u>([\s\S]*?)<\/u>/gi, '__$1__')
    .replace(/<s>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, '> $1')
    .replace(/<div[^>]*align="center"[^>]*>([\s\S]*?)<\/div>/gi, '---\n$1\n---')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

GM_addStyle(`
  .zz-btn { background:#428bca; border:1px solid #357ebd; color:#fff; border-radius:4px; padding:6px 12px;
            font-size:14px; cursor:pointer; transition:background .2s; }
  .zz-btn:hover { background:#3071a9; }
  .zz-export { display:none; margin:16px auto; max-width:1100px; }
  .zz-export.visible { display:block; }
  .zz-actions { margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap; }
  .zz-mini { background:#5cb85c; border:1px solid #4cae4c; color:#fff; border-radius:4px; padding:6px 10px; cursor:pointer; }
  .zz-mini:hover { background:#449d44; }
  .zz-block { margin-bottom:20px; }
  .zz-block textarea { width:100%; height:170px; font-family:monospace; white-space:pre-wrap; }
`);

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getPseudoFromHref = href => {
  try { const u = new URL(href, location.href); return decodeURIComponent(u.searchParams.get('Pseudo')||''); }
  catch { const m=/[?&]Pseudo=([^&]+)/.exec(href||''); return m?decodeURIComponent(m[1]):''; }
};

// Détection auteur & lignes système
const DATE_PREFIX_RE = /^\s*(?:\d{1,2}\/\d{1,2}\/\d{2}\s+à\s+\d{1,2}h\d{2}|(?:lun|mar|mer|jeu|ven|sam|dim|hier|aujourd'hui)\s+\d{1,2}h\d{2}|\d{1,2}h\d{2})\s*/i;
const SYS_ACTION_RE  = /(a\s+(?:quitté|rejoint)\s+la conversation|a\s+(?:été\s+)?(?:ajouté|exclu|retiré)(?:e)?(?:\s+\w+)*\s+(?:de|à)\s+la conversation)\b/i;

function detectAuthor(tr) {
  let a = tr.querySelector('td.expe a[href*="Membre.php?Pseudo="]');
  if (a) return getPseudoFromHref(a.getAttribute('href')) || a.textContent.trim();

  a = tr.querySelector('td.message a[href*="Membre.php?Pseudo="]');
  if (a) return getPseudoFromHref(a.getAttribute('href')) || a.textContent.trim();

  const raw = tr.querySelector('td.message')?.innerText || '';
  if (raw) {
    const cleaned = raw.replace(DATE_PREFIX_RE, '');
    const m = cleaned.match(/^(.+?)\s+${SYS_ACTION_RE.source}/i);
    if (m && m[1]) return m[1].trim();
  }

  const expe = tr.querySelector('td.expe')?.innerText.trim() || '';
  if (expe && !/\d{1,2}h\d{2}/.test(expe)) return expe;
  return '';
}

// Objet (titre) robuste
function getConversationTitle(table) {
  const contentTR = table.closest('tr.contenu_conversation');
  let row = contentTR ? contentTR.previousElementSibling : null;
  const pick = el => el && el.textContent ? el.textContent.trim() : '';
  const SEL = '.intitule_message, .intitule, .titre_message, .titre, .title, .objet, .objet_message, .nom_conversation, .libelle_conversation, a.intitule_message, b, strong';

  if (row) {
    let el = row.querySelector(SEL);
    if (pick(el)) return pick(el);
    const td = row.querySelector('td[colspan]'); if (pick(td)) return pick(td);
  }
  // remonte quelques lignes si besoin
  let r = row;
  for (let i=0; i<6 && r; i++, r=r?.previousElementSibling) {
    let el = r?.querySelector(SEL);
    if (pick(el)) return pick(el);
    const td = r?.querySelector('td[colspan]'); if (pick(td)) return pick(td);
  }
  // tente dans le tableau parent
  const parentTable = contentTR?.closest('table');
  if (parentTable) {
    const el = parentTable.querySelector(SEL);
    if (pick(el)) return pick(el);
  }
  return 'Sans Objet';
}

// Participants (ligne officielle : id="liste_participants_*")
function findParticipantsCell(table) {
  const contentTR = table.closest('tr.contenu_conversation');
  let row = contentTR ? contentTR.previousElementSibling : null;
  for (let i=0; i<6 && row; i++, row=row.previousElementSibling) {
    const cell = row.querySelector('td[id^="liste_participants_"]');
    if (cell) return cell;
  }
  return table.closest('table')?.querySelector('td[id^="liste_participants_"]') || null;
}
async function ensureAllParticipantsShown(cell) {
  const t = cell?.querySelector('a.afficher_tous_participants');
  if (t) { t.click(); await sleep(150); }
}
function readParticipantsFromCell(cell) {
  if (!cell) return [];
  const links = $$('a[href*="Membre.php?Pseudo="]', cell);
  const names = links.map(a => getPseudoFromHref(a.getAttribute('href')) || a.textContent.trim()).filter(Boolean);
  return [...new Set(names)];
}
function readParticipantsFromMessages(table) {
  const rows = $$('tr[id^="message_"]', table).filter(tr => !tr.id.includes('complet'));
  const names = rows.map(tr => {
    const a = tr.querySelector('td.expe a[href*="Pseudo="]');
    return a ? getPseudoFromHref(a.getAttribute('href')) : tr.querySelector('td.expe')?.innerText.trim();
  }).filter(Boolean);
  return [...new Set(names)];
}

// Ouvre “Voir les messages précédents”
async function clickAllVoirPrec(table) {
  let btn;
  while ((btn = $$('a', table).find(a => /voir les messages pr[ée]c[ée]dents/i.test(a.textContent)))) {
    btn.click(); await sleep(200);
  }
}

// UI helpers
function makeCopyBtn(ta, label) {
  const b = document.createElement('button');
  b.className = 'zz-mini'; b.textContent = label;
  b.onclick = () => {
    if (typeof GM_setClipboard === 'function') GM_setClipboard(ta.value, { type:'text', mimetype:'text/plain' });
    else { ta.select(); document.execCommand('copy'); }
  };
  return b;
}

// Injection
function inject(table) {
  if (table.__zzInjected) return; table.__zzInjected = true;

  const rBtn = table.insertRow(-1), cBtn = rBtn.insertCell(0);
  cBtn.colSpan = table.rows[0]?.cells.length || 2;
  cBtn.style.textAlign = 'center';
  const btn = Object.assign(document.createElement('button'), { className:'zz-btn', textContent:'Exporter la conversation' });
  cBtn.appendChild(btn);

  const rExp = table.insertRow(-1), cExp = rExp.insertCell(0);
  cExp.colSpan = cBtn.colSpan;
  cExp.innerHTML = `
    <div class="zz-export">
      <div class="zz-actions"></div>
      <div class="zz-block"><strong>Sans BBCode</strong><textarea class="ta-raw" readonly></textarea></div>
      <div class="zz-block"><strong>Avec BBCode (Fourmizzz)</strong><textarea class="ta-fz" readonly></textarea></div>
      <div class="zz-block"><strong>Markdown (Discord)</strong><textarea class="ta-md" readonly></textarea></div>
    </div>`;
  const exp = $('.zz-export', cExp);
  const taRaw = $('.ta-raw', exp), taFZ = $('.ta-fz', exp), taMD = $('.ta-md', exp);
  const actions = $('.zz-actions', exp);
  actions.append(
    makeCopyBtn(taRaw, 'Copier Texte'),
    makeCopyBtn(taFZ, 'Copier BBCode Fzzz'),
    makeCopyBtn(taMD, 'Copier Markdown')
  );

  btn.onclick = async () => {
    await clickAllVoirPrec(table);

    // Objet + Participants
    const titre = getConversationTitle(table);
    let partsCell = findParticipantsCell(table);
    await ensureAllParticipantsShown(partsCell);
    let participants = readParticipantsFromCell(partsCell);
    if (participants.length === 0) participants = readParticipantsFromMessages(table);

    const partsRaw = participants.join(', ');
    const partsFZ  = participants.map(p => `[player]${p}[/player]`).join(', ');

    // En-têtes
    let raw = `Objet : ${titre}\n\nParticipants : ${partsRaw}\n\n`;
    let fz  = `[center][b]${titre}[/b][/center]\n\nParticipants : ${partsFZ}\n\n`;
    let md  = `# ${titre}\n\nParticipants : ${partsRaw}\n\n`;

    // Messages (ignorer *_complet)
    const rows = $$('tr[id^="message_"]', table).filter(tr => !tr.id.includes('complet'));

    rows.forEach(tr => {
      const date = tr.querySelector('.date_envoi')?.textContent.trim() || '';
      const author = detectAuthor(tr) || 'Système';

      const id = tr.id.replace('message_', '');
      const htmlSrc = ($('#message_complet_'+id)?.innerHTML || $('.message', tr)?.innerHTML || '');
      const html = htmlSrc.replace(/<div class="date_envoi">[\s\S]*?<\/div>/g, '');
      const text = ($('.message', tr)?.innerText || '').trim();

      const sysClean = text.replace(DATE_PREFIX_RE, '');
      const mAction = sysClean.match(SYS_ACTION_RE);

      if (mAction) {
        const action = mAction[1];
        raw += `${author} ${action}.\n\n`;
        fz  += `[player]${author}[/player] ${action}.\n\n[hr]\n`;
        md  += `**${author}** ${action}.\n\n---\n`;
      } else {
        raw += `${author} ${date}\n\n${text}\n\n`;
        fz  += `[player]${author}[/player] ${date}\n\n${ze_HTML_to_BBcode(html, true)}\n\n[hr]\n`;
        md  += `**${author}** *(${date})*\n${htmlToMarkdown(html)}\n\n---\n`;
      }
    });

    taRaw.value = raw.trim();
    taFZ.value  = fz.trim();
    taMD.value  = md.trim();
    exp.classList.add('visible');
  };
}

// Boot
function boot() {
  $$('tr.contenu_conversation td > table').forEach(inject);
  new MutationObserver(() => $$('tr.contenu_conversation td > table').forEach(inject))
    .observe(document.body, { childList:true, subtree:true });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
