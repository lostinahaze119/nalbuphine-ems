/**
 * Nalbuphine 止痛評估電子化系統 - Google 雲端與離線自動同步模組 (Google Sync Engine)
 */
class GoogleSyncManager {
  constructor() {
    this.storageKeyUrl = 'nalbuphine_gas_webapp_url';
    this.storageKeyLocalRecords = 'nalbuphine_local_records';
    
    // Default hardcoded Google Apps Script Web App URL for automatic zero-config sync!
    this.defaultGasUrl = 'https://script.google.com/macros/s/AKfycbxvJMmFTu241FlzbYjthzHRsiTrFgynZujRj2SrbIsnRbBc4vDLOpj2quW8mmn6Cz6dcQ/exec';
    
    this.gasUrl = localStorage.getItem(this.storageKeyUrl) || this.defaultGasUrl;
    
    if (!localStorage.getItem(this.storageKeyUrl)) {
      localStorage.setItem(this.storageKeyUrl, this.defaultGasUrl);
    }

    this.initOnlineListener();
  }

  getGasUrl() {
    return this.gasUrl;
  }

  setGasUrl(url) {
    this.gasUrl = url.trim();
    localStorage.setItem(this.storageKeyUrl, this.gasUrl);
  }

  initOnlineListener() {
    window.addEventListener('online', () => {
      this.updateOnlineStatusUI(true);
      this.syncPendingRecords();
    });

    window.addEventListener('offline', () => {
      this.updateOnlineStatusUI(false);
    });

    this.updateOnlineStatusUI(navigator.onLine);
  }

  updateOnlineStatusUI(isOnline) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (statusDot && statusText) {
      if (isOnline && this.gasUrl) {
        statusDot.classList.remove('offline');
        statusText.textContent = '已連線 Google 雲端';
      } else if (!isOnline) {
        statusDot.classList.add('offline');
        statusText.textContent = '離線模式 (離線暫存)';
      } else {
        statusDot.classList.add('offline');
        statusText.textContent = '未綁定 Google 雲端';
      }
    }
  }

  getLocalRecords() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKeyLocalRecords) || '[]');
    } catch (e) {
      return [];
    }
  }

  saveOrUpdateLocalRecord(recordData) {
    const records = this.getLocalRecords();
    const existingIndex = records.findIndex(r => r.id === recordData.id);
    if (existingIndex >= 0) {
      records[existingIndex] = recordData;
    } else {
      records.unshift(recordData);
    }
    localStorage.setItem(this.storageKeyLocalRecords, JSON.stringify(records));
    return recordData;
  }

  deleteLocalRecord(recordId) {
    const records = this.getLocalRecords().filter(r => r.id !== recordId);
    localStorage.setItem(this.storageKeyLocalRecords, JSON.stringify(records));
    return records;
  }

  async submitRecord(formData, pdfBase64 = '', isUpdate = false, existingRecordId = '') {
    const recordId = isUpdate && existingRecordId ? existingRecordId : ('REC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
    
    const record = {
      id: recordId,
      timestamp: new Date().toLocaleString('zh-TW'),
      data: formData,
      pdfBase64: pdfBase64,
      isUpdate: isUpdate,
      status: 'pending',
      syncError: ''
    };

    this.saveOrUpdateLocalRecord(record);

    if (this.gasUrl && navigator.onLine) {
      try {
        const response = await this.uploadToGas(record);
        if (response && response.result === 'success') {
          record.status = 'synced';
          record.driveUrl = response.driveUrl || '';
          record.sheetRow = response.sheetRow || '';
          this.updateLocalRecordStatus(record.id, 'synced', '', response.driveUrl);
          return { success: true, mode: 'cloud', driveUrl: response.driveUrl };
        }
      } catch (err) {
        console.warn('Sync to Google Drive failed, kept in local queue:', err);
        this.updateLocalRecordStatus(record.id, 'pending', err.message || '網路上傳失敗');
      }
    }

    return { 
      success: true, 
      mode: 'local', 
      message: this.gasUrl ? '離線狀態，已先暫存於平板，恢復連線後將自動上傳' : '資料已暫存於平板。請至設定綁定 Google 雲端網址' 
    };
  }

  async uploadToGas(record) {
    let fileName = '光明91_1151004_7777777.pdf';
    if (window.NalbuphinePdfGenerator && record.data) {
      fileName = NalbuphinePdfGenerator.getMinguoFileName(record.data);
    }

    const payload = {
      recordId: record.id,
      isUpdate: !!record.isUpdate,
      timestamp: record.timestamp,
      fileName: fileName,
      unit: record.data.unit || '光明91',
      date: record.data.date,
      time: record.data.time,
      formNo: record.data.formNo,
      gender: record.data.gender,
      age: record.data.age,
      conditions: record.data.conditions ? record.data.conditions.join(', ') : '',
      dosage: record.data.dosage || '5',
      route: record.data.route,
      repeatDose: record.data.repeatDose || '否',
      repeatDoseRemark: record.data.repeatDoseRemark || '',
      vasPre: record.data.vasPre,
      vasPost: record.data.vasPost,
      sideEffects: record.data.sideEffects ? record.data.sideEffects.join(', ') : '',
      sideEffectOther: record.data.sideEffectOther,
      satisfaction: record.data.satisfaction,
      patientSignature: record.data.patientSignature,
      emtSignature: record.data.emtSignature,
      pdfBase64: record.pdfBase64
    };

    const response = await fetch(this.gasUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });

    return await response.json();
  }

  updateLocalRecordStatus(id, status, errorMsg = '', driveUrl = '') {
    const records = this.getLocalRecords();
    const target = records.find(r => r.id === id);
    if (target) {
      target.status = status;
      target.syncError = errorMsg;
      if (driveUrl) target.driveUrl = driveUrl;
      localStorage.setItem(this.storageKeyLocalRecords, JSON.stringify(records));
    }
  }

  async syncPendingRecords() {
    if (!this.gasUrl || !navigator.onLine) return;

    const records = this.getLocalRecords();
    const pendingRecords = records.filter(r => r.status === 'pending');

    for (const record of pendingRecords) {
      try {
        const res = await this.uploadToGas(record);
        if (res && res.result === 'success') {
          this.updateLocalRecordStatus(record.id, 'synced', '', res.driveUrl);
        }
      } catch (err) {
        console.error('Auto sync record failed:', record.id, err);
      }
    }
  }
}

window.GoogleSyncManager = GoogleSyncManager;
