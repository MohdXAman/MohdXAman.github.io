// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatXP(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(1)} kB`;
  return `${bytes} B`;
}

function polarToXY(cx, cy, angleDeg, r) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: (cx + r * Math.cos(rad)).toFixed(2),
    y: (cy + r * Math.sin(rad)).toFixed(2),
  };
}

// ─── Graph 1 — XP Line Chart ──────────────────────────────────────────────────

export function createXPLineChart(transactions, width = 680, height = 280) {
  if (!transactions || transactions.length === 0) {
    return '<p class="no-data">No XP data available</p>';
  }

  const pad = { top: 20, right: 30, bottom: 68, left: 78 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;

  let cum = 0;
  const data = transactions.map(t => {
    cum += t.amount;
    return { date: new Date(t.createdAt), xp: cum };
  });

  const t0    = data[0].date.getTime();
  const tSpan = Math.max(data[data.length - 1].date.getTime() - t0, 1);
  const maxXP = data[data.length - 1].xp;

  const sx = d  => ((d.getTime() - t0) / tSpan * W).toFixed(2);
  const sy = xp => (H - (xp / maxXP) * H).toFixed(2);

  const linePoints = data.map(d => `${sx(d.date)},${sy(d.xp)}`).join(' ');
  const areaPoints =
    `0,${H} ${linePoints} ${sx(data[data.length - 1].date)},${H}`;

  // Y-axis grid + labels
  const Y_TICKS = 5;
  const yGrid = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const val = (maxXP / Y_TICKS) * i;
    const y   = sy(val);
    return `
      <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#252538" stroke-width="1"/>
      <text x="-8" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="10">${formatXP(val)}</text>`;
  }).join('');

  // X-axis grid + labels — show only start and end dates for a cleaner timeline
  const dataPoints = data.length === 1 ? [data[0]] : [data[0], data[data.length - 1]];
  const multiYr   = data[data.length - 1].date.getFullYear() !== data[0].date.getFullYear();
  const xGrid = dataPoints.map(d => {
    const x     = sx(d.date);
    const label = d.date.toLocaleDateString('en', {
      day: 'numeric', month: 'short', ...(multiYr ? { year: '2-digit' } : {}),
    });
    return `
      <line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#252538" stroke-width="1"/>
      <text x="${x}" y="${H + 8}" text-anchor="end" font-size="10"
        transform="rotate(-40,${x},${H + 8})">${label}</text>`;
  }).join('');

  // Data-point circles (sparse — max 25 visible)
  const step = Math.max(1, Math.floor(data.length / 25));
  const dots = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map(d => `
      <circle cx="${sx(d.date)}" cy="${sy(d.xp)}" r="3.5"
        fill="var(--accent)" class="data-point">
        <title>${formatXP(d.xp)} — ${d.date.toLocaleDateString()}</title>
      </circle>`)
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="graph-svg"
         role="img" aria-label="XP accumulated over time line chart">
      <defs>
        <linearGradient id="xpAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="var(--accent)" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g transform="translate(${pad.left},${pad.top})">
        ${yGrid}
        ${xGrid}
        <polygon points="${areaPoints}" fill="url(#xpAreaGrad)"/>
        <polyline points="${linePoints}" fill="none"
          stroke="var(--accent)" stroke-width="2.2"
          stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#4a4a65" stroke-width="1.5"/>
        <line x1="0" y1="0"  x2="0"  y2="${H}" stroke="#4a4a65" stroke-width="1.5"/>
        <text x="${W / 2}" y="${H + 58}" text-anchor="middle" font-size="11" fill="var(--muted)">Timeline</text>
        <text transform="rotate(-90)" x="${-H / 2}" y="-62"
          text-anchor="middle" font-size="11" fill="var(--muted)">Cumulative XP</text>
      </g>
    </svg>`;
}

// ─── Graph 2 — Pass / Fail Bar Chart ─────────────────────────────────────────

export function createPassFailBarChart(results, width = 480, height = 280) {
  if (!results || results.length === 0) {
    return '<p class="no-data">No results data available</p>';
  }

  const projects = results.filter(r => r.object?.type === 'project');
  const passed   = projects.filter(r => r.grade !== null && r.grade >= 1).length;
  const failed   = projects.filter(r => r.grade !== null && r.grade <  1).length;
  const total    = passed + failed;

  if (total === 0) {
    return '<p class="no-data">No project results yet</p>';
  }

  const pad = { top: 44, right: 30, bottom: 62, left: 55 };
  const W   = width  - pad.left - pad.right;
  const H   = height - pad.top  - pad.bottom;

  const bars = [
    { label: 'Pass', value: passed, color: 'var(--success)' },
    { label: 'Fail', value: failed, color: 'var(--danger)'  },
  ];
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  const barW   = (W / bars.length) * 0.5;

  const barElems = bars.map((bar, i) => {
    const x    = (i + 0.5) * (W / bars.length) - barW / 2;
    const barH = (bar.value / maxVal) * H;
    const y    = H - barH;
    const pct  = Math.round((bar.value / total) * 100);
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}"
        width="${barW.toFixed(1)}" height="${Math.max(barH, 0).toFixed(1)}"
        fill="${bar.color}" rx="6" opacity="0.88">
        <title>${bar.label}: ${bar.value} (${pct}%)</title>
      </rect>
      <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}"
        text-anchor="middle" font-size="13" font-weight="700">${bar.value}</text>
      <text x="${(x + barW / 2).toFixed(1)}" y="${(H + 18).toFixed(1)}"
        text-anchor="middle" font-size="11">${bar.label}</text>
      <text x="${(x + barW / 2).toFixed(1)}" y="${(H + 34).toFixed(1)}"
        text-anchor="middle" font-size="10" fill="var(--muted)">${pct}%</text>`;
  }).join('');

  const Y_TICKS = 4;
  const yGrid   = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const val = Math.round((maxVal / Y_TICKS) * i);
    const y   = (H - (val / maxVal) * H).toFixed(1);
    return `
      <line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#252538" stroke-width="1"/>
      <text x="-8" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="10">${val}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="graph-svg"
         role="img" aria-label="Project pass and fail bar chart">
      <g transform="translate(${pad.left},${pad.top})">
        <text x="${W / 2}" y="-18" text-anchor="middle" font-size="11" fill="var(--muted)">Total: ${total} projects</text>
        ${yGrid}
        ${barElems}
        <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#4a4a65" stroke-width="1.5"/>
        <line x1="0" y1="0"  x2="0"  y2="${H}" stroke="#4a4a65" stroke-width="1.5"/>
        <text x="${W / 2}" y="${H + 52}" text-anchor="middle" font-size="11" fill="var(--muted)">Project Results</text>
        <text transform="rotate(-90)" x="${-H / 2}" y="-40"
          text-anchor="middle" font-size="11" fill="var(--muted)">Count</text>
      </g>
    </svg>`;
}

