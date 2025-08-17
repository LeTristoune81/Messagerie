// ==UserScript==
// @name         Fourmizzz — Export messagerie (UI Zzzelp + Titre local + Participants officiels, optimisé)
// @namespace    https://github.com/LeTristoune81/Messagerie
// @version      7.12
// @description  Export messagerie style Zzzelp autonome : titre par conversation, participants officiels (#liste_participants), virgules, saut de ligne, code léger.
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

// Conversion HTML→BBCode (issu de Zzzelp)
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

// Style Zzzelp
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

// Utils
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getPseudoFromHref = href => {
  try { const u = new URL(href, location.href); return decodeURIComponent(u.searchParams.get('Pseudo')||''); }
  catch { const m=/[?&]Pseudo=([^&]+)/.exec(href||''); return m?decodeURIComponent(m[1]):''; }
};

// ---- Titre par conversation (local) ----
function getConversationTitle(table) {
  const contentTR = table.closest('tr.contenu_conversation');
  let row = contentTR ? contentTR.previousElementSibling : null;
  const pick = el => el && el.textContent ? el.textContent.trim() : '';
  const SEL = '.intitule_message, .intitule, .titre_message, .titre, .title, .objet, .objet_message, .nom_conversation, .libelle_conversation';

  if (row) {
    let el = row.querySelector(SEL) || row.querySelector('a.intitule_message');
    if (pick(el)) return pick(el);
    const td = row.querySelector('td[colspan]');
    if (pick(td)) return pick(td);
  }
  let r = row;
  for (let i=0; i<6 && r; i++, r=r?.previousElementSibling) {
    let el = r?.querySelector(SEL) || r?.querySelector('a.intitule_message') || r?.querySelector('b, strong');
    if (pick(el)) return pick(el);
    const td = r?.querySelector('td[colspan]');
    if (pick(td)) return pick(td);
  }
  const parentTable = contentTR?.closest('table');
  if (parentTable) {
    const el = parentTable.querySelector(SEL) || parentTable.querySelector('a.intitule_message');
    if (pick(el)) return pick(el);
  }
  return 'Sans Objet';
}

// ---- Participants officiels (depuis #liste_participants_xxx) ----
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

// ---- Auteur robuste (gère “a quitté / a rejoint …”) ----
function detectAuthor(tr) {
  // 1) Lien vers le joueur (colonne expéditeur)
  let a = tr.querySelector('td.expe a[href*="Membre.php?Pseudo="]');
  if (a) return getPseudoFromHref(a.getAttribute('href')) || a.textContent.trim();

  // 2) Lien vers le joueur (dans le corps du message, ex. "Fenrir a quitté la conversation.")
  a = tr.querySelector('td.message a[href*="Membre.php?Pseudo="]');
  if (a) return getPseudoFromHref(a.getAttribute('href')) || a.textContent.trim();

  // 3) Texte du message : "Fenrir a quitté la conversation."
  const msg = tr.querySelector('td.message')?.innerText.trim() || '';
  const m = msg.match(/^(.+?)\s+(?:a\s+(?:quitté|rejoint)\s+la conversation|a\s+(?:été\s+)?(?:ajouté|exclu|retiré)(?:e)?(?:\s+\w+)*\s+(?:de|à)\s+la conversation)\b/i);
  if (m && m[1]) return m[1].trim();

  // 4) Faible proba : texte expéditeur qui ne ressemble pas à une date
  const expe = tr.querySelector('td.expe')?.innerText.trim() || '';
  if (expe && !/^\d{1,2}\/\d{1,2}\/\d{2}/.test(expe) && !/(?:\bhier\b|\baujourd)/i.test(expe) && !/\d{1,2}h\d{2}/.test(expe)) {
    return expe;
  }
  return '';
}

