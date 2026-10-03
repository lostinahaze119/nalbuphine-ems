/**
 * Nalbuphine 止痛評估電子化系統 - 主應用程式邏輯 (EMS Main Logic)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Managers
  const syncManager = new GoogleSyncManager();
  
  // State
  let editingRecordId = null; // null for new entry, string ID when editing

  // Permanent EMS Unit from localStorage
  const savedUnit = localStorage.getItem('saved_ems_unit') || '光明91';

  const formData = {
    unit: savedUnit,
    year: '',
    month: '',
    day: '',
    hour: '',
    minute: '',
    date: '',
    time: '',
    formNo: '',
    gender: '男',
    age: '',
    conditions: ['VAS 疼痛指數≧6 分'],
    dosage: '0.5',
    route: 'IV',
    vasPre: 8,
    vasPost: 3,
    sideEffects: ['無任何副作用'],
    sideEffectOther: '',
    satisfaction: '非常滿意 (5 分)',
    patientSignature: '',
    emtSignature: ''
  };

  let activeSignaturePad = null;
  let currentSigningType = ''; // 'patient' or 'emt'

  // DOM Elements
  const formElement = document.getElementById('nalbuphineForm');
  const unitInput = document.getElementById('inputUnit');
  const dateInput = document.getElementById('inputDate');
  const timeInput = document.getElementById('inputTime');
  const btnSetNow = document.getElementById('btnSetNow');
  const formNoInput = document.getElementById('inputFormNo');
  const ageInput = document.getElementById('inputAge');
  const dosageInput = document.getElementById('inputDosage');
  const sideEffectOtherInput = document.getElementById('inputSideEffectOther');
  const btnNewCase = document.getElementById('btnNewCase');
  
  // Modals
  const signatureModal = document.getElementById('signatureModal');
  const previewModal = document.getElementById('previewModal');
  const settingsModal = document.getElementById('settingsModal');
  const historyModal = document.getElementById('historyModal');
  const gasCodeModal = document.getElementById('gasCodeModal');

  // Edit Mode Banner Elements
  const editModeBanner = document.getElementById('editModeBanner');
  const editFormNoText = document.getElementById('editFormNoText');
  const btnCancelEdit = document.getElementById('btnCancelEdit');

  // Initialize EMS Unit Field
  if (unitInput) {
    unitInput.value = formData.unit;
    unitInput.addEventListener('input', () => {
      formData.unit = unitInput.value.trim();
      localStorage.setItem('saved_ems_unit', formData.unit);
      validateFormStatus();
    });
  }

  // Initialize UI Values & Current Date/Time
  function initDateTime() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    dateInput.value = `${yyyy}-${mm}-${dd}`;
    timeInput.value = `${hh}:${min}`;
    
    updateDateTimeState();
  }

  function updateDateTimeState() {
    if (dateInput.value) {
      const parts = dateInput.value.split('-');
      formData.year = parts[0];
      formData.month = parts[1];
      formData.day = parts[2];
      formData.date = dateInput.value;
    }
    if (timeInput.value) {
      const parts = timeInput.value.split(':');
      formData.hour = parts[0];
      formData.minute = parts[1];
      formData.time = timeInput.value;
    }
    validateFormStatus();
  }

  btnSetNow.addEventListener('click', () => {
    initDateTime();
    showToast('已更新為最新時間！');
  });

  dateInput.addEventListener('change', updateDateTimeState);
  timeInput.addEventListener('change', updateDateTimeState);
  
  formNoInput.addEventListener('input', () => {
    formData.formNo = formNoInput.value.trim();
    validateFormStatus();
  });

  ageInput.addEventListener('input', () => {
    formData.age = ageInput.value.trim();
    validateFormStatus();
  });

  dosageInput.addEventListener('input', () => {
    formData.dosage = dosageInput.value.trim();
    validateFormStatus();
  });

  initDateTime();

  // 新增案件 (New Case) 按鈕事件處理：清空病患資料與雙方簽名，僅保留常駐單位
  if (btnNewCase) {
    btnNewCase.addEventListener('click', () => {
      if (editingRecordId || formData.formNo || formData.age) {
        if (!confirm('確定要建立新案件嗎？目前填寫的病患資料與簽名將被重置（但會保留您的常駐出勤單位）。')) {
          return;
        }
      }
      resetFormForNewCase();
    });
  }

  function resetFormForNewCase() {
    editingRecordId = null;
    if (editModeBanner) editModeBanner.style.display = 'none';

    // 重置病患相關欄位
    formData.formNo = '';
    formNoInput.value = '';

    formData.age = '';
    ageInput.value = '';

    formData.gender = '男';
    document.querySelectorAll('#genderGroup .btn-toggle-option').forEach(b => {
      b.classList.toggle('active', b.dataset.value === '男');
    });

    formData.conditions = ['VAS 疼痛指數≧6 分'];
    document.querySelectorAll('.condition-card').forEach(card => {
      const cb = card.querySelector('input[type="checkbox"]');
      cb.checked = cb.value === 'VAS 疼痛指數≧6 分';
      card.classList.toggle('selected', cb.checked);
    });

    formData.dosage = '0.5';
    dosageInput.value = '0.5';

    formData.route = 'IV';
    document.querySelectorAll('#routeGroup .btn-toggle-option').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'IV');
    });

    formData.vasPre = 8;
    formData.vasPost = 3;
    setupVasScale('vasPreContainer', formData.vasPre, (score) => { formData.vasPre = score; });
    setupVasScale('vasPostContainer', formData.vasPost, (score) => { formData.vasPost = score; });
    calculateVasDelta();

    formData.sideEffects = ['無任何副作用'];
    document.querySelectorAll('.side-effect-card').forEach(card => {
      const cb = card.querySelector('input[type="checkbox"]');
      cb.checked = cb.value === '無任何副作用';
      card.classList.toggle('selected', cb.checked);
    });
    sideEffectOtherInput.value = '';
    sideEffectOtherInput.style.display = 'none';

    formData.satisfaction = '非常滿意 (5 分)';
    document.querySelectorAll('.satisfaction-card').forEach(card => {
      card.classList.toggle('active', card.dataset.value === formData.satisfaction);
    });

    // 重置病患簽名與救護人員簽名 (不保留救護員簽名)
    formData.patientSignature = '';
    resetSignatureBoxUI('patientSigBox', '病患 / 家屬簽名', 'fa-pen-fancy');

    formData.emtSignature = '';
    resetSignatureBoxUI('emtSigBox', '救護人員簽名', 'fa-user-nurse');

    // 時間更新為現在
    initDateTime();

    validateFormStatus();
    showToast('已建立新案件 (已保留出勤單位，簽名已重置)', 'success');
  }

  // 性別 Toggle
  const genderOptions = document.querySelectorAll('#genderGroup .btn-toggle-option');
  genderOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      genderOptions.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formData.gender = btn.dataset.value;
      validateFormStatus();
    });
  });

  // 途徑 Toggle
  const routeOptions = document.querySelectorAll('#routeGroup .btn-toggle-option');
  routeOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      routeOptions.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formData.route = btn.dataset.value;
      validateFormStatus();
    });
  });

  // 適用條件 Cards
  const conditionCards = document.querySelectorAll('.condition-card');
  conditionCards.forEach(card => {
    const checkbox = card.querySelector('input[type="checkbox"]');
    card.addEventListener('click', (e) => {
      if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
      card.classList.toggle('selected', checkbox.checked);
      
      formData.conditions = Array.from(document.querySelectorAll('.condition-card input:checked'))
        .map(cb => cb.value);
      validateFormStatus();
    });
  });

  // VAS Pain Scale UI (0-10)
  function setupVasScale(containerId, initialScore, onScoreChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const scoreDisplay = container.querySelector('.vas-score-display');
    const buttonsContainer = container.querySelector('.vas-buttons');
    
    buttonsContainer.innerHTML = '';
    for (let i = 0; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `vas-btn ${i === initialScore ? 'active' : ''}`;
      btn.textContent = i;
      
      btn.addEventListener('click', () => {
        buttonsContainer.querySelectorAll('.vas-btn').forEach(b => {
          b.classList.remove('active');
          b.style.backgroundColor = ''; 
        });

        btn.classList.add('active');
        updateVasDisplay(scoreDisplay, i, btn);
        onScoreChange(i);
        calculateVasDelta();
        validateFormStatus();
      });
      
      if (i === initialScore) {
        updateVasDisplay(scoreDisplay, i, btn);
      }

      buttonsContainer.appendChild(btn);
    }
  }

  function updateVasDisplay(displayElem, score, activeBtn) {
    displayElem.textContent = `${score} 分`;
    let activeColor = 'var(--vas-mild)';
    if (score <= 3) {
      activeColor = 'var(--vas-mild)';
    } else if (score <= 6) {
      activeColor = 'var(--vas-moderate)';
    } else {
      activeColor = 'var(--vas-severe)';
    }

    displayElem.style.backgroundColor = activeColor;
    if (activeBtn) {
      activeBtn.style.backgroundColor = activeColor;
    }
  }

  function calculateVasDelta() {
    const deltaBadge = document.getElementById('vasDeltaBadge');
    if (!deltaBadge) return;
    
    const pre = formData.vasPre;
    const post = formData.vasPost;
    const diff = pre - post;

    if (diff > 0) {
      deltaBadge.style.backgroundColor = '#ECFDF5';
      deltaBadge.style.color = '#065F46';
      deltaBadge.style.borderColor = '#A7F3D0';
      deltaBadge.innerHTML = `<i class="fas fa-arrow-down"></i> 疼痛顯著減緩 ${diff} 分 (降低 ${Math.round((diff/pre)*100)}%)`;
    } else if (diff === 0) {
      deltaBadge.style.backgroundColor = '#FEF3C7';
      deltaBadge.style.color = '#92400E';
      deltaBadge.style.borderColor = '#FCD34D';
      deltaBadge.innerHTML = `<i class="fas fa-minus"></i> 疼痛指數無變化 (${pre} 分)`;
    } else {
      deltaBadge.style.backgroundColor = '#FEF2F2';
      deltaBadge.style.color = '#991B1B';
      deltaBadge.style.borderColor = '#FCA5A5';
      deltaBadge.innerHTML = `<i class="fas fa-arrow-up"></i> 疼痛指數增加 ${Math.abs(diff)} 分`;
    }
  }

  setupVasScale('vasPreContainer', formData.vasPre, (score) => { formData.vasPre = score; });
  setupVasScale('vasPostContainer', formData.vasPost, (score) => { formData.vasPost = score; });
  calculateVasDelta();

  // 副作用 Cards
  const sideEffectCards = document.querySelectorAll('.side-effect-card');
  sideEffectCards.forEach(card => {
    const checkbox = card.querySelector('input[type="checkbox"]');
    card.addEventListener('click', (e) => {
      if (e.target !== checkbox) checkbox.checked = !checkbox.checked;

      const isNone = checkbox.value === '無任何副作用';
      if (isNone && checkbox.checked) {
        sideEffectCards.forEach(other => {
          const otherCb = other.querySelector('input[type="checkbox"]');
          if (otherCb.value !== '無任何副作用') {
            otherCb.checked = false;
            other.classList.remove('selected');
          }
        });
      } else if (!isNone && checkbox.checked) {
        const noneCard = document.querySelector('.side-effect-card input[value="無任何副作用"]').parentElement;
        noneCard.querySelector('input').checked = false;
        noneCard.classList.remove('selected');
      }

      card.classList.toggle('selected', checkbox.checked);

      const otherCard = document.querySelector('.side-effect-card input[value="其他"]');
      if (otherCard && otherCard.checked) {
        sideEffectOtherInput.style.display = 'block';
      } else {
        sideEffectOtherInput.style.display = 'none';
      }

      formData.sideEffects = Array.from(document.querySelectorAll('.side-effect-card input:checked'))
        .map(cb => cb.value);
      validateFormStatus();
    });
  });

  // 滿意度 Cards
  const satisfactionCards = document.querySelectorAll('.satisfaction-card');
  satisfactionCards.forEach(card => {
    card.addEventListener('click', () => {
      satisfactionCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      formData.satisfaction = card.dataset.value;
      validateFormStatus();
    });
  });

  // Signature Canvas Engine
  const canvasElem = document.getElementById('signatureCanvas');
  activeSignaturePad = new TouchSignaturePad(canvasElem);

  window.openSignatureModal = function(type) {
    currentSigningType = type;
    const titleElem = document.getElementById('sigModalTitle');
    titleElem.textContent = type === 'patient' ? '病患 / 家屬手寫簽名' : '救護人員手寫簽名';
    
    signatureModal.classList.add('open');
    setTimeout(() => {
      activeSignaturePad.resize();
      const existing = type === 'patient' ? formData.patientSignature : formData.emtSignature;
      if (existing) {
        activeSignaturePad.fromDataURL(existing);
      } else {
        activeSignaturePad.clear();
      }
    }, 150);
  };

  document.getElementById('patientSigBox').addEventListener('click', (e) => {
    if (!e.target.closest('.btn-clear-sig')) openSignatureModal('patient');
  });
  document.getElementById('emtSigBox').addEventListener('click', (e) => {
    if (!e.target.closest('.btn-clear-sig')) openSignatureModal('emt');
  });

  // Signature Clear / Delete Handlers (復原空白)
  document.getElementById('btnDeletePatientSig').addEventListener('click', (e) => {
    e.stopPropagation();
    formData.patientSignature = '';
    resetSignatureBoxUI('patientSigBox', '病患 / 家屬簽名', 'fa-pen-fancy');
    validateFormStatus();
    showToast('病患簽名已重置為空白');
  });

  document.getElementById('btnDeleteEmtSig').addEventListener('click', (e) => {
    e.stopPropagation();
    formData.emtSignature = '';
    resetSignatureBoxUI('emtSigBox', '救護人員簽名', 'fa-user-nurse');
    validateFormStatus();
    showToast('救護人員簽名已重置為空白');
  });

  function resetSignatureBoxUI(boxId, title, iconClass) {
    const box = document.getElementById(boxId);
    box.classList.remove('has-signature');
    box.innerHTML = `
      <div class="signature-prompt">
        <i class="fas ${iconClass}" style="color:var(--teal-main);"></i>
        <span>點擊此處用手指簽名</span>
      </div>
    `;
  }

  document.getElementById('btnSigClear').addEventListener('click', () => activeSignaturePad.clear());
  document.getElementById('btnSigUndo').addEventListener('click', () => activeSignaturePad.undo());

  // Confirm Signature Button Handler
  document.getElementById('btnSigSave').addEventListener('click', () => {
    const isPadEmpty = activeSignaturePad.isEmpty();
    
    if (isPadEmpty) {
      if (currentSigningType === 'patient') {
        formData.patientSignature = '';
        resetSignatureBoxUI('patientSigBox', '病患 / 家屬簽名', 'fa-pen-fancy');
      } else {
        formData.emtSignature = '';
        resetSignatureBoxUI('emtSigBox', '救護人員簽名', 'fa-user-nurse');
      }
      showToast('已確認並恢復為空白簽名狀態');
    } else {
      const sigDataUrl = activeSignaturePad.toDataURL();
      if (currentSigningType === 'patient') {
        formData.patientSignature = sigDataUrl;
        updateSignatureBoxUI('patientSigBox', sigDataUrl);
      } else {
        formData.emtSignature = sigDataUrl;
        updateSignatureBoxUI('emtSigBox', sigDataUrl);
      }
      showToast('簽名已完成儲存！');
    }

    signatureModal.classList.remove('open');
    validateFormStatus();
  });

  function updateSignatureBoxUI(boxId, dataUrl) {
    const box = document.getElementById(boxId);
    box.classList.add('has-signature');
    box.innerHTML = `
      <span class="re-sign-badge"><i class="fas fa-edit"></i> 點擊重簽</span>
      <img src="${dataUrl}" class="signature-preview-img" alt="簽名預覽" />
    `;
  }

  // Section Validation Status Badges
  function setSectionBadge(cardId, badgeId, isValid, label = '') {
    const card = document.getElementById(cardId);
    const badge = document.getElementById(badgeId);
    if (!badge || !card) return;

    if (isValid) {
      card.classList.remove('is-invalid');
      card.classList.add('is-valid');
      badge.className = 'section-status-badge valid';
      badge.innerHTML = `<i class="fas fa-check-circle"></i> ${label || '完成'}`;
    } else {
      card.classList.remove('is-valid');
      card.classList.add('is-invalid');
      badge.className = 'section-status-badge invalid';
      badge.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${label || '未完成'}`;
    }
  }

  function validateFormStatus() {
    const sec1Valid = !!(formData.unit && formData.date && formData.time && formData.formNo);
    const sec2Valid = !!(formData.gender && formData.age);
    const sec3Valid = formData.conditions && formData.conditions.length > 0;
    const sec4Valid = !!(formData.dosage && formData.route);
    const sec5Valid = formData.vasPre !== undefined && formData.vasPost !== undefined;
    const sec6Valid = formData.sideEffects && formData.sideEffects.length > 0;
    const sec7Valid = !!formData.satisfaction;
    const sec8Valid = !!(formData.patientSignature && formData.emtSignature);

    setSectionBadge('cardSec1', 'statusBadgeSec1', sec1Valid, sec1Valid ? '完成' : '必填');
    setSectionBadge('cardSec2', 'statusBadgeSec2', sec2Valid, sec2Valid ? '完成' : '必填');
    setSectionBadge('cardSec3', 'statusBadgeSec3', sec3Valid, sec3Valid ? '完成' : '必填');
    setSectionBadge('cardSec4', 'statusBadgeSec4', sec4Valid, sec4Valid ? '完成' : '必填');
    setSectionBadge('cardSec5', 'statusBadgeSec5', sec5Valid, sec5Valid ? '完成' : '完成');
    setSectionBadge('cardSec6', 'statusBadgeSec6', sec6Valid, sec6Valid ? '完成' : '必填');
    setSectionBadge('cardSec7', 'statusBadgeSec7', sec7Valid, sec7Valid ? '完成' : '完成');

    let sigBadgeLabel = '簽名完成';
    if (!formData.patientSignature && !formData.emtSignature) {
      sigBadgeLabel = '簽名未完成 (雙方未簽)';
    } else if (!formData.patientSignature) {
      sigBadgeLabel = '簽名未完成 (缺病患簽名)';
    } else if (!formData.emtSignature) {
      sigBadgeLabel = '簽名未完成 (缺救護簽名)';
    }
    setSectionBadge('cardSec8', 'statusBadgeSec8', sec8Valid, sigBadgeLabel);

    const allValid = sec1Valid && sec2Valid && sec3Valid && sec4Valid && sec5Valid && sec6Valid && sec7Valid && sec8Valid;
    const btnPreview = document.getElementById('btnTriggerPreview');
    if (btnPreview) {
      btnPreview.disabled = !allValid;
      if (allValid) {
        btnPreview.innerHTML = editingRecordId ? `<i class="fas fa-sync-alt"></i> 預覽修改內容並覆蓋上傳` : `<i class="fas fa-eye"></i> 預覽表單並確認送出`;
      } else {
        btnPreview.innerHTML = `<i class="fas fa-lock"></i> 請完成必填欄位與手寫簽名`;
      }
    }
  }

  // Initial validation check
  validateFormStatus();

  // Close Modals
  document.querySelectorAll('.btn-close-modal, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      signatureModal.classList.remove('open');
      previewModal.classList.remove('open');
      settingsModal.classList.remove('open');
      historyModal.classList.remove('open');
      gasCodeModal.classList.remove('open');
    });
  });

  // Settings & GAS Modal Handlers
  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('gasUrlInput').value = syncManager.getGasUrl();
    settingsModal.classList.add('open');
  });

  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    const url = document.getElementById('gasUrlInput').value;
    syncManager.setGasUrl(url);
    settingsModal.classList.remove('open');
    showToast('Google 雲端設定已儲存！');
  });

  document.getElementById('btnViewGasCode').addEventListener('click', () => {
    settingsModal.classList.remove('open');
    gasCodeModal.classList.add('open');
  });

  document.getElementById('btnCopyGasCode').addEventListener('click', () => {
    const code = document.getElementById('gasCodeTextarea').value;
    navigator.clipboard.writeText(code).then(() => {
      showToast('已複製 GAS 後端腳本程式碼！');
    });
  });

  // History Records Render with Delete Option
  document.getElementById('btnHistory').addEventListener('click', () => {
    renderHistoryTable();
    historyModal.classList.add('open');
  });

  function renderHistoryTable() {
    const records = syncManager.getLocalRecords();
    const container = document.getElementById('historyListContainer');
    if (records.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:#888; padding:20px;">尚無出勤評估紀錄</p>`;
      return;
    }

    const hasPending = records.some(r => r.status === 'pending');

    container.innerHTML = `
      ${hasPending ? `
        <div style="margin-bottom:12px; padding:12px; background:#FEF3C7; border:1px solid #FCD34D; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; color:#92400E; font-weight:600;"><i class="fas fa-exclamation-triangle"></i> 尚有離線紀錄等待傳輸至 Google 雲端</span>
          <button type="button" id="btnSyncAllPending" class="btn-inline" style="height:32px; padding:0 12px; font-size:12px; background:#D97706;">
            <i class="fas fa-sync-alt"></i> 一鍵同步補傳
          </button>
        </div>
      ` : ''}
      ${records.map(r => `
        <div style="border:1.5px solid #E2E8F0; padding:16px; border-radius:14px; margin-bottom:14px; background:#FFF; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <span style="font-size:12px; padding:2px 8px; border-radius:6px; background:#E0F2FE; color:#0369A1; font-weight:700; margin-right:6px;">
                ${r.data.unit || '光明91'}
              </span>
              <strong style="font-size:16px; color:var(--teal-dark);">單號：${r.data.formNo || '無單號'}</strong>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; padding:3px 10px; border-radius:12px; font-weight:700; ${r.status === 'synced' ? 'background:#D1FAE5; color:#065F46;' : 'background:#FEF3C7; color:#92400E;'}">
                ${r.status === 'synced' ? '已同步雲端' : '離線暫存'}
              </span>
              <button type="button" class="btn-inline btn-edit-record" data-id="${r.id}" style="height:32px; padding:0 12px; font-size:13px; background:var(--teal-dark);" title="修改內容">
                <i class="fas fa-edit"></i> 修改
              </button>
              <button type="button" class="btn-inline btn-delete-record" data-id="${r.id}" style="height:32px; padding:0 12px; font-size:13px; background:#EF4444;" title="刪除此筆紀錄">
                <i class="fas fa-trash-alt"></i> 刪除
              </button>
            </div>
          </div>
          <div style="font-size:13px; color:#64748B; margin-top:8px; line-height:1.6;">
            時間：${r.timestamp} ｜ 性別：${r.data.gender} ｜ 年齡：${r.data.age || '未填'}歲 ｜ 給藥前/後 VAS：${r.data.vasPre} ➔ ${r.data.vasPost}
          </div>
          ${r.driveUrl ? `<a href="${r.driveUrl}" target="_blank" style="font-size:13px; color:#0284C7; margin-top:8px; display:inline-block; font-weight:600;"><i class="fas fa-external-link-alt"></i> 開啟 Google Drive PDF</a>` : ''}
        </div>
      `).join('')}
    `;

    const btnSyncAll = document.getElementById('btnSyncAllPending');
    if (btnSyncAll) {
      btnSyncAll.addEventListener('click', async () => {
        btnSyncAll.disabled = true;
        btnSyncAll.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 上傳中...`;
        showToast('正在嘗試補傳離線紀錄至 Google 雲端...');
        await syncManager.syncPendingRecords();
        renderHistoryTable();
        showToast('補傳完成！請檢查雲端連結');
      });
    }

    container.querySelectorAll('.btn-edit-record').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        loadRecordForEditing(id);
      });
    });

    // 刪除按鈕處理
    container.querySelectorAll('.btn-delete-record').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('確定要刪除這筆救護紀錄嗎？此動作將從本地暫存中移除。')) {
          syncManager.deleteLocalRecord(id);
          renderHistoryTable();
          showToast('紀錄已成功刪除');
        }
      });
    });
  }

  function loadRecordForEditing(recordId) {
    const records = syncManager.getLocalRecords();
    const target = records.find(r => r.id === recordId);
    if (!target) return;

    const data = target.data;
    editingRecordId = recordId;

    if (data.unit) {
      formData.unit = data.unit;
      if (unitInput) unitInput.value = data.unit;
    }

    if (data.date) dateInput.value = data.date;
    if (data.time) timeInput.value = data.time;
    updateDateTimeState();

    formNoInput.value = data.formNo || '';
    formData.formNo = data.formNo || '';

    ageInput.value = data.age || '';
    formData.age = data.age || '';

    dosageInput.value = data.dosage || '0.5';
    formData.dosage = data.dosage || '0.5';

    formData.gender = data.gender || '男';
    document.querySelectorAll('#genderGroup .btn-toggle-option').forEach(b => {
      b.classList.toggle('active', b.dataset.value === formData.gender);
    });

    formData.route = data.route || 'IV';
    document.querySelectorAll('#routeGroup .btn-toggle-option').forEach(b => {
      b.classList.toggle('active', b.dataset.value === formData.route);
    });

    formData.conditions = data.conditions || [];
    document.querySelectorAll('.condition-card').forEach(card => {
      const cb = card.querySelector('input[type="checkbox"]');
      cb.checked = formData.conditions.includes(cb.value);
      card.classList.toggle('selected', cb.checked);
    });

    formData.vasPre = data.vasPre !== undefined ? data.vasPre : 8;
    formData.vasPost = data.vasPost !== undefined ? data.vasPost : 3;
    setupVasScale('vasPreContainer', formData.vasPre, (score) => { formData.vasPre = score; });
    setupVasScale('vasPostContainer', formData.vasPost, (score) => { formData.vasPost = score; });
    calculateVasDelta();

    formData.sideEffects = data.sideEffects || [];
    document.querySelectorAll('.side-effect-card').forEach(card => {
      const cb = card.querySelector('input[type="checkbox"]');
      cb.checked = formData.sideEffects.includes(cb.value);
      card.classList.toggle('selected', cb.checked);
    });
    if (data.sideEffectOther) {
      sideEffectOtherInput.value = data.sideEffectOther;
      sideEffectOtherInput.style.display = 'block';
    }

    formData.satisfaction = data.satisfaction || '非常滿意 (5 分)';
    document.querySelectorAll('.satisfaction-card').forEach(card => {
      card.classList.toggle('active', card.dataset.value === formData.satisfaction);
    });

    if (data.patientSignature) {
      formData.patientSignature = data.patientSignature;
      updateSignatureBoxUI('patientSigBox', data.patientSignature);
    } else {
      resetSignatureBoxUI('patientSigBox', '病患 / 家屬簽名', 'fa-pen-fancy');
    }

    if (data.emtSignature) {
      formData.emtSignature = data.emtSignature;
      updateSignatureBoxUI('emtSigBox', data.emtSignature);
    } else {
      resetSignatureBoxUI('emtSigBox', '救護人員簽名', 'fa-user-nurse');
    }

    editFormNoText.textContent = data.formNo || '無單號';
    editModeBanner.style.display = 'flex';

    historyModal.classList.remove('open');
    validateFormStatus();

    showToast(`已載入單號 [${data.formNo || '無號'}] 進行修改！完成後送出即可覆蓋更新`, 'success');
  }

  btnCancelEdit.addEventListener('click', () => {
    editingRecordId = null;
    editModeBanner.style.display = 'none';
    showToast('已取消修改模式，恢復為新表單填寫');
    validateFormStatus();
  });

  // Pre-submission Preview Trigger
  document.getElementById('btnTriggerPreview').addEventListener('click', () => {
    formData.unit = unitInput ? unitInput.value.trim() : (localStorage.getItem('saved_ems_unit') || '光明91');
    formData.formNo = formNoInput.value.trim();
    formData.age = ageInput.value.trim();
    formData.dosage = dosageInput.value.trim() || '0.5';
    formData.sideEffectOther = sideEffectOtherInput.value.trim();

    if (!formData.unit) {
      showToast('請填寫出勤單位！', 'warning');
      if (unitInput) unitInput.focus();
      return;
    }

    if (!formData.formNo) {
      showToast('請填寫救護紀錄表單號！', 'warning');
      formNoInput.focus();
      return;
    }

    if (!formData.patientSignature) {
      showToast('請完成「病患簽名」！', 'warning');
      openSignatureModal('patient');
      return;
    }

    if (!formData.emtSignature) {
      showToast('請完成「救護人員簽名」！', 'warning');
      openSignatureModal('emt');
      return;
    }

    const previewContainer = document.getElementById('previewFormContainer');
    previewContainer.innerHTML = NalbuphinePdfGenerator.generateHTML(formData);

    const btnConfirm = document.getElementById('btnConfirmFinalSubmit');
    if (btnConfirm) {
      btnConfirm.innerHTML = editingRecordId ? `<i class="fas fa-sync-alt"></i> 確認修改，覆蓋更新雲端與離線` : `<i class="fas fa-cloud-upload-alt"></i> 確認無誤，儲存並傳至雲端`;
    }

    previewModal.classList.add('open');
  });

  // Final Submit Handler inside Preview Modal
  document.getElementById('btnConfirmFinalSubmit').addEventListener('click', async () => {
    const submitBtn = document.getElementById('btnConfirmFinalSubmit');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 傳輸覆蓋中...`;

    try {
      showToast('正在生成電子評估表 PDF...');
      
      // Direct on-screen rendered form element capture
      const previewContainer = document.getElementById('previewFormContainer');
      const targetElem = previewContainer.querySelector('#pdf-export-container') || previewContainer;
      
      const pdfBase64 = await NalbuphinePdfGenerator.getPdfBase64(formData, targetElem);

      const isUpdate = !!editingRecordId;
      const result = await syncManager.submitRecord(formData, pdfBase64, isUpdate, editingRecordId);

      previewModal.classList.remove('open');

      if (result.success) {
        showToast(isUpdate ? '🎉 已成功覆蓋更新雲端與離線紀錄！' : (result.mode === 'cloud' ? '🎉 已成功上傳歸檔至 Google 雲端資料夾！' : result.message));
        
        editingRecordId = null;
        if (editModeBanner) editModeBanner.style.display = 'none';

        await NalbuphinePdfGenerator.downloadPdf(formData);
      }
    } catch (err) {
      console.error('Submission error:', err);
      showToast('儲存過程中發生錯誤：' + err.message, 'warning');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  // Toast Notification
  function showToast(msg, type = 'success') {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotification';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #0F172A;
        color: #FFF;
        padding: 12px 24px;
        border-radius: 30px;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.25);
        z-index: 1000;
        transition: all 0.3s ease;
        opacity: 0;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = msg;
    toast.style.backgroundColor = type === 'warning' ? '#E11D48' : '#0F172A';
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.opacity = '0';
    }, 3200);
  }
});
