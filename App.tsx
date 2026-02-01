import React, { useState, useCallback, useEffect } from "react";
import type { RenderHistoryItem, SourceImage, EditHistoryItem } from "./types";
import {
  generateImages,
  upscaleImage,
  describeInteriorImage,
} from "./services/geminiService";
import { Icon } from "./components/icons";
import { ImageEditor } from "./components/ImageEditor";
import { UtilitiesTab } from "./components/UtilitiesTab";

// Helper to save to local storage safely with pruning
const safeSaveToLocalStorage = (key: string, data: any) => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e: any) {
    if (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014) {
      console.warn(
        `LocalStorage quota exceeded for ${key}. Pruning history...`,
      );
      if (Array.isArray(data)) {
        const pruned = data.slice(0, Math.max(0, data.length - 3));
        if (pruned.length > 0) {
          safeSaveToLocalStorage(key, pruned);
        }
      }
    }
  }
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl">
    <h2 className="text-lg font-semibold text-slate-700 mb-4">{title}</h2>
    {children}
  </div>
);

const ImageUpload: React.FC<{
  sourceImage: SourceImage | null;
  onImageUpload: (image: SourceImage) => void;
  onRemove: () => void;
}> = ({ sourceImage, onImageUpload, onRemove }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        if (base64) {
          onImageUpload({ base64, mimeType: file.type });
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("Vui lòng tải lên một tệp ảnh hợp lệ (PNG, JPG, WEBP).");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
        className={`relative group border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-48 mb-4 hover:border-brand transition-colors cursor-pointer ${isDraggingOver ? "border-brand bg-brand-light" : "border-slate-300 bg-slate-50"}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {sourceImage ? (
          <>
            <img
              src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`}
              alt="Source"
              className="max-h-full max-w-full object-contain rounded"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
            >
              <Icon name="x-circle" className="w-5 h-5" />
            </button>
          </>
        ) : (
          <div className="text-center text-slate-400 pointer-events-none">
            <p className="font-medium">Nhấp hoặc kéo tệp vào đây</p>
            <p className="text-xs">PNG, JPG, WEBP</p>
          </div>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-2 px-4 rounded transition-colors shadow-sm"
      >
        {sourceImage ? "Đổi Ảnh Khác" : "Tải Lên Ảnh"}
      </button>
    </div>
  );
};

