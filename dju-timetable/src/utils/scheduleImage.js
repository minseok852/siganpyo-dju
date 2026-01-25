// src/utils/scheduleImage.js
import html2canvas from 'html2canvas';

/**
 * 시간표를 이미지로 저장
 * @param {string} elementId - 캡처할 요소의 ID
 * @param {string} filename - 저장할 파일명
 */
export async function saveScheduleAsImage(elementId = 'schedule-grid', filename = '내_시간표') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found:', elementId);
    return;
  }

  try {
    // 폰트 로딩 대기
    if (document.fonts) {
      await document.fonts.ready;
    }
    
    // 약간의 딜레이
    await new Promise(resolve => setTimeout(resolve, 200));

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: false,
      allowTaint: true,
      logging: false,
      foreignObjectRendering: false,
      // X 버튼 제거
      ignoreElements: (el) => {
        return el.tagName === 'BUTTON';
      }
    });

    // 다운로드 링크 생성
    const link = document.createElement('a');
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();

    return true;
  } catch (error) {
    console.error('Failed to save image:', error);
    return false;
  }
}

/**
 * 시간표를 클립보드에 복사
 * @param {string} elementId 
 */
export async function copyScheduleToClipboard(elementId = 'schedule-grid') {
  const element = document.getElementById(elementId);
  if (!element) return false;

  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
    await new Promise(resolve => setTimeout(resolve, 200));

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: false,
      allowTaint: true,
      foreignObjectRendering: false,
      ignoreElements: (el) => el.tagName === 'BUTTON'
    });

    canvas.toBlob(async (blob) => {
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}