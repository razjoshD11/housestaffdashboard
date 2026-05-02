/* House Staff Dashboard — client SPA */

const fmtUSD = n => '$' + Math.round(n || 0).toLocaleString('en-US');
const fmtUSDk = n => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'k';
  return '$' + Math.round(n).toLocaleString('en-US');
};
const escape = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slugify = s => String(s).toLowerCase()
  .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
  .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let DATA = null;
let SORT = { col: 'total_spend', dir: 'desc' };
let FILTER = { city: 'all', q: '' };

async function load() {
  const r = await fetch('data.json');
  DATA = await r.json();
  DATA.members.forEach(m => { m.slug = slugify(m.name); });
  route();
}

window.addEventListener('hashchange', route);

function route() {
  const hash = location.hash || '#/';
  const app = document.getElementById('app');
  if (hash === '#/' || hash === '') {
    app.innerHTML = renderHome();
    bindHomeEvents();
    return;
  }
  if (hash === '#/methodology') {
    app.innerHTML = renderMethodology();
    return;
  }
  const m = hash.match(/^#\/member\/(.+)$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const member = DATA.members.find(x => x.slug === slug);
    if (member) {
      app.innerHTML = renderMember(member);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
  }
  app.innerHTML = `<div class="wrap"><div class="loading">Not found.</div></div>`;
}

/* HOME */
function renderHome() {
  const totalSpend = DATA.members.reduce((a, m) => a + m.totals.total_spend, 0);
  const totalStaffCount = DATA.members.reduce((a, m) => a + m.staff.length, 0);
  const cities = DATA.city_summary.length;

  return `
    <section class="hero">
      <div class="wrap">
        <h1>How big-city Democrats spend their House office budget.</h1>
        <p class="lede">Every quarter, the U.S. House publishes a Statement of Disbursements showing every dollar each Member of Congress spent — staff salaries, office rent, travel, the works. This dashboard pulls 2025 data for Democrats representing the seven largest American cities and lays it bare: who they pay, what they pay them, and where the rest of the money goes.</p>
        <div class="hero-stats">
          <div class="stat"><span class="stat-num">${DATA.members.length}</span><div class="stat-label">Members</div></div>
          <div class="stat"><span class="stat-num">${cities}</span><div class="stat-label">Cities</div></div>
          <div class="stat"><span class="stat-num">${fmtUSDk(totalSpend)}</span><div class="stat-label">Total 2025 Spend</div></div>
          <div class="stat"><span class="stat-num">${totalStaffCount.toLocaleString()}</span><div class="stat-label">Staff Names on Payroll</div></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2>By city</h2>
        <p class="sub">Aggregate 2025 spending by Members representing each metro area.</p>
        <div class="city-grid">
          ${DATA.city_summary
            .sort((a, b) => b.total_spend - a.total_spend)
            .map(c => `
              <div class="city-card">
                <div class="city-name">${escape(c.city)}</div>
                <div class="city-count">${c.members} member${c.members > 1 ? 's' : ''}</div>
                <div class="city-stat">${fmtUSDk(c.total_spend)}</div>
                <div class="staff-title">total 2025 spend</div>
              </div>
            `).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2>Compare members</h2>
        <p class="sub">Click a column header to sort. Click any name to see staff roster, top vendors, and category detail.</p>
        <div class="filter-bar">
          <label>Filter</label>
          <select id="city-filter">
            <option value="all">All cities</option>
            ${DATA.city_summary.map(c => `<option value="${escape(c.city)}">${escape(c.city)}</option>`).join('')}
          </select>
          <input id="search" type="search" placeholder="Search by name…">
        </div>
        <div class="table-wrap">
          <table class="compare" id="compare-table">
            <thead><tr>
              <th data-col="name" class="sortable">Member</th>
              <th data-col="city" class="sortable">City</th>
              <th data-col="staff_count" class="sortable num">Staff</th>
              <th data-col="staff_total" class="sortable num">Staff $</th>
              <th data-col="office_total" class="sortable num">Office $</th>
              <th data-col="travel_total" class="sortable num">Travel $</th>
              <th data-col="other_total" class="sortable num">Other $</th>
              <th data-col="total_spend" class="sortable num sort-desc">Total $</th>
            </tr></thead>
            <tbody id="compare-body"></tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function bindHomeEvents() {
  document.querySelectorAll('#compare-table thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (SORT.col === col) SORT.dir = (SORT.dir === 'asc' ? 'desc' : 'asc');
      else { SORT.col = col; SORT.dir = (col === 'name' || col === 'city') ? 'asc' : 'desc'; }
      document.querySelectorAll('#compare-table thead th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(SORT.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      renderTable();
    });
  });
  document.getElementById('city-filter').addEventListener('change', e => {
    FILTER.city = e.target.value;
    renderTable();
  });
  document.getElementById('search').addEventListener('input', e => {
    FILTER.q = e.target.value.toLowerCase();
    renderTable();
  });
  renderTable();
}

function renderTable() {
  const rows = DATA.members
    .filter(m => FILTER.city === 'all' || m.city === FILTER.city)
    .filter(m => !FILTER.q || m.name.toLowerCase().includes(FILTER.q) || m.district.toLowerCase().includes(FILTER.q));

  const accessor = m => {
    switch (SORT.col) {
      case 'name': return m.name;
      case 'city': return m.city;
      case 'staff_count': return m.staff.length;
      case 'staff_total': return m.totals.staff_total;
      case 'office_total': return m.totals.office_total;
      case 'travel_total': return m.totals.travel_total;
      case 'other_total': return m.totals.other_total;
      case 'total_spend': return m.totals.total_spend;
      default: return 0;
    }
  };
  rows.sort((a, b) => {
    const va = accessor(a), vb = accessor(b);
    let cmp;
    if (typeof va === 'string') cmp = va.localeCompare(vb);
    else cmp = (va || 0) - (vb || 0);
    return SORT.dir === 'asc' ? cmp : -cmp;
  });

  const body = document.getElementById('compare-body');
  body.innerHTML = rows.map(m => `
    <tr>
      <td>
        <a href="#/member/${encodeURIComponent(m.slug)}" class="member-link">
          <span class="district">${escape(m.district)}</span>${escape(m.name)}
        </a>
      </td>
      <td><span class="city-tag">${escape(m.city)}</span></td>
      <td class="num">${m.staff.length}</td>
      <td class="num">${fmtUSDk(m.totals.staff_total)}</td>
      <td class="num">${fmtUSDk(m.totals.office_total)}</td>
      <td class="num">${fmtUSDk(m.totals.travel_total)}</td>
      <td class="num">${fmtUSDk(m.totals.other_total)}</td>
      <td class="num"><strong>${fmtUSDk(m.totals.total_spend)}</strong></td>
    </tr>
  `).join('');
}

/* MEMBER DETAIL */
function renderMember(m) {
  const t = m.totals;
  const maxQ = Math.max(...m.quarterly.map(q => q.amount || 0)) || 1;
  const maxCat = Math.max(...m.category_breakdown.map(c => c.amount || 0)) || 1;

  return `
    <div class="member-detail">
      <div class="wrap">
        <a href="#/" class="member-back">← All members</a>
        <div class="member-header">
          <div>
            <h1>${escape(m.name)}</h1>
            <div class="member-meta">
              <span class="district">${escape(m.district)}</span>
              ${escape(m.city)}, ${escape(m.state)}
            </div>
          </div>
        </div>

        <div class="totals-row">
          <div class="total-card primary">
            <div class="total-label">Total 2025 Spend</div>
            <div class="total-num">${fmtUSD(t.total_spend)}</div>
          </div>
          <div class="total-card">
            <div class="total-label">Staff Compensation</div>
            <div class="total-num">${fmtUSD(t.staff_total)}</div>
          </div>
          <div class="total-card">
            <div class="total-label">Office (rent, supplies, print)</div>
            <div class="total-num">${fmtUSD(t.office_total)}</div>
          </div>
          <div class="total-card">
            <div class="total-label">Travel</div>
            <div class="total-num">${fmtUSD(t.travel_total)}</div>
          </div>
          <div class="total-card">
            <div class="total-label">Other</div>
            <div class="total-num">${fmtUSD(t.other_total)}</div>
          </div>
        </div>

        <h2 style="font-family: var(--serif); font-size: 22px; margin: 0 0 14px;">Quarterly spend</h2>
        <div class="qchart">
          ${m.quarterly.map(q => {
            const h = Math.max(4, (q.amount / maxQ) * 160);
            return `
              <div class="qbar">
                <div class="qval">${fmtUSDk(q.amount)}</div>
                <div class="bar" style="height: ${h}px;"></div>
                <div class="qlabel">${escape(q.quarter)}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="detail-grid">
          <div>
            <div class="panel">
              <h3>Staff (${m.staff.length})</h3>
              <div class="panel-sub">Annualized salaries are total 2025 pay. Where a person is on payroll fewer than 4 quarters, salary is estimated by extrapolating their pay across 12 months.</div>
              <table class="staff">
                <thead><tr>
                  <th>Name / Title</th>
                  <th>Quarters</th>
                  <th class="num">Annualized</th>
                  <th class="num">Paid 2025</th>
                </tr></thead>
                <tbody>
                  ${m.staff.map(s => `
                    <tr>
                      <td>
                        <div class="staff-name">${escape(s.name)}</div>
                        <div class="staff-title">${escape(s.title || '—')}</div>
                        ${s.note ? `<div class="staff-note">${escape(s.note)}</div>` : ''}
                      </td>
                      <td>${s.quarters_paid.map(q => `<span class="q-pill">${escape(q)}</span>`).join('')}</td>
                      <td class="num">${fmtUSD(s.annualized_salary)}</td>
                      <td class="num">${fmtUSD(s.total_paid_2025)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div class="panel" style="margin-bottom: 24px;">
              <h3>Top 5 other expenses</h3>
              <div class="panel-sub">Largest line items excluding staff, office, and travel.</div>
              <table class="other">
                <tbody>
                  ${m.top_other.map(o => `
                    <tr>
                      <td>
                        <div class="other-cat">${escape(o.category)}</div>
                        <div class="other-vendor">${escape(o.vendor || 'multiple vendors')}</div>
                        ${o.examples && o.examples.length ? `<div class="other-examples">${escape(o.examples.join(' • '))}</div>` : ''}
                      </td>
                      <td class="num"><strong>${fmtUSD(o.amount)}</strong></td>
                    </tr>
                  `).join('') || '<tr><td colspan="2" style="text-align:center;color:var(--muted);">No "other" expenses recorded.</td></tr>'}
                </tbody>
              </table>
            </div>

            <div class="panel">
              <h3>Full category breakdown</h3>
              <div class="cat-list">
                ${m.category_breakdown.map(c => `
                  <div class="cat-row">
                    <span class="cat-name">${escape(c.category)}</span>
                    <span class="cat-amount">${fmtUSD(c.amount)}</span>
                    <div class="cat-bar-wrap">
                      <div class="cat-bar-fill" style="width: ${(c.amount / maxCat) * 100}%;"></div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* METHODOLOGY */
function renderMethodology() {
  return `
    <div class="wrap">
      <div class="methodology">
        <a href="#/" class="member-back">← Back</a>
        <h2>Methodology</h2>
        <p>This dashboard compiles 2025 data from the U.S. House <strong>Statement of Disbursements (SOD)</strong>, the official quarterly publication of every dollar paid out of each Member office's <strong>Members' Representational Allowance (MRA)</strong>.</p>

        <h3>Source</h3>
        <p>Four quarterly detail-grid CSVs published by the House Chief Administrative Officer:</p>
        <ul>
          <li>January–March 2025 SOD Detail Grid</li>
          <li>April–June 2025 SOD Detail Grid</li>
          <li>July–September 2025 SOD Detail Grid</li>
          <li>October–December 2025 SOD Detail Grid</li>
        </ul>

        <h3>Member selection</h3>
        <p>Democratic Members of the U.S. House whose districts contain any part of the city limits of <strong>San Francisco, Los Angeles, New York City, Miami, Chicago, Seattle, or Boston</strong>. Where a city is split across many Democratic districts (NYC, LA, Chicago), every Democratic member with district territory inside the city is included.</p>

        <h3>Categories</h3>
        <ul>
          <li><strong>Staff</strong> = <code>PERSONNEL COMPENSATION</code> rows.</li>
          <li><strong>Office</strong> = <code>RENT, COMMUNICATION, UTILITIES</code> + <code>SUPPLIES AND MATERIALS</code> + <code>PRINTING AND REPRODUCTION</code>.</li>
          <li><strong>Travel</strong> = <code>TRAVEL</code> rows.</li>
          <li><strong>Other</strong> = everything else (typically <code>OTHER SERVICES</code>, <code>FRANKED MAIL</code>, miscellaneous categories).</li>
        </ul>
        <p>Only rows with <code>SORT SEQUENCE = DETAIL</code> are summed. Subtotal and grand-total rows are excluded so totals are not double-counted.</p>

        <h3>Annualized salary</h3>
        <p>For each staff name appearing in personnel-compensation rows, all 2025 payments are summed.</p>
        <ul>
          <li>If the staffer received pay in <strong>all 4 quarters</strong>, the sum is reported directly as the annualized salary (full year on payroll).</li>
          <li>If they received pay in <strong>fewer than 4 quarters</strong>, the salary is estimated by extrapolating the per-quarter rate across 12 months: <code>(total paid ÷ months on payroll) × 12</code>, where each quarter equals 3 months. These rows are flagged with an "Estimated" note.</li>
        </ul>
        <p>This means a person who joined mid-year and earned $50,000 across two quarters is reported as having an annualized rate of $100,000, not $50,000. Total-paid-in-2025 is also shown unmodified for transparency.</p>

        <h3>Caveats</h3>
        <ul>
          <li>Staff counts reflect <em>distinct names that appeared on payroll at any point in 2025</em>, not headcount at a single moment. Turnover inflates the count above any office's true point-in-time staff size.</li>
          <li>"Title" reflects the most recent title attached to that name in the SOD detail.</li>
          <li>Some categories such as <code>FRANKED MAIL</code> are reimbursed on different cycles and may show large one-time charges.</li>
          <li>Negative amounts (refunds, corrections) are netted into category totals.</li>
        </ul>

        <h3>Source code</h3>
        <p>The Python ETL that produces <code>data.json</code> from the four SOD CSVs is in this repo under <code>scripts/build_data.py</code>.</p>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('app').innerHTML = '<div class="wrap"><div class="loading">Loading 2025 disbursements…</div></div>';
  load();
});
