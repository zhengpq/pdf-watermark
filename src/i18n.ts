export const translations = {
  en: {
    title: 'WaterMarks for PDF',
    watermark: 'Watermark',
    textWatermark: 'Text Watermark',
    imageWatermark: 'Image Watermark',
    uploadButton: 'Upload Image',
    exportButton: 'Export',
    tips: 'Tips',
    color: 'Color',
    size: 'Size',
    rotate: 'Rotate',
    opacity: 'Opacity',
    selectPages: 'Select Pages',
    customSize: 'Custom Size',
  },
  zh: {
    title: 'PDF 水印工具',
    watermark: '水印',
    textWatermark: '文字水印',
    imageWatermark: '图片水印',
    uploadButton: '上传图片',
    exportButton: '导出',
    tips: '提示',
    color: '颜色',
    size: '大小',
    rotate: '旋转',
    opacity: '透明度',
    selectPages: '选择页面',
    customSize: '自定义大小',
  },
} as const;

export type Language = keyof typeof translations;

export const detectLanguage = (): Language => {
  const lang = (navigator.language || navigator.languages?.[0] || 'en').split('-')[0].toLowerCase();
  return translations[lang as Language] ? lang as Language : 'en';
};

export const t = (key: string, lang: Language = detectLanguage()): string => {
  return translations[lang][key as keyof typeof translations[Language]] ?? key;
};
