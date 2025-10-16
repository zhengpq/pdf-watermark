// 图片水印工具函数

export interface ImageWatermarkOptions {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  angle: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  offsetX: number;
  offsetY: number;
}

/**
 * 在图片上添加多条文字水印（平铺效果）
 */
export async function addWatermarkToImage(
  imageFile: File,
  options: ImageWatermarkOptions,
  watermarkTexts?: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('无法创建canvas上下文'));
      return;
    }

    img.onload = () => {
      console.log('图片加载成功，尺寸:', img.width, 'x', img.height);
      
      // 设置canvas尺寸
      canvas.width = img.width;
      canvas.height = img.height;

      // 绘制原始图片
      ctx.drawImage(img, 0, 0);

      // 设置水印样式
      ctx.font = `${options.fontSize}px Arial, sans-serif`;
      ctx.fillStyle = options.color;
      ctx.globalAlpha = options.opacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 获取要绘制的水印文字
      const textsToDraw = watermarkTexts && watermarkTexts.length > 0 ? watermarkTexts : [options.text];
      console.log('水印文字:', textsToDraw);
      console.log('水印选项:', options);
      
      // 计算水印间距 - 降低密度到原来的五分之一
      // 使用更大的间距，让水印更加稀疏
      const spacing = Math.max(options.fontSize * 15, 400); // 大幅增加间距，降低密度
      console.log('水印间距:', spacing);
      
      // 平铺水印
      let watermarkCount = 0;
      for (let y = spacing; y < canvas.height + spacing; y += spacing) {
        for (let x = spacing; x < canvas.width + spacing; x += spacing) {
          // 保存当前状态
          ctx.save();
          
          // 移动到水印位置并旋转
          ctx.translate(x, y);
          ctx.rotate((options.angle * Math.PI) / 180);
          
          // 绘制所有水印文字
          textsToDraw.forEach((text, index) => {
            if (text.trim()) {
              ctx.fillText(text, 0, index * (options.fontSize + 5));
              watermarkCount++;
            }
          });
          
          // 恢复状态
          ctx.restore();
        }
      }
      console.log('总共绘制了', watermarkCount, '个水印');

      // 转换为base64
      const result = canvas.toDataURL('image/png');
      resolve(result);
    };

    img.onerror = () => {
      reject(new Error('图片加载失败'));
    };

    img.src = URL.createObjectURL(imageFile);
  });
}


/**
 * 下载处理后的图片
 */
export function downloadImage(dataUrl: string, filename: string = 'watermarked-image.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 批量处理图片水印
 */
export async function batchAddWatermarkToImages(
  imageFiles: File[],
  options: ImageWatermarkOptions,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < imageFiles.length; i++) {
    try {
      const result = await addWatermarkToImage(imageFiles[i], options);
      results.push(result);
      onProgress?.(i + 1, imageFiles.length);
    } catch (error) {
      console.error(`处理第${i + 1}张图片时出错:`, error);
      results.push(''); // 添加空字符串表示处理失败
    }
  }
  
  return results;
}
