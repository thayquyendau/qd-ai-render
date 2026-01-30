
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Icon } from './icons';
import { GoogleGenAI } from '@google/genai';
import type { SourceImage, RenderHistoryItem } from '../types';
import { generateImages, editImage, analyzeMaterialReplacement, analyze3Dto2DConversion, analyzeUtilityTask, upscaleImage } from '../services/geminiService';
import { VirtualTourTab } from './VirtualTourTab';

// Helper to save to local storage safely with pruning
const safeSaveToLocalStorage = (key: string, data: any) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      console.warn(`LocalStorage quota exceeded for ${key}. Pruning history...`);
      if (Array.isArray(data)) {
        // More aggressive pruning for utilities as they store multiple base64 images
        const pruned = data.slice(0, Math.max(0, data.length - 2));
        if (pruned.length > 0) {
           safeSaveToLocalStorage(key, pruned);
        } else {
           localStorage.removeItem(key);
        }
      }
    }
  }
};

const Section: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">{title}</h2>
        {children}
    </div>
);

const ImageUpload: React.FC<{
    sourceImage: SourceImage | null;
    onImageUpload: (image: SourceImage) => void;
    onRemove: () => void;
    title?: string;
    heightClass?: string;
}> = ({ sourceImage, onImageUpload, onRemove, title = "Nhấp hoặc kéo tệp vào đây", heightClass = 'h-48' }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    return (
        <div>
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if(file) {
                    const r = new FileReader(); r.onload = (ev) => onImageUpload({ base64: (ev.target?.result as string).split(',')[1], mimeType: file.type });
                    r.readAsDataURL(file);
                }}}
                className={`relative group border-2 border-dashed rounded-lg p-4 flex items-center justify-center ${heightClass} mb-4 hover:border-brand transition-colors cursor-pointer border-slate-300 bg-slate-50`}
                onClick={() => fileInputRef.current?.click()}
            >
                {sourceImage ? (
                    <>
                        <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Source" className="max-h-full max-w-full object-contain rounded" />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"><Icon name="x-circle" className="w-5 h-5" /></button>
                    </>
                ) : (
                    <div className="text-center text-slate-400 pointer-events-none">
                        <p className="font-medium">{title}</p>
                        <p className="text-xs mt-1 font-medium">Hỗ trợ PNG, JPG, WEBP</p>
                    </div>
                )}
            </div>
            <input type="file" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0]; if(file) {
                    const r = new FileReader(); r.onload = (ev) => onImageUpload({ base64: (ev.target?.result as string).split(',')[1], mimeType: file.type });
                    r.readAsDataURL(file);
                }
            }} className="hidden" accept="image/png, image/jpeg, image/webp" />
        </div>
    );
};

const ImageViewerModal: React.FC<{ imageUrl: string | null; onClose: () => void; }> = ({ imageUrl, onClose }) => {
    if (!imageUrl) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4" onClick={onClose}>
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative animate-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute -top-4 -right-4 bg-brand text-white rounded-full p-2 hover:bg-brand-hover transition-transform duration-200 hover:scale-110 z-[510] shadow-lg">
                    <Icon name="x-mark" className="w-6 h-6" />
                </button>
                <div className="p-2 flex-grow overflow-auto flex items-center justify-center">
                    <img src={imageUrl} alt="Fullscreen View" className="max-w-full max-h-full object-contain rounded-md" />
                </div>
            </div>
        </div>
    );
};

interface UtilityTaskDef {
    id: string;
    name: string;
    description: string;
    icon: string;
    inputs: 1 | 2;
    inputLabels?: string[];
    service: string;
    requiresMask?: boolean;
}

