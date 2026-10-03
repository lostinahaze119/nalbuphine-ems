/**
 * Nalbuphine 止痛評估電子化系統 - 精準 1 頁 A4 PDF 生成與列印引擎
 */
class NalbuphinePdfGenerator {
  static getMinguoFileName(formData) {
    const unit = formData.unit || '光明91';
    const formNo = formData.formNo || Date.now();
    let minguoDate = '1151004';
    if (formData.date) {
      const parts = formData.date.split('-');
      const yyyy = parseInt(parts[0]);
      const mm = parts[1];
      const dd = parts[2];
      const minguoYear = yyyy - 1911;
      minguoDate = `${minguoYear}${mm}${dd}`;
    }
    return `${unit}_${minguoDate}_${formNo}.pdf`;
  }

  static generateHTML(formData) {
    const isChecked = (arr, val) => arr && arr.includes(val) ? '■' : '□';
    const isRadio = (fieldVal, targetVal) => fieldVal === targetVal ? '■' : '□';

    return `
      <div id="pdf-export-container" style="
        width: 190mm;
        height: 255mm;
        max-height: 255mm;
        padding: 3mm 5mm;
        background: #ffffff;
        color: #000000;
        font-family: 'DFKai-SB', 'PMingLiU', 'Noto Serif TC', 'SimSun', serif;
        font-size: 10pt;
        line-height: 1.3;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <h1 style="text-align: center; font-size: 17pt; font-weight: bold; letter-spacing: 2px; margin: 0 0 6px 0; padding: 0;">
          Nalbuphine &nbsp;&nbsp; 止痛評估表
        </h1>

        <div style="margin-bottom: 6px; display: flex; justify-content: space-between;">
          <span><strong>出勤單位：</strong> <u>&nbsp; ${formData.unit || '光明91'} &nbsp;</u></span>
          <span><strong>救護紀錄表單號：</strong> <u>&nbsp; ${formData.formNo || '________________'} &nbsp;</u></span>
        </div>

        <div style="margin-bottom: 6px;">
          <strong>給藥紀錄：</strong>
          <u>&nbsp; ${formData.year || '____'} &nbsp;</u> 年 
          <u>&nbsp; ${formData.month || '__'} &nbsp;</u> 月 
          <u>&nbsp; ${formData.day || '__'} &nbsp;</u> 日 
          <u>&nbsp; ${formData.hour || '__'} &nbsp;</u> 時 
          <u>&nbsp; ${formData.minute || '__'} &nbsp;</u> 分
        </div>

        <div style="margin-bottom: 6px;">
          <strong>性別：</strong> 
          ${isRadio(formData.gender, '男')} 男 &nbsp;&nbsp;&nbsp;
          ${isRadio(formData.gender, '女')} 女 
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <strong>年齡：</strong> <u>&nbsp; ${formData.age || '____'} &nbsp;</u> 歲
        </div>

        <div style="margin-bottom: 6px;">
          <div style="display: flex; align-items: flex-start;">
            <strong style="white-space: nowrap; margin-right: 6px;">適用條件 ｜</strong>
            <div style="line-height: 1.3;">
              <div>${isChecked(formData.conditions, '接受同步整流或經皮體外心律調節器(TCP)')} 接受同步整流或經皮體外心律調節器(TCP)</div>
              <div>${isChecked(formData.conditions, '肢體夾困，預期短時間(≧20 分鐘)無法脫困')} 肢體夾困，預期短時間(≧20 分鐘)無法脫困</div>
              <div>${isChecked(formData.conditions, '創傷性截肢或不完全截肢')} 創傷性截肢或不完全截肢</div>
              <div>${isChecked(formData.conditions, '外傷後，肢體明顯變形疑似骨折')} 外傷後，肢體明顯變形疑似骨折</div>
              <div>${isChecked(formData.conditions, 'VAS 疼痛指數≧6 分')} VAS 疼痛指數≧6 分</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 6px;">
          <strong>給藥劑量 / 途徑：</strong> 
          <u>&nbsp; ${formData.dosage || '0.5'} &nbsp;</u> mg 
          （ ${isRadio(formData.route, 'IV')} IV &nbsp;&nbsp; ${isRadio(formData.route, 'IM')} IM ）
        </div>

        <div style="margin-bottom: 6px;">
          <strong>疼痛指數變化（VAS 0 － 10 分）</strong>
          <div style="margin-left: 18px; margin-top: 2px; line-height: 1.3;">
            給藥前 VAS： <u>&nbsp; ${formData.vasPre !== undefined ? formData.vasPre : '____'} &nbsp;</u> 分<br/>
            給藥後半小時 VAS： <u>&nbsp; ${formData.vasPost !== undefined ? formData.vasPost : '____'} &nbsp;</u> 分
          </div>
        </div>

        <div style="margin-bottom: 6px;">
          <strong>副作用反應（可複選）</strong>
          <div style="margin-left: 18px; margin-top: 2px; line-height: 1.3;">
            <div>${isChecked(formData.sideEffects, '無任何副作用')} 無任何副作用</div>
            <div>${isChecked(formData.sideEffects, '鎮靜 / 嗜睡')} 鎮靜 / 嗜睡</div>
            <div>${isChecked(formData.sideEffects, '頭暈 / 眩暈')} 頭暈 / 眩暈</div>
            <div>${isChecked(formData.sideEffects, '噁心 / 嘔吐')} 噁心 / 嘔吐</div>
            <div>${isChecked(formData.sideEffects, '呼吸抑制 (呼吸速率 < 10 次/分)')} 呼吸抑制（呼吸速率 < 10 次/分）</div>
            <div>${isChecked(formData.sideEffects, '其他')} 其他： <u>&nbsp; ${formData.sideEffectOther || '________________'} &nbsp;</u></div>
          </div>
        </div>

        <div style="margin-bottom: 6px;">
          <strong>對於給予止痛藥物滿意度</strong>
          <div style="margin-left: 18px; margin-top: 2px; line-height: 1.3;">
            <div>${isRadio(formData.satisfaction, '非常滿意 (5 分)')} 非常滿意（5 分）</div>
            <div>${isRadio(formData.satisfaction, '滿意 (4 分)')} 滿意（4 分）</div>
            <div>${isRadio(formData.satisfaction, '普通 (3 分)')} 普通（3 分）</div>
            <div>${isRadio(formData.satisfaction, '不滿意 (2 分)')} 不滿意（2 分）</div>
            <div>${isRadio(formData.satisfaction, '非常不滿意 (1 分)')} 非常不滿意（1 分）</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; padding-top: 2px;">
          <div style="width: 45%;">
            <strong>病患簽名：</strong>
            <div style="margin-top: 2px; border-bottom: 1px solid #000; min-height: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
              ${formData.patientSignature ? `<img src="${formData.patientSignature}" style="max-height: 35px; max-width: 100%; object-fit: contain;" />` : '<span style="color:#888; font-size:8.5pt;">(未簽名)</span>'}
            </div>
          </div>
          <div style="width: 45%;">
            <strong>救護人員簽名：</strong>
            <div style="margin-top: 2px; border-bottom: 1px solid #000; min-height: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
              ${formData.emtSignature ? `<img src="${formData.emtSignature}" style="max-height: 35px; max-width: 100%; object-fit: contain;" />` : '<span style="color:#888; font-size:8.5pt;">(未簽名)</span>'}
            </div>
          </div>
        </div>

        <div style="margin-top: 6px; font-size: 8.5pt; font-weight: bold; color: #333; text-align: left;">
          此表單請於下個月 10 號前上傳至 Google 表單
        </div>
      </div>
    `;
  }

