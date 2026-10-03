/**
 * Nalbuphine 止痛評估電子化系統 - 精準 1 頁 A4 PDF 生成與列印引擎
 */
class NalbuphinePdfGenerator {
  static generateHTML(formData) {
    const isChecked = (arr, val) => arr && arr.includes(val) ? '■' : '□';
    const isRadio = (fieldVal, targetVal) => fieldVal === targetVal ? '■' : '□';

    return `
      <div id="pdf-export-container" style="
        width: 190mm;
        height: 275mm;
        padding: 5mm 8mm;
        background: #ffffff;
        color: #000000;
        font-family: 'DFKai-SB', 'PMingLiU', 'Noto Serif TC', 'SimSun', serif;
        font-size: 11.5pt;
        line-height: 1.45;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <h1 style="text-align: center; font-size: 20pt; font-weight: bold; letter-spacing: 2px; margin: 0 0 12px 0; padding: 0;">
          Nalbuphine &nbsp;&nbsp; 止痛評估表
        </h1>

        <div style="margin-bottom: 10px;">
          <strong>給藥紀錄</strong> &nbsp;&nbsp;&nbsp;&nbsp;
          <u>&nbsp; ${formData.year || '____'} &nbsp;</u> 年 
          <u>&nbsp; ${formData.month || '__'} &nbsp;</u> 月 
          <u>&nbsp; ${formData.day || '__'} &nbsp;</u> 日 
          <u>&nbsp; ${formData.hour || '__'} &nbsp;</u> 時 
          <u>&nbsp; ${formData.minute || '__'} &nbsp;</u> 分
        </div>

        <div style="margin-bottom: 10px;">
          <strong>救護紀錄表單號：</strong> <u>&nbsp; ${formData.formNo || '________________'} &nbsp;</u>
        </div>

        <div style="margin-bottom: 10px;">
          <strong>性別：</strong> 
          ${isRadio(formData.gender, '男')} 男 &nbsp;&nbsp;&nbsp;
          ${isRadio(formData.gender, '女')} 女 
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <strong>年齡：</strong> <u>&nbsp; ${formData.age || '____'} &nbsp;</u> 歲
        </div>

        <div style="margin-bottom: 10px;">
          <div style="display: flex; align-items: flex-start;">
            <strong style="white-space: nowrap; margin-right: 8px;">適用條件 ｜</strong>
            <div style="line-height: 1.5;">
              <div>${isChecked(formData.conditions, '接受同步整流或經皮體外心律調節器(TCP)')} 接受同步整流或經皮體外心律調節器(TCP)</div>
              <div>${isChecked(formData.conditions, '肢體夾困，預期短時間(≧20 分鐘)無法脫困')} 肢體夾困，預期短時間(≧20 分鐘)無法脫困</div>
              <div>${isChecked(formData.conditions, '創傷性截肢或不完全截肢')} 創傷性截肢或不完全截肢</div>
              <div>${isChecked(formData.conditions, '外傷後，肢體明顯變形疑似骨折')} 外傷後，肢體明顯變形疑似骨折</div>
              <div>${isChecked(formData.conditions, 'VAS 疼痛指數≧6 分')} VAS 疼痛指數≧6 分</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <strong>給藥劑量 / 途徑：</strong> 
          <u>&nbsp; ${formData.dosage || '0.5'} &nbsp;</u> mg 
          （ ${isRadio(formData.route, 'IV')} IV &nbsp;&nbsp; ${isRadio(formData.route, 'IM')} IM ）
        </div>

        <div style="margin-bottom: 10px;">
          <strong>疼痛指數變化（VAS 0 － 10 分）</strong>
          <div style="margin-left: 20px; margin-top: 2px; line-height: 1.4;">
            給藥前 VAS： <u>&nbsp; ${formData.vasPre !== undefined ? formData.vasPre : '____'} &nbsp;</u> 分<br/>
            給藥後半小時 VAS： <u>&nbsp; ${formData.vasPost !== undefined ? formData.vasPost : '____'} &nbsp;</u> 分
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <strong>副作用反應（可複選）</strong>
          <div style="margin-left: 20px; margin-top: 2px; line-height: 1.4;">
            <div>${isChecked(formData.sideEffects, '無任何副作用')} 無任何副作用</div>
            <div>${isChecked(formData.sideEffects, '鎮靜 / 嗜睡')} 鎮靜 / 嗜睡</div>
            <div>${isChecked(formData.sideEffects, '頭暈 / 眩暈')} 頭暈 / 眩暈</div>
            <div>${isChecked(formData.sideEffects, '噁心 / 嘔吐')} 噁心 / 嘔吐</div>
            <div>${isChecked(formData.sideEffects, '呼吸抑制 (呼吸速率 < 10 次/分)')} 呼吸抑制（呼吸速率 < 10 次/分）</div>
            <div>${isChecked(formData.sideEffects, '其他')} 其他： <u>&nbsp; ${formData.sideEffectOther || '________________'} &nbsp;</u></div>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>對於給予止痛藥物滿意度</strong>
          <div style="margin-left: 20px; margin-top: 2px; line-height: 1.4;">
            <div>${isRadio(formData.satisfaction, '非常滿意 (5 分)')} 非常滿意（5 分）</div>
            <div>${isRadio(formData.satisfaction, '滿意 (4 分)')} 滿意（4 分）</div>
            <div>${isRadio(formData.satisfaction, '普通 (3 分)')} 普通（3 分）</div>
            <div>${isRadio(formData.satisfaction, '不滿意 (2 分)')} 不滿意（2 分）</div>
            <div>${isRadio(formData.satisfaction, '非常不滿意 (1 分)')} 非常不滿意（1 分）</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; padding-top: 5px;">
          <div style="width: 45%;">
            <strong>病患簽名：</strong>
            <div style="margin-top: 4px; border-bottom: 1px solid #000; min-height: 55px; height: 55px; display: flex; align-items: center; justify-content: center;">
              ${formData.patientSignature ? `<img src="${formData.patientSignature}" style="max-height: 50px; max-width: 100%; object-fit: contain;" />` : '<span style="color:#888; font-size:10pt;">(未簽名)</span>'}
            </div>
          </div>
          <div style="width: 45%;">
            <strong>救護人員簽名：</strong>
            <div style="margin-top: 4px; border-bottom: 1px solid #000; min-height: 55px; height: 55px; display: flex; align-items: center; justify-content: center;">
              ${formData.emtSignature ? `<img src="${formData.emtSignature}" style="max-height: 50px; max-width: 100%; object-fit: contain;" />` : '<span style="color:#888; font-size:10pt;">(未簽名)</span>'}
            </div>
          </div>
        </div>

        <div style="margin-top: 15px; font-size: 10pt; color: #444; text-align: left;">
          此表單請於下個月 10 號前上傳至 Google 表單
        </div>
      </div>
    `;
  }