const ReferenceImageUpload: React.FC<{
  image: SourceImage | null;
  onUpload: (image: SourceImage) => void;
  onRemove: () => void;
}> = ({ image, onUpload, onRemove }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const processFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        if (base64) onUpload({ base64, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  if (image) {
    return (
      <div className="relative group">
        <img
          src={`data:${image.mimeType};base64,${image.base64}`}
          alt="Reference"
          className="w-full h-56 object-cover rounded-md"
        />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 bg-black/50 rounded-full text-white hover:bg-black/80 p-0.5 transition-colors opacity-0 group-hover:opacity-100 z-10"
        >
          <Icon name="x-circle" className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
        className={`w-full border-2 border-dashed rounded-lg p-4 flex items-center justify-center h-56 text-center text-slate-400 text-sm hover:border-brand transition-colors ${isDraggingOver ? "border-brand bg-brand-light" : "border-slate-300 bg-slate-50"}`}
      >
        + Thêm ảnh tham khảo (Tone/Mood)
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
    </>
  );
};

const ResultDisplay: React.FC<{
  images: string[];
  isLoading: boolean;
  onUpscale: (index: number, target: "2k" | "4k") => void;
  upscalingIndex: number | null;
  onEditRequest: (image: string) => void;
  selectedImageIndex: number;
  onSelectImageIndex: (index: number) => void;
  onChangeAngle: (index: number) => void;
  onFullscreen: (index: number) => void;
  showChangeAngleButton: boolean;
}> = ({
  images,
  isLoading,
  onUpscale,
  upscalingIndex,
  onEditRequest,
  selectedImageIndex,
  onSelectImageIndex,
  onChangeAngle,
  onFullscreen,
  showChangeAngleButton,
}) => {
  const selectedImage = images[selectedImageIndex];

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl h-full flex flex-col relative z-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-700">Kết Quả Render</h2>
        {images.length > 0 && (
          <span className="text-sm text-slate-500 font-medium">
            {images.length} ảnh
          </span>
        )}
      </div>

      <div className="flex-grow flex items-center justify-center bg-black/20 rounded-lg mb-4 min-h-[300px] md:min-h-[400px] relative overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand"></div>
          </div>
        ) : selectedImage ? (
          <div className="relative group w-full h-full flex items-center justify-center">
            <img
              src={selectedImage}
              alt={`Rendered result ${selectedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-md"
            />

            {upscalingIndex === selectedImageIndex && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center rounded-lg z-20">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-100"></div>
                <p className="mt-3 font-semibold text-sm text-slate-200">
                  Đang upscale...
                </p>
              </div>
            )}

            {upscalingIndex === null && (
              <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                <button
                  onClick={() => onFullscreen(selectedImageIndex)}
                  className="bg-white/90 backdrop-blur-sm border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Icon name="arrows-expand" className="w-4 h-4" />
                  <span>Phóng To</span>
                </button>
                <button
                  onClick={() => onEditRequest(selectedImage)}
                  className="bg-white/90 backdrop-blur-sm border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Icon name="pencil" className="w-4 h-4" />
                  <span>Sửa</span>
                </button>
                {showChangeAngleButton && (
                  <button
                    onClick={() => onChangeAngle(selectedImageIndex)}
                    className="bg-white/90 backdrop-blur-sm border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Icon name="viewfinder" className="w-4 h-4" />
                    <span>Góc Chụp</span>
                  </button>
                )}
                <a
                  href={selectedImage}
                  download={`faceconst-render-${Date.now()}.png`}
                  className="bg-white/90 backdrop-blur-sm border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Icon name="download" className="w-4 h-4" />
                  <span>Tải</span>
                </a>
              </div>
            )}

            {upscalingIndex === null && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                <button
                  onClick={() => onUpscale(selectedImageIndex, "2k")}
                  className="bg-white/90 backdrop-blur-sm border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-xs px-2 py-1 rounded-md transition-colors shadow-sm"
                >
                  UPSCALE 2K
                </button>
                <button
                  onClick={() => onUpscale(selectedImageIndex, "4k")}
                  className="bg-white/90 backdrop-blur-sm border border-slate-200 hover:bg-brand hover:text-white text-slate-700 font-bold text-xs px-2 py-1 rounded-md transition-colors shadow-sm"
                >
                  UPSCALE 4K
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <p>Hình ảnh được tạo sẽ xuất hiện ở đây.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {!isLoading &&
          images.map((image, index) => (
            <div
              key={index}
              className={`relative group aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${selectedImageIndex === index ? "ring-2 ring-offset-2 ring-offset-white ring-brand" : "opacity-70 hover:opacity-100"}`}
              onClick={() => onSelectImageIndex(index)}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
      </div>
    </div>
  );
};

const HistoryPanel: React.FC<{
  history: RenderHistoryItem[];
  onClear: () => void;
  onSelect: (item: RenderHistoryItem) => void;
  title: string;
}> = ({ history, onClear, onSelect, title }) => {
  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" />
          {title}
        </h2>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-red-500 hover:text-red-700 text-sm font-semibold flex items-center gap-1"
          >
            <Icon name="trash" className="w-4 h-4" /> Xóa
          </button>
        )}
      </div>
      {history.length > 0 ? (
        <ul className="space-y-3 overflow-y-auto max-h-96">
          {history.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-2 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
              onClick={() => onSelect(item)}
            >
              <img
                src={item.images[0]}
                alt="History thumbnail"
                className="w-12 h-12 object-cover rounded shadow-sm"
              />
              <div className="flex-grow min-w-0">
                <p className="font-semibold text-slate-700 text-sm">
                  {item.images.length} ảnh
                </p>
                <p className="text-xs text-slate-500 truncate">{item.prompt}</p>
              </div>
              <p className="text-xs text-slate-400 self-start">
                {item.timestamp}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 text-center py-4">
          Chưa có lịch sử render.
        </p>
      )}
    </div>
  );
};

const EditHistoryPanel: React.FC<{
  history: EditHistoryItem[];
  onClear: () => void;
  onSelect: (item: EditHistoryItem) => void;
}> = ({ history, onClear, onSelect }) => {
  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <Icon name="clock" className="w-5 h-5" /> Lịch Sử Chỉnh Sửa
        </h2>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-red-500 hover:text-red-700 text-sm font-semibold flex items-center gap-1"
          >
            <Icon name="trash" className="w-4 h-4" /> Xóa
          </button>
        )}
      </div>
      {history.length > 0 ? (
        <ul className="space-y-3 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {history.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-2 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
              onClick={() => onSelect(item)}
            >
              <img
                src={item.resultImage}
                alt="History thumbnail"
                className="w-12 h-12 object-cover rounded shadow-sm"
              />
              <div className="flex-grow min-w-0">
                <p className="font-semibold text-slate-700 text-sm truncate">
                  {item.prompt}
                </p>
                <p className="text-xs text-slate-500">1 ảnh đã sửa</p>
              </div>
              <p className="text-xs text-slate-400 self-start flex-shrink-0">
                {item.timestamp}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 text-center py-4">
          Chưa có lịch sử chỉnh sửa.
        </p>
      )}
    </div>
  );
};

const ImageViewerModal: React.FC<{ imageUrl: string; onClose: () => void }> = ({
  imageUrl,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-brand text-white rounded-full p-2 hover:bg-brand-hover transition-transform duration-200 z-10 shadow-lg"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-2 flex-grow flex items-center justify-center overflow-auto">
          <img
            src={imageUrl}
            alt="Fullscreen view"
            className="max-w-full max-h-full object-contain rounded-md"
          />
        </div>
      </div>
    </div>
  );
};

const UpscaleModal: React.FC<{ imageUrl: string; onClose: () => void }> = ({
  imageUrl,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-brand text-white rounded-full p-2 hover:bg-brand-hover transition-transform duration-200 z-10 shadow-lg"
        >
          <Icon name="x-mark" className="w-6 h-6" />
        </button>
        <div className="p-4 overflow-auto">
          <img
            src={imageUrl}
            alt="Upscaled result"
            className="w-full h-auto object-contain rounded-md"
          />
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50 rounded-b-xl">
          <a
            href={imageUrl}
            download={`faceconst-upscaled-${Date.now()}.png`}
            className="bg-brand hover:bg-brand-hover text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <Icon name="download" className="w-5 h-5" /> Tải Về Ảnh Upscaled
          </a>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
        isActive
          ? "border-brand text-brand bg-white"
          : "border-transparent text-slate-500 hover:text-brand hover:bg-slate-100"
      }`}
    >
      <Icon name={icon} className="w-5 h-5" />
      {label}
    </button>
  );
};

import { ApiKeyModal } from "./components/ApiKeyModal";
import { getApiKey } from "./services/geminiService";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    | "exterior"
    | "interior"
    | "floorplan"
    | "color-floorplan"
    | "edit"
    | "utilities"
  >("exterior");
  const [standaloneTaskId, setStandaloneTaskId] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Check API Key on mount - Disabled as we now have a hardcoded key
  useEffect(() => {
    // const key = getApiKey();
    // if (!key) {
    //   setIsApiKeyModalOpen(true);
    // }
  }, []);

  const [imageForEditing, setImageForEditing] = useState<SourceImage | null>(
    null,
  );
  const [editHistoryItemToRestore, setEditHistoryItemToRestore] =
    useState<EditHistoryItem | null>(null);

  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);
  const [referenceImage, setReferenceImage] = useState<SourceImage | null>(
    null,
  );

  const [exteriorPrompt, setExteriorPrompt] = useState(
    "Ảnh chụp thực tế công trình tại đường phố Việt Nam",
  );
  const [exteriorAspectRatio, setExteriorAspectRatio] = useState<
    "original" | "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
  >("original");
  const exteriorPredefinedPrompts = [
    "Ảnh chụp thực tế công trình tại đường phố Việt Nam, trời buổi trưa có nắng gắt",
    "Ảnh chụp thực tế công trình tại ngã 3 đường phố sầm uất tại Thành Phố Hồ Chí Minh, trời ban ngày vừa tạnh mưa",
    "Ảnh chụp thực tế công trình tại khu villa giàu có ở Việt Nam, trời ban ngày vừa tạnh mưa",
    "Ảnh chụp thực tế công trình tại khu đồng quê ở Việt Nam, trời buổi chiều có nắng vàng",
  ];

  const [interiorPrompt, setInteriorPrompt] = useState("");
  const [interiorAspectRatio, setInteriorAspectRatio] = useState<
    "original" | "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
  >("original");
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const interiorPredefinedPrompts = [
    "tạo ảnh chụp thực tế phòng khách phong cách hiện đại với ghế sofa màu xám, sàn gỗ, và cửa sổ lớn nhìn ra vườn",
    "tạo ảnh chụp thực tế phòng ngủ ấm cúng với tông màu trung tính, giường gỗ, và ánh sáng vàng dịu",
    "tạo ảnh chụp thực tế nhà bếp tối giản with tủ bếp trắng không tay cầm, mặt bếp đá cẩm thạch, và đèn thả trần",
    "tạo ảnh chụp thực tế phòng tắm sang trọng ốp đá marble, có bồn tắm đứng và vòi sen cây, ánh sáng tự nhiên",
    "tạo ảnh chụp thực tế văn phòng làm việc tại nhà với bàn gỗ sồi, ghế công thái học, và kệ sách âm tường",
  ];

  const [floorplanPrompt, setFloorplanPrompt] = useState(
    "Biến bản floorplan này thành ảnh render 3d nội thất.",
  );
  const [floorplanAspectRatio, setFloorplanAspectRatio] = useState<
    "original" | "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
  >("original");
  const [roomType, setRoomType] = useState("Phòng khách");
  const [roomStyle, setRoomStyle] = useState("Hiện đại");
  const roomTypeOptions = [
    "Phòng khách",
    "Phòng ngủ",
    "Nhà bếp",
    "Phòng tắm / WC",
    "Ban công",
    "Phòng làm việc",
    "Phòng ăn",
    "Lối vào",
  ];
  const roomStyleOptions = [
    "Hiện đại",
    "Tân cổ điển",
    "Wabi-sabi",
    "Tối giản (Minimalism)",
    "Scanvadian",
    "Indochine",
    "Industrial",
    "Bohemian",
  ];

  const [colorFloorplanPrompt, setColorFloorplanPrompt] = useState(
    "Render một phiên bản chất lượng cao của floorplan 2D này with góc nhìn từ trên xuống. Thêm vật liệu thực tế và bóng đổ mềm.",
  );
  const [colorFloorplanAspectRatio, setColorFloorplanAspectRatio] = useState<
    "original" | "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
  >("original");

  const exteriorAngleOptions = [
    "Góc chụp trực diện toàn cảnh mặt tiền căn nhà",
    "Góc chụp 3/4 bên trái, thể hiện cả mặt tiền and hông nhà",
    "Góc chụp 3/4 bên phải, lấy được chiều sâu công trình",
    "Góc chụp từ trên cao nhìn xuống (drone view) toàn cảnh khuôn viên",
    "Góc chụp từ dưới lên (low angle), nhấn mạnh chiều cao and sự bề thế",
    "Góc chụp cận cảnh chi tiết cửa chính and vật liệu mặt tiền",
    "Góc chụp xuyên qua hàng cây/cảnh quan để tạo khung tự nhiên",
    "Góc chụp từ trong nhà nhìn ra sân vườn hoặc cổng",
    "Góc chụp ban đêm with ánh sáng nhân tạo, nhấn mạnh hệ thống đèn",
    "Góc chụp panorama quét ngang, bao trọn bối cảnh and môi trường xung quanh",
  ];
  const interiorAngleOptions = [
    "Ảnh chụp thực tế từ trên cao nhìn xuống toàn bộ không gian phòng",
    "Ảnh chụp thực tế góc 3/4 bên trái bao quát cả căn phòng",
    "Ảnh chụp thực tế góc 3/4 bên phải bao quát cả căn phòng",
    "Ảnh chụp thực tế góc chính diện thẳng vào trung tâm phòng",
    "Ảnh chụp thực tế góc chéo từ cửa ra vào nhìn vào trong phòng",
    "Ảnh chụp thực tế góc chụp từ phía sau sofa nhìn về hướng cửa sổ",
    "Ảnh chụp thực tế góc chụp từ trong phòng nhìn ngược ra cửa chính",
    "Ảnh chụp thực tế góc chụp từ trần nhà thấp xuống tạo chiều sâu không gian",
    "Ảnh chụp thực tế góc chụp đối xứng cân bằng toàn bộ phòng",
    "Ảnh chụp thực tế góc chụp từ một góc tường chéo tạo cảm giác rộng",
  ];

  const [exteriorAnglePrompt, setExteriorAnglePrompt] = useState(
    exteriorAngleOptions[0],
  );
  const [interiorAnglePrompt, setInteriorAnglePrompt] = useState("");
  const angleSectionRef = React.useRef<HTMLDivElement>(null);

  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [exteriorHistory, setExteriorHistory] = useState<RenderHistoryItem[]>(
    [],
  );
  const [interiorHistory, setInteriorHistory] = useState<RenderHistoryItem[]>(
    [],
  );
  const [floorplanHistory, setFloorplanHistory] = useState<RenderHistoryItem[]>(
    [],
  );
  const [colorFloorplanHistory, setColorFloorplanHistory] = useState<
    RenderHistoryItem[]
  >([]);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [upscalingIndex, setUpscalingIndex] = useState<number | null>(null);
  const [upscaledImageForModal, setUpscaledImageForModal] = useState<
    string | null
  >(null);
  const [imageForFullscreen, setImageForFullscreen] = useState<string | null>(
    null,
  );

  useEffect(() => {
    // Check for deep link or standalone mode
    const params = new URLSearchParams(window.location.search);
    const task = params.get("task");
    if (task) {
      setStandaloneTaskId(task);
      setActiveTab("utilities");
    }

    try {
      const eH = localStorage.getItem("exteriorRenderHistory");
      if (eH) setExteriorHistory(JSON.parse(eH));
      const iH = localStorage.getItem("interiorRenderHistory");
      if (iH) setInteriorHistory(JSON.parse(iH));
      const fH = localStorage.getItem("floorplanHistory");
      if (fH) setFloorplanHistory(JSON.parse(fH));
      const cfH = localStorage.getItem("colorFloorplanHistory");
      if (cfH) setColorFloorplanHistory(JSON.parse(cfH));
      const edH = localStorage.getItem("editHistory");
      if (edH) setEditHistory(JSON.parse(edH));
    } catch (error) {
      console.error("Failed to load history", error);
    }
  }, []);

  useEffect(
    () => safeSaveToLocalStorage("exteriorRenderHistory", exteriorHistory),
    [exteriorHistory],
  );
  useEffect(
    () => safeSaveToLocalStorage("interiorRenderHistory", interiorHistory),
    [interiorHistory],
  );
  useEffect(
    () => safeSaveToLocalStorage("floorplanHistory", floorplanHistory),
    [floorplanHistory],
  );
  useEffect(
    () =>
      safeSaveToLocalStorage("colorFloorplanHistory", colorFloorplanHistory),
    [colorFloorplanHistory],
  );
  useEffect(
    () => safeSaveToLocalStorage("editHistory", editHistory),
    [editHistory],
  );

  const handleHandleError = useCallback(async (error: any) => {
    console.error("API Error:", error);
    if (
      error?.message?.includes("API_KEY_MISSING") ||
      error?.message?.includes("API_KEY") ||
      error?.message?.includes("403")
    ) {
      setIsApiKeyModalOpen(true);
    } else if (error?.message?.includes("Requested entity was not found")) {
      // This typically means the model doesn't exist or key lacks permission
      setIsApiKeyModalOpen(true);
    } else {
      alert(
        `Đã xảy ra lỗi khi tạo ảnh. Chi tiết: ${error?.message || "Lỗi không xác định"}. Vui lòng thử lại.`,
      );
    }
  }, []);

  const handleGeneration = useCallback(
    async (
      prompt: string,
      renderType: "exterior" | "interior" | "floorplan" | "color-floorplan",
    ) => {
      if (!sourceImage || !prompt) {
        alert("Vui lòng tải lên ảnh nguồn and nhập prompt.");
        return;
      }
      setIsLoading(true);
      setGeneratedImages([]);
      setSelectedImageIndex(0);
      try {
        const finalAspectRatio =
          renderType === "exterior"
            ? exteriorAspectRatio
            : renderType === "interior"
              ? interiorAspectRatio
              : renderType === "floorplan"
                ? floorplanAspectRatio
                : renderType === "color-floorplan"
                  ? colorFloorplanAspectRatio
                  : "original";

        const images = await generateImages(
          sourceImage,
          prompt,
          renderType === "color-floorplan" ? "floorplan" : renderType,
          4,
          referenceImage,
          false,
          false,
          finalAspectRatio,
        );
        setGeneratedImages(images);

        const newHistoryItem = {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          images,
          prompt,
        };
        if (renderType === "exterior")
          setExteriorHistory((prev) => [newHistoryItem, ...prev]);
        else if (renderType === "interior")
          setInteriorHistory((prev) => [newHistoryItem, ...prev]);
        else if (renderType === "floorplan")
          setFloorplanHistory((prev) => [newHistoryItem, ...prev]);
        else if (renderType === "color-floorplan")
          setColorFloorplanHistory((prev) => [newHistoryItem, ...prev]);
      } catch (error) {
        handleHandleError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      sourceImage,
      referenceImage,
      exteriorAspectRatio,
      interiorAspectRatio,
      floorplanAspectRatio,
      colorFloorplanAspectRatio,
      handleHandleError,
    ],
  );

  const handleImageUpload = async (image: SourceImage) => {
    setSourceImage(image);
    if (activeTab === "interior") {
      setIsGeneratingDesc(true);
      try {
        const desc = await describeInteriorImage(image);
        setInteriorPrompt(`tạo ảnh chụp thực tế ${desc}`);
      } catch (error) {
        console.error(error);
      } finally {
        setIsGeneratingDesc(false);
      }
    }
  };

  const handleUpscale = useCallback(
    async (index: number, target: "2k" | "4k") => {
      const imageUrl = generatedImages[index];
      if (!imageUrl) return;
      const match = imageUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!match) return;

      setUpscalingIndex(index);
      try {
        const result = await upscaleImage(
          { mimeType: match[1], base64: match[2] },
          target,
        );
        if (result) {
          const newImages = [...generatedImages];
          newImages[index] = result;
          setGeneratedImages(newImages);
          setUpscaledImageForModal(result);
        }
      } catch (error) {
        handleHandleError(error);
      } finally {
        setUpscalingIndex(null);
      }
    },
    [generatedImages, handleHandleError],
  );

  const handleEditRequest = useCallback((imageUrl: string) => {
    const match = imageUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match) {
      setImageForEditing({ mimeType: match[1], base64: match[2] });
      setActiveTab("edit");
    }
  }, []);

  const handleChangeAngle = useCallback(() => {
    angleSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const selectCommonStyles =
    "w-full bg-slate-50 border border-slate-200 p-3 rounded-md text-sm focus:ring-2 focus:ring-brand focus:border-brand focus:outline-none appearance-none text-slate-700";

  // Standalone mode renderer
  if (standaloneTaskId) {
    return (
      <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-[#0d1117] to-[#111827]">
        <div className="max-w-7xl mx-auto">
          <UtilitiesTab
            initialTaskId={standaloneTaskId}
            onEditRequest={handleEditRequest}
            isStandalone={true}
          />
        </div>
        {imageForFullscreen && typeof imageForFullscreen === "string" && (
          <ImageViewerModal
            imageUrl={imageForFullscreen}
            onClose={() => setImageForFullscreen(null)}
          />
        )}
        {upscaledImageForModal && (
          <UpscaleModal
            imageUrl={upscaledImageForModal}
            onClose={() => setUpscaledImageForModal(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 relative">
      <header className="text-center mb-10 pt-4">
        <div className="inline-block border-2 border-brand/20 px-8 py-4 bg-white shadow-sm rounded-lg">
          <h1 className="text-3xl md:text-4xl font-bold tracking-wider text-slate-800 uppercase font-orbitron">
            AI RENDER FOR{" "}
            <span className="text-brand">ARCHITECTURE - INTERIOR</span>
          </h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
          <TabButton
            label="Render Ngoại Thất"
            icon="photo"
            isActive={activeTab === "exterior"}
            onClick={() => setActiveTab("exterior")}
          />
          <TabButton
            label="Render Nội Thất"
            icon="home"
            isActive={activeTab === "interior"}
            onClick={() => setActiveTab("interior")}
          />
          <TabButton
            label="Floorplan to 3D"
            icon="cube"
            isActive={activeTab === "floorplan"}
            onClick={() => setActiveTab("floorplan")}
          />
          <TabButton
            label="Render Mặt bằng"
            icon="brush"
            isActive={activeTab === "color-floorplan"}
            onClick={() => setActiveTab("color-floorplan")}
          />
          <TabButton
            label="Chỉnh Sửa Ảnh"
            icon="pencil"
            isActive={activeTab === "edit"}
            onClick={() => setActiveTab("edit")}
          />
          <TabButton
            label="Tiện Ích Khác"
            icon="bookmark"
            isActive={activeTab === "utilities"}
            onClick={() => setActiveTab("utilities")}
          />
        </div>

        <main>
          {activeTab === "exterior" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 flex flex-col gap-8">
                <Section title="1. Tải Lên Ảnh Ngoại Thất">
                  <ImageUpload
                    sourceImage={sourceImage}
                    onImageUpload={handleImageUpload}
                    onRemove={() => setSourceImage(null)}
                  />
                </Section>
                <Section title="2. Cấu Hình Render">
                  <div className="space-y-4">
                    <ReferenceImageUpload
                      image={referenceImage}
                      onUpload={setReferenceImage}
                      onRemove={() => setReferenceImage(null)}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Mô tả bối cảnh
                      </label>
                      <textarea
                        value={exteriorPrompt}
                        onChange={(e) => setExteriorPrompt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all shadow-sm"
                      />
                      <select
                        onChange={(e) => setExteriorPrompt(e.target.value)}
                        value=""
                        className={`${selectCommonStyles} mt-2`}
                      >
                        <option value="" disabled>
                          Hoặc chọn bối cảnh có sẵn
                        </option>
                        {exteriorPredefinedPrompts.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div ref={angleSectionRef}>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Góc chụp & Camera
                      </label>
                      <textarea
                        value={exteriorAnglePrompt}
                        onChange={(e) => setExteriorAnglePrompt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all shadow-sm"
                      />
                      <select
                        onChange={(e) => setExteriorAnglePrompt(e.target.value)}
                        value=""
                        className={`${selectCommonStyles} mt-2`}
                      >
                        <option value="" disabled>
                          Chọn góc chụp mẫu
                        </option>
                        {exteriorAngleOptions.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <label className="block text-sm font-medium text-slate-400">
                        Tỷ lệ khung hình
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {["original", "1:1", "3:4", "4:3", "9:16", "16:9"].map(
                          (r) => (
                            <button
                              key={r}
                              onClick={() => setExteriorAspectRatio(r as any)}
                              className={`py-2 px-1 rounded text-xs font-bold transition-all border ${exteriorAspectRatio === r ? "bg-brand shadow-md shadow-brand/20" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                            >
                              {r === "original" ? "MẶC ĐỊNH" : r}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleGeneration(
                          exteriorPrompt + ". " + exteriorAnglePrompt,
                          "exterior",
                        )
                      }
                      disabled={isLoading || !sourceImage}
                      className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-4 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500 mt-4 shadow-lg shadow-brand/20"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />{" "}
                      {isLoading ? "Đang Render..." : "Bắt Đầu Render"}
                    </button>
                  </div>
                </Section>
              </div>
              <div className="lg:col-span-2 flex flex-col gap-8">
                <ResultDisplay
                  images={generatedImages}
                  isLoading={isLoading}
                  onUpscale={handleUpscale}
                  upscalingIndex={upscalingIndex}
                  onEditRequest={handleEditRequest}
                  selectedImageIndex={selectedImageIndex}
                  onSelectImageIndex={setSelectedImageIndex}
                  onChangeAngle={handleChangeAngle}
                  onFullscreen={(index) =>
                    setImageForFullscreen(generatedImages[index])
                  }
                  showChangeAngleButton={true}
                />
                <HistoryPanel
                  title="Lịch Sử Render Ngoại Thất"
                  history={exteriorHistory}
                  onClear={() => setExteriorHistory([])}
                  onSelect={(item) => {
                    setGeneratedImages(item.images);
                    setSelectedImageIndex(0);
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "interior" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 flex flex-col gap-8">
                <Section title={`1. Tải Lên Ảnh Nội Thất`}>
                  <ImageUpload
                    sourceImage={sourceImage}
                    onImageUpload={handleImageUpload}
                    onRemove={() => setSourceImage(null)}
                  />
                </Section>
                <Section title="2. Cấu Hình Render">
                  <div className="space-y-4">
                    <ReferenceImageUpload
                      image={referenceImage}
                      onUpload={setReferenceImage}
                      onRemove={() => setReferenceImage(null)}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Mô tả nội thất
                      </label>
                      <div className="relative">
                        <textarea
                          value={interiorPrompt}
                          onChange={(e) => setInteriorPrompt(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all shadow-sm"
                          readOnly={isGeneratingDesc}
                        />
                        {isGeneratingDesc && (
                          <div className="absolute inset-0 bg-slate-700/80 flex items-center justify-center rounded-md">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-slate-100"></div>
                          </div>
                        )}
                      </div>
                      <select
                        onChange={(e) => setInteriorPrompt(e.target.value)}
                        value=""
                        className={`${selectCommonStyles} mt-2`}
                      >
                        <option value="" disabled>
                          Hoặc chọn mẫu nội thất có sẵn
                        </option>
                        {interiorPredefinedPrompts.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div ref={angleSectionRef}>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Góc chụp nội thất
                      </label>
                      <textarea
                        value={interiorAnglePrompt}
                        onChange={(e) => setInteriorAnglePrompt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all shadow-sm"
                      />
                      <select
                        onChange={(e) => setInteriorAnglePrompt(e.target.value)}
                        value=""
                        className={`${selectCommonStyles} mt-2`}
                      >
                        <option value="" disabled>
                          Chọn góc chụp nội thất mẫu
                        </option>
                        {interiorAngleOptions.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <label className="block text-sm font-medium text-slate-400">
                        Tỷ lệ khung hình
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {["original", "1:1", "3:4", "4:3", "9:16", "16:9"].map(
                          (r) => (
                            <button
                              key={r}
                              onClick={() => setInteriorAspectRatio(r as any)}
                              className={`py-2 px-1 rounded text-xs font-bold transition-all border ${interiorAspectRatio === r ? "bg-brand shadow-md shadow-brand/20 shadow-blue-900/40" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                            >
                              {r === "original" ? "MẶC ĐỊNH" : r}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleGeneration(
                          interiorPrompt + ". " + interiorAnglePrompt,
                          "interior",
                        )
                      }
                      disabled={isLoading || !sourceImage}
                      className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-4 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500 mt-4 shadow-lg shadow-brand/20"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />{" "}
                      {isLoading ? "Đang Render..." : "Bắt Đầu Render"}
                    </button>
                  </div>
                </Section>
              </div>
              <div className="lg:col-span-2 flex flex-col gap-8">
                <ResultDisplay
                  images={generatedImages}
                  isLoading={isLoading}
                  onUpscale={handleUpscale}
                  upscalingIndex={upscalingIndex}
                  onEditRequest={handleEditRequest}
                  selectedImageIndex={selectedImageIndex}
                  onSelectImageIndex={setSelectedImageIndex}
                  onChangeAngle={handleChangeAngle}
                  onFullscreen={(index) =>
                    setImageForFullscreen(generatedImages[index])
                  }
                  showChangeAngleButton={true}
                />
                <HistoryPanel
                  title="Lịch Sử Render Nội Thất"
                  history={interiorHistory}
                  onClear={() => setInteriorHistory([])}
                  onSelect={(item) => {
                    setGeneratedImages(item.images);
                    setSelectedImageIndex(0);
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "floorplan" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 flex flex-col gap-8">
                <Section title="1. Tải Lên Ảnh Floorplan">
                  <ImageUpload
                    sourceImage={sourceImage}
                    onImageUpload={handleImageUpload}
                    onRemove={() => setSourceImage(null)}
                  />
                </Section>
                <Section title="2. Tùy Chọn & Mô Tả">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          Loại phòng
                        </label>
                        <select
                          value={roomType}
                          onChange={(e) => setRoomType(e.target.value)}
                          className={selectCommonStyles}
                        >
                          {roomTypeOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          Phong cách
                        </label>
                        <select
                          value={roomStyle}
                          onChange={(e) => setRoomStyle(e.target.value)}
                          className={selectCommonStyles}
                        >
                          {roomStyleOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={floorplanPrompt}
                      onChange={(e) => setFloorplanPrompt(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all shadow-sm"
                    />
                    <div className="grid grid-cols-1 gap-2">
                      <label className="block text-sm font-medium text-slate-400">
                        Tỷ lệ khung hình
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {["original", "1:1", "3:4", "4:3", "9:16", "16:9"].map(
                          (r) => (
                            <button
                              key={r}
                              onClick={() => setFloorplanAspectRatio(r as any)}
                              className={`py-2 px-1 rounded text-xs font-bold transition-all border ${floorplanAspectRatio === r ? "bg-brand shadow-md shadow-brand/20 shadow-blue-900/40" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                            >
                              {r === "original" ? "MẶC ĐỊNH" : r}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleGeneration(floorplanPrompt, "floorplan")
                      }
                      disabled={isLoading || !sourceImage}
                      className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-4 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500 shadow-lg shadow-brand/20"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />{" "}
                      {isLoading ? "Đang Render..." : "Tạo Ảnh 3D"}
                    </button>
                  </div>
                </Section>
              </div>
              <div className="lg:col-span-2 flex flex-col gap-8">
                <ResultDisplay
                  images={generatedImages}
                  isLoading={isLoading}
                  onUpscale={handleUpscale}
                  upscalingIndex={upscalingIndex}
                  onEditRequest={handleEditRequest}
                  selectedImageIndex={selectedImageIndex}
                  onSelectImageIndex={setSelectedImageIndex}
                  onChangeAngle={handleChangeAngle}
                  onFullscreen={(index) =>
                    setImageForFullscreen(generatedImages[index])
                  }
                  showChangeAngleButton={false}
                />
                <HistoryPanel
                  title="Lịch Sử Floorplan 3D"
                  history={floorplanHistory}
                  onClear={() => setFloorplanHistory([])}
                  onSelect={(item) => {
                    setGeneratedImages(item.images);
                    setSelectedImageIndex(0);
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "color-floorplan" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 flex flex-col gap-8">
                <Section title="1. Tải Lên Floorplan 2D">
                  <ImageUpload
                    sourceImage={sourceImage}
                    onImageUpload={handleImageUpload}
                    onRemove={() => setSourceImage(null)}
                  />
                </Section>
                <Section title="2. Yêu Cầu Render">
                  <div className="space-y-4">
                    <textarea
                      value={colorFloorplanPrompt}
                      onChange={(e) => setColorFloorplanPrompt(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all shadow-sm"
                    />
                    <div className="grid grid-cols-1 gap-2">
                      <label className="block text-sm font-medium text-slate-400">
                        Tỷ lệ khung hình
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {["original", "1:1", "3:4", "4:3", "9:16", "16:9"].map(
                          (r) => (
                            <button
                              key={r}
                              onClick={() =>
                                setColorFloorplanAspectRatio(r as any)
                              }
                              className={`py-2 px-1 rounded text-xs font-bold transition-all border ${colorFloorplanAspectRatio === r ? "bg-brand shadow-md shadow-brand/20 shadow-blue-900/40" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                            >
                              {r === "original" ? "MẶC ĐỊNH" : r}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleGeneration(
                          colorFloorplanPrompt,
                          "color-floorplan",
                        )
                      }
                      disabled={isLoading || !sourceImage}
                      className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-4 px-4 rounded transition-colors flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-500 mt-4 shadow-lg shadow-brand/20"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />{" "}
                      {isLoading ? "Đang Render..." : "Bắt Đầu Render"}
                    </button>
                  </div>
                </Section>
              </div>
              <div className="lg:col-span-2 flex flex-col gap-8">
                <ResultDisplay
                  images={generatedImages}
                  isLoading={isLoading}
                  onUpscale={handleUpscale}
                  upscalingIndex={upscalingIndex}
                  onEditRequest={handleEditRequest}
                  selectedImageIndex={selectedImageIndex}
                  onSelectImageIndex={setSelectedImageIndex}
                  onChangeAngle={handleChangeAngle}
                  onFullscreen={(index) =>
                    setImageForFullscreen(generatedImages[index])
                  }
                  showChangeAngleButton={false}
                />
                <HistoryPanel
                  title="Lịch Sử Render Mặt bằng"
                  history={colorFloorplanHistory}
                  onClear={() => setColorFloorplanHistory([])}
                  onSelect={(item) => {
                    setGeneratedImages(item.images);
                    setSelectedImageIndex(0);
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "edit" && (
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3">
                <ImageEditor
                  initialImage={imageForEditing}
                  onClearInitialImage={() => setImageForEditing(null)}
                  onEditComplete={() => {}}
                  historyItemToRestore={editHistoryItemToRestore}
                  onHistoryRestored={() => setEditHistoryItemToRestore(null)}
                />
              </div>
              <div className="lg:col-span-1">
                <EditHistoryPanel
                  history={editHistory}
                  onClear={() => setEditHistory([])}
                  onSelect={setEditHistoryItemToRestore}
                />
              </div>
            </div>
          )}
          {activeTab === "utilities" && (
            <UtilitiesTab onEditRequest={handleEditRequest} />
          )}
        </main>
      </div>

      {imageForFullscreen && typeof imageForFullscreen === "string" && (
        <ImageViewerModal
          imageUrl={imageForFullscreen}
          onClose={() => setImageForFullscreen(null)}
        />
      )}
      {upscaledImageForModal && (
        <UpscaleModal
          imageUrl={upscaledImageForModal}
          onClose={() => setUpscaledImageForModal(null)}
        />
      )}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {}}
        onSuccess={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