// Voir messages précédents
async function clickAllVoirPrec(table) {
  let btn;
  while ((btn = $$('a', table).find(a => /voir les messages pr[ée]c[ée]dents/i.test(a.textContent)))) {
    btn.click();
    await sleep(200);
  }
}
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
  if (table.__done) return; table.__done = true;

  // Bouton
  const rBtn = table.insertRow(-1), cBtn = rBtn.insertCell(0);
  cBtn.colSpan = table.rows[0]?.cells.length || 2;
  cBtn.style.textAlign = 'center';
  const btn = Object.assign(document.createElement('button'), { className:'zz-btn', textContent:'Exporter la conversation' });
  cBtn.appendChild(btn);

  // Bloc export (caché)
  const rExp = table.insertRow(-1), cExp = rExp.insertCell(0);
  cExp.colSpan = cBtn.colSpan;
  cExp.innerHTML = `
    <div class="zz-export">
      <div class="zz-actions"></div>
      <div class="zz-block"><strong>Sans BBCode</strong><textarea class="ta-raw" readonly></textarea></div>
      <div class="zz-block"><strong>Avec BBCode (Fourmizzz)</strong><textarea class="ta-fz" readonly></textarea></div>
      <div class="zz-block"><strong>Avec BBCode (Classique)</strong><textarea class="ta-classic" readonly></textarea></div>
    </div>`;
  const exp = $('.zz-export', cExp);
  const taRaw = $('.ta-raw', exp), taFZ = $('.ta-fz', exp), taC = $('.ta-classic', exp);
  const actions = $('.zz-actions', exp);
  actions.append(
    makeCopyBtn(taRaw, 'Copier Texte'),
    makeCopyBtn(taFZ, 'Copier BBCode Fzzz'),
    makeCopyBtn(taC, 'Copier BBCode Classique')
  );

  btn.onclick = async () => {
    const titre = getConversationTitle(table);

    // Anciens messages et dépliage
    await clickAllVoirPrec(table);
    const rows = $$('tr[id^="message_"]', table).filter(tr => !tr.id.includes('complet'));
    rows.forEach(tr => tr.querySelector('[id*="afficher_complet_"]')?.click());
    await sleep(150);

    // Participants
    let partsCell = findParticipantsCell(table);
    await ensureAllParticipantsShown(partsCell);
    let participants = readParticipantsFromCell(partsCell);
    if (participants.length === 0) participants = readParticipantsFromMessages(table);

    const partsRaw = participants.join(', ');
    const partsFZ  = participants.map(p => `[player]${p}[/player]`).join(', ');

    // Têtes (ligne vide après Participants)
    let raw = `Titre : ${titre}\n\nParticipants : ${partsRaw}\n\n`;
    let fz  = `[center][b]${titre}[/b][/center]\n\nParticipants : ${partsFZ}\n\n`;
    let cls = `[center][b]${titre}[/b][/center]\n\nParticipants : ${partsRaw}\n\n`;

    // Messages
    rows.forEach(tr => {
      const date = tr.querySelector('.date_envoi')?.textContent.trim() || '';
      const author = detectAuthor(tr); // <-- FIX: vrai pseudo, pas l’heure
      const authorFZ  = author ? `[player]${author}[/player]` : `[b]Système[/b]`;
      const authorCls = author ? `[b]${author}[/b]` : `[b]Système[/b]`;

      const id   = tr.id.replace('message_', '');
      const html = ( $('#message_complet_'+id)?.innerHTML || $('.message', tr)?.innerHTML || '' )
                    .replace(/<div class="date_envoi">[\s\S]*?<\/div>/, '');
      const text = $('.message', tr)?.innerText.trim() || '';

      raw += `${author || 'Système'} ${date}\n\n${text}\n\n`;
      fz  += `${authorFZ} [b]${date}[/b]\n\n${ze_HTML_to_BBcode(html, true)}\n\n[hr]\n`;
      cls += `${authorCls} [b]${date}[/b]\n\n${ze_HTML_to_BBcode(html, false)}\n\n[hr]\n`;
    });

    taRaw.value = raw.trim();
    taFZ.value  = fz.trim();
    taC.value   = cls.trim();
    exp.classList.add('visible');
  };
}

function boot() {
  $$('tr.contenu_conversation td > table').forEach(inject);
  new MutationObserver(() => $$('tr.contenu_conversation td > table').forEach(inject))
    .observe(document.body, { childList: true, subtree: true });
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
