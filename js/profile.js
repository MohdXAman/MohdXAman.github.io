import {
  gqlQuery,
  QUERY_USER,
  QUERY_XP,
  QUERY_RESULTS,
  QUERY_AUDITS,
  QUERY_OBJECT_BY_ID,
} from './graphql.js';
import { createXPLineChart, createPassFailBarChart, createAuditDonut, formatXP } from './graphs.js';

export async function loadProfile() {
  await Promise.all([
    loadUserSection(),
    loadXPSection(),
    loadAuditSection(),
    loadGraphsSection(),
  ]);
}

// Extracts the program/track from a transaction path.
// Handles both /<campus>/<program>/... and /<program>/... structures.
export function extractProgram(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length >= 3) return parts[1]; // /<campus>/<program>/<project>
  if (parts.length === 2) return parts[0]; // /<program>/<project>
  if (parts.length === 1) return parts[0];
  return null;
}

export function formatProgramName(slug) {
  if (!slug) return '';
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.toUpperCase() === part ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

async function loadUserSection() {
  const el = document.getElementById('user-info');
  try {
    const data = await gqlQuery(QUERY_USER);
    const { id, login, attrs } = data.user[0];

    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = login;

    const firstName = attrs?.firstName || attrs?.first_name || '—';
    const lastName  = attrs?.lastName  || attrs?.last_name  || attrs?.secondName || '—';
    const fullName  = (firstName !== '—' || lastName !== '—')
      ? `${firstName} ${lastName}`.trim()
      : '—';
    const phone = attrs?.Phone       || attrs?.phoneNumber  ||
                  attrs?.phone       || attrs?.mobile       ||
                  attrs?.tel         || attrs?.PhoneNumber  || '—';

    el.innerHTML = `
      <div class="info-grid">
        <div class="info-item">
          <span class="label">User ID</span>
          <span class="value value-sm">${id}</span>
        </div>
        <div class="info-item">
          <span class="label">Full Name</span>
          <span class="value">${fullName}</span>
        </div>
        <div class="info-item">
          <span class="label">Phone</span>
          <span class="value value-sm">${phone}</span>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<p class="error-text">Failed to load user info: ${err.message}</p>`;
  }
}

async function loadXPSection() {
  const el = document.getElementById('xp-info');
  try {
    const data   = await gqlQuery(QUERY_XP);
    const allTxs = data.transaction;

    // Argument query — official name of the latest project
    let latestOfficialName = null;
    const lastTx = allTxs[allTxs.length - 1];
    if (lastTx?.objectId) {
      try {
        const obj = await gqlQuery(QUERY_OBJECT_BY_ID, { id: lastTx.objectId });
        if (obj.object[0]) latestOfficialName = obj.object[0].name;
      } catch { /* non-critical */ }
    }

    const programs = [...new Set(
      allTxs.map(t => extractProgram(t.path)).filter(Boolean)
    )].sort();

    function renderXP(program) {
      const txs     = program === 'all'
        ? allTxs
        : allTxs.filter(t => extractProgram(t.path) === program);
      const totalXP = txs.reduce((sum, t) => sum + t.amount, 0);
      const last    = txs[txs.length - 1];
      const name    = program === 'all' && latestOfficialName
        ? latestOfficialName
        : last ? last.path.split('/').filter(Boolean).pop() : '—';

      document.getElementById('xp-total').textContent  = formatXP(totalXP);
      document.getElementById('xp-latest').textContent = name || '—';
    }

    const options = ['all', ...programs]
      .map(p => `<option value="${p}">${p === 'all' ? 'All Programs' : formatProgramName(p)}</option>`)
      .join('');

    el.innerHTML = `
      <div class="xp-filter">
        <label class="filter-label" for="xp-program-select">Program</label>
        <select id="xp-program-select" class="program-select">
          ${options}
        </select>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Total XP</span>
          <span class="value xp-highlight" id="xp-total">—</span>
        </div>
        <div class="info-item">
          <span class="label">Latest Project</span>
          <span class="value value-sm" id="xp-latest">—</span>
        </div>
      </div>
    `;

    renderXP('all');
    document.getElementById('xp-program-select').addEventListener('change', e => {
      renderXP(e.target.value);
    });
  } catch (err) {
    el.innerHTML = `<p class="error-text">Failed to load XP data: ${err.message}</p>`;
  }
}

async function loadAuditSection() {
  const el = document.getElementById('audit-info');
  try {
    const data = await gqlQuery(QUERY_AUDITS);
    const { auditRatio, totalUp, totalDown } = data.user[0];

    const ratio      = auditRatio != null ? auditRatio.toFixed(1) : '—';
    const ratioClass = auditRatio >= 1 ? 'ratio-good' : 'ratio-bad';

    el.innerHTML = `
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Audit Ratio</span>
          <span class="value ${ratioClass}">${ratio}</span>
        </div>
        <div class="info-item">
          <span class="label">Done</span>
          <span class="value">${formatXP(totalUp ?? 0)}</span>
        </div>
        <div class="info-item">
          <span class="label">Received</span>
          <span class="value">${formatXP(totalDown ?? 0)}</span>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<p class="error-text">Failed to load audit data: ${err.message}</p>`;
  }
}

async function loadGraphsSection() {
  const xpEl    = document.getElementById('xp-graph');
  const resEl   = document.getElementById('results-graph');
  const auditEl = document.getElementById('audit-graph');

  try {
    const [xpData, resultsData, auditData] = await Promise.all([
      gqlQuery(QUERY_XP),
      gqlQuery(QUERY_RESULTS),
      gqlQuery(QUERY_AUDITS),
    ]);

    const allTxs = xpData.transaction;

    // Populate the XP chart program filter
    const programs = [...new Set(
      allTxs.map(t => extractProgram(t.path)).filter(Boolean)
    )].sort();

    const filterEl = document.getElementById('xp-graph-filter');
    if (filterEl) {
      programs.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = formatProgramName(p);
        filterEl.appendChild(opt);
      });

      function renderXPGraph(program) {
        const txs = program === 'all'
          ? allTxs
          : allTxs.filter(t => extractProgram(t.path) === program);
        xpEl.innerHTML = createXPLineChart(txs);
      }

      renderXPGraph('all');
      filterEl.addEventListener('change', e => renderXPGraph(e.target.value));
    } else {
      xpEl.innerHTML = createXPLineChart(allTxs);
    }

    resEl.innerHTML   = createPassFailBarChart(resultsData.result);

    const { totalUp, totalDown } = auditData.user[0];
    auditEl.innerHTML = createAuditDonut(totalUp ?? 0, totalDown ?? 0);
  } catch (err) {
    xpEl.innerHTML    = `<p class="error-text">Failed to load graphs: ${err.message}</p>`;
    resEl.innerHTML   = '';
    auditEl.innerHTML = '';
  }
}

export function getAuditPercent(up, down) {
  if (!up && !down) return 50;
  return Math.round((up / (up + down)) * 100);
}