const UTILITY_TASKS: UtilityTaskDef[] = [
    { id: 'sketch_to_render', name: 'Phác thảo thành Render', description: 'Biến ý tưởng thô thành ảnh render 3D chân thực siêu nét.', icon: 'pencil', inputs: 1, inputLabels: ['Bản Phác Thảo'], service: 'generateImages' },
    { id: 'facade_renovation', name: 'Cải tạo Mặt tiền', description: 'Lột xác diện mạo kiến trúc với vật liệu và màu sắc hiện đại.', icon: 'home', inputs: 1, inputLabels: ['Mặt Tiền Cũ'], service: 'generateImages' },
    { id: 'landscape_design', name: 'Thiết kế Cảnh quan', description: 'Kiến tạo sân vườn, hồ bơi, tiểu cảnh nghỉ dưỡng.', icon: 'map', inputs: 1, inputLabels: ['Khoảng Sân Trống'], service: 'generateImages' },
    { id: 'lighting_simulation', name: 'Mô phỏng Ánh sáng', description: 'Đề xuất các kịch bản ánh sáng Ban ngày, Hoàng hôn, Ban đêm.', icon: 'sun', inputs: 1, inputLabels: ['Ảnh Hiện Trạng'], service: 'generateImages' },
    { id: 'design_variation', name: 'Tạo phương án tự động', description: 'Đề xuất nhiều bộ phối màu và vật liệu khác nhau.', icon: 'swatch', inputs: 1, inputLabels: ['Ảnh Gốc'], service: 'generateImages' },
    { id: 'space_analysis', name: 'Phân tích & Gợi ý', description: 'AI chuyên gia đưa ra các nhận xét và giải pháp cải thiện không gian.', icon: 'magnifying-glass-plus', inputs: 1, inputLabels: ['Ảnh Không Gian'], service: 'generateImages' },
    { id: 'change_material', name: 'Thay đổi vật liệu', description: 'Thay thế sàn/tường bằng mẫu vật liệu tham chiếu.', icon: 'brush', inputs: 2, inputLabels: ['Ảnh Căn Phòng', 'Ảnh Mẫu Vật Liệu'], service: 'editImageWithReference', requiresMask: true },
    { id: 'virtual_staging', name: 'Dàn dựng (Staging)', description: 'Thêm nội thất vào phòng trống chuẩn phong thủy.', icon: 'sofa', inputs: 1, inputLabels: ['Ảnh Phòng Trống'], service: 'generateImages' },
    { id: '3d_to_2d', name: '3D thành Bản vẽ 2D', description: 'Tạo bản vẽ kỹ thuật CAD từ ảnh render 3D.', icon: 'pencil', inputs: 1, inputLabels: ['Ảnh Render 3D'], service: 'generateImages' },
];

const STAGING_CONFIG = [
    { type: 'Phòng Khách', items: ['Sofa', 'Bàn trà', 'Kệ TV', 'Thảm', 'Đèn decor', 'Tranh'] },
    { type: 'Phòng Ngủ', items: ['Giường', 'Tủ đầu giường', 'Bàn phấn', 'Rèm', 'Tủ áo'] },
    { type: 'Phòng Bếp', items: ['Bàn ăn', 'Tủ bếp', 'Đèn thả', 'Thiết bị bếp'] },
];

