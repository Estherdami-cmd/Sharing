"use client";

/**
 * 화면의 문서를 PDF 파일로 바로 내려받는다(인쇄 창을 거치지 않는다).
 * 문서 한 장(.report-sheet)마다 새 쪽에서 시작하고, A4보다 길면 여러 쪽으로 나눈다.
 * 라이브러리는 누를 때만 불러온다 — 페이지를 여는 사람 모두가 받을 필요는 없다.
 * Tailwind 4의 oklch 색을 읽으려고 html2canvas 대신 html2canvas-pro를 쓴다.
 */
export async function downloadSheetsAsPdf(sheets: HTMLElement[], fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  let first = true;

  for (const sheet of sheets) {
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
    // 이 문서의 캔버스 픽셀 중 한 쪽에 들어가는 높이.
    const pxPerMm = canvas.width / contentW;
    const sliceH = Math.floor(contentH * pxPerMm);
    // 쪽을 나눌 수 있는 자리: 표의 줄·구역·문단이 끝나는 곳. 글줄 한가운데서 잘리지 않게 한다.
    const scale = canvas.height / sheet.offsetHeight;
    const top = sheet.getBoundingClientRect().top;
    const breaks = [...sheet.querySelectorAll("tr, section, h1, h2, p")]
      .map((el) => Math.round((el.getBoundingClientRect().bottom - top) * scale))
      .sort((a, b) => a - b);
    for (let y = 0; y < canvas.height; ) {
      let end = Math.min(y + sliceH, canvas.height);
      if (end < canvas.height) {
        // 이 쪽에 들어가는 마지막 나눔 자리. 너무 위(쪽의 절반 이전)면 그냥 꽉 채워 자른다.
        const fit = breaks.filter((b) => b > y + sliceH * 0.5 && b <= end).pop();
        if (fit) end = fit;
      }
      const h = end - y;
      const part = document.createElement("canvas");
      part.width = canvas.width;
      part.height = h;
      part.getContext("2d")?.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, contentW, h / pxPerMm);
      y = end;
    }
  }
  pdf.save(fileName.replace(/[\\/:*?"<>|]/g, "_"));
}