  static async downloadPdf(formData) {
    const element = document.createElement('div');
    element.innerHTML = this.generateHTML(formData);
    document.body.appendChild(element);

    if (window.html2pdf) {
      const opt = {
        margin:       [5, 5, 5, 5],
        filename:     `Nalbuphine止痛評估_${formData.formNo || Date.now()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };
      await window.html2pdf().set(opt).from(element.firstElementChild).save();
    } else {
      window.print();
    }

    document.body.removeChild(element);
  }

  static async getPdfBase64(formData, targetElement = null) {
    let elementToCapture = targetElement;
    let tempWrapper = null;

    if (!elementToCapture) {
      tempWrapper = document.createElement('div');
      tempWrapper.style.cssText = 'position:fixed; top:0; left:0; width:210mm; z-index:99999; background:#ffffff; box-shadow:0 0 20px rgba(0,0,0,0.5);';
      tempWrapper.innerHTML = this.generateHTML(formData);
      document.body.appendChild(tempWrapper);
      elementToCapture = tempWrapper.firstElementChild;
    }

    // Wait for all signature images inside elementToCapture to fully render
    const images = elementToCapture.querySelectorAll('img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    await Promise.all(imagePromises);

    // Wait for layout engine
    await new Promise(r => setTimeout(r, 200));

    let base64 = '';
    if (window.html2pdf) {
      const opt = {
        margin:       [5, 5, 5, 5],
        filename:     'form.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, allowTaint: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      const pdfDataUri = await window.html2pdf().set(opt).from(elementToCapture).outputPdf('datauristring');
      if (pdfDataUri && pdfDataUri.includes(',')) {
        base64 = pdfDataUri.split(',')[1];
      }
    }

    if (tempWrapper && tempWrapper.parentNode) {
      tempWrapper.parentNode.removeChild(tempWrapper);
    }
    
    return base64;
  }
}

window.NalbuphinePdfGenerator = NalbuphinePdfGenerator;
