/**
 * 新竹縣緊急救護暨高級救護技術員 (EMT-P) 深度成效戰情儀表板 - Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = window.DASHBOARD_DATA;
  if (!data) {
    console.error('DASHBOARD_DATA not found!');
    return;
  }

  // ================= 1. Header Tickers =================
  const summary = data.summary || {};
  document.getElementById('ticker-total-ohca').textContent = `${(summary.total_ohca || 4037).toLocaleString()} 件`;
  document.getElementById('ticker-total-rosc').textContent = `${(summary.total_rosc || 857).toLocaleString()} 人 (${((summary.total_rosc || 857)/(summary.total_ohca || 4037)*100).toFixed(1)}%)`;
  document.getElementById('ticker-gm-ems').textContent = `${(summary.gm_total_ems || 26843).toLocaleString()} 件`;
  document.getElementById('ticker-gm-rate').textContent = `${summary.gm_rosc_rate || 30.39}% (R1 ${summary.gm_r1_rosc_rate || 23.57}%)`;
  document.getElementById('count-firefighters').textContent = `${(data.career_firefighters || []).length}位`;

  // ================= 2. Nav Tabs Switching =================
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // ================= 3. TAB 1: 光明分隊警消個人分析專頁 =================
  const ffGrid = document.getElementById('firefighter-grid');
  const ffSearch = document.getElementById('firefighter-search');
  const ffPills = document.querySelectorAll('#firefighter-filter-pills .filter-pill');
  const modal = document.getElementById('profile-modal');
  const modalClose = document.getElementById('modal-close-btn');

  let currentFfFilter = 'all';
  let currentFfSearch = '';

  function renderFirefighters() {
    ffGrid.innerHTML = '';
    const list = data.career_firefighters || [];

    const filtered = list.filter(ff => {
      // Pill filter
      if (currentFfFilter === 'tp' && !ff.is_tp) return false;
      if (currentFfFilter === 'non-tp' && ff.is_tp) return false;
      if (currentFfFilter === 'heavy' && ff.general_ems_calls < 2000) return false;

      // Text search
      if (currentFfSearch) {
        const q = currentFfSearch.toLowerCase();
        const matchName = ff.name.toLowerCase().includes(q);
        const matchRole = ff.role.toLowerCase().includes(q);
        const matchBadge = (ff.badge || '').toLowerCase().includes(q);
        if (!matchName && !matchRole && !matchBadge) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      ffGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">查無符合條件的警消同仁</div>';
      return;
    }

    filtered.forEach(ff => {
      const card = document.createElement('div');
      card.className = 'firefighter-card';
      const roleTagClass = ff.is_tp ? 'tag-tp' : 'tag-emt2';
      const hasImage = !!ff.hero_image;
      const thumbHtml = hasImage 
        ? `<img src="${ff.hero_image}" alt="${ff.hero_name}" class="ff-thumb-img" />`
        : '';

      card.innerHTML = `
        <div class="card-top-row">
          <div class="ff-name-title">
            <div class="ff-name">${ff.name}</div>
            <span class="ff-role-tag ${roleTagClass}">${ff.role}</span>
          </div>
          <span class="ff-badge">${ff.badge || '光明前線主力'}</span>
        </div>

        <div class="ff-thumb-row">
          ${thumbHtml}
          <div style="flex: 1; min-width: 0;">
            <div class="ff-hero-meta">
              <span>🏛️</span> 歷史人物：<strong>${ff.hero_name}</strong>・<span>${ff.hero_title}</span>
            </div>
            <div class="ff-hero-quote">「${ff.hero_quote}」</div>
          </div>
        </div>

        <div class="ff-kpi-summary">
          <div class="ff-kpi-item">
            <span class="ff-kpi-label">一般救護量</span>
            <span class="ff-kpi-val text-blue">${ff.general_ems_calls.toLocaleString()}</span>
          </div>
          <div class="ff-kpi-item">
            <span class="ff-kpi-label">OHCA出勤</span>
            <span class="ff-kpi-val">${ff.ohca_calls}</span>
          </div>
          <div class="ff-kpi-item">
            <span class="ff-kpi-label">廣義成功率</span>
            <span class="ff-kpi-val text-emerald">${ff.rosc_rate}%</span>
          </div>
        </div>

        <div style="font-size: 0.84rem; color: var(--text-body); line-height: 1.6; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${ff.desc}
        </div>

        <div class="ff-skills-compact">
          <span>給藥: <strong>${ff.drug_rate}%</strong></span>
          <span>插管: <strong>${ff.endo_rate}%</strong></span>
          <span>救回: <strong class="text-emerald">${ff.ohca_rosc}人</strong></span>
        </div>
      `;

      card.addEventListener('click', () => openFirefighterModal(ff));
      ffGrid.appendChild(card);
    });
  }

  // Filter Pills event
  ffPills.forEach(pill => {
    pill.addEventListener('click', () => {
      ffPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFfFilter = pill.getAttribute('data-filter');
      renderFirefighters();
    });
  });

  // Search Input event
  ffSearch.addEventListener('input', (e) => {
    currentFfSearch = e.target.value.trim();
    renderFirefighters();
  });

  // Modal open function
  function openFirefighterModal(ff) {
    const femaleNames = new Set(['黃玉喬', '張馨予', '紀琍瑀', '紀俐瑀', '黃美樺', '蔡億鼎']);
    const avatarEl = document.getElementById('modal-avatar');
    if (avatarEl) {
      avatarEl.textContent = femaleNames.has(ff.name) ? '👩‍🚒' : '👨‍🚒';
    }

    document.getElementById('modal-name').textContent = ff.name;
    document.getElementById('modal-role-pill').textContent = ff.role;
    document.getElementById('modal-role-pill').className = `profile-badge-pill ${ff.is_tp ? 'tag-tp' : 'tag-emt2'}`;
    document.getElementById('modal-title-badge').textContent = ff.badge || '光明主力';
    document.getElementById('modal-group-sub').textContent = `光明分隊專職警消・一般救護出勤 ${ff.general_ems_calls.toLocaleString()} 件（分隊佔比 ${ff.general_ems_pct}%）`;

    // Hero Showcase Banner
    document.getElementById('modal-hero-name').textContent = ff.hero_name;
    document.getElementById('modal-hero-title').textContent = ff.hero_title;
    document.getElementById('modal-hero-quote').textContent = `「${ff.hero_quote}」`;
    document.getElementById('modal-hero-narrative').textContent = ff.desc;

    const heroFrame = document.getElementById('modal-hero-image-frame');
    const heroImg = document.getElementById('modal-hero-img');
    const heroSeal = document.getElementById('modal-hero-seal');
    const heroBgImg = document.getElementById('modal-hero-bg-img');

    // Clear dynamic seals if any
    const existingLargeSeal = heroFrame.querySelector('.hero-large-seal');
    if (existingLargeSeal) existingLargeSeal.remove();

    if (ff.hero_image) {
      heroImg.src = ff.hero_image;
      heroImg.style.display = 'block';
      heroSeal.style.display = 'block';
      heroSeal.textContent = `${ff.hero_name}像`;
      heroFrame.classList.remove('seal-only');

      if (heroBgImg) {
        heroBgImg.src = ff.hero_image;
        heroBgImg.style.display = 'block';
      }
    } else {
      heroImg.style.display = 'none';
      heroSeal.style.display = 'none';
      heroFrame.classList.add('seal-only');
      const sealDiv = document.createElement('div');
      sealDiv.className = 'hero-large-seal';
      sealDiv.innerHTML = `${ff.hero_name}<br><span style="font-size: 0.9rem; font-weight: normal;">之印</span>`;
      heroFrame.appendChild(sealDiv);

      if (heroBgImg) {
        heroBgImg.style.display = 'none';
      }
    }

    document.getElementById('modal-general-calls').textContent = `${ff.general_ems_calls.toLocaleString()} 件`;
    document.getElementById('modal-general-pct').textContent = `佔光明全隊 ${ff.general_ems_pct}%`;
    document.getElementById('modal-ohca-calls').textContent = `${ff.ohca_calls} 件`;
    document.getElementById('modal-rosc-calls').textContent = `${ff.ohca_rosc} 人`;
    document.getElementById('modal-rosc-rate').textContent = `成功率 ${ff.rosc_rate}% (全隊差 ${ff.diff_broad >= 0 ? '+' : ''}${ff.diff_broad}%)`;
    document.getElementById('modal-r1-calls').textContent = `${ff.r1_rosc} 人`;
    document.getElementById('modal-r1-rate').textContent = `到院前率 ${ff.r1_rate}%`;

    // Skills Bars
    document.getElementById('modal-drug-rate').textContent = `${ff.drug_rate}% (平均 ${ff.drug_avg} 劑)`;
    document.getElementById('modal-drug-fill').style.width = `${Math.min(100, ff.drug_rate)}%`;

    document.getElementById('modal-endo-rate').textContent = `${ff.endo_rate}%`;
    document.getElementById('modal-endo-fill').style.width = `${Math.min(100, ff.endo_rate)}%`;

    document.getElementById('modal-sga-rate').textContent = `${ff.sga_rate}%`;
    document.getElementById('modal-sga-fill').style.width = `${Math.min(100, ff.sga_rate)}%`;

    document.getElementById('modal-iv-rate').textContent = `${ff.iv_rate}%`;
    document.getElementById('modal-iv-fill').style.width = `${Math.min(100, ff.iv_rate)}%`;

    // Review Text
    document.getElementById('modal-review-text').textContent = ff.desc;

    // Best Partners Table
    const partnersTbody = document.getElementById('modal-partners-tbody');
    partnersTbody.innerHTML = '';
    const partners = ff.best_partners || [];
    if (partners.length === 0) {
      partnersTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim);">無共同出勤達 3 件以上之特定搭檔紀錄</td></tr>';
    } else {
      partners.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${p.name}</strong></td>
          <td>${p.total} 件</td>
          <td class="text-emerald">${p.rosc} 件</td>
          <td><strong class="text-blue">${p.rate}%</strong></td>
        `;
        partnersTbody.appendChild(row);
      });
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  renderFirefighters();

  // ================= 4. TAB 2: 全縣 37 位 EMT-P 總榜 =================
  const lbTableBody = document.getElementById('leaderboard-tbody');
  const lbSearch = document.getElementById('leaderboard-search');
  const lbFilter = document.getElementById('leaderboard-group-filter');
  const lbHeaders = document.querySelectorAll('#leaderboard-table th.sortable');

  let currentLbGroup = 'all';
  let currentLbSearch = '';
  let lbSortField = 'rosc';
  let lbSortAsc = false;

  const rawLb = data.master_37_leaderboard || [];

  function renderLeaderboard() {
    lbTableBody.innerHTML = '';

    let list = rawLb.filter(r => {
      // Group filter
      if (currentLbGroup === 'classmates' && !r.group.includes('同學組')) return false;
      if (currentLbGroup === 'senior' && !r.group.includes('資深')) return false;
      if (currentLbGroup === 'later' && !r.group.includes('新進')) return false;

      // Text search
      if (currentLbSearch) {
        const q = currentLbSearch.toLowerCase();
        const mName = r.name.toLowerCase().includes(q);
        const mStation = r.station.toLowerCase().includes(q);
        const mGroup = r.group.toLowerCase().includes(q);
        if (!mName && !mStation && !mGroup) return false;
      }
      return true;
    });

    // Sorting
    list.sort((a, b) => {
      let valA = a[lbSortField];
      let valB = b[lbSortField];

      if (lbSortField === 'rank') {
        valA = rawLb.indexOf(a) + 1;
        valB = rawLb.indexOf(b) + 1;
      } else if (lbSortField === 'total') {
        valA = a.total_cases_all; valB = b.total_cases_all;
      } else if (lbSortField === 'deducted') {
        valA = a.deducted_emt2; valB = b.deducted_emt2;
      } else if (lbSortField === 'tp_cases') {
        valA = a.ohca_tp; valB = b.ohca_tp;
      } else if (lbSortField === 'rosc') {
        valA = a.rosc_tp; valB = b.rosc_tp;
      } else if (lbSortField === 'rate') {
        valA = a.rate_tp; valB = b.rate_tp;
      } else if (lbSortField === 'drugs') {
        valA = a.drugs_tp; valB = b.drugs_tp;
      }

      if (typeof valA === 'string') {
        return lbSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return lbSortAsc ? (valA - valB) : (valB - valA);
    });

    list.forEach((r) => {
      const globalRank = rawLb.findIndex(item => item.name === r.name) + 1;
      const tr = document.createElement('tr');

      let rankClass = 'rank-other';
      if (globalRank === 1) rankClass = 'rank-1';
      else if (globalRank === 2) rankClass = 'rank-2';
      else if (globalRank === 3) rankClass = 'rank-3';

      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass}">#${globalRank}</span></td>
        <td><strong style="font-size: 1rem; color: var(--text-heading);">${r.name}</strong></td>
        <td><span style="font-size: 0.8rem; color: var(--text-muted);">${r.group}</span></td>
        <td>${r.station}</td>
        <td>${r.total_cases_all} 件</td>
        <td style="color: ${r.deducted_emt2 > 0 ? 'var(--color-clay)' : 'var(--text-dim)'}; font-weight: ${r.deducted_emt2 > 0 ? '600' : 'normal'};">${r.deducted_emt2 > 0 ? `-${r.deducted_emt2} 件` : '0 件'}</td>
        <td><strong>${r.ohca_tp} 件</strong></td>
        <td class="text-emerald"><strong>${r.rosc_tp} 人</strong></td>
        <td class="text-blue"><strong>${r.rate_tp.toFixed(2)}%</strong></td>
        <td>${r.drugs_tp} 次</td>
      `;
      lbTableBody.appendChild(tr);
    });
  }

  lbSearch.addEventListener('input', (e) => {
    currentLbSearch = e.target.value.trim();
    renderLeaderboard();
  });

  lbFilter.addEventListener('change', (e) => {
    currentLbGroup = e.target.value;
    renderLeaderboard();
  });

  lbHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort');
      if (lbSortField === field) {
        lbSortAsc = !lbSortAsc;
      } else {
        lbSortField = field;
        lbSortAsc = false;
      }
      renderLeaderboard();
    });
  });

  renderLeaderboard();

  // ================= 5. TAB 3: 救護常客大數據 =================
  const pyramidContainer = document.getElementById('pyramid-list');
  const fc7y = data.frequent_callers || {};
  const dist = fc7y.distribution || {};

  pyramidContainer.innerHTML = '';
  for (const [tier, cnt] of Object.entries(dist)) {
    const row = document.createElement('div');
    row.className = 'pyramid-row';
    row.innerHTML = `
      <span class="pyramid-label">${tier}</span>
      <span class="pyramid-val">${cnt.toLocaleString()} 人</span>
    `;
    pyramidContainer.appendChild(row);
  }

  // 11501 Month Slice
  const fcm1 = data.frequent_callers_m1 || {};
  const m1List = fcm1['115年01月份_高頻率救護個案_Top15'] || [];
  const m1Tbody = document.getElementById('frequent-m1-tbody');
  m1Tbody.innerHTML = '';
  m1List.slice(0, 10).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td><code>${item.id_masked || '-'}</code></td>
      <td class="text-clay"><strong>${item.count} 次</strong></td>
      <td><span style="font-size: 0.75rem; color: var(--text-dim);">${(item.forms || [])[0] || '-'}</span></td>
    `;
    m1Tbody.appendChild(tr);
  });

  // Top 30 Frequent Callers
  const top30 = fc7y.top30 || [];
  const top30Tbody = document.getElementById('top30-tbody');
  top30Tbody.innerHTML = '';
  top30.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="rank-badge ${p.rank <= 3 ? 'rank-' + p.rank : 'rank-other'}">#${p.rank}</span></td>
      <td><strong>${p.name}</strong></td>
      <td>${p.gender || '-'}</td>
      <td>${p.age ? p.age + ' 歲' : '-'}</td>
      <td class="text-clay"><strong>${p.count} 次</strong></td>
      <td>${p.main_town || '-'}</td>
      <td>${p.years_span || '-'}</td>
      <td style="font-size: 0.8rem; color: var(--text-dim);">${p.first_call || ''} ~ ${p.last_call || ''}</td>
    `;
    top30Tbody.appendChild(tr);
  });

  // ================= 6. TAB 4: 雙人 / 三人組協同勝率 =================
  const combData = data.combinations || {};
  const pairsTop = combData.pairs_top || [];
  const triosTop = combData.trios_top || [];

  const pairsTbody = document.getElementById('pairs-top-tbody');
  pairsTbody.innerHTML = '';
  pairsTop.slice(0, 12).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.names}</strong></td>
      <td>${p.total} 件</td>
      <td class="text-emerald"><strong>${p.rosc} 件</strong></td>
      <td class="text-blue"><strong>${p.rate.toFixed(1)}%</strong></td>
      <td>${p.drugs} 次</td>
    `;
    pairsTbody.appendChild(tr);
  });

  const triosTbody = document.getElementById('trios-top-tbody');
  triosTbody.innerHTML = '';
  triosTop.slice(0, 6).forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.names}</strong></td>
      <td>${t.total} 件</td>
      <td class="text-emerald">${t.rosc} 件</td>
      <td class="text-blue"><strong>${t.rate.toFixed(1)}%</strong></td>
    `;
    triosTbody.appendChild(tr);
  });
});
