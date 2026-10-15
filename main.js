/**
 * Nalbuphine 止痛評估電子化系統 - 主應用程式邏輯 (EMS Main Logic)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Managers
  const syncManager = new GoogleSyncManager();
  
  // State
  let editingRecordId = null; // null for new entry, string ID when editing
  let confirmedAgeValue = null; // 紀錄已確認過的特殊年齡

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
    dosage: '5',
    route: 'IV',
    repeatDose: '否',
    repeatDoseRemark: '',
    vasPre: 8,
    vasPost: 3,
    sideEffects: ['無任何副作用'],
    sideEffectOther: '',
    satisfaction: '非常滿意 (5 分)',
    patientSignature: '',
    patientUnableToSign: false,
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
  const repeatDoseOptions = document.querySelectorAll('#repeatDoseGroup .btn-toggle-option');
  const repeatDoseRemarkContainer = document.getElementById('repeatDoseRemarkContainer');
  const inputRepeatDoseRemark = document.getElementById('inputRepeatDoseRemark');
  const sideEffectOtherInput = document.getElementById('inputSideEffectOther');
  const btnNewCase = document.getElementById('btnNewCase');
  const chkPatientUnableToSign = document.getElementById('chkPatientUnableToSign');
  const lblUnableSign = document.getElementById('lblUnableSign');
  
  // Modals
  const signatureModal = document.getElementById('signatureModal');
  const previewModal = document.getElementById('previewModal');
  const settingsModal = document.getElementById('settingsModal');
  const historyModal = document.getElementById('historyModal');
  const gasCodeModal = document.getElementById('gasCodeModal');
  const warningConfirmModal = document.getElementById('warningConfirmModal');

  // 通用美化提醒確認視窗 (支援 Promise)
  function showConfirmDialog({ title, message, confirmText = '確認繼續', cancelText = '取消' }) {
    return new Promise((resolve) => {
      if (!warningConfirmModal) {
        // Fallback to window.confirm if modal not present
        const result = window.confirm(`${title}\n\n${message.replace(/<[^>]+>/g, '')}`);
        resolve(result);
        return;
      }

      const titleEl = document.getElementById('warningModalTitle');
      const msgEl = document.getElementById('warningModalMsg');
      const btnConfirm = document.getElementById('btnWarningConfirm');
      const btnCancel = document.getElementById('btnWarningCancel');

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.innerHTML = message;
      if (btnConfirm) btnConfirm.textContent = confirmText;
      if (btnCancel) btnCancel.textContent = cancelText;

      const cleanup = () => {
        warningConfirmModal.classList.remove('open');
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);

      warningConfirmModal.classList.add('open');
    });
  }

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

  // 年齡輸入限制：只能是大於 0 的整數
  ageInput.addEventListener('input', () => {
    let val = ageInput.value.replace(/[^\d]/g, '');
    if (val.length > 1 && val.startsWith('0')) {
      val = parseInt(val, 10).toString();
    }
    ageInput.value = val;
    formData.age = val;
    validateFormStatus();
  });

  async function checkAgeWarning(isSubmitting = false) {
    const rawVal = ageInput.value.trim();
    if (!rawVal) return true;
    const ageNum = parseInt(rawVal, 10);
    if (isNaN(ageNum) || ageNum <= 0) {
      showToast('年齡只能是大於 0 的整數！', 'warning');
      ageInput.focus();
      return false;
    }
    if ((ageNum < 18 || ageNum >= 100) && confirmedAgeValue !== ageNum) {
      const isChild = ageNum < 18;
      const confirmed = await showConfirmDialog({
        title: '⚠️ 病患年齡確認提醒',
        message: `目前填寫之病患年齡為 <strong>${ageNum} 歲</strong>（${isChild ? '小於 18 歲' : '大於或等於 100 歲'}）。<br/><br/>依臨床規範請確認年齡無誤，確認後仍可正常儲存與上傳。請問確認年齡正確並繼續嗎？`,
        confirmText: '確認正確',
        cancelText: '重新修改'
      });
      if (confirmed) {
        confirmedAgeValue = ageNum;
        return true;
      } else {
        if (!isSubmitting) ageInput.focus();
        return false;
      }
    }
    return true;
  }

  ageInput.addEventListener('blur', () => {
    checkAgeWarning(false);
  });

  // ==========================================
  // 新竹縣 Nalbuphine 藥品規格與劑量防呆換算系統
  // 規格：1 安瓿 = 1 ml = 10 mg (10 mg/ml)
  // 常規指引：IM 3~5 mg (0.3~0.5 ml) | IV 5 mg (0.5 ml)
  // ==========================================
  const toggleAutoCorrectDose = document.getElementById('toggleAutoCorrectDose');
  const modalToggleAutoCorrectDose = document.getElementById('modalToggleAutoCorrectDose');
  const dosageVolumeEq = document.getElementById('dosageVolumeEq');
  const dosageCorrectionBadge = document.getElementById('dosageCorrectionBadge');
  const dosageCorrectionMsg = document.getElementById('dosageCorrectionMsg');
  const doseChips = document.querySelectorAll('.btn-dose-chip');

  function isAutoDoseCorrectEnabled() {
    const val = localStorage.getItem('nalbuphine_auto_correct_dose');
    return val === null ? true : val === 'true';
  }

  function setAutoDoseCorrectEnabled(enabled) {
    localStorage.setItem('nalbuphine_auto_correct_dose', enabled ? 'true' : 'false');
    if (toggleAutoCorrectDose) toggleAutoCorrectDose.checked = enabled;
    if (modalToggleAutoCorrectDose) modalToggleAutoCorrectDose.checked = enabled;
  }

  if (toggleAutoCorrectDose) {
    toggleAutoCorrectDose.checked = isAutoDoseCorrectEnabled();
    toggleAutoCorrectDose.addEventListener('change', () => {
      setAutoDoseCorrectEnabled(toggleAutoCorrectDose.checked);
      handleDosageCorrection(true);
    });
  }

  if (modalToggleAutoCorrectDose) {
    modalToggleAutoCorrectDose.checked = isAutoDoseCorrectEnabled();
    modalToggleAutoCorrectDose.addEventListener('change', () => {
      setAutoDoseCorrectEnabled(modalToggleAutoCorrectDose.checked);
      handleDosageCorrection(true);
    });
  }

  function cleanAndCorrectNalbuphineDosage(rawInput, routeHint) {
    if (rawInput === undefined || rawInput === null || String(rawInput).trim() === '') {
      return { dose: '5', note: null, volumeMl: '0.5' };
    }

    const raw = String(rawInput).trim();
    const isAutoCorrect = isAutoDoseCorrectEnabled();

    // 若使用者關閉防呆，則僅提取數字
    if (!isAutoCorrect) {
      const match = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
      const dose = match ? match[1] : '5';
      const vol = (parseFloat(dose) / 10).toFixed(1).replace(/\.0$/, '');
      return { dose, note: null, volumeMl: vol };
    }

    const lower = raw.toLowerCase();

    // 1. 中文安瓿俗名支援 (半支、半安瓿、整支、一支)
    if (/(?:半支|半安瓿|半管|0\.5支)/.test(lower)) {
      return { dose: '5', note: '「半安瓿 (0.5ml)」已自動換算為 5mg', volumeMl: '0.5' };
    }
    if (/(?:整支|整管|1支|一支|1安瓿)/.test(lower)) {
      return { dose: '10', note: '「1安瓿 (1.0ml)」已換算為 10mg', volumeMl: '1.0' };
    }

    // 2. 明確標示 ml 或 c.c. 單位換算與筆誤防呆 (例如 0.5ml, 5ml, 0.3ml)
    const mMl = lower.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:ml|c\.?c\.?)/);
    if (mMl) {
      const v = parseFloat(mMl[1]);
      // 筆誤防呆：新竹縣 1 安瓿僅 1ml，若打成 5ml 相當於 50mg (5支)，顯係筆誤打成 5mg (0.5ml)
      if (v === 5.0) {
        return { dose: '5', note: '筆誤「5ml」已自動校正為 5mg (相當於 0.5ml)', volumeMl: '0.5' };
      }
      if (v === 3.0) {
        return { dose: '3', note: '筆誤「3ml」已自動校正為 3mg (相當於 0.3ml)', volumeMl: '0.3' };
      }
      if (v === 4.0) {
        return { dose: '4', note: '筆誤「4ml」已自動校正為 4mg (相當於 0.4ml)', volumeMl: '0.4' };
      }
      if (v === 10.0) {
        return { dose: '10', note: '筆誤「10ml」已自動校正為 10mg (1安瓿 1.0ml)', volumeMl: '1.0' };
      }

      // 標準 ml 換算為 mg (x 10)
      const mgVal = Math.round(v * 10 * 10) / 10;
      const doseStr = Number.isInteger(mgVal) ? String(mgVal) : String(mgVal);
      const volStr = v.toFixed(1).replace(/\.0$/, '');
      return { 
        dose: doseStr, 
        note: `「${mMl[1]}ml」已依新竹縣規格 (10mg/ml) 自動換算為 ${doseStr}mg`, 
        volumeMl: volStr 
      };
    }

    // 3. 明確標示 mg 單位筆誤防呆 (例如 0.5mg 實為 0.5ml = 5mg)
    const mMg = lower.match(/([0-9]+(?:\.[0-9]+)?)\s*mg/);
    if (mMg) {
      const v = parseFloat(mMg[1]);
      // 筆誤防呆：0.5mg 僅 0.05ml，無止痛療效，顯為 0.5ml (5mg) 之筆誤
      if (v === 0.5) {
        return { dose: '5', note: '筆誤「0.5mg」已自動校正為 5mg (相當於 0.5ml)', volumeMl: '0.5' };
      }
      if (v === 0.3) {
        return { dose: '3', note: '筆誤「0.3mg」已自動校正為 3mg (相當於 0.3ml)', volumeMl: '0.3' };
      }
      if (v === 0.4) {
        return { dose: '4', note: '筆誤「0.4mg」已自動校正為 4mg (相當於 0.4ml)', volumeMl: '0.4' };
      }
      if (v < 1.0 && v > 0) {
        const mgVal = Math.round(v * 10 * 10) / 10;
        const doseStr = Number.isInteger(mgVal) ? String(mgVal) : String(mgVal);
        return { 
          dose: doseStr, 
          note: `筆誤「${mMg[1]}mg」已自動校正為 ${doseStr}mg (相當於 ${v}ml)`, 
          volumeMl: String(v) 
        };
      }
      const doseStr = Number.isInteger(v) ? String(v) : String(v);
      const volStr = (v / 10).toFixed(1).replace(/\.0$/, '');
      return { dose: doseStr, note: null, volumeMl: volStr };
    }

    // 4. 純數字輸入（無單位）
    const mNum = lower.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (mNum) {
      const v = parseFloat(mNum[1]);
      // 小數（例如 0.5、0.3、0.4）：臨床上輸入小數必為 ml，自動換算為 mg
      if (v < 1.0 && v > 0) {
        const mgVal = Math.round(v * 10 * 10) / 10;
        const doseStr = Number.isInteger(mgVal) ? String(mgVal) : String(mgVal);
        return { 
          dose: doseStr, 
          note: `數值「${mNum[1]}」依體積(ml)自動換算為 ${doseStr}mg`, 
          volumeMl: String(v) 
        };
      }

      // 整數（例如 3, 4, 5, 10）
      const doseStr = Number.isInteger(v) ? String(v) : String(v);
      const volStr = (v / 10).toFixed(1).replace(/\.0$/, '');
      return { dose: doseStr, note: null, volumeMl: volStr };
    }

    return { dose: '5', note: null, volumeMl: '0.5' };
  }

  function updateDoseChipsActive() {
    doseChips.forEach(chip => {
      const cDose = chip.dataset.dose;
      const cRoute = chip.dataset.route;
      const isMatch = (cDose === formData.dosage && cRoute === formData.route);
      chip.classList.toggle('active', isMatch);
    });
  }

  function handleDosageCorrection(showToastIfCorrected = false) {
    const raw = dosageInput.value.trim();
    if (!raw) return;
    const res = cleanAndCorrectNalbuphineDosage(raw, formData.route);
    dosageInput.value = res.dose;
    formData.dosage = res.dose;

    if (dosageVolumeEq) {
      dosageVolumeEq.textContent = `＝ ${res.volumeMl} ml`;
    }

    if (res.note && dosageCorrectionBadge && dosageCorrectionMsg) {
      dosageCorrectionMsg.textContent = res.note;
      dosageCorrectionBadge.style.display = 'inline-flex';
      if (showToastIfCorrected) {
        showToast(`💡 ${res.note}`, 'info');
      }
    } else if (dosageCorrectionBadge) {
      dosageCorrectionBadge.style.display = 'none';
    }

    updateDoseChipsActive();
    validateFormStatus();
  }

  // 初始給藥劑量設定：預設 5mg
  dosageInput.value = '5';
  formData.dosage = '5';
  updateDoseChipsActive();

  dosageInput.addEventListener('input', () => {
    // 輸入過程中即時更新體積預覽
    const raw = dosageInput.value.trim();
    const m = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (m && dosageVolumeEq) {
      const v = parseFloat(m[1]);
      if (v < 1.0) {
        dosageVolumeEq.textContent = `＝ ${v} ml (換算 ${Math.round(v * 10)}mg)`;
      } else {
        dosageVolumeEq.textContent = `＝ ${(v / 10).toFixed(1).replace(/\.0$/, '')} ml`;
      }
    }
  });

  dosageInput.addEventListener('blur', () => {
    handleDosageCorrection(true);
  });

  dosageInput.addEventListener('change', () => {
    handleDosageCorrection(true);
  });

  dosageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dosageInput.blur();
    }
  });

  // 常用劑量膠囊按鈕 (Quick Dose Chips) 點擊事件
  doseChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const targetDose = chip.dataset.dose;
      const targetRoute = chip.dataset.route;

      // 切換途徑
      formData.route = targetRoute;
      document.querySelectorAll('#routeGroup .btn-toggle-option').forEach(b => {
        b.classList.toggle('active', b.dataset.value === targetRoute);
      });

      // 設定劑量
      dosageInput.value = targetDose;
      formData.dosage = targetDose;
      if (dosageVolumeEq) {
        dosageVolumeEq.textContent = `＝ ${(parseFloat(targetDose) / 10).toFixed(1).replace(/\.0$/, '')} ml`;
      }
      if (dosageCorrectionBadge) {
        dosageCorrectionBadge.style.display = 'none';
      }

      updateDoseChipsActive();
      playBeepSound();
      validateFormStatus();
    });
  });

  // 重複給藥 Toggle 事件
  repeatDoseOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      repeatDoseOptions.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formData.repeatDose = btn.dataset.value;

      if (formData.repeatDose === '是') {
        if (repeatDoseRemarkContainer) repeatDoseRemarkContainer.style.display = 'block';
        if (inputRepeatDoseRemark) inputRepeatDoseRemark.focus();
      } else {
        if (repeatDoseRemarkContainer) repeatDoseRemarkContainer.style.display = 'none';
        if (inputRepeatDoseRemark) inputRepeatDoseRemark.value = '';
        formData.repeatDoseRemark = '';
      }
      validateFormStatus();
    });
  });

  if (inputRepeatDoseRemark) {
    inputRepeatDoseRemark.addEventListener('input', () => {
      formData.repeatDoseRemark = inputRepeatDoseRemark.value.trim();
      validateFormStatus();
    });
  }

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
    confirmedAgeValue = null;
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

    formData.dosage = '5';
    dosageInput.value = '5';
    if (dosageVolumeEq) dosageVolumeEq.textContent = '＝ 0.5 ml';
    if (dosageCorrectionBadge) dosageCorrectionBadge.style.display = 'none';

    formData.route = 'IV';
    document.querySelectorAll('#routeGroup .btn-toggle-option').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'IV');
    });
    updateDoseChipsActive();

    formData.repeatDose = '否';
    formData.repeatDoseRemark = '';
    repeatDoseOptions.forEach(b => {
      b.classList.toggle('active', b.dataset.value === '否');
    });
    if (repeatDoseRemarkContainer) repeatDoseRemarkContainer.style.display = 'none';
    if (inputRepeatDoseRemark) inputRepeatDoseRemark.value = '';

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

    // 重置病患簽名與救護人員簽名 (每次皆需手動簽名，不自動帶入)
    formData.patientSignature = '';
    formData.patientUnableToSign = false;
    if (chkPatientUnableToSign) chkPatientUnableToSign.checked = false;
    if (lblUnableSign) lblUnableSign.classList.remove('checked');
    const patientBoxEl = document.getElementById('patientSigBox');
    if (patientBoxEl) patientBoxEl.classList.remove('unable-to-sign');
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

      // 新竹縣指引連動：IV 常規為 5mg，若先前為 3 或 4mg 則智慧建議為 5mg
      if (formData.route === 'IV' && (formData.dosage === '3' || formData.dosage === '4')) {
        formData.dosage = '5';
        dosageInput.value = '5';
        if (dosageVolumeEq) dosageVolumeEq.textContent = '＝ 0.5 ml';
        if (dosageCorrectionBadge && dosageCorrectionMsg) {
          dosageCorrectionMsg.textContent = '常規靜脈注射 (IV) 標準劑量為 5mg (0.5ml)';
          dosageCorrectionBadge.style.display = 'inline-flex';
        }
      }

      updateDoseChipsActive();
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
    const isPreVas = containerId === 'vasPreContainer';
    
    buttonsContainer.innerHTML = '';
    for (let i = 0; i <= 10; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `vas-btn ${i === initialScore ? 'active' : ''}`;
      btn.textContent = i;
      
      btn.addEventListener('click', async () => {
        // 給藥前 VAS 若主動選擇小於 6 分，跳提醒確認視窗
        if (isPreVas && i < 6 && formData.vasPre !== i) {
          const confirmed = await showConfirmDialog({
            title: '⚠️ 給藥前 VAS 疼痛指數提醒',
            message: `依 Nalbuphine 適應條件標準，給藥前 VAS 疼痛指數建議 <strong>≧ 6 分</strong>。<br/><br/>您目前主動選擇為 <strong>${i} 分</strong>，確定要設定此分數嗎？<br/><span style="color:#0D9488; font-size:12px;">（確認後仍可繼續評估並正常儲存上傳）</span>`,
            confirmText: '確定選擇',
            cancelText: '取消'
          });
          if (!confirmed) {
            return; // 使用者按取消，維持原分數
          }
        }

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
    
    // 立刻清空繪圖板，防止殘留上一個對象的簽名軌跡
    if (activeSignaturePad) activeSignaturePad.clear();

    signatureModal.classList.add('open');
    setTimeout(() => {
      activeSignaturePad.resize();
      activeSignaturePad.clear();
      const existing = type === 'patient' ? formData.patientSignature : formData.emtSignature;
      if (existing) {
        activeSignaturePad.fromDataURL(existing);
      }
    }, 150);
  };

  function updatePatientUnableToSignUI() {
    const box = document.getElementById('patientSigBox');
    if (!box) return;
    if (formData.patientUnableToSign) {
      box.classList.add('unable-to-sign');
      box.classList.remove('has-signature');
      box.innerHTML = `
        <div class="signature-unable-badge">
          <div class="unable-icon-wrap"><i class="fas fa-user-slash"></i></div>
          <div class="unable-main-text">【病患因故無法簽名】</div>
          <div class="unable-sub-text">(意識改變 / 嚴重創傷劇痛 / 肢體受限等)</div>
        </div>
      `;
    } else {
      box.classList.remove('unable-to-sign');
      if (formData.patientSignature) {
        updateSignatureBoxUI('patientSigBox', formData.patientSignature);
      } else {
        resetSignatureBoxUI('patientSigBox', '病患 / 家屬簽名', 'fa-pen-fancy');
      }
    }
  }

  if (chkPatientUnableToSign) {
    chkPatientUnableToSign.addEventListener('change', () => {
      formData.patientUnableToSign = chkPatientUnableToSign.checked;
      if (lblUnableSign) lblUnableSign.classList.toggle('checked', formData.patientUnableToSign);

      if (formData.patientUnableToSign) {
        formData.patientSignature = '';
        updatePatientUnableToSignUI();
        showToast('已註記病患因故無法簽名');
      } else {
        updatePatientUnableToSignUI();
        showToast('已取消因故無法簽名，可點擊手指簽名');
      }
      validateFormStatus();
    });
  }

  document.getElementById('patientSigBox').addEventListener('click', (e) => {
    if (e.target.closest('.btn-clear-sig')) return;
    if (formData.patientUnableToSign) {
      showToast('病患已勾選「因故無法簽名」，若欲親筆簽名請先取消勾選方框', 'warning');
      return;
    }
    openSignatureModal('patient');
  });
  document.getElementById('emtSigBox').addEventListener('click', (e) => {
    if (!e.target.closest('.btn-clear-sig')) openSignatureModal('emt');
  });

  // Signature Clear / Delete Handlers (復原空白)
  document.getElementById('btnDeletePatientSig').addEventListener('click', (e) => {
    e.stopPropagation();
    formData.patientSignature = '';
    formData.patientUnableToSign = false;
    if (chkPatientUnableToSign) chkPatientUnableToSign.checked = false;
    if (lblUnableSign) lblUnableSign.classList.remove('checked');
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
    const sec8Valid = !!formData.emtSignature; // 救護員必簽，病患未簽在送出前跳提醒但允許送出

    setSectionBadge('cardSec1', 'statusBadgeSec1', sec1Valid, sec1Valid ? '完成' : '必填');
    setSectionBadge('cardSec2', 'statusBadgeSec2', sec2Valid, sec2Valid ? '完成' : '必填');
    setSectionBadge('cardSec3', 'statusBadgeSec3', sec3Valid, sec3Valid ? '完成' : '必填');
    setSectionBadge('cardSec4', 'statusBadgeSec4', sec4Valid, sec4Valid ? '完成' : '必填');
    setSectionBadge('cardSec5', 'statusBadgeSec5', sec5Valid, sec5Valid ? '完成' : '完成');
    setSectionBadge('cardSec6', 'statusBadgeSec6', sec6Valid, sec6Valid ? '完成' : '必填');
    setSectionBadge('cardSec7', 'statusBadgeSec7', sec7Valid, sec7Valid ? '完成' : '完成');

    let sigBadgeLabel = '簽名完成';
    if (!formData.emtSignature) {
      sigBadgeLabel = '未完成 (缺救護員簽名)';
    } else if (formData.patientUnableToSign) {
      sigBadgeLabel = '完成 (因故無法簽名)';
    } else if (!formData.patientSignature) {
      sigBadgeLabel = '可送出 (病患未簽)';
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

    dosageInput.value = data.dosage || '5';
    formData.dosage = data.dosage || '5';
    if (dosageVolumeEq) {
      dosageVolumeEq.textContent = `＝ ${(parseFloat(formData.dosage) / 10).toFixed(1).replace(/\.0$/, '')} ml`;
    }
    updateDoseChipsActive();

    formData.repeatDose = data.repeatDose || '否';
    formData.repeatDoseRemark = data.repeatDoseRemark || '';
    repeatDoseOptions.forEach(b => {
      b.classList.toggle('active', b.dataset.value === formData.repeatDose);
    });
    if (repeatDoseRemarkContainer) {
      repeatDoseRemarkContainer.style.display = formData.repeatDose === '是' ? 'block' : 'none';
    }
    if (inputRepeatDoseRemark) {
      inputRepeatDoseRemark.value = formData.repeatDoseRemark;
    }

    confirmedAgeValue = parseInt(data.age, 10) || null;

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

    formData.patientUnableToSign = !!data.patientUnableToSign;
    if (chkPatientUnableToSign) chkPatientUnableToSign.checked = formData.patientUnableToSign;
    if (lblUnableSign) lblUnableSign.classList.toggle('checked', formData.patientUnableToSign);

    if (data.patientSignature) {
      formData.patientSignature = data.patientSignature;
      updateSignatureBoxUI('patientSigBox', data.patientSignature);
    } else if (formData.patientUnableToSign) {
      updatePatientUnableToSignUI();
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
  document.getElementById('btnTriggerPreview').addEventListener('click', async () => {
    formData.unit = unitInput ? unitInput.value.trim() : (localStorage.getItem('saved_ems_unit') || '光明91');
    formData.formNo = formNoInput.value.trim();
    formData.age = ageInput.value.trim();
    formData.dosage = dosageInput.value.trim() || '5';
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

    // 年齡檢核：必須為大於 0 的整數
    const ageNum = parseInt(formData.age, 10);
    if (!formData.age || isNaN(ageNum) || ageNum <= 0) {
      showToast('年齡只能是大於 0 的整數！', 'warning');
      ageInput.focus();
      return;
    }

    const ageOk = await checkAgeWarning(true);
    if (!ageOk) return;

    // 給藥劑量檢核：必須為大於 0 的整數
    const doseNum = parseInt(formData.dosage, 10);
    if (isNaN(doseNum) || doseNum <= 0) {
      showToast('給藥劑量只能是大於 0 的整數 (例如 5 或 10)！', 'warning');
      dosageInput.focus();
      return;
    }

    if (!formData.patientSignature && !formData.patientUnableToSign) {
      const proceedWithoutPatientSig = confirm(
        '【提醒】「病患 / 家屬簽名欄」目前尚未簽名。\n\n' +
        '※ 臨床若因病患意識改變、嚴重創傷劇痛或無法簽名之情況，可勾選「因故無法簽名」或點擊【確定】直接送出；\n' +
        '※ 若需補簽，請點擊【取消】進行簽名。\n\n' +
        '是否確定不簽名直接送出？'
      );
      if (!proceedWithoutPatientSig) {
        openSignatureModal('patient');
        return;
      }
      showToast('提醒：病患簽名欄未簽名，已確認送出。', 'warning');
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
      
      // Generate clean PDF Base64 via off-screen element
      const pdfBase64 = await NalbuphinePdfGenerator.getPdfBase64(formData);

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

  // ==========================================
  // 相機條碼掃描模組 (Barcode Scanner Engine)
  // ==========================================
  let html5QrScanner = null;
  let isScanningBarcode = false;
  let torchEnabled = false;

  function playBeepSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  function initBarcodeScanner() {
    const btnScan = document.getElementById('btnScanBarcode');
    const modal = document.getElementById('barcodeScannerModal');
    const btnClose = document.getElementById('btnCloseBarcodeModal');
    const btnCancel = document.getElementById('btnCancelScan');
    const btnTorch = document.getElementById('btnToggleTorch');
    const fileInput = document.getElementById('barcodeFileInput');
    const statusMsg = document.getElementById('scannerStatusMsg');

    if (!btnScan || !modal) return;

    async function startCameraScanner() {
      modal.classList.add('open');
      if (statusMsg) statusMsg.textContent = '正在啟動相機...';
      if (btnTorch) btnTorch.style.display = 'none';
      torchEnabled = false;

      if (typeof Html5Qrcode === 'undefined') {
        if (statusMsg) statusMsg.innerHTML = '⚠️ 掃描模組尚未就緒，請手動輸入單號或點擊「相簿選圖」';
        return;
      }

      try {
        if (!html5QrScanner) {
          html5QrScanner = new Html5Qrcode("barcodeScannerView", {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.CODE_93,
              Html5QrcodeSupportedFormats.CODABAR,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.QR_CODE
            ],
            verbose: false
          });
        }

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(Math.round(viewfinderWidth * 0.88), 340);
            const height = Math.min(Math.round(viewfinderHeight * 0.55), 180);
            return { width, height };
          },
          aspectRatio: 1.0,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };

        // Try environment/back camera first
        try {
          await html5QrScanner.start(
            { facingMode: { exact: "environment" } },
            config,
            onBarcodeSuccess,
            onBarcodeError
          );
        } catch (camErr) {
          await html5QrScanner.start(
            { facingMode: "environment" },
            config,
            onBarcodeSuccess,
            onBarcodeError
          );
        }

        isScanningBarcode = true;
        if (statusMsg) statusMsg.textContent = '請將救護紀錄表單號條碼置於框中...';

        // Check torch capability
        try {
          const track = html5QrScanner.getRunningTrackCapabilities();
          if (track && track.torch) {
            btnTorch.style.display = 'inline-flex';
          }
        } catch (e) {}

      } catch (err) {
        console.warn('Camera start error:', err);
        if (statusMsg) {
          statusMsg.innerHTML = `⚠️ 無法開啟相機 (${err.message || '請確認相機權限'})，可改用相簿照片選取`;
        }
      }
    }

    function onBarcodeSuccess(decodedText) {
      if (!decodedText) return;
      playBeepSound();
      if (navigator.vibrate) {
        try { navigator.vibrate([70, 30, 70]); } catch (e) {}
      }

      let cleanText = decodedText.trim();
      // If barcode contains URL parameters, extract ID if possible
      try {
        if (cleanText.startsWith('http://') || cleanText.startsWith('https://')) {
          const url = new URL(cleanText);
          const params = ['no', 'id', 'num', 'formNo', 'case'];
          for (const p of params) {
            if (url.searchParams.get(p)) {
              cleanText = url.searchParams.get(p).trim();
              break;
            }
          }
        }
      } catch (e) {}

      formNoInput.value = cleanText;
      formData.formNo = cleanText;
      validateFormStatus();

      showToast(`條碼掃描成功！已帶入單號：${cleanText}`, 'success');
      stopCameraScanner();
    }

    function onBarcodeError(errorMessage) {
      // Per frame scan attempt - silent
    }

    async function stopCameraScanner() {
      if (html5QrScanner && isScanningBarcode) {
        try {
          await html5QrScanner.stop();
          html5QrScanner.clear();
        } catch (e) {}
        isScanningBarcode = false;
      }
      modal.classList.remove('open');
      if (statusMsg) statusMsg.textContent = '';
    }

    btnScan.addEventListener('click', startCameraScanner);
    if (btnClose) btnClose.addEventListener('click', stopCameraScanner);
    if (btnCancel) btnCancel.addEventListener('click', stopCameraScanner);

    if (btnTorch) {
      btnTorch.addEventListener('click', async () => {
        if (!html5QrScanner || !isScanningBarcode) return;
        try {
          torchEnabled = !torchEnabled;
          await html5QrScanner.applyVideoConstraints({
            advanced: [{ torch: torchEnabled }]
          });
          const torchText = document.getElementById('torchBtnText');
          if (torchText) torchText.textContent = torchEnabled ? '關閉手電筒' : '開啟手電筒';
        } catch (err) {
          showToast('此裝置不支援手電筒控制', 'warning');
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (statusMsg) statusMsg.textContent = '正在辨識相片中的條碼...';
        try {
          let scanner = html5QrScanner;
          if (!scanner) {
            scanner = new Html5Qrcode("barcodeScannerView", { verbose: false });
          }
          const decodedText = await scanner.scanFile(file, true);
          onBarcodeSuccess(decodedText);
        } catch (err) {
          if (statusMsg) statusMsg.textContent = '⚠️ 相片中未辨識出清晰條碼，請換一張或重試';
          showToast('未辨識出條碼，請確認條碼清晰完整', 'warning');
        } finally {
          fileInput.value = '';
        }
      });
    }
  }

  // ==========================================
  // 平板專用智慧連動工具組 (Tablet Smart Linkage Tools)
  // ==========================================
  function isValidTemsisNumber(str) {
    if (!str || typeof str !== 'string') return false;
    str = str.trim();
    // 1. 絕對不能以 0 開頭 (嚴格排除 091029102983 這類時間/表格座標拼接或電話號碼)
    if (str.startsWith('0')) return false;
    // 2. 必須以西元 202x~203x 或民國 11x 開頭
    if (!/^(?:20[2-3]\d|11\d)/.test(str)) return false;
    // 3. 排除明確為分隊內部派遣案號 (例如 20260904081345004001 結尾為 004001，且不含 101008 機關碼)
    if (/00\d{4}$/.test(str) && !str.includes('101008')) return false;
    // 4. 長度必須為 15~22 碼
    if (str.length < 10 || str.length > 22) return false;
    return true;
  }

  function extractTemsisNumber(text) {
    if (!text) return null;

    const normalizedText = text.replace(/[\r\n]+/g, ' ');

    // 優先級 1：直接緊接在 "TEMSIS編號"、"TEMSIS" 標籤之後或之前的數字
    // 範例：TEMSIS編號: 20260904101008081345
    const mAfter = normalizedText.match(/(?:TEMSIS|temsis)(?:編號)?\s*[:：\s]\s*([0-9]{15,22})/i);
    if (mAfter && isValidTemsisNumber(mAfter[1])) {
      return mAfter[1];
    }

    // 範例：20260904101008081345 TEMSIS編號
    const mBefore = normalizedText.match(/([0-9]{15,22})\s*(?:TEMSIS|temsis)(?:編號)?/i);
    if (mBefore && isValidTemsisNumber(mBefore[1])) {
      return mBefore[1];
    }

    // 優先級 2：在 "TEMSIS" 關鍵字前後 250 字元視窗內搜尋
    const temsisPos = normalizedText.toUpperCase().indexOf('TEMSIS');
    if (temsisPos !== -1) {
      const windowStr = normalizedText.substring(Math.max(0, temsisPos - 200), Math.min(normalizedText.length, temsisPos + 300));
      const windowCands = windowStr.match(/\b(20[2-3]\d{17}|11\d{8,14})\b/g) || [];
      
      // 2a. 優先找包含新竹縣 TEMSIS 專屬局碼 101008 的號碼
      for (const c of windowCands) {
        if (c.includes('101008') && isValidTemsisNumber(c)) return c;
      }
      // 2b. 排除 004001、005001 派遣案號
      for (const c of windowCands) {
        if (isValidTemsisNumber(c) && !/00\d{4}$/.test(c)) return c;
      }
    }

    // 優先級 3：全局搜尋 20 碼候選號，鎖定包含 101008 (TEMSIS 機關代碼)
    const all20Cands = normalizedText.match(/\b(20[2-3]\d{17})\b/g) || [];
    const agencyCands = all20Cands.filter(c => c.includes('101008') && isValidTemsisNumber(c));
    if (agencyCands.length > 0) {
      return agencyCands[0];
    }

    // 優先級 4：全局搜尋中，排除明確的內部派遣編號 (如 20260904081345004001 結尾為 004001)
    const validNonDispatch = all20Cands.filter(c => isValidTemsisNumber(c) && !/00\d{4}$/.test(c));
    if (validNonDispatch.length > 0) {
      return validNonDispatch[0];
    }

    // 優先級 5：民國年編號
    const rocCands = (normalizedText.match(/\b(11\d{8,14})\b/g) || []).filter(c => isValidTemsisNumber(c));
    if (rocCands.length > 0) {
      return rocCands[0];
    }

    return null;
  }

  function parseTemsisDateTime(temsisNo) {
    if (!temsisNo) return null;
    if (/^20\d{18}$/.test(temsisNo)) {
      const yyyy = temsisNo.substr(0, 4);
      const mm = temsisNo.substr(4, 2);
      const dd = temsisNo.substr(6, 2);
      // In TEMSIS 20-digit number (YYYYMMDD 101008 HHMMSS)
      let hh = temsisNo.substr(8, 2);
      let min = temsisNo.substr(10, 2);
      if (temsisNo.includes('101008')) {
        hh = temsisNo.substr(14, 2);
        min = temsisNo.substr(16, 2);
      }
      return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
    }
    return null;
  }

  function applyFormNumber(num, shouldSyncDateTime = true) {
    if (!num) return;
    formNoInput.value = num;
    formData.formNo = num;

    if (shouldSyncDateTime) {
      const dt = parseTemsisDateTime(num);
      if (dt) {
        dateInput.value = dt.date;
        timeInput.value = dt.time;
        updateDateTimeState();
      }
    }
    validateFormStatus();
  }

  // ==========================================
  // 右側中間「給藥」專屬欄位智慧萃取 (Drug Administration Table Extractor)
  // 以救護紀錄表右側中間「給藥」標籤及其下方「時間」欄位為最高基準
  // ==========================================
  function extractDrugAdministrationInfo(pdfItems, fullText) {
    const result = { time: null, route: null, dose: null };

    // 1. 空間座標精準鎖定 (適用於 PDF.js 解析物件，最精確且不失真)
    // 救護紀錄表橫向A4尺寸約 842x595 點，右側中段「給藥」區塊特徵：
    // X 座標落在 380~550 之間，Y 座標落在 200~350 之間
    if (Array.isArray(pdfItems) && pdfItems.length > 0) {
      const timeHeaders = pdfItems.filter(it => {
        const str = (it.str || '').trim();
        if (!str.includes('時間')) return false;
        const x = it.transform ? it.transform[4] : (it.x || 0);
        const y = it.transform ? it.transform[5] : (it.y || 0);
        return x > 380 && x < 550 && y >= 200 && y <= 350;
      });

      for (const th of timeHeaders) {
        const thX = th.transform ? th.transform[4] : th.x;
        const thY = th.transform ? th.transform[5] : th.y;

        // 檢查同一水平線 (Y 差距在 8 點內) 是否有「藥名」或「途徑/劑量」
        const hasNeighbor = pdfItems.some(it => {
          const str = (it.str || '').trim();
          const x = it.transform ? it.transform[4] : (it.x || 0);
          const y = it.transform ? it.transform[5] : (it.y || 0);
          return Math.abs(y - thY) <= 8 && x > thX && (str.includes('藥名') || str.includes('途徑') || str.includes('劑量'));
        });

        if (hasNeighbor || timeHeaders.length === 1) {
          // 向下方直接鎖定時間數值 (X 誤差 35 點以內，Y 在下方 4~35 點)
          const timeCandidates = pdfItems.filter(it => {
            const str = (it.str || '').trim();
            const x = it.transform ? it.transform[4] : (it.x || 0);
            const y = it.transform ? it.transform[5] : (it.y || 0);
            const deltaX = Math.abs(x - thX);
            const deltaY = thY - y;
            return deltaX <= 35 && deltaY >= 4 && deltaY <= 35 && /^\d{1,2}:\d{2}$/.test(str);
          });

          if (timeCandidates.length > 0) {
            const raw = timeCandidates[0].str.trim();
            const parts = raw.split(':');
            result.time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
          }

          // 同列 (Y 在下方 4~35 點) 尋找途徑與劑量 (例如 IM/5mg, 0.5ml, 5ml 等)
          const routeCandidates = pdfItems.filter(it => {
            const str = (it.str || '').trim();
            const x = it.transform ? it.transform[4] : (it.x || 0);
            const y = it.transform ? it.transform[5] : (it.y || 0);
            const deltaY = thY - y;
            return x > thX + 40 && deltaY >= 4 && deltaY <= 35 && /(?:IM|IV|SC|mg|ml)/i.test(str);
          });

          if (routeCandidates.length > 0) {
            const rStr = routeCandidates[0].str.trim();
            if (/\bIM\b/i.test(rStr)) result.route = 'IM';
            else if (/\bIV\b/i.test(rStr)) result.route = 'IV';
            const corrected = cleanAndCorrectNalbuphineDosage(rStr, result.route);
            result.dose = corrected.dose;
            result.doseNote = corrected.note;
            result.volumeMl = corrected.volumeMl;
          }

          if (result.time) break;
        }
      }
    }

    // 2. 文字串流 / OCR 順序備援 (適用於純文字或剪貼簿)
    if (!result.time && fullText) {
      const cleanText = fullText.replace(/[\r\n]+/g, ' ');

      // 優先級 2A：鎖定「給」與「藥」字樣之後緊接之「時間」欄位下方的時間
      const mGeiyao = cleanText.match(/給[\s\S]{0,10}藥[\s\S]{0,120}?時間[\s\S]{0,60}?(\d{1,2}:\d{2})/);
      if (mGeiyao) {
        const parts = mGeiyao[1].split(':');
        result.time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      } else {
        // 優先級 2B：表格欄位標題接續：「時間 藥名 途徑/劑量 08:33」
        const mTbl = cleanText.match(/時間[\s\S]{0,25}?藥名[\s\S]{0,25}?(?:途徑|劑量)?[\s\S]{0,30}?(\d{1,2}:\d{2})/);
        if (mTbl) {
          const parts = mTbl[1].split(':');
          result.time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        } else {
          // 優先級 2C：直接在「給藥」之後 150 字元內尋找時間
          const mGeiyaoDirect = cleanText.match(/給[\s\S]{0,10}藥[\s\S]{0,150}?(\d{1,2}:\d{2})/);
          if (mGeiyaoDirect) {
            const parts = mGeiyaoDirect[1].split(':');
            result.time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
          } else {
            // 優先級 2D：時間接續途徑/劑量 (例如 08:33 其他 IM/5mg)
            const mRoute = cleanText.match(/(\d{1,2}:\d{2})\s+(?:其他|[^\d\s]{1,10})\s+(?:IM|IV|SC)/i);
            if (mRoute) {
              const parts = mRoute[1].split(':');
              result.time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            } else {
              // 優先級 2E：備註欄記載 (例如 0833 Bain 5mg)
              const mRem = cleanText.match(/(?:備註|備註欄)?[\s\S]{0,40}?(\d{2})(\d{2})\s*(?:Bain|止痛|IM|IV)/i);
              if (mRem) {
                result.time = `${mRem[1]}:${mRem[2]}`;
              }
            }
          }
        }
      }
    }

    return result;
  }

  function initTabletSmartTools() {
    const btnSmartPaste = document.getElementById('btnSmartPaste');
    const pdfImportInput = document.getElementById('pdfImportInput');
    const clipboardBanner = document.getElementById('clipboardDetectBanner');
    const clipboardDetectedNo = document.getElementById('clipboardDetectedNo');
    const btnApplyClipboard = document.getElementById('btnApplyClipboard');

    // 1. 一鍵智慧貼上 (Smart Paste)
    if (btnSmartPaste) {
      btnSmartPaste.addEventListener('click', async () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.readText) {
            showToast('請直接點選單號框長按貼上', 'warning');
            formNoInput.focus();
            return;
          }
          const text = await navigator.clipboard.readText();
          const cleanNo = extractTemsisNumber(text) || (isValidTemsisNumber(text.trim()) ? text.trim() : null);
          if (!cleanNo) {
            showToast('剪貼簿中未偵測到標準 TEMSIS 編號，請先在救護表長按複製', 'warning');
            return;
          }

          const drugInfo = extractDrugAdministrationInfo([], text);
          applyFormNumber(cleanNo, !drugInfo.time);
          if (drugInfo.time) {
            timeInput.value = drugInfo.time;
            formData.time = drugInfo.time;
            updateDateTimeState();
          }
          playBeepSound();
          if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch (e) {}

          showToast(`📋 已從剪貼簿智慧帶入 TEMSIS 單號：${cleanNo}${drugInfo.time ? ` 與給藥時間：${drugInfo.time}` : ''}`, 'success');
          if (clipboardBanner) clipboardBanner.style.display = 'none';
        } catch (err) {
          showToast('無法讀取剪貼簿，請點選單號框直接貼上', 'warning');
          formNoInput.focus();
        }
      });
    }

    // 2. 切換回網頁自動偵測剪貼簿 (Window Focus Auto-detect)
    let lastCheckedClipboard = '';
    window.addEventListener('focus', async () => {
      if (!navigator.clipboard || !navigator.clipboard.readText) return;
      try {
        const text = await navigator.clipboard.readText();
        const detectedNo = extractTemsisNumber(text);
        if (detectedNo && detectedNo !== formData.formNo && detectedNo !== lastCheckedClipboard) {
          lastCheckedClipboard = detectedNo;
          if (clipboardBanner && clipboardDetectedNo && btnApplyClipboard) {
            clipboardDetectedNo.textContent = detectedNo;
            clipboardBanner.style.display = 'flex';

            btnApplyClipboard.onclick = () => {
              applyFormNumber(detectedNo, true);
              playBeepSound();
              if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch (e) {}
              showToast(`✨ 已一鍵帶入 TEMSIS 單號：${detectedNo}`, 'success');
              clipboardBanner.style.display = 'none';
            };
          }
        }
      } catch (e) {
        // Safe to ignore clipboard access restriction
      }
    });

    // 3. 匯入救護紀錄表 PDF 自動辨識 (PDF Import Auto-fill)
    if (pdfImportInput) {
      pdfImportInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        showToast('正在解析救護紀錄表 PDF...');

        try {
          let fullText = '';
          let pdfItems = [];
          // Try PDF.js if available
          if (typeof pdfjsLib !== 'undefined') {
            try {
              if (typeof pdfjsWorker !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';
              } else {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
              }
              const arrayBuffer = await file.arrayBuffer();
              const loadingTask = pdfjsLib.getDocument({
                data: arrayBuffer,
                isEvalSupported: false,
                useWorkerFetch: false
              });
              const pdfDoc = await loadingTask.promise;
              const page = await pdfDoc.getPage(1);
              const content = await page.getTextContent();
              pdfItems = content.items || [];
              fullText = pdfItems.map(item => item.str).join(' ');
            } catch (pdfErr) {
              console.warn('PDF.js textContent error:', pdfErr);
            }
          }

          // 1. 萃取 TEMSIS 單號 (嚴格優先 TEMSIS編號，排除派遣案號與雜字)
          let detectedNo = extractTemsisNumber(fullText) || extractTemsisNumber(file.name);

          if (!detectedNo) {
            showToast('⚠️ 未在該 PDF 中找到標準 TEMSIS 編號 (如: 2026...101008...)', 'warning');
            return;
          }

          // 2. 優先萃取右側中間「給藥」標籤下方「時間」欄位 (最高基準，例如 08:33)
          const drugAdminInfo = extractDrugAdministrationInfo(pdfItems, fullText);
          const drugTimeVal = drugAdminInfo.time;

          // 3. 填入 TEMSIS 單號與出勤日期，時間以「給藥」欄位之數值為最高基準
          applyFormNumber(detectedNo, false);
          const dt = parseTemsisDateTime(detectedNo);
          if (dt) {
            dateInput.value = dt.date;
            formData.date = dt.date;
          }
          if (drugTimeVal) {
            timeInput.value = drugTimeVal;
            formData.time = drugTimeVal;
            updateDateTimeState();
          } else if (dt) {
            timeInput.value = dt.time;
            formData.time = dt.time;
            updateDateTimeState();
          }

          // 4. 智慧萃取其他欄位 (性別、年齡、給藥時間、VAS、劑量與途徑)
          const importedItems = [];
          if (drugTimeVal) {
            importedItems.push(`給藥時間：${drugTimeVal} (依「給藥」欄位基準)`);
          }

          // 性別：優先透過身分證字號第二碼判定 (1為男, 2為女)，若無則依勾選標記
          const mId = fullText.match(/\b[A-Z]([12])\d{8}\b/);
          let detectedGender = null;
          if (mId) {
            detectedGender = mId[1] === '1' ? '男' : '女';
          } else if (/[Vv✓✔■☑]\s*女|女\s*[Vv✓✔■☑]/.test(fullText)) {
            detectedGender = '女';
          } else if (/[Vv✓✔■☑]\s*男|男\s*[Vv✓✔■☑]/.test(fullText)) {
            detectedGender = '男';
          }
          if (detectedGender) {
            formData.gender = detectedGender;
            document.querySelectorAll('#genderGroup .btn-toggle-option').forEach(b => {
              b.classList.toggle('active', b.dataset.value === detectedGender);
            });
            importedItems.push(`性別：${detectedGender}`);
          }

          // 年齡：優先從身分證旁緊接之數字或 "歲" 辨識
          const mAge = fullText.match(/\b[A-Z][12]\d{8}\s*(\d{1,3})\b/) || fullText.match(/(\d{1,3})\s*歲/) || fullText.match(/年齡\D{0,10}(\d{1,3})/);
          if (mAge) {
            const ageVal = mAge[1];
            formData.age = ageVal;
            ageInput.value = ageVal;
            confirmedAgeValue = parseInt(ageVal, 10);
            importedItems.push(`年齡：${ageVal}歲`);
          }

          // 疼痛指數 (VAS)
          const mVas = fullText.match(/疼痛指數\s*[:：]?\s*(\d{1,2})\s*分/) || 
                       fullText.match(/VAS\D*(\d{1,2})/i) ||
                       fullText.match(/疼痛\D*([0-9]|10)\s*分?/) ||
                       fullText.match(/4[、,\.\s\D]{1,15}\D*([1-9]|10)[分\?]/);
          if (mVas) {
            const vasScore = Math.min(10, Math.max(0, parseInt(mVas[1], 10)));
            formData.vasPre = vasScore;
            setupVasScale('vasPreContainer', vasScore, (s) => { formData.vasPre = s; });
            calculateVasDelta();
            importedItems.push(`給藥前VAS：${vasScore}分`);
          }

          // 給藥途徑與劑量 (優先使用右側「給藥」表格解析之 IM/5mg)
          const detectedRoute = drugAdminInfo.route || (/\bIM\b/i.test(fullText) ? 'IM' : (/\bIV\b/i.test(fullText) ? 'IV' : null));
          if (detectedRoute) {
            formData.route = detectedRoute;
            document.querySelectorAll('#routeGroup .btn-toggle-option').forEach(b => {
              b.classList.toggle('active', b.dataset.value === detectedRoute);
            });
            importedItems.push(`途徑：${detectedRoute}`);
          }

          const rawDoseMatch = drugAdminInfo.dose || 
                               (fullText.match(/(?:IM\s*\/|Bain\s*|途徑\/劑量\s*.*?)(\d{1,2}(?:\.\d+)?)\s*(?:mg|ml)/i) || 
                                fullText.match(/\b([0-9\.]+)\s*(?:mg|ml)\b/i) || [])[1];
          if (rawDoseMatch) {
            const corrected = cleanAndCorrectNalbuphineDosage(rawDoseMatch, detectedRoute);
            formData.dosage = corrected.dose;
            dosageInput.value = corrected.dose;
            if (dosageVolumeEq) dosageVolumeEq.textContent = `＝ ${corrected.volumeMl} ml`;
            if (corrected.note && dosageCorrectionBadge && dosageCorrectionMsg) {
              dosageCorrectionMsg.textContent = corrected.note;
              dosageCorrectionBadge.style.display = 'inline-flex';
            }
            updateDoseChipsActive();
            importedItems.push(`劑量：${corrected.dose}mg` + (corrected.note ? ` (${corrected.note})` : ''));
          }

          playBeepSound();
          if (navigator.vibrate) try { navigator.vibrate([80, 50, 80]); } catch (e) {}

          validateFormStatus();
          showToast(`🎉 成功帶入 TEMSIS 單號 [${detectedNo}]！${importedItems.length > 0 ? ` (自動辨識 ${importedItems.join('、')})` : ''}`, 'success');
        } catch (err) {
          console.error('PDF import error:', err);
          showToast('讀取 PDF 發生錯誤：' + err.message, 'warning');
        } finally {
          pdfImportInput.value = '';
        }
      });
    }

    // 4. iPad 分割畫面文字 / 檔案拖曳 (Drag & Drop)
    formNoInput.addEventListener('dragover', (e) => e.preventDefault());
    formNoInput.addEventListener('drop', (e) => {
      e.preventDefault();
      const text = e.dataTransfer.getData('text');
      if (text) {
        const cleanNo = extractTemsisNumber(text) || (isValidTemsisNumber(text.trim()) ? text.trim() : null);
        if (cleanNo) {
          const drugInfo = extractDrugAdministrationInfo([], text);
          applyFormNumber(cleanNo, !drugInfo.time);
          if (drugInfo.time) {
            timeInput.value = drugInfo.time;
            formData.time = drugInfo.time;
            updateDateTimeState();
          }
          playBeepSound();
          showToast(`已拖曳填入 TEMSIS 單號：${cleanNo}${drugInfo.time ? ` 與給藥時間：${drugInfo.time}` : ''}`, 'success');
        }
      }
    });

    // 5. URL 參數預填 (URL Query String Pre-fill)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryNo = urlParams.get('formNo') || urlParams.get('no') || urlParams.get('case');
      if (queryNo) {
        applyFormNumber(queryNo, true);
        showToast(`已從網址參數自動帶入單號：${queryNo}`, 'success');
      }
      const queryUnit = urlParams.get('unit');
      if (queryUnit && unitInput) {
        unitInput.value = queryUnit;
        formData.unit = queryUnit;
      }
      const queryAge = urlParams.get('age');
      if (queryAge && ageInput) {
        ageInput.value = queryAge;
        formData.age = queryAge;
      }
      const queryGender = urlParams.get('gender');
      if (queryGender) {
        formData.gender = queryGender;
        document.querySelectorAll('#genderGroup .btn-toggle-option').forEach(b => {
          b.classList.toggle('active', b.dataset.value === queryGender);
        });
      }
    } catch (e) {}
  }

  // Initialize Barcode Scanner & Tablet Smart Tools
  initBarcodeScanner();
  initTabletSmartTools();
});