// ─── Graph 3 (Bonus) — Audit Ratio Donut ─────────────────────────────────────

export function createAuditDonut(totalUp, totalDown, size = 200) {
  if (!totalUp && !totalDown) {
    return '<p class="no-data">No audit data available</p>';
  }

  const total    = totalUp + totalDown;
  const upRatio  = totalUp / total;
  const cx = size / 2;
  const cy = size / 2;
  const R        = size * 0.38;
  const innerR   = size * 0.22;

  function arc(startDeg, endDeg) {
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const s1 = polarToXY(cx, cy, startDeg, R);
    const e1 = polarToXY(cx, cy, endDeg,   R);
    const s2 = polarToXY(cx, cy, endDeg,   innerR);
    const e2 = polarToXY(cx, cy, startDeg, innerR);
    return `M ${s1.x} ${s1.y} A ${R} ${R} 0 ${large} 1 ${e1.x} ${e1.y}`
         + ` L ${s2.x} ${s2.y} A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
  }

  const upDeg    = upRatio * 360;
  const ratio    = (totalUp / Math.max(totalDown, 1)).toFixed(1);
  const ratioColor = totalUp >= totalDown ? 'var(--success)' : 'var(--danger)';

  return `
    <div class="donut-wrapper">
      <svg viewBox="0 0 ${size} ${size}" class="graph-svg donut-svg"
           role="img" aria-label="Audit ratio donut chart">
        <path d="${arc(0, upDeg)}" fill="var(--success)" opacity="0.88">
          <title>Done: ${formatXP(totalUp)} (${Math.round(upRatio * 100)}%)</title>
        </path>
        <path d="${arc(upDeg, 360)}" fill="var(--danger)" opacity="0.88">
          <title>Received: ${formatXP(totalDown)} (${Math.round((1 - upRatio) * 100)}%)</title>
        </path>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle"
          font-size="22" font-weight="700" fill="${ratioColor}">${ratio}</text>
        <text x="${cx}" y="${cy + 13}" text-anchor="middle"
          font-size="11" fill="var(--muted)">ratio</text>
      </svg>
      <div class="donut-legend">
        <span class="legend-item">
          <span class="legend-dot success"></span>Done: ${formatXP(totalUp)}
        </span>
        <span class="legend-item">
          <span class="legend-dot danger"></span>Received: ${formatXP(totalDown)}
        </span>
      </div>
    </div>`;
}