  static async downloadPdf(formData) {
    const element = document.createElement('div');
    element.innerHTML = this.generateHTML(formData);
    document.body.appendChild(element);

    const fileName = this.getMinguoFileName(formData);

    if (window.html2pdf) {
      const opt = {
        margin:       [2, 2, 2, 2],
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'css' }
      };
      await window.html2pdf().set(opt).from(element.firstElementChild).save();
    } else {
      window.print();
    }

    document.body.removeChild(element);
  }

  static async getPdfBase64(formData) {
    const tempWrapper = document.createElement('div');
    tempWrapper.style.cssText = 'position:fixed; top:0; left:0; width:190mm; z-index:99999; background:#ffffff; opacity:1;';
    tempWrapper.innerHTML = this.generateHTML(formData);
    document.body.appendChild(tempWrapper);
    const elementToCapture = tempWrapper.firstElementChild;

    const images = elementToCapture.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    await new Promise(r => setTimeout(r, 300));

    let base64 = '';
    try {
      if (window.html2pdf) {
        const fileName = this.getMinguoFileName(formData);
        const opt = {
          margin:       [2, 2, 2, 2],
          filename:     fileName,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false, allowTaint: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak:    { mode: 'css' }
        };
        
        const worker = window.html2pdf().set(opt).from(elementToCapture);
        const pdfDataUri = await worker.toPdf().output('datauristring');
        
        if (pdfDataUri && pdfDataUri.includes(',')) {
          base64 = pdfDataUri.split(',')[1];
        }
      }
    } catch (e) {
      console.error('Error generating PDF Base64:', e);
    }

    if (tempWrapper && tempWrapper.parentNode) {
      tempWrapper.parentNode.removeChild(tempWrapper);
    }
    
    return base64;
  }
}

window.NalbuphinePdfGenerator = NalbuphinePdfGenerator;
