// 📄 src/utils/exportPDF.ts

import html2pdf from 'html2pdf.js';

export const exportPanelAsPDF = (
  elementId: string,
  fileName: string = 'panel-export.pdf'
) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`❌ Element with id "${elementId}" not found.`);
    return;
  }

  html2pdf()
    .from(element)
    .set({
      margin: 0.4,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    })
    .save();
};
