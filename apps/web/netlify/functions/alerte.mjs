// FLEMME V2 — alerte e-mail à l'équipe (fonction Netlify, /api/alerte).
// Appelée par Supabase (pg_net, voir supabase/migrations/20261103130000_flemme_v2_admin.sql) à chaque nouvelle flemme,
// accord conclu ou signalement. Envoie l'e-mail via Resend.
// Variables Netlify : RESEND_API_KEY, ALERTE_SECRET (obligatoires), ALERTE_EMAIL, ALERTE_FROM (facultatives).
// Les anciens appels du site FlemmeV2.0 (tables demandes/messages) sont ignorés sans erreur.
import { timingSafeEqual } from 'node:crypto';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euros = cents => Number.isInteger(cents) ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100) : '';
const short = (s, n = 60) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// Comparaison du secret en temps constant.
export function secretOk(given, expected) {
  if (!expected) return false;
  const a = Buffer.from(given || ''), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function html(title, lines, site, button) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#16131f;max-width:520px">
<p style="font-size:20px;font-weight:800;margin:0 0 12px">${esc(title)}</p>
${lines.filter(([, v]) => v).map(([k, v]) => `<p style="margin:0 0 6px"><b>${esc(k)} :</b> ${esc(v).replace(/\n/g, '<br>')}</p>`).join('')}
<p style="margin:20px 0"><a href="${esc(site)}/admin" style="background:#16131f;color:#a5ccff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px">${esc(button)}</a></p>
<p style="font-size:12px;color:#3f3a55">Alerte automatique de flemme.org</p></div>`;
}
const text = (title, lines, site) => [title, '', ...lines.filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`), '', site + '/admin'].join('\n');

// Contenu de l'e-mail selon l'événement, ou null s'il n'y a rien à envoyer.
export function alerte(body, site = 'https://flemme.org') {
  if (!body || body.source !== 'flemme_v2' || !body.payload || typeof body.payload !== 'object') return null;
  const p = body.payload, ref = ['Flemme', String(body.task_id || '').slice(0, 8)];
  let subject, title, lines, button;
  if (body.kind === 'report') {
    subject = `Signalement : ${short(p.title)}`; title = 'Un désaccord a été signalé'; button = 'Ouvrir les litiges';
    lines = [['Flemme', p.title], ['Signalé par', p.actor], ['Message', p.text], ['Déposant', p.owner], ['Brigadier', p.brigadier], ref];
  } else if (body.kind === 'task_created') {
    subject = `Nouvelle flemme : ${short(p.title)}`; title = 'Nouvelle flemme publiée'; button = 'Ouvrir l’admin';
    lines = [['Flemme', p.title], ['Lieu', p.place], ['Budget', p.budget == null ? 'Prix à proposer' : euros(p.budget)], ['Déposant', p.owner], ref];
  } else if (body.kind === 'agreement') {
    subject = `Accord conclu : ${short(p.title)}`; title = 'Un accord a été conclu'; button = 'Ouvrir l’admin';
    lines = [['Flemme', p.title], ['Déposant', p.owner], ['Brigadier', p.brigadier], ['Forfait', euros(p.amount)], ['Commission FLEMME à régler', euros(p.commission)], ref];
  } else return null;
  return { subject, html: html(title, lines, site, button), text: text(title, lines, site) };
}

export default async req => {
  if (req.method !== 'POST') return new Response('', { status: 405 });
  const secret = process.env.ALERTE_SECRET, key = process.env.RESEND_API_KEY;
  if (!secret || !key) return new Response('Alerte non configurée', { status: 503 });
  if (!secretOk(req.headers.get('x-alerte-secret'), secret)) return new Response('', { status: 401 });
  let mail;
  try { mail = alerte(await req.json(), (process.env.URL || 'https://flemme.org').replace(/\/+$/, '')); }
  catch { return new Response('', { status: 400 }); }
  if (!mail) return new Response(null, { status: 204 });
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.ALERTE_FROM || 'FLEMME <alertes@flemme.org>',
      to: (process.env.ALERTE_EMAIL || 'ben.champly@gmail.com').split(',').map(s => s.trim()).filter(Boolean),
      subject: mail.subject, html: mail.html, text: mail.text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  return new Response(r.ok ? 'ok' : 'Resend : ' + r.status, { status: r.ok ? 200 : 502 });
};

export const config = { path: '/api/alerte' };
