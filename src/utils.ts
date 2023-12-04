import html2canvas from "html2canvas";

export const getDomCanvas = async <T extends HTMLElement,>(dom: T, devicePixelRatio: number) => {
  const canvasdom = document.createElement("canvas");
  const width = parseInt(`${dom.clientWidth}`, 10);
  const height = parseInt(`${dom.clientHeight}`, 10);
  const scaleBy = devicePixelRatio;
  canvasdom.width = width * scaleBy;
  canvasdom.height = height * scaleBy;
  const canvas = await html2canvas(dom, {
    canvas: canvasdom,
    scale: scaleBy,
    backgroundColor: null,
    useCORS: true
  });
  return canvas
}

export function chunkArray<T>(array: Array<T>, step: number) {
  const result = [];
  for (let i = 0; i < array.length; i += step) {
    const chunk = array.slice(i, i + step);
    result.push(chunk);
  }
  return result;
}