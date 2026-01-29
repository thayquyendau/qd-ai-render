
import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import type { SourceImage } from '../types';

const extractBase64Image = (response: any): string | null => {
  // Đối với generateContent (Gemini 3 Pro / 2.5 Flash Image)
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
};

// Helper to get the API Key (Local Storage -> Env)
export const getApiKey = (): string | null => {
  if (typeof window !== 'undefined') {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) return storedKey;
  }
  return process.env.API_KEY || null;
};

// Helper to get GoogleGenAI instance
const getGenAI = (): GoogleGenAI => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  // @ts-ignore - User requested allowDangerousAllowBrowser for browser usage
  return new GoogleGenAI({ apiKey, allowDangerousAllowBrowser: true });
};

// Validate API Key
export const validateApiKey = async (key: string): Promise<{ isValid: boolean; error?: string }> => {
  const ERROR_MSG = "Key của bạn cần thiết lập trả phí, vui lòng xem video và thực hiện lại nhé";

  try {
    // @ts-ignore
    const genAI = new GoogleGenAI({ apiKey: key, allowDangerousAllowBrowser: true });

    // Chỉ kiểm tra model Gemini 2.0 Flash (Model chính của app)
    await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: 'user', parts: [{ text: "hi" }] }]
    });

    return { isValid: true };
  } catch (error: any) {
    console.error("Key validation failed:", error);
    // Trả về đúng câu thông báo anh yêu cầu, không hiện JSON nữa
    return {
      isValid: false,
      error: ERROR_MSG
    };
  }
};

/**
 * Phân tích ảnh cho các tác vụ tiện ích cụ thể.
 */
export const analyzeUtilityTask = async (
  sourceImage: SourceImage,
  taskType: string
): Promise<string> => {
  const ai = getGenAI();
  const instructions: Record<string, string> = {
    'sketch_to_render': 'Phân tích bản phác thảo tay kiến trúc này. Xác định các khối và công năng. Viết 1 prompt tiếng Việt yêu cầu AI biến nó thành ảnh render 3D siêu thực chất lượng cao, vật liệu cao cấp, ánh sáng điện ảnh.',
    'facade_renovation': 'Phân tích mặt tiền ngôi nhà cũ này. Viết 1 prompt tiếng Việt yêu cầu AI cải tạo toàn bộ diện mạo: dùng vật liệu hiện đại (gỗ ốp, kính lớn, sơn trung tính), thêm lan can kính, hệ thống đèn hắt sang trọng.',
    'landscape_design': 'Phân tích khoảng sân/ngoại thất trống này. Viết 1 prompt tiếng Việt yêu cầu AI thiết kế cảnh quan nghỉ dưỡng: hồ bơi tràn bờ, lát đá tự nhiên, cây xanh nhiệt đới tầng tán, khu vực lounge ngoài trời.',
    'lighting_simulation': 'Phân tích không gian. Viết 1 prompt tiếng Việt yêu cầu AI tạo ra kịch bản ánh sáng Ban ngày/Hoàng hôn/Ban đêm lung linh, nhấn mạnh chiều sâu và cảm xúc không gian.',
    'design_variation': 'Phân tích phong cách này. Viết 1 prompt tiếng Việt yêu cầu AI tạo ra 4 phương án phối màu và vật liệu khác nhau (ví dụ: tông gỗ trầm, tông trắng tối giản, tông xanh navy hiện đại) nhưng giữ nguyên bố cục.',
    'space_analysis': 'Phân tích không gian này. Đưa ra các gợi ý cải thiện về công năng và thẩm mỹ (như thêm điểm nhấn tường, thay đổi vị trí đèn, thêm cây xanh) để không gian hoàn hảo hơn.'
  };

  const engineeredPrompt = `
    Bạn là một kiến trúc sư chủ trì.
    NHIỆM VỤ: ${instructions[taskType] || 'Tạo prompt render kiến trúc tối ưu.'}
    Yêu cầu: Prompt phải chi tiết, chuyên nghiệp bằng tiếng Việt.
    CHỈ TRẢ VỀ CHUỖI VĂN BẢN TIẾNG VIỆT.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
  });

  return response.text?.trim().replace(/^"(.*)"$/, '$1') || '';
};

export const analyzeMaterialReplacement = async (
  roomImage: SourceImage,
  materialImage: SourceImage
): Promise<string> => {
  const ai = getGenAI();
  const engineeredPrompt = `
    Bạn là một chuyên gia thiết kế nội thất và vật liệu kiến trúc.
    Nhiệm vụ: 
    1. Nhận diện chính xác vật liệu từ Ảnh 2 (Ví dụ: đá marble trắng vân mây, gỗ sồi màu sáng, vải nhung xanh...).
    2. Phân tích không gian ở Ảnh 1 để xác định vị trí phù hợp nhất để áp dụng vật liệu này.
    3. Viết một lệnh (prompt) tiếng Việt tự nhiên để AI thực hiện việc thay thế vật liệu đó vào đúng vị trí đã chọn.
    CHỈ TRẢ VỀ CHUỖI VĂN BẢN TIẾNG VIỆT.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { data: roomImage.base64, mimeType: roomImage.mimeType } },
        { inlineData: { data: materialImage.base64, mimeType: materialImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
  });

  return response.text?.trim().replace(/^"(.*)"$/, '$1') || '';
};

