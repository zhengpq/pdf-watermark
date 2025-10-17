import React, { useState, useCallback, useRef } from 'react';
import { Button, message, Input, InputNumber, ColorPicker, Slider, Popover, Spin } from 'antd';
import { UploadOutlined, DeleteOutlined, PlusOutlined, MinusOutlined, MenuOutlined } from '@ant-design/icons';
import { TransformComponent, TransformWrapper, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { downloadImage, ImageWatermarkOptions, addWatermarkToImage } from './imageWatermarkUtils';
import classNames from 'classnames';
import './App.css';


interface ImageData {
  file: File;
  preview: string;
  watermarked?: string;
}

const ImageWatermark: React.FC = () => {
  const [imageList, setImageList] = useState<ImageData[]>([]);
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [slideHidden, setSlideHidden] = useState(false);
  const [generateWatermarkFinish, setGenerateWatermarkFinish] = useState(false);
  
  // 水印配置
  const [watermarkTexts, setWatermarkTexts] = useState<string[]>(['xx信息技术有限公司']);
  const [watermarkDensity, setWatermarkDensity] = useState(2); // 水印密度 1-10
  const [watermarkOptions, setWatermarkOptions] = useState<Omit<ImageWatermarkOptions, 'text'>>({
    fontSize: 24,
    color: 'rgba(80, 80, 80, 0.6)', // 适中的不透明度，确保水印可见
    opacity: 0.6, // 适中的不透明度，确保水印可见
    angle: 30, // 调整角度，与PDF水印一致
    position: 'center',
    offsetX: 0,
    offsetY: 0,
  });

  // Refs
  const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null);
  const watermarkUnitRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const imageListRef = useRef<HTMLDivElement>(null);

  // 处理文件上传
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setImageList(prev => [...prev, ...newImages]);
    setCurrentImage(0);
  }, []);

  // 处理上传按钮点击
  const handleUpload = useCallback(() => {
    if (uploadInputRef.current) {
      uploadInputRef.current.click();
    }
  }, []);

  // 清除文件
  const handleClearFile = useCallback(() => {
    setImageList([]);
    setCurrentImage(0);
    setGenerateWatermarkFinish(false);
    transformComponentRef.current?.resetTransform();
    transformComponentRef.current?.centerView(0.8);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }, []);

  // 更新水印配置
  const updateWatermarkOption = useCallback((key: keyof typeof watermarkOptions, value: any) => {
    setWatermarkOptions(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // 添加水印文字
  const handleAddText = useCallback(() => {
    setWatermarkTexts(prev => [...prev, '']);
  }, []);

  // 删除水印文字
  const handleDeleteText = useCallback((index: number) => {
    setWatermarkTexts(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 修改水印文字
  const handleChangeText = useCallback((index: number, value: string) => {
    setWatermarkTexts(prev => {
      const newTexts = [...prev];
      newTexts[index] = value;
      return newTexts;
    });
  }, []);

  // 处理单张图片水印
  const handleProcessImage = useCallback(async (imageData: ImageData) => {
    try {
      const fullOptions: ImageWatermarkOptions = {
        ...watermarkOptions,
        text: watermarkTexts[0] || 'xx信息技术有限公司',
        density: watermarkDensity // 添加密度参数
      };
      
      // 使用多条水印平铺功能
      const result = await addWatermarkToImage(imageData.file, fullOptions, watermarkTexts);
      return result;
    } catch (error) {
      console.error('处理图片失败:', error);
      return null;
    }
  }, [watermarkOptions, watermarkTexts, watermarkDensity]);

  // 生成水印单元
  const generateWatermarkUnit = useCallback(async () => {
    if (imageList.length === 0) {
      message.warning('请先上传图片');
      return;
    }
    
    setLoading(true);
    try {
      // 处理当前选中的图片
      const currentImageData = imageList[currentImage];
      if (currentImageData) {
        const result = await handleProcessImage(currentImageData);
        if (result) {
          // 更新当前图片的水印结果
          setImageList(prev => {
            const newList = [...prev];
            newList[currentImage] = { ...newList[currentImage], watermarked: result };
            return newList;
          });
          setGenerateWatermarkFinish(true);
          message.success("已应用水印内容");
        } else {
          message.error('水印生成失败');
        }
      }
    } catch (error) {
      message.error('水印生成失败');
    } finally {
      setLoading(false);
    }
  }, [imageList, currentImage, handleProcessImage]);

  // 下载当前图片
  const handleDownload = useCallback(async () => {
    if (imageList[currentImage]?.watermarked) {
      downloadImage(imageList[currentImage].watermarked!, `watermarked-image-${currentImage + 1}.png`);
    } else {
      message.warning('请先生成水印');
    }
  }, [imageList, currentImage]);

  // 防止输入框触发全局键盘事件
  const handlePreventKeyEvent = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
  }, []);

  // 是否能够导出文件
  const exportDisabled = !generateWatermarkFinish || imageList.length === 0;
  
  // 如果有水印输入框没有内容，不能应用当前的水印内容
  const isWaterMarkDisabled = watermarkTexts.some(item => !item);

  return (
    <div className="main">
      <div className="left">
        <div className={classNames('left_inner', { 'left_inner_active': !!imageList[currentImage] })}>
          {imageList.length > 0 && (
            <div style={{ width: slideHidden ? '0px' : '193px', overflowX: 'hidden' }}>
              <div className="images" ref={imageListRef}>
                {imageList.map((item, index) => (
                  <div 
                    key={index}
                    className={classNames('images_item', { 'images_item_active': index === currentImage })} 
                    onClick={() => setCurrentImage(index)}
                  >
                    <div className="images_item_inner" style={{ width: '100%' }}>
                      <img 
                        src={item.watermarked || item.preview} 
                        alt="" 
                        style={{ width: '100%', height: 'auto' }} 
                      />
                      {item.watermarked && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          已水印
                        </div>
                      )}
                    </div>
                    <div className="image_num">{index + 1}</div>
                  </div>
                ))}
                {loading && (
                  <div className="images_loading">
                    <Spin></Spin>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className={classNames('left_main', { 'left_main_images': imageList.length > 0 })}>
            {imageList.length > 0 && (
              <TransformWrapper ref={transformComponentRef} centerOnInit centerZoomedOut minScale={0.2}>
                {({ zoomIn, zoomOut }) => (
                  <>
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                      <div className="selection_outer">
                        <div className="selection">
                          {imageList[currentImage] && (
                            <img 
                              style={{ width: '100%' }} 
                              alt='' 
                              src={imageList[currentImage].watermarked || imageList[currentImage].preview}
                            />
                          )}
                        </div>
                      </div>
                    </TransformComponent>
                    <div className="controls">
                      {imageList.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>第 {currentImage + 1} 张，共 {imageList.length} 张</span>
                        </div>
                      )}
                    </div>
                    <Button 
                      icon={<MenuOutlined />} 
                      onClick={() => setSlideHidden(!slideHidden)} 
                      className='hidden_button'
                    />
                    <Button.Group className="scale_buttons">
                      <Button 
                        icon={<MinusOutlined />} 
                        onClick={() => zoomOut(0.1)}
                      />
                      <Button 
                        icon={<PlusOutlined />} 
                        onClick={() => zoomIn(0.1)}
                      />
                    </Button.Group>
                  </>
                )}
              </TransformWrapper>
            )}
            {imageList.length === 0 && (
              <div className="empty">
                <input 
                  ref={uploadInputRef} 
                  className="button_input" 
                  accept="image/*" 
                  type="file" 
                  multiple
                  onChange={handleFileChange} 
                />
                <Button 
                  icon={<UploadOutlined />} 
                  size="large" 
                  type="primary" 
                  onClick={handleUpload}
                >
                  上传图片文件
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="watermark_unit">
          <div ref={watermarkUnitRef} style={{ overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                width: '200px',
                height: '160px',
                padding: '20px',
                transform: `rotate(${-watermarkOptions.angle}deg)`,
                transformOrigin: 'center',
              }}
            >
              {watermarkTexts.map((text, index) => (
                <div
                  key={index}
                  className='watermark_item'
                  style={{
                    fontSize: `${watermarkOptions.fontSize}px`,
                    color: `${watermarkOptions.color}`,
                    fontWeight: '400',
                    marginBottom: '12px',
                    opacity: watermarkOptions.opacity,
                  }}
                >
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="right">
        <div className="right_head">
          <div className="right_title">
            <div>图片</div>
          </div>
          <div className="upload_button">
            {imageList.length > 0 && (
              <input 
                ref={uploadInputRef} 
                className="button_input" 
                accept="image/*" 
                type="file" 
                multiple
                onChange={handleFileChange} 
              />
            )}
            {imageList.length === 0 && (
              <div className="upload_button_empty">请先上传图片文件</div>
            )}
            {imageList.length > 0 && (
              <div className="file_name_button">
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <div className="file_name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>
                    已上传 {imageList.length} 张图片
                  </div>
                  <div className="file_name_operator">
                    <Button 
                      onClick={handleUpload} 
                      style={{ color: 'var(--transparent-gray-800)' }} 
                      icon={<UploadOutlined />} 
                      size="small" 
                      type="text"
                    />
                    <div style={{ width: '1px', margin: '0 6px', height: '16px', backgroundColor: 'var(--transparent-gray-300)', flex: 'none' }}></div>
                    <Button 
                      onClick={handleClearFile} 
                      style={{ color: 'var(--transparent-gray-800)' }} 
                      icon={<DeleteOutlined />} 
                      size="small" 
                      type="text"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="divider"></div>
        <div className="right_main">
          <div className="right_title">
            水印内容
          </div>
          <div className="right_section">
            <div className="right_section_title">
              <div>文字水印</div>
              <Button size="small" type="text" onClick={handleAddText} icon={<PlusOutlined />} />
            </div>
            <div className="right_section_body text_body">
              {watermarkTexts.map((text, index) => (
                <div key={index} className="text_item">
                  <Input 
                    size="small" 
                    onKeyDown={handlePreventKeyEvent} 
                    style={{ flex: '1' }} 
                    placeholder="请输入水印文案" 
                    value={text} 
                    onChange={(e) => handleChangeText(index, e.target.value)} 
                  />
                  <Button 
                    size="small" 
                    type="text" 
                    style={{ color: 'var(--transparent-gray-700)', marginLeft: '4px', flex: 'none' }} 
                    onClick={() => handleDeleteText(index)} 
                    icon={<DeleteOutlined />} 
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="right_section">
            <div className="right_section_title">
              <div>水印配置</div>
            </div>
            <div className="right_section_body">
              <div className="rule_item">
                <div className="rule_label">字体大小</div>
                <InputNumber 
                  controls={false} 
                  onKeyDown={handlePreventKeyEvent} 
                  size="small" 
                  min={12} 
                  max={72}
                  value={watermarkOptions.fontSize} 
                  onChange={(value) => updateWatermarkOption('fontSize', value || 24)} 
                />
              </div>
              <div className="rule_item">
                <div className="rule_label">旋转角度</div>
                <InputNumber 
                  controls={false} 
                  onKeyDown={handlePreventKeyEvent} 
                  size="small" 
                  min={-180} 
                  max={180} 
                  value={watermarkOptions.angle} 
                  onChange={(value) => updateWatermarkOption('angle', value || 0)} 
                />
              </div>
              <div className="rule_item">
                <div className="rule_label">文字颜色</div>
                <ColorPicker 
                  size="small" 
                  value={watermarkOptions.color} 
                  onChange={(color) => updateWatermarkOption('color', color.toHexString())} 
                />
              </div>
              <div className="rule_item">
                <div className="rule_label">不透明度</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Slider
                    value={watermarkOptions.opacity * 100}
                    onChange={(value) => updateWatermarkOption('opacity', value / 100)}
                    min={0}
                    max={100}
                    style={{ width: '100px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#666', minWidth: '35px' }}>
                    {Math.round(watermarkOptions.opacity * 100)}%
                  </span>
                </div>
              </div>
              <div className="rule_item">
                <div className="rule_label">水印密度</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Slider
                    value={watermarkDensity}
                    onChange={(value) => setWatermarkDensity(value)}
                    min={1}
                    max={10}
                    style={{ width: '100px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#666', minWidth: '35px' }}>
                    {Math.round(watermarkDensity * 10)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="right_section">
            <div className="right_section_title">
              <div>水印单元预览</div>
            </div>
            <div className="right_section_body">
              <div className="watermark_unit_preview">
                <div style={{ transform: 'scale(0.5)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      width: '200px',
                      height: '160px',
                      padding: '20px',
                      transform: `rotate(${-watermarkOptions.angle}deg)`,
                      transformOrigin: 'center',
                    }}
                  >
                    {watermarkTexts.map((text, index) => (
                      <div
                        key={index}
                        className='watermark_item'
                        style={{
                          fontSize: `${watermarkOptions.fontSize}px`,
                          color: `${watermarkOptions.color}`,
                          fontWeight: '400',
                          marginBottom: '12px',
                          opacity: watermarkOptions.opacity,
                        }}
                      >
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isWaterMarkDisabled ? (
            <Popover content="请先检查水印内容是否有填写">
              <Button type="default" disabled style={{ width: '100%' }}>应用水印内容</Button>
            </Popover>
          ) : (
            <Button type="default" onClick={generateWatermarkUnit} style={{ width: '100%' }}>应用水印内容</Button>
          )}
        </div>
        <div className="divider"></div>
        <div className="right_bottom">
          {exportDisabled && (
            <Popover content="导出水印前，请先应用水印内容" placement="top">
              <div>
                <Button type="primary" disabled style={{ width: '100%' }}>导出文件</Button>
              </div>
            </Popover>
          )}
          {!exportDisabled && (
            <Button type="primary" onClick={handleDownload} style={{ width: '100%' }}>导出文件</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageWatermark;