import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import html2canvas from 'html2canvas';
import classNames from 'classnames';
import { BlendMode, PDFDocument } from 'pdf-lib'
import imageCompression from 'browser-image-compression';
import { Button, Form, Input, Message, Checkbox, Radio, NumericInput, Alert, Pagination, Icon } from 'adui'
import { TransformComponent, TransformWrapper, ReactZoomPanPinchRef, useControls } from 'react-zoom-pan-pinch'
import { debounce } from 'lodash'
import axios from 'axios'
import { Buffer } from 'buffer';
import './App.css';
import { waterMarkData, sizeData, ISizeData } from './data'
const work = require('pdfjs-dist/build/pdf.worker')
// import './pdfjsWorkerSetup.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = work

type SizeDataKeys = keyof ISizeData

interface WatermarkUnitData {
  base64Data: string
  bufferData: ArrayBuffer | string,
  nums: number
}

interface ImageData {
  width: number
  height: number
  canvas: HTMLCanvasElement
}

const getDomCanvas = async <T extends HTMLElement,>(dom: T, devicePixelRatio: number) => {
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

const base64ToImage = (base64: string) => {
  return new Promise((resolve: (value: HTMLImageElement) => void, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64;
    img.onload = () => {
      resolve(img)
    }
    img.onerror = (event) => {
      reject(event)
    }
  }).then((value: HTMLImageElement) => { return value }).catch((event) => { throw event })
}

const createCanvasWidthImage = (canvasWidth: number, canvasHeight: number, devicePixelRatio: number, waterUnit: HTMLCanvasElement, offsetX = 0, selectImage?: HTMLImageElement) => {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvasWidth * devicePixelRatio
    const height = canvasHeight * devicePixelRatio
    canvas.width = width
    canvas.height = height
    // 绘制图片
    if (selectImage) {
      ctx.globalCompositeOperation = 'exclusion'
      ctx.drawImage(selectImage, 0, 0, width, height)
    }
    // 绘制水印
    ctx.globalCompositeOperation = 'exclusion'
    const pattern = ctx.createPattern(waterUnit, "repeat");
    if (!pattern) return
    ctx.translate(offsetX, 0)
    ctx.fillStyle = pattern
    ctx.fillRect(-offsetX, 0, width, height)
    // 绘制结束缩小宽高，保证不会模糊
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${canvasHeight}px`
    canvas.style.position = "absolute"
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    canvas.style.top = '0px',
      canvas.style.left = '0px'
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob as Blob)
      } else {
        reject()
      }
    })
  }).then((value: Blob) => { return value }).catch(() => { })
}


const App: React.FC = () => {
  const [file, setFile] = useState<ArrayBuffer | string>('')
  const [fileName, setFileName] = useState('')
  const [watermarkUnit, setWatermarkUnit] = useState<WatermarkUnitData | null>(null)
  const [imageList, setImageList] = useState<ImageData[]>([])
  const [currentImage, setCurrentImage] = useState(0)
  const [waterMarkValue, setWaterMarkValue] = useState<Array<string>>([])
  const [contentSizeType, setContentSizeType] = useState<SizeDataKeys | null>('size1')
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [contentSize, setContentSize] = useState({ width: sizeData.size1.size[0], height: sizeData.size1.size[1] })
  const [generating, setGenerating] = useState(false)
  const [hasCustomize, setHasCustomize] = useState(false)
  const [customizeContent, setCustomizeContent] = useState<string | undefined>('')
  const [customizeGenerateFinish, setCustomizeGenerateFinish] = useState(false)
  const [generateWatermarkUnitFinish, setGenerateWatermarkUnitFinish] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [watermarkScale, setWatermarkScale] = useState(1)
  const watermarkUnitRef = useRef<HTMLDivElement>(null)
  const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null)
  const selectTransformRef = useRef<HTMLDivElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const imageListRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<any>(null)
  const selectionRef = useRef<HTMLDivElement>(null)
  const leftMainRef = useRef<HTMLDivElement>(null)
  const pageWidth = useRef(0)
  const devicePixelRatio = window.devicePixelRatio
  const waterUnitWidth = 222
  const waterUnitHeight = 168
  const offsetX = 138;

  const generateWatermarkUnit = useCallback(async () => {
    if (!watermarkUnitRef.current) return
    // 获取当前水印单元画布
    const watermarkCanvas = await getDomCanvas(watermarkUnitRef.current, devicePixelRatio)
    // 获取水印单元 base64 数据
    const watermarkUnitImageBase64 = watermarkCanvas.toDataURL()
    // setWatermarkUnit(watermarkUnitImageBase64)
    // 获取水印单元 buffer 数据
    watermarkCanvas.toBlob((blob) => {
      if (!blob) return
      const reader = new FileReader()
      reader.onload = () => {
        if (!reader.result) return
        // setWatermarkBuffer(reader.result)
        setWatermarkUnit({
          base64Data: watermarkUnitImageBase64,
          bufferData: reader.result,
          nums: waterMarkValue.length
        })
        Message.success({
          content: "已应用水印内容",
        })
        setGenerateWatermarkUnitFinish(true)
      }
      reader.readAsArrayBuffer(blob)
    })
  }, [devicePixelRatio, waterMarkValue])

  const handleCheckboxChange = (value: string[]) => {
    if (value.length === 3) {
      value.shift()
    }
    setWaterMarkValue(value)
    setGenerateWatermarkUnitFinish(false)
  }

  const handleGenerateCustomize = async () => {
    if (customizeGenerateFinish) return
    // await generateWatermarkUnit()
    setCustomizeGenerateFinish(true)
  }

  const handleUpload = () => {
    if (uploadInputRef.current) {
      uploadInputRef.current.click()
    }
  }

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return
    setUploading(true)
    messageRef.current = Message.normal({
      content: "文件解析中，请耐心等待",
      duration: 0,
    })
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFile(event.target?.result)
        setFileName(file.name)
      }
    };
    reader.readAsArrayBuffer(file);
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
        const watermarkWidth = waterUnitWidth;
        const watermarkHeight = waterUnitHeight * waterMarkValue.length;
        const columns = Math.ceil(width / watermarkWidth);
        const rows = Math.ceil(height / watermarkHeight);

        // 在页面上重复绘制水印图片
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < columns; col++) {
            page.drawImage(watermarkImage, {
              blendMode: BlendMode.Exclusion,
              x: col * watermarkWidth,
              y: row * watermarkHeight,
              width: watermarkWidth,
              height: watermarkHeight,
            });
          }
        }
      }
    }
    const pdfWithWatermarkBytes = await pdfDoc.save({ useObjectStreams: true });
    // const bufferData = Buffer.from(pdfWithWatermarkBytes)
    // const base64String = bufferData.toString("base64")
    // axios({
    //   method: 'post',
    //   url: 'http://localhost:8001/api/pdf/compress',
    //   data: {
    //     fileName: fileName.replaceAll('.pdf', ''),
    //     fileData: base64String
    //   }
    // }).then((data) => {
    //   console.log('paki compress', data.data.data.data);
    //   const blob = new Blob([new Uint8Array(data.data.data.data)], { type: 'application/pdf' });
    //   const url = URL.createObjectURL(blob);

    //   const link = document.createElement('a');
    //   link.href = url;
    //   const newName = fileName.replaceAll('.pdf', '')
    //   link.download = `${newName}_watermark.pdf`
    //   link.click();
    //   URL.revokeObjectURL(url);
    // }).catch((error) => {
    //   console.log('paki error', error);
    // })
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
    setSelectedPages([...selectedPages])
  }

  const handleChangeContentSize = useCallback(debounce((type: 'width' | 'height', value: string | undefined) => {
    if (value === undefined) return
    if (type === 'width') {
      setContentSize({
        width: Number(value),
        height: contentSize.height
      })
    }
    if (type === 'height') {
      setContentSize({
        width: contentSize.width,
        height: Number(value)
      })
    }
  }, 150, { leading: true, trailing: true }), [contentSize])

  const handleGenerateImage = async () => {
    setGenerating(true)
    // 生成水印单元的 canvas
    if (!watermarkUnit?.base64Data) return
    const watermarkUnitImage = await base64ToImage(watermarkUnit.base64Data)
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return
    const tempImageWidth = waterUnitWidth * devicePixelRatio;
    const tempImageHeight = waterUnitHeight * waterMarkValue.length * devicePixelRatio;
    tempCanvas.width = tempImageWidth
    tempCanvas.height = tempImageHeight
    tempCtx.drawImage(
      watermarkUnitImage,
      0,
      0,
      tempImageWidth,
      tempImageHeight
    );
    // 如果没有选中图层，直接生成水印
    const blob = await createCanvasWidthImage(contentSize.width, contentSize.height, devicePixelRatio, tempCanvas, offsetX)
    const fileName = `watermark_${contentSize.width}x${contentSize.height}@2x`;
    const downloadLink = document.createElement("a");
    const url = URL.createObjectURL(blob as Blob);
    downloadLink.href = url
    downloadLink.download = `${fileName}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    setGenerating(false)
  }

  const handleClearFile = () => {
    setFile('')
    setImageList([])
    setCurrentImage(0)
    setFileName('')
    setWatermarkScale(1)
    if (uploadInputRef.current) {
      uploadInputRef.current.value = ''
    }
  }


  useEffect(() => {
    if (waterMarkValue.includes('customize')) {
      setHasCustomize(true)
    } else {
      setHasCustomize(false)
      setCustomizeGenerateFinish(false)
    }
  }, [waterMarkValue, customizeGenerateFinish, generateWatermarkUnit])

  useEffect(() => {
    if (!contentSizeType) return
    setContentSize({
      width: sizeData[contentSizeType].size[0],
      height: sizeData[contentSizeType].size[1]
    })
  }, [contentSizeType])

  useEffect(() => {
    const genetateImages = async () => {
      if (!file) return
      const fileCopy = file.slice(0)
      const pdfData = new Uint8Array((fileCopy as ArrayBufferLike));
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const promises = Array.from(Array(pdf.numPages), (item, index) => index).map((item, itemIndex) => {
        return new Promise<ImageData>(async (resolve, reject) => {
          const page = await pdf.getPage(item + 1);
          const viewport = page.getViewport({ scale: 1 });
          const imageWidth = viewport.width
          const imageHeight = viewport.height
          if (itemIndex === 0) {
            pageWidth.current = imageWidth
          }
          const viewportScale = page.getViewport({ scale: devicePixelRatio })
          const canvas = document.createElement('canvas');
          canvas.className = `canvas_${itemIndex}`
          canvas.width = imageWidth * devicePixelRatio
          canvas.height = imageHeight * devicePixelRatio

          const ctx = canvas.getContext('2d');
          if (!ctx) return
          const renderContext = {
            canvasContext: ctx,
            viewport: viewportScale,
          };
          await page.render(renderContext).promise;
          canvas.style.width = `${imageWidth}px`
          canvas.style.height = `${imageHeight}px`
          // const url = canvas.toDataURL("image/png")
          resolve({
            width: imageWidth,
            height: imageHeight,
            canvas,
          })
        })
      })
      Promise.all(promises).then((value) => {
        if (messageRef.current) {
          messageRef.current.destroy()
        }
        setImageList(value)
        setUploading(false)
      }).catch((error) => {
        console.log(error)
        setUploading(false)
      })
    }
    const timer = setTimeout(() => {
      genetateImages()
    }, 300)

    return () => {
      clearTimeout(timer)
    }

  }, [file, devicePixelRatio])

  useEffect(() => {
    const pages = Array.from(Array(imageList.length), (item, index) => index)
    setCurrentImage(0)
    setSelectedPages(pages)

    // 页面插入 canvas 节点
    const imageDoms = document.getElementsByClassName('images_item')
    Array.from(imageDoms).forEach((item, index) => {
      const canvasDom = item.getElementsByClassName('canvas')[0]
      canvasDom.innerHTML = ''
      canvasDom.appendChild(imageList[index].canvas)
    })

    //设置背景的缩放倍数
    if (!leftMainRef.current || !pageWidth.current || imageList.length === 0) return
    const { clientWidth } = leftMainRef.current
    setWatermarkScale(clientWidth / pageWidth.current)
  }, [imageList])


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

  const checkboxContent = (
    <div>
      <Checkbox.Group value={waterMarkValue} onChange={handleCheckboxChange}>
        {
          Object.entries(waterMarkData).map((item) => {
            return <Checkbox style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }} value={item[1].key} key={item[1].key}><div className="checkbox_content">{item[1].desc}</div></Checkbox>
          })
        }
      </Checkbox.Group>
      {hasCustomize && (
        <div className="customize">
          <Input.Textarea
            style={{ height: '60px', width: '100%' }}
            onChange={(e, value) => {
              setCustomizeContent(value)
            }}
            limit={20}
            value={customizeContent}
            intent={(customizeContent !== undefined && customizeContent.length > 20) ? 'danger' : 'normal'}
          >
          </Input.Textarea>
          <Button
            onClick={handleGenerateCustomize}
            intent={customizeGenerateFinish ? 'success' : 'normal'}
            leftIcon={customizeGenerateFinish ? 'tick-circle' : undefined}
            theme={customizeGenerateFinish ? 'light' : null}
            style={{ width: '100%', marginTop: '6px' }}
            active={customizeGenerateFinish}
            disabled={customizeContent !== undefined && customizeContent.length > 20}
          >
            {customizeGenerateFinish ? '已应用自定义内容' : '完成输入'}
          </Button>
        </div>
      )}
    </div>
  )
  return (
    <div className="app">
      <div className="header">
        <Icon style={{ transform: 'rotate(180deg)', marginRight: '8px' }} icon="location-outlined" size={24} color="rgb(255, 255, 255)"></Icon>
        <div className="logo_text">TAD WaterMarks for PDF</div>
      </div>
      <div className="main">
        <div className="left">
          <div ref={leftMainRef} className={classNames('left_inner', { 'left_inner_active': !!imageList[currentImage] })}>
            {imageList.length > 0 && (
              <div className="images" ref={imageListRef}>
                {imageList.map((item, index) => {
                  return <div className={classNames('images_item', { 'images_item_active': index === currentImage })} onClick={() => { setCurrentImage(index) }}>
                    {watermarkUnit && (
                      <div className="image_select" onClick={(event) => {
                        event.stopPropagation()
                        handleChangeSelectedPage(index)
                      }}>
                        <Checkbox size="large" checked={selectedPages.includes(index)}></Checkbox>
                      </div>
                    )}
                    <div className="images_item_inner" style={{ width: '100%', height: `${(160 / item.width) * item.height}px`, }}>
                      <div style={{ width: 'fit-content', transform: `scale(${160 / (item.width)})`, transformOrigin: 'left top', position: 'relative' }}>
                        <div className="canvas"></div>
                      </div>
                    </div>
                    <div className="image_num">{index + 1}</div>
                  </div>
                })}
              </div>
            )}
            <div className={classNames('left_main', { 'left_main_images': imageList.length > 0 })}>
              {(imageList[currentImage] || waterMarkValue.length !== 0) && (
                <TransformWrapper ref={transformComponentRef} initialScale={0.8} centerOnInit centerZoomedOut minScale={0.2}>
                  {({ zoomIn, zoomOut }) => {
                    return <>
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                        <div className="selection_outer" ref={selectTransformRef}>
                          <div className="selection" ref={selectionRef}>
                            {/* {imageList[currentImage] && imageList[currentImage].canvas} */}
                            {imageList[currentImage] && <img style={{ width: '100%' }} alt='' src={imageList[currentImage].canvas.toDataURL()}></img>}
                          </div>
                          {(!file && waterMarkValue.length !== 0) && (
                            <div style={{ border: '1px solid #C7C7C7', width: `${contentSize.width}px`, height: `${contentSize.height}px` }}></div>
                          )}
                          <div className='watermark_cover'
                            style={{
                              backgroundImage: `url(${watermarkUnit?.base64Data})`,
                              backgroundRepeat: 'repeat',
                              backgroundPosition: file ? '0px 0px' : `-${offsetX}px 0px`,
                              backgroundSize: `${waterUnitWidth * watermarkScale}px ${(watermarkUnit?.nums || waterMarkValue.length) * 168 * watermarkScale}px`,
                              mixBlendMode: 'exclusion'
                            }}>
                          </div>
                        </div>
                      </TransformComponent>
                      <div className="controls">
                        {imageList.length > 1 && <Pagination size="medium" total={imageList.length} pageSize={1} showButtonJumper showInputJumper current={currentImage + 1} onChange={(value) => { setCurrentImage(value - 1) }}></Pagination>}
                      </div>
                      <Button.Group size="medium" className="scale_buttons">
                        <Button leftIcon="minus" onClick={() => { zoomOut(0.1) }}></Button>
                        <Button leftIcon="add" onClick={() => { zoomIn(0.1) }}></Button>
                      </Button.Group>
                    </>
                  }}
                </TransformWrapper>
              )}
              {(!imageList[currentImage] && waterMarkValue.length === 0) && (
                <div className="empty">
                  <div>选择水印内容，可预览水印效果</div>
                  <div>上传 pdf，导出带水印的文件</div>
                </div>
              )}
            </div>
          </div>
          <div className="watermark_unit" ref={watermarkUnitRef}>
            {
              waterMarkValue.map((item) => {
                if (item === 'customize') {
                  return (
                    <div className="watermark_item">
                      <div className="watermark_item_inner">{customizeContent}</div>
                    </div>
                  )
                } else {
                  return (
                    <div className="watermark_item">
                      <div className="watermark_item_inner">{waterMarkData[item].content}</div>
                    </div>
                  )
                }
              })
            }
          </div>
        </div>
        <div className="right">
          <div className="right_top">
            <div className="right_head">
              <div className="right_title">
                <div>PDF</div>
              </div>
              <div className="upload_button">
                <input ref={uploadInputRef} className="button_input" accept=".pdf" type="file" onChange={handleFileChange} />
                {!fileName && <Button loading={uploading} size="medium" onClick={handleUpload} style={{ width: '100%' }} leftIcon="upload">上传文件</Button>}
                {fileName && (
                  <div className="file_name_button">
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <div className="file_name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{fileName}</div>
                      <div className="file_name_operator">
                        <Button onClick={handleUpload} leftIcon="refresh" size="mini" theme="light"></Button>
                        <div style={{ width: '1px', margin: '0 6px', height: '16px', backgroundColor: 'var(--transparent-gray-300)', flex: 'none' }}></div>
                        <Button onClick={handleClearFile} leftIcon="delete-outlined" size="mini" theme="light"></Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="divider"></div>
            <div>
              <div className="right_title">
                <div className="right_title_inner">
                  <div>水印内容</div>
                  <div className="watermark_number" style={{ marginLeft: '8px' }}>{waterMarkValue.length}/2</div>
                </div>
                {waterMarkValue.length > 0 && <Button onClick={generateWatermarkUnit}>应用</Button>}
              </div>
              <div className="right_checkbox">{checkboxContent}</div>
              <div className="divider"></div>
              <div>
                <div className="right_title">
                  <div>导出空白水印（@2x）</div>
                </div>
                <Radio.Group disabled={!!file} value={contentSizeType} style={{ display: 'block' }} onChange={(value) => {
                  console.log(value)
                  setContentSizeType(value)
                }}>
                  {Object.entries(sizeData).map((entry) => {
                    return <Radio style={{ display: 'block', marginLeft: '0px' }} key={entry[0]} value={entry[0]}>{entry[1].desc}</Radio>
                  })}
                </Radio.Group>
                {contentSizeType === 'size3' && (
                  <div className="customize_size">
                    <Input onChange={(event, value) => { handleChangeContentSize('width', value) }} type="number" value={`${contentSize.width}`} style={{ width: '72px' }}></Input>
                    <div style={{ margin: '0 8px' }}>×</div>
                    <Input onChange={(eent, value) => { handleChangeContentSize('height', value) }} type="number" value={`${contentSize.height}`} style={{ width: '72px' }}></Input>
                    <div style={{ marginLeft: '8px' }}>px</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="right_bottom">
            {file && <Button intent="primary" onClick={handleDownload} loading={generating} disabled={!watermarkUnit || !generateWatermarkUnitFinish} style={{ width: '100%' }}>导出文件</Button>}
            {!file && <Button intent="primary" onClick={handleGenerateImage} loading={generating} disabled={!watermarkUnit || !generateWatermarkUnitFinish} style={{ width: '100%' }} >导出空白水印</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

