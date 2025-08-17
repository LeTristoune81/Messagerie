// ==UserScript==
// @name         Fourmizzz — Export messagerie (UI Zzzelp + Titre local + Participants officiels, optimisé)
// @namespace    https://github.com/LeTristoune81/Messagerie
// @version      7.1
// @description  Export messagerie style Zzzelp autonome : titre par conversation, participants officiels (#liste_participants), virgules, saut de ligne, horodatage colonne droite, code léger.
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
  return html.replace(/<br>/g, '\n')
             .replace(/<img src="(.*?)">/g, '[img]$1[/img]')
             .replace(/<a href="(.*?)" target="_blank">(.*?)<\/a>/g, '[url=$1]$2[/url]')
             .replace(/<strong>([\s\S]*?)<\/strong>/g, '[b]$1[/b]')
             .replace(/<em>([\s\S]*?)<\/em>/g, '[i]$1[/i]')
             .replace(/<font color="(.*?)">(.*?)<\/font>/g, '[color=$1]$2[/color]')
             .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '[quote]$1[/quote]')
             .replace(/<div[^>]*align="center"[^>]*>([\s\S]*?)<\/div>/g, '[center]$1[/center]')
             .replace(/</g, '[').replace(/>/g, ']');
}

GM_addStyle(`
  .zz-btn { background:#428bca; border:1px solid #357ebd; color:#fff; border-radius:4px; padding:6px 12px;
            font-size:14px; cursor:pointer; transition:background .2s; }
  .zz-btn:hover { background:#3071a9; }
  .zz-export { display:none; margin:16px auto; max-width:1100px; }
  .zz-export.visible { display:block; }
  .zz-actions { margin-bottom:16px; display:flex; gap:8px; }
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

// ----- Titre par conversation -----
function getConversationTitle(table) {
  const contentTR = table.closest('tr.contenu_conversation');
  let row = contentTR ? contentTR.previousElementSibling : null;
  const pick = el => el && el.textContent ? el.textContent.trim() : '';
  const SEL = '.intitule_message, .intitule, .titre_message, .titre, .title, .objet, .objet_message, .nom_conversation, .libelle_conversation';
  if (row) {
    let el = row.querySelector(SEL) || row.querySelector('a.intitule_message');
    if (pick(el)) return pick(el);
    const td = row.querySelector('td[colspan]'); if (pick(td)) return pick(td);
  }
  let r = row;
  for (let i=0; i<6 && r; i++, r=r?.previousElementSibling) {
    let el = r?.querySelector(SEL) || r?.querySelector('a.intitule_message') || r?.querySelector('b, strong');
    if (pick(el)) return pick(el);
    const td = r?.querySelector('td[colspan]'); if (pick(td)) return pick(td);
  }
  const parentTable = contentTR?.closest('table');
  if (parentTable) {
    const el = parentTable.querySelector(SEL) || parentTable.querySelector('a.intitule_message');
    if (pick(el)) return pick(el);
  }
  return 'Sans Objet';
}

// ----- Participants -----
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
  if (!cell) return;
  const toggle = cell.querySelector('a.afficher_tous_participants');
  if (toggle) { toggle.click(); await sleep(150); }
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

// ----- Auteur robuste -----
function detectAuthor(tr) {
  let a = tr.querySelector('td.expe a[href*="Membre.php?Pseudo="]');
  if (a) return getPseudoFromHref(a.getAttribute('href')) || a.textContent.trim();
  a = tr.querySelector('td.message a[href*="Membre.php?Pseudo="]');
  if (a) return getPseudoFromHref(a.getAttribute('href')) || a.textContent.trim();
  const msg = tr.querySelector('td.message')?.innerText.trim() || '';
  const m = msg.match(/^(.+?)\s+(?:a\s+(?:quitté|rejoint)\s+la conversation|a\s+(?:été\s+)?(?:ajouté|exclu|retiré)(?:e)?(?:\s+\w+)*\s+(?:de|à)\s+la conversation)\b/i);
  if (m && m[1]) return m[1].trim();
  const expe = tr.querySelector('td.expe')?.innerText.trim() || '';
  if (expe && !/^\d{1,2}\/\d{1,2}\/\d{2}/.test(expe) && !/(?:\bhier\b|\baujourd)/i.test