const UtilityRunner: React.FC<{ task: UtilityTaskDef; onBack: () => void; onEditRequest: (imageUrl: string) => void; isStandalone?: boolean; }> = ({ task, onBack, onEditRequest, isStandalone }) => {
    const [sourceImage1, setSourceImage1] = useState<SourceImage | null>(null);
    const [sourceImage2, setSourceImage2] = useState<SourceImage | null>(null);
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<string>("original");
    const [resultImages, setResultImages] = useState<string[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);
    const [brushSize, setBrushSize] = useState(40);
    const [isDrawing, setIsDrawing] = useState(false);
    const [utilityHistory, setUtilityHistory] = useState<RenderHistoryItem[]>([]);
    const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
    const [stagingRoom, setStagingRoom] = useState(STAGING_CONFIG[0].type);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const stored = localStorage.getItem(`utility_history_${task.id}`);
        if (stored) setUtilityHistory(JSON.parse(stored));
    }, [task.id]);

    useEffect(() => {
        const skipAnalysis = ['virtual_staging', 'change_material'];
        if (sourceImage1 && !skipAnalysis.includes(task.id) && !prompt && !isAnalyzing) {
            const run = async () => {
                setIsAnalyzing(true);
                try {
                    let p = '';
                    if (task.id === '3d_to_2d') p = await analyze3Dto2DConversion(sourceImage1);
                    else p = await analyzeUtilityTask(sourceImage1, task.id);
                    setPrompt(p);
                } catch (e) { console.error(e); }
                setIsAnalyzing(false);
            };
            run();
        }
    }, [sourceImage1, task.id]);

    useEffect(() => {
        if (task.id === 'change_material' && sourceImage1 && sourceImage2 && !prompt && !isAnalyzing) {
            const run = async () => {
                setIsAnalyzing(true);
                try { 
                    const suggestedPrompt = await analyzeMaterialReplacement(sourceImage1, sourceImage2);
                    setPrompt(suggestedPrompt); 
                } catch(e){ console.error(e); }
                setIsAnalyzing(false);
            };
            run();
        }
    }, [sourceImage1, sourceImage2, task.id]);

    useEffect(() => {
        if (task.id === 'virtual_staging') {
            const items = selectedItems.length ? selectedItems.join(', ') : 'nội thất cơ bản';
            setPrompt(`Thiết kế nội thất cho ${stagingRoom}. Thêm: ${items}. Phong cách hiện đại, chuẩn phong thủy, bố trí hợp lý.`);
        }
    }, [stagingRoom, selectedItems, task.id]);

    useEffect(() => {
        if (task.requiresMask && sourceImage1) {
            const img = new Image(); img.src = `data:${sourceImage1.mimeType};base64,${sourceImage1.base64}`;
            img.onload = () => {
                if (sourceCanvasRef.current && drawingCanvasRef.current) {
                    sourceCanvasRef.current.width = drawingCanvasRef.current.width = img.width;
                    sourceCanvasRef.current.height = drawingCanvasRef.current.height = img.height;
                    sourceCanvasRef.current.getContext('2d')?.drawImage(img, 0, 0);
                }
            };
        }
    }, [sourceImage1, task.requiresMask]);

    const handleGenerate = async () => {
        if (!sourceImage1) return;

        setIsLoading(true);
        setSelectedImageIndex(0);
        try {
            let images: string[] = [];
            if (task.id === 'change_material') {
                const dc = drawingCanvasRef.current!;
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = dc.width; maskCanvas.height = dc.height;
                const mctx = maskCanvas.getContext('2d')!;
                mctx.fillStyle = 'black'; mctx.fillRect(0,0,dc.width,dc.height);
                mctx.globalCompositeOperation = 'source-over'; mctx.drawImage(dc, 0, 0);
                mctx.globalCompositeOperation = 'source-in'; mctx.fillStyle = 'white'; mctx.fillRect(0,0,dc.width,dc.height);
                const mask = { base64: maskCanvas.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
                images = await editImage(sourceImage1, mask, prompt, sourceImage2, 4);
            } else {
                images = await generateImages(sourceImage1, prompt, 'exterior', 4, sourceImage2, false, false, aspectRatio, false);
            }
            
            if (images && images.length > 0) {
                setResultImages(images);
                const newItem: RenderHistoryItem = {
                    id: Date.now(),
                    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    images: images,
                    prompt: prompt,
                };
                const newHistory = [newItem, ...utilityHistory];
                setUtilityHistory(newHistory);
                safeSaveToLocalStorage(`utility_history_${task.id}`, newHistory);
            }
        } catch (e: any) { 
            console.error(e);
            alert("Lỗi khi tạo ảnh. Vui lòng thử lại.");
        }
        setIsLoading(false);
    };

    const handleUpscale = async (target: '2k' | '4k') => {
        const sourceDataUrl = resultImages[selectedImageIndex];
        if (!sourceDataUrl) return;
        const match = sourceDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (!match) return;
        setUpscalingIndex(selectedImageIndex);
        try {
            const upscaled = await upscaleImage({ mimeType: match[1], base64: match[2] }, target);
            if (upscaled) {
                const newResults = [...resultImages];
                newResults[selectedImageIndex] = upscaled;
                setResultImages(newResults);
            }
        } catch (e) { alert("Lỗi khi upscale."); }
        setUpscalingIndex(null);
    };

    return (
        <div className="animate-in fade-in duration-500 relative z-10">
            {!isStandalone && (
                <button onClick={onBack} className="text-brand hover:text-brand-hover mb-6 flex items-center gap-2 font-semibold transition-transform hover:-translate-x-1">
                    <Icon name="arrow-uturn-left" className="w-5 h-5"/> Quay lại danh mục
                </button>
            )}
            
            {isStandalone && (
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold font-orbitron text-brand uppercase tracking-widest">{task.name} - AI POWERED</h1>
                    <p className="text-slate-500 text-sm mt-1">{task.description}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-10">
                <div className="lg:col-span-1 space-y-6">
                    <Section title="1. Cấu Hình">
                        <div className="space-y-5">
                            {task.requiresMask && sourceImage1 ? (
                                <div className="space-y-3">
                                    <label className="text-xs text-brand font-bold uppercase block">Vùng cần thay thế:</label>
                                    <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                        <canvas ref={sourceCanvasRef} className="w-full h-full object-contain" />
                                        <canvas ref={drawingCanvasRef} className="absolute inset-0 w-full h-full cursor-crosshair"
                                            onMouseDown={(e) => {
                                                setIsDrawing(true); const r = drawingCanvasRef.current!.getBoundingClientRect();
                                                const x = (e.clientX-r.left)*(drawingCanvasRef.current!.width/r.width);
                                                const y = (e.clientY-r.top)*(drawingCanvasRef.current!.height/r.height);
                                                const ctx = drawingCanvasRef.current!.getContext('2d')!;
                                                ctx.beginPath(); ctx.moveTo(x,y);
                                            }}
                                            onMouseMove={(e) => {
                                                if(!isDrawing) return; const r = drawingCanvasRef.current!.getBoundingClientRect();
                                                const x = (e.clientX-r.left)*(drawingCanvasRef.current!.width/r.width);
                                                const y = (e.clientY-r.top)*(drawingCanvasRef.current!.height/r.height);
                                                const ctx = drawingCanvasRef.current!.getContext('2d')!;
                                                ctx.lineTo(x,y); ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
                                                ctx.lineWidth = brushSize*(drawingCanvasRef.current!.width/r.width); ctx.lineCap = 'round'; ctx.stroke();
                                            }}
                                            onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)}
                                        />
                                        <button onClick={() => setSourceImage1(null)} className="absolute top-2 right-2 bg-black/70 p-1.5 rounded-full z-20 hover:bg-red-600"><Icon name="x-circle" className="w-5 h-5"/></button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold">Cỡ cọ:</span>
                                        <input type="range" min="10" max="150" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="flex-grow h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand" />
                                    </div>
                                </div>
                            ) : (
                                <ImageUpload sourceImage={sourceImage1} onImageUpload={setSourceImage1} onRemove={() => {setSourceImage1(null); setPrompt('');}} title={task.inputLabels?.[0]} />
                            )}

                            {task.id === 'virtual_staging' && (
                                <div className="space-y-4 bg-brand-light p-4 rounded-lg border border-brand/10">
                                    <div>
                                        <label className="text-xs text-brand font-bold uppercase mb-2 block">Loại Phòng:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {STAGING_CONFIG.map(c => (
                                                <button key={c.type} onClick={() => {setStagingRoom(c.type); setSelectedItems([]);}} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${stagingRoom === c.type ? 'bg-brand text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>{c.type}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-brand font-bold uppercase mb-2 block">Nội Thất Cần Thêm:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {STAGING_CONFIG.find(c => c.type === stagingRoom)?.items.map(i => (
                                                <button key={i} onClick={() => setSelectedItems(p => p.includes(i) ? p.filter(x=>x!==i) : [...p,i])} className={`px-3 py-1 rounded border text-[11px] font-medium transition-all ${selectedItems.includes(i) ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{i}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {task.inputs === 2 && <ImageUpload sourceImage={sourceImage2} onImageUpload={setSourceImage2} onRemove={() => {setSourceImage2(null); setPrompt('');}} title={task.inputLabels?.[1]} heightClass="h-32" />}

                            <div className="grid grid-cols-1 gap-2">
                                <label className="block text-xs font-bold text-brand uppercase mb-2">Tỷ lệ khung hình</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {["original", "1:1", "3:4", "4:3", "9:16", "16:9"].map((ratio) => (
                                        <button
                                            key={ratio}
                                            onClick={() => setAspectRatio(ratio)}
                                            className={`py-1.5 px-1 rounded text-[11px] font-bold transition-all border ${aspectRatio === ratio ? 'bg-brand shadow-sm shadow-brand/20 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            {ratio === 'original' ? 'MẶC ĐỊNH' : ratio}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative z-0">
                                <label className="text-xs text-brand font-bold uppercase mb-2 block">Mô tả thiết kế:</label>
                                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg h-32 text-sm focus:ring-2 focus:ring-brand outline-none text-slate-700 shadow-sm" placeholder="AI sẽ tự động mô tả..." />
                                {isAnalyzing && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-20 backdrop-blur-[1px]">
                                        <div className="animate-spin h-5 w-5 border-2 border-brand border-t-transparent rounded-full mr-2"></div>
                                        <span className="text-xs font-bold text-brand">Đang phân tích...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Section>
                    <button onClick={handleGenerate} disabled={isLoading || isAnalyzing || !sourceImage1} className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-brand/20 disabled:bg-slate-200 disabled:text-slate-500 flex items-center justify-center gap-2 transition-all">
                        <Icon name="sparkles" className="w-5 h-5" />
                        {isLoading ? "Đang tạo Render..." : "Bắt đầu Render"}
                    </button>
                </div>

                <div className="lg:col-span-2 space-y-8 relative z-10">
                    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl flex flex-col min-h-[550px] relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-700">Kết Quả Render</h2>
                            {resultImages.length > 0 && <span className="text-sm text-slate-500 font-medium font-inter">{resultImages.length} ảnh</span>}
                        </div>

                        <div className="flex-grow flex items-center justify-center bg-slate-100 rounded-lg relative group overflow-hidden border border-slate-200 shadow-inner mb-4 min-h-[400px]">
                            {isLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md z-30">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand mb-4"></div>
                                    <p className="text-brand font-bold text-xs tracking-widest animate-pulse uppercase font-inter">Đang kiến tạo không gian...</p>
                                </div>
                            ) : resultImages.length > 0 ? (
                                <div className="relative w-full h-full flex items-center justify-center p-4">
                                    <img src={resultImages[selectedImageIndex]} className="max-w-full max-h-[500px] object-contain rounded-md transition-opacity shadow-2xl" alt="Result" />
                                    
                                    {upscalingIndex === selectedImageIndex ? (
                                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-40 rounded-lg backdrop-blur-sm">
                                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100 mb-3"></div>
                                            <p className="font-bold text-xs text-slate-200">Đang tối ưu...</p>
                                        </div>
                                    ) : (
                                        <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto">
                                            <button onClick={() => setFullscreenImg(resultImages[selectedImageIndex])} className="bg-white/90 backdrop-blur-md border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-lg transition-all">
                                                <Icon name="arrows-expand" className="w-4 h-4" /> <span>PHÓNG TO</span>
                                            </button>
                                            <button onClick={() => onEditRequest(resultImages[selectedImageIndex])} className="bg-white/90 backdrop-blur-md border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-lg transition-all">
                                                <Icon name="pencil" className="w-4 h-4" /> <span>SỬA ẢNH</span>
                                            </button>
                                            <a href={resultImages[selectedImageIndex]} download={`Utility-${Date.now()}.png`} className="bg-white/90 backdrop-blur-md border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-lg transition-all">
                                                <Icon name="download" className="w-4 h-4" /> <span>TẢI VỀ</span>
                                            </a>
                                        </div>
                                    )}

                                    {upscalingIndex === null && (
                                        <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto">
                                            <button onClick={() => handleUpscale('2k')} className="bg-white/90 backdrop-blur-md border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-[10px] px-3 py-1.5 rounded-md shadow-lg transition-all">UPSCALE 2K</button>
                                            <button onClick={() => handleUpscale('4k')} className="bg-white/90 backdrop-blur-md border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-[10px] px-3 py-1.5 rounded-md shadow-lg transition-all">UPSCALE 4K</button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center text-slate-600 py-10">
                                    <Icon name="photo" className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                    <p className="text-sm font-medium opacity-40">Kết quả render sẽ xuất hiện ở đây.</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                            {!isLoading && resultImages.map((image, index) => (
                                <div
                                    key={index}
                                    className={`relative group aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${selectedImageIndex === index ? 'ring-2 ring-offset-2 ring-offset-white ring-brand' : 'opacity-70 hover:opacity-100'}`}
                                    onClick={() => setSelectedImageIndex(index)}
                                >
                                    <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2"><Icon name="clock" className="w-5 h-5 text-brand" /> Lịch sử {task.name}</h2>
                            {utilityHistory.length > 0 && (
                                <button onClick={() => { if(confirm("Xóa toàn bộ lịch sử?")) { setUtilityHistory([]); localStorage.removeItem(`utility_history_${task.id}`); }}} className="text-red-500 hover:text-red-600 text-xs font-bold flex items-center gap-1 transition-colors"><Icon name="trash" className="w-4 h-4" /> XÓA TẤT CẢ</button>
                            )}
                        </div>
                        {utilityHistory.length > 0 ? (
                            <div className="space-y-3 overflow-y-auto max-h-72 pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                {utilityHistory.map((item) => (
                                    <div key={item.id} onClick={() => {setResultImages(item.images); setSelectedImageIndex(0);}} className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl hover:bg-slate-100 cursor-pointer transition-all border border-slate-100 hover:border-slate-200 shadow-sm">
                                        <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden shadow-sm border border-slate-100"><img src={item.images[0]} className="w-full h-full object-cover" /></div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-center mb-0.5"><p className="font-bold text-xs text-slate-700">{item.images.length} ảnh</p><span className="text-[10px] font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-xs">{item.timestamp}</span></div>
                                            <p className="text-[11px] text-slate-500 truncate leading-relaxed" title={item.prompt}>{item.prompt}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-10 text-xs text-slate-500 font-bold uppercase tracking-widest opacity-30">Chưa có lịch sử hoạt động</p>
                        )}
                    </div>
                </div>
            </div>
            {fullscreenImg && <ImageViewerModal imageUrl={fullscreenImg} onClose={() => setFullscreenImg(null)} />}
        </div>
    );
};

export const UtilitiesTab: React.FC<{ initialTaskId?: string; onEditRequest: (imageUrl: string) => void; isStandalone?: boolean; }> = ({ initialTaskId, onEditRequest, isStandalone }) => {
    const [selectedTask, setSelectedTask] = useState<UtilityTaskDef | null>(null);

    useEffect(() => {
        if (initialTaskId) {
            const t = UTILITY_TASKS.find(x => x.id === initialTaskId);
            if (t) setSelectedTask(t);
        }
    }, [initialTaskId]);

    if (selectedTask?.id === 'virtual_tour') return <VirtualTourTab />;
    if (selectedTask) return <UtilityRunner task={selectedTask} onBack={() => setSelectedTask(null)} onEditRequest={onEditRequest} isStandalone={isStandalone} />;
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {UTILITY_TASKS.map(t => (
                <div key={t.id} onClick={() => setSelectedTask(t)} className="bg-white border border-slate-200 p-6 rounded-2xl hover:border-brand hover:bg-slate-50 cursor-pointer transition-all shadow-sm group border-b-4 border-b-transparent hover:border-b-brand relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 text-brand/5 rotate-12 group-hover:scale-125 transition-transform duration-700 pointer-events-none"><Icon name={t.icon} className="w-32 h-32" /></div>
                    <div className="text-brand mb-5 transition-transform group-hover:scale-110 group-hover:-rotate-3 relative z-10"><Icon name={t.icon} className="w-10 h-10" /></div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2 relative z-10">{t.name}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed relative z-10">{t.description}</p>
                    <div className="mt-6 flex items-center text-brand text-[11px] font-bold tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-all relative z-10">SỬ DỤNG NGAY <Icon name="arrow-right" className="w-3 h-3 ml-2" /></div>
                </div>
            ))}
        </div>
    );
};