export const analyze3Dto2DConversion = async (
  renderImage: SourceImage
): Promise<string> => {
  const ai = getGenAI();
  const engineeredPrompt = 'Viết prompt tiếng Việt chuyển ảnh render này thành bản vẽ kỹ thuật 2D CAD nét mảnh đen trắng chuẩn kiến trúc.';
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { data: renderImage.base64, mimeType: renderImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
  });
  return response.text?.trim().replace(/^"(.*)"$/, '$1') || '';
};

export const describeInteriorImage = async (sourceImage: SourceImage): Promise<string> => {
  const ai = getGenAI();
  const engineeredPrompt = "Describe this interior image in Vietnamese as a design expert.";
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: engineeredPrompt },
      ],
    },
  });
  return response.text?.trim() || '';
};

export const generateImages = async (
  sourceImage: SourceImage,
  prompt: string,
  renderType: 'exterior' | 'interior' | 'floorplan',
  count: number = 4,
  referenceImage: SourceImage | null = null,
  isAnglePrompt: boolean = false,
  useRawPrompt: boolean = false,
  aspectRatio: string = "1:1",
  isHighQuality: boolean = false
): Promise<string[]> => {
  const currentAi = getGenAI();
  // Rule: gemini-3-pro-image-preview cho High Quality, còn lại gemini-2.5-flash-image
  const modelName = isHighQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

  const generationPromises = Array(count).fill(0).map(async () => {
    const parts: any[] = [{ inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } }];
    if (referenceImage) parts.push({ inlineData: { data: referenceImage.base64, mimeType: referenceImage.mimeType } });
    parts.push({ text: prompt });

    const imageConfig: any = {};
    if (aspectRatio && aspectRatio !== 'original') {
      imageConfig.aspectRatio = aspectRatio;
    }
    if (isHighQuality) {
      imageConfig.imageSize = "4K";
    }

    const response = await currentAi.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
        imageConfig
      },
    }
    );
    return extractBase64Image(response);
  });

  const results = await Promise.all(generationPromises);
  return results.filter((result): result is string => result !== null);
};

export const upscaleImage = async (sourceImage: SourceImage, target: '2k' | '4k'): Promise<string | null> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
        { text: `Upscale this image to ${target.toUpperCase()}.` },
      ],
    },
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  }
  );
  return extractBase64Image(response);
};

export const editImage = async (
  sourceImage: SourceImage,
  maskImage: SourceImage,
  prompt: string,
  referenceImage: SourceImage | null = null,
  count: number = 4
): Promise<string[]> => {
  const ai = getGenAI();

  const generationPromises = Array(count).fill(0).map(async () => {
    const parts: any[] = [
      { inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } },
      { inlineData: { data: maskImage.base64, mimeType: maskImage.mimeType } }
    ];
    if (referenceImage) parts.push({ inlineData: { data: referenceImage.base64, mimeType: referenceImage.mimeType } });

    const instruction = referenceImage
      ? `SYSTEM: EXACT MATERIAL REPLACEMENT. Use material from Image 3 to replace mask area in Image 1. Target description: ${prompt}`
      : `Edit masked area: ${prompt}`;

    parts.push({ text: instruction });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });
    return extractBase64Image(response);
  });

  const results = await Promise.all(generationPromises);
  return results.filter((result): result is string => result !== null);
};
