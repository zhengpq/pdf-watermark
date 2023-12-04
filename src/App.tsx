import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import classNames from 'classnames';
import { BlendMode, PDFDocument } from 'pdf-lib'
import { Button, Input, Checkbox, Pagination, Popover, Spin, message, ColorPicker, InputNumber } from 'antd'
import { DeleteFilled, MenuOutlined, MinusOutlined, PlusOutlined, RedoOutlined, UploadOutlined } from '@ant-design/icons'
import { TransformComponent, TransformWrapper, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import './App.css';
import { chunkArray, getDomCanvas } from './utils';
const work = require('pdfjs-dist/build/pdf.worker')
pdfjsLib.GlobalWorkerOptions.workerSrc = work


interface WatermarkUnitData {
  base64Data: string
  bufferData: ArrayBuffer | string,
  nums: number
}

interface ImageData {
  width: number
  height: number
  data: string
}


const waterUnitWidth = 200
const waterUnitHeight = 160


const App: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage()
  const [file, setFile] = useState<ArrayBuffer | string>('')
  const [fileName, setFileName] = useState('')
  const [watermarkUnit, setWatermarkUnit] = useState<WatermarkUnitData | null>(null)
  const [imageList, setImageList] = useState<ImageData[]>([])
  const [currentImage, setCurrentImage] = useState(0)
  const [currentPagesChunk, setCurrentPagesChunk] = useState(0)
  const [waterMarkValue, setWaterMarkValue] = useState<Array<string>>([''])
  const [watermarkSize, setWatermarkSize] = useState({ width: waterUnitWidth, height: waterUnitHeight })
  const [watermarkPreviewSize, setWatermarkPreviewSize] = useState({ width: 0 })
  const [textColor, setTextColor] = useState('rgba(80, 80, 80, 0.3)')
  const [textSize, setTextSize] = useState(14)
  const [rotate, setRotate] = useState(0)
  const [textPadding, setTextPadding] = useState(12)
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [slideHidden, setSlideHidden] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateWatermarkUnitFinish, setGenerateWatermarkUnitFinish] = useState(false)
  const [uploading, setUploading] = useState(false)
  const watermarkUnitRef = useRef<HTMLDivElement>(null)
  const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null)
  const selectTransformRef = useRef<HTMLDivElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const imageListRef = useRef<HTMLDivElement>(null)
  const imagesListDataRef = useRef<ImageData[]>([])
  const selectedPagesDataRef = useRef<number[]>([])
  const selectionRef = useRef<HTMLDivElement>(null)
  const leftMainRef = useRef<HTMLDivElement>(null)
  const waterCoverRef = useRef<HTMLDivElement>(null)
  const pageWidth = useRef(0)
  const devicePixelRatio = window.devicePixelRatio
  const scalePoint = 1600

  // 防止输入框触发全局键盘事件
  const handlePreventKeyEvent: React.KeyboardEventHandler<HTMLInputElement> = useCallback((event) => {
    event.stopPropagation()
  }, [])

  const generateWatermarkUnit = useCallback(async () => {
    if (!file) {
      messageApi.warning({
        content: '请先上传 pdf 文件',
      })
      return
    }
    if (!watermarkUnitRef.current) return
    // 获取当前水印单元画布
    const watermarkCanvas = await getDomCanvas(watermarkUnitRef.current, devicePixelRatio)
    // 获取水印单元 base64 数据
    const watermarkUnitImageBase64 = watermarkCanvas.toDataURL()
    // 获取水印单元 buffer 数据
    watermarkCanvas.toBlob((blob) => {
      if (!blob) return
      const reader = new FileReader()
      reader.onload = async () => {
        if (!reader.result) return
        setWatermarkUnit({
          base64Data: watermarkUnitImageBase64,
          bufferData: reader.result,
          nums: waterMarkValue.length
        })
        messageApi.success({
          content: "已应用水印内容"
        })
        setGenerateWatermarkUnitFinish(true)
      }
      reader.readAsArrayBuffer(blob)
    })
  }, [devicePixelRatio, waterMarkValue, messageApi, file])

  const handleUpload = () => {
    if (uploadInputRef.current) {
      uploadInputRef.current.click()
    }
  }

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return
    setUploading(true)
    setCurrentPagesChunk(0)
    imagesListDataRef.current = []
    selectedPagesDataRef.current = []
    messageApi.info({
      content: "文件解析中...",
      duration: 0,
    })
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFile(event.target?.result)
          setFileName(file.name)
        }
      };
      reader.readAsArrayBuffer(file);
    }, 300)
  }
  // 修改水印内容
  const handleChangeText = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget
    waterMarkValue[index] = value
    setWaterMarkValue([...waterMarkValue])
  }
  // 添加文字水印
  const handleAddText = () => {
    setWaterMarkValue([...waterMarkValue, ''])
  }
  // 删除某一个文字水印
  const handleDeleteText = (index: number) => {
    waterMarkValue.splice(index, 1)
    setWaterMarkValue([...waterMarkValue])
  }
  const handleDownload = async () => {
    const pdfDoc = await PDFDocument.load(file);
    if (!watermarkUnit?.bufferData) return
    const watermarkImage = await pdfDoc.embedPng(watermarkUnit?.bufferData);
    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      if (selectedPages.includes(i)) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();

        // 计算水印图片的行数和列数，以便铺满整个页面
        const watermarkWidth = watermarkSize.width;
        const watermarkHeight = watermarkSize.height;
        const columns = Math.ceil(width / watermarkWidth);
        const rows = Math.ceil(height / watermarkHeight);

        // 在页面上重复绘制水印图片
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < columns; col++) {
            page.drawImage(watermarkImage, {
              blendMode: BlendMode.Exclusion,
              x: col * watermarkWidth,
              y: height - (watermarkHeight * (row + 1)),
              width: watermarkWidth,
              height: watermarkHeight,
            });
          }
        }
      }
    }
    const pdfWithWatermarkBytes = await pdfDoc.save({ useObjectStreams: true });
    const blob = new Blob([new Uint8Array(pdfWithWatermarkBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const newName = fileName.replaceAll('.pdf', '')
    link.download = `${newName}_watermark.pdf`
    link.click();
    URL.revokeObjectURL(url);
  }

  const handleChangeSelectedPage = (value: number) => {
    const index = selectedPages.indexOf(value)

    if (index === -1) {
      selectedPages.push(value)
    } else {
      selectedPages.splice(index, 1)
    }
    selectedPagesDataRef.current = [...selectedPages]
    setSelectedPages([...selectedPages])
  }

  const handleClearFile = () => {
    setFile('')
    setImageList([])
    setCurrentImage(0)
    setFileName('')
    setWatermarkPreviewSize({ width: 0 })
    setCurrentPagesChunk(0)
    transformComponentRef.current?.resetTransform()
    transformComponentRef.current?.centerView(0.8)
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }

  const handleTurnPage = useCallback((event: KeyboardEvent) => {
    if (imageList.length === 0) return
    const max = imageList.length - 1
    const min = 0
    const { key } = event
    if (key === 'ArrowDown') {
      const result = currentImage + 1
      if (result > max) return
      setCurrentImage(result)
    }
    if (key === 'ArrowUp') {
      const result = currentImage - 1
      if (result < min) return
      setCurrentImage(result)
    }
  }, [imageList, currentImage])

  useEffect(() => {
    const genetateImages = async () => {
      if (!file) return
      const fileCopy = file.slice(0)
      const pdfData = new Uint8Array((fileCopy as ArrayBufferLike));
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const numPages = pdf.numPages
      const pagesArray = Array.from(Array(numPages), (item, index) => index)
      const step = 5
      const pagesChunks = chunkArray<number>(pagesArray, step)
      for (let index = 0; index < pagesChunks.length; index++) {
        const pages = pagesChunks[index]
        const promises = pages.map((pageItem) => {
          return new Promise<ImageData>(async (resolve, reject) => {
            const page = await pdf.getPage(pageItem + 1);
            const viewport = page.getViewport({ scale: 1 });
            const imageWidth = viewport.width
            const imageHeight = viewport.height
            if (pageItem === 0) {
              pageWidth.current = imageWidth
            }
            const canvasScale = imageWidth < scalePoint ? devicePixelRatio : 1
            const viewportScale = page.getViewport({ scale: canvasScale })
            const canvas = document.createElement('canvas');
            canvas.className = `canvas_${pageItem}`
            canvas.width = imageWidth * canvasScale
            canvas.height = imageHeight * canvasScale

            const ctx = canvas.getContext('2d');
            if (!ctx) return
            const renderContext = {
              canvasContext: ctx,
              viewport: viewportScale,
            };
            await page.render(renderContext).promise;
            canvas.style.width = `${imageWidth}px`
            canvas.style.height = `${imageHeight}px`
            const imageData = canvas.toDataURL()
            resolve({
              width: imageWidth,
              height: imageHeight,
              data: imageData,
            })
          })
        })
        await Promise.all(promises).then((value) => {
          setCurrentPagesChunk(index)
          imagesListDataRef.current = [...imagesListDataRef.current, ...value]
          selectedPagesDataRef.current = [...selectedPagesDataRef.current, ...pages]
          setImageList(imagesListDataRef.current)
          setSelectedPages(selectedPagesDataRef.current)
        }).catch((error) => {
          setUploading(false)
        })
      }
      messageApi.destroy()
      messageApi.success({
        content: '解析完毕！'
      })
      setUploading(false)
    }
    genetateImages()

  }, [file, devicePixelRatio, messageApi])

  useEffect(() => {
    if (currentPagesChunk === 0) {
      setCurrentImage(0)
      //设置背景的缩放倍数
      if (!leftMainRef.current || !pageWidth.current) return
      const scale = waterUnitWidth / pageWidth.current
      setWatermarkPreviewSize({
        width: scale
      })
      const timer = setTimeout(() => {
        transformComponentRef.current?.resetTransform()
        transformComponentRef.current?.centerView(0.7)
      }, 100)
      return () => {
        clearTimeout(timer)
      }
    }
  }, [imageList, currentPagesChunk])

  useEffect(() => {
    // 监听键盘事件
    window.addEventListener('keydown', handleTurnPage)
    return () => {
      window.removeEventListener('keydown', handleTurnPage)
    }
  }, [imageList, handleTurnPage])

  useEffect(() => {
    if (!imageListRef.current) return
    const children = imageListRef.current.querySelectorAll('.images_item')
    const target = children[currentImage]
    const { bottom: parentBottom, top: parentTop } = imageListRef.current.getBoundingClientRect()
    const { bottom: targetBottom, top: targetTop } = target.getBoundingClientRect()
    if (targetBottom > parentBottom || targetTop < parentTop) {
      target.scrollIntoView()
    }
  }, [currentImage])


  // 是否能够导出文件
  const exportDisabled = !watermarkUnit || !generateWatermarkUnitFinish || !file

  // 如果有水印输入框没有内容，不能应用当前的水印内容
  const isWaterMarkDisaled = waterMarkValue.some(item => !item)

  // 预览的缩放
  const previewScale = Math.min((120 / watermarkSize.height), (288 / watermarkSize.width))

  return (
    <div className="app">
      {contextHolder}
      <div className="header">
        <div className="logo_text">WaterMarks for PDF</div>
      </div>
      <div className="main">
        <div className="left">
          <div className={classNames('left_inner', { 'left_inner_active': !!imageList[currentImage] })}>
            {imageList.length > 0 && (
              <div style={{ width: slideHidden ? '0px' : '193px', overflowX: 'hidden' }}>
                <div className="images" ref={imageListRef}>
                  {imageList.map((item, index) => {
                    return <div className={classNames('images_item', { 'images_item_active': index === currentImage })} onClick={() => { setCurrentImage(index) }}>
                      {watermarkUnit && (
                        <div className="image_select" onClick={(event) => {
                          event.stopPropagation()
                          handleChangeSelectedPage(index)
                        }}>
                          <Checkbox checked={selectedPages.includes(index)}></Checkbox>
                        </div>
                      )}
                      <div className="images_item_inner" style={{ width: '100%' }}>
                        <img src={item.data} alt="" style={{ width: '100%', height: 'auto' }} />
                      </div>
                      <div className="image_num">{index + 1}</div>
                    </div>
                  })}
                  {uploading && (
                    <div className="images_loading">
                      <Spin></Spin>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={leftMainRef} className={classNames('left_main', { 'left_main_images': imageList.length > 0 })}>
              {file && (
                <TransformWrapper ref={transformComponentRef} centerOnInit centerZoomedOut minScale={0.2}>
                  {({ zoomIn, zoomOut }) => {
                    return <>
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                        <div className="selection_outer" ref={selectTransformRef}>
                          <div className="selection" ref={selectionRef}>
                            {imageList[currentImage] && <img style={{ width: '100%' }} alt='' src={imageList[currentImage].data}></img>}
                          </div>
                          {selectedPages.includes(currentImage) && (
                            <div ref={waterCoverRef} className='watermark_cover'
                              style={{
                                backgroundImage: `url(${watermarkUnit?.base64Data})`,
                                backgroundRepeat: 'repeat',
                                backgroundPosition: '0px 0px',
                                backgroundSize: `${watermarkPreviewSize.width * 100}% auto`,
                              }}>
                            </div>
                          )}
                        </div>
                      </TransformComponent>
                      <div className="controls">
                        {imageList.length > 1 && (
                          <Pagination size="default" showQuickJumper pageSize={1} current={currentImage + 1} total={imageList.length} onChange={(value) => { setCurrentImage(value - 1) }} />
                        )}
                      </div>
                      <Button icon={<MenuOutlined></MenuOutlined>} onClick={() => { setSlideHidden(!slideHidden) }} className='hidden_button'></Button>
                      <Button.Group className="scale_buttons">
                        <Button icon={<MinusOutlined></MinusOutlined>} onClick={() => {
                          zoomOut(0.1);
                        }}></Button>
                        <Button icon={<PlusOutlined></PlusOutlined>} onClick={() => {
                          zoomIn(0.1);
                        }}></Button>
                      </Button.Group>
                    </>
                  }}
                </TransformWrapper>
              )}
              {!file && (
                <div className="empty">
                  <input ref={uploadInputRef} className="button_input" accept=".pdf" type="file" onChange={handleFileChange} />
                  <Button icon={<UploadOutlined />} size="large" type="primary" onClick={handleUpload}>上传 PDF 文件</Button>
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
                  width: `${watermarkSize.width}px`,
                  height: `${watermarkSize.height}px`,
                  padding: '12px',
                  transform: `rotate(${-rotate}deg)`,
                  transformOrigin: 'center',
                }}
                ref={watermarkUnitRef}
              >
                {
                  waterMarkValue.map((item, index) => {
                    return (
                      <div
                        className='watermark_item'
                        style={{
                          fontSize: `${textSize}px`,
                          color: `${textColor}`,
                          fontWeight: '400',
                          marginBottom: `${index === waterMarkValue.length - 1 ? 0 : textPadding}px`,
                        }}
                      >
                        {item}
                      </div>
                    )
                  })
                }
              </div>
            </div>
          </div>
        </div>
        <div className="right">
          <div className="right_head">
            <div className="right_title">
              <div>PDF</div>
            </div>
            <div className="upload_button">
              {file && <input ref={uploadInputRef} className="button_input" accept=".pdf" type="file" onChange={handleFileChange} />}
              {!file && <div className="upload_button_empty">请先上传 PDF 文件</div>}
              {file && (
                <div className="file_name_button">
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <div className="file_name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{fileName}</div>
                    <div className="file_name_operator">
                      <Button onClick={handleUpload} style={{ color: 'var(--transparent-gray-800)' }} icon={<RedoOutlined></RedoOutlined>} size="small" type="text"></Button>
                      <div style={{ width: '1px', margin: '0 6px', height: '16px', backgroundColor: 'var(--transparent-gray-300)', flex: 'none' }}></div>
                      <Button onClick={handleClearFile} style={{ color: 'var(--transparent-gray-800)' }} icon={<DeleteFilled></DeleteFilled>} size="small" type="text"></Button>
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
                <Button size="small" type="text" onClick={handleAddText} icon={<PlusOutlined></PlusOutlined>}></Button>
              </div>
              <div className="right_section_body text_body">
                {waterMarkValue.map((item, index) => {
                  return <div className="text_item">
                    <Input size="small" onKeyDown={handlePreventKeyEvent} style={{ flex: '1' }} placeholder="请输入水印文案" value={item} onChange={(event) => { handleChangeText(index, event) }}></Input>
                    <Button size="small" type="text" style={{ color: 'var(--transparent-gray-700)', marginLeft: '4px', flex: 'none' }} onClick={() => { handleDeleteText(index) }} icon={<DeleteFilled></DeleteFilled>}></Button>
                  </div>
                })}
              </div>
            </div>
            <div className="right_section">
              <div className="right_section_title">
                <div>水印配置</div>
              </div>
              <div className="right_section_body">
                <div className="rule_item">
                  <div className="rule_label">水印大小</div>
                  <div className="rule_body">
                    <div className="rule_size">
                      <div className="rule_size_label">宽度</div>
                      <InputNumber style={{ width: '60px' }} controls={false} onKeyDown={handlePreventKeyEvent} onChange={(value) => { setWatermarkSize({ width: value || 0, height: watermarkSize.height }) }} value={watermarkSize.width} size="small"></InputNumber>
                    </div>
                    <div className="rule_size">
                      <div className="rule_size_label">高度</div>
                      <InputNumber style={{ width: '60px' }} controls={false} onKeyDown={handlePreventKeyEvent} onChange={(value) => { setWatermarkSize({ width: watermarkSize.width, height: value || 0 }) }} value={watermarkSize.height} size="small"></InputNumber>
                    </div>
                  </div>
                </div>
                <div className="rule_item">
                  <div className="rule_label">文字颜色</div>
                  <ColorPicker size="small" defaultValue={textColor} onChange={(value, hex) => { setTextColor(hex) }}></ColorPicker>
                </div>
                <div className="rule_item">
                  <div className="rule_label">文字大小</div>
                  <InputNumber controls={false} onKeyDown={handlePreventKeyEvent} size="small" min={12} value={textSize} onChange={(value) => { if (value !== null) { setTextSize(value) } }}></InputNumber>
                </div>
                <div className="rule_item">
                  <div className="rule_label">旋转角度</div>
                  <InputNumber controls={false} onKeyDown={handlePreventKeyEvent} size="small" min={0} max={360} value={rotate} onChange={(value) => { if (value !== null) { setRotate(value) } }}></InputNumber>
                </div>
                <div className="rule_item">
                  <div className="rule_label">水印间距</div>
                  <InputNumber controls={false} onKeyDown={handlePreventKeyEvent} size="small" min={0} value={textPadding} onChange={(value) => { if (value !== null) { setTextPadding(value) } }}></InputNumber>
                </div>
              </div>
            </div>
            <div className="right_section">
              <div className="right_section_title">
                <div>水印单元预览</div>
              </div>
              <div className="right_section_body">
                <div className="watermark_unit_preview">
                  <div style={{ transform: `scale(${previewScale})` }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        width: `${watermarkSize.width}px`,
                        height: `${watermarkSize.height}px`,
                        padding: '12px',
                        transform: `rotate(${-rotate}deg)`,
                        transformOrigin: 'center',
                      }}
                    >
                      {
                        waterMarkValue.map((item, index) => {
                          return (
                            <div
                              className='watermark_item'
                              style={{
                                fontSize: `${textSize}px`,
                                color: `${textColor}`,
                                fontWeight: '400',
                                marginBottom: `${index === waterMarkValue.length - 1 ? 0 : textPadding}px`,
                              }}
                            >
                              {item}
                            </div>
                          )
                        })
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {isWaterMarkDisaled ? (
              <Popover content="请先检查水印内容是否有填写">
                <Button type="default" disabled style={{ width: '100%' }}>应用水印内容</Button>
              </Popover>
            ) : (
              <Button type="default" onClick={generateWatermarkUnit} style={{ width: '100%' }}>应用水印内容</Button>
            )}
          </div>
          <div className="divider"></div>
          <div className="right_bottom">
            {exportDisabled && <Popover content="导出水印前，请先应用水印内容" placement="top"><div><Button type="primary" onClick={handleDownload} loading={generating} disabled style={{ width: '100%' }}>导出文件</Button></div></Popover>}
            {!exportDisabled && <Button type="primary" onClick={handleDownload} loading={generating} style={{ width: '100%' }}>导出文件</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

