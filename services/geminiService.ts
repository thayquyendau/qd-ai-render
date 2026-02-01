import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import type { SourceImage } from "../types";

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

// Helper to get the API Key (Hardcoded -> Local Storage -> Env)
export const getApiKey = (): string | null => {
  // Hardcoded key as per user request
  return "AIzaSyCUJYRiI7t_vFzaX0HgZn6YORqzEkyG9Yg";
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
export const validateApiKey = async (
  key: string,
): Promise<{ isValid: boolean; error?: string }> => {
  const ERROR_MSG =
    "Key của bạn cần thiết lập trả phí, vui lòng xem video và thực hiện lại nhé";

  try {
    // @ts-ignore
    const genAI = new GoogleGenAI({
      apiKey: key,
      allowDangerousAllowBrowser: true,
    });

    // Chỉ kiểm tra model Gemini 2.0 Flash (Model chính của app)
    await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });

    return { isValid: true };
  } catch (error: any) {
    console.error("Key validation failed:", error);
    // Trả về đúng câu thông báo anh yêu cầu, không hiện JSON nữa
    return {
      isValid: false,
      error: ERROR_MSG,
    };
  }
};

/**
 * Phân tích ảnh cho các tác vụ tiện ích cụ thể.
 */
export const analyzeUtilityTask = async (
  sourceImage: SourceImage,
  taskType: string,
): Promise<string> => {
  const ai = getGenAI();
  const instructions: Record<string, string> = {
    sketch_to_render:
      "Phân tích bản phác thảo tay kiến trúc này. Xác định các khối và công năng. Viết 1 prompt tiếng Việt yêu cầu AI biến nó thành ảnh render 3D siêu thực chất lượng cao, vật liệu cao cấp, ánh sáng điện ảnh.",
    facade_renovation:
      "Phân tích mặt tiền ngôi nhà cũ này. Viết 1 prompt tiếng Việt yêu cầu AI cải tạo toàn bộ diện mạo: dùng vật liệu hiện đại (gỗ ốp, kính lớn, sơn trung tính), thêm lan can kính, hệ thống đèn hắt sang trọng.",
    landscape_design:
      "Phân tích khoảng sân/ngoại thất trống này. Viết 1 prompt tiếng Việt yêu cầu AI thiết kế cảnh quan nghỉ dưỡng: hồ bơi tràn bờ, lát đá tự nhiên, cây xanh nhiệt đới tầng tán, khu vực lounge ngoài trời.",
    lighting_simulation:
      "Phân tích không gian. Viết 1 prompt tiếng Việt yêu cầu AI tạo ra kịch bản ánh sáng Ban ngày/Hoàng hôn/Ban đêm lung linh, nhấn mạnh chiều sâu và cảm xúc không gian.",
    design_variation:
      "Phân tích phong cách này. Viết 1 prompt tiếng Việt yêu cầu AI tạo ra 4 phương án phối màu và vật liệu khác nhau (ví dụ: tông gỗ trầm, tông trắng tối giản, tông xanh navy hiện đại) nhưng giữ nguyên bố cục.",
    space_analysis:
      "Phân tích không gian này. Đưa ra các gợi ý cải thiện về công năng và thẩm mỹ (như thêm điểm nhấn tường, thay đổi vị trí đèn, thêm cây xanh) để không gian hoàn hảo hơn.",
  };

  const engineeredPrompt = `
    Bạn là một kiến trúc sư chủ trì.
    NHIỆM VỤ: ${instructions[taskType] || "Tạo prompt render kiến trúc tối ưu."}
    Yêu cầu: Prompt phải chi tiết, chuyên nghiệp bằng tiếng Việt.
    CHỈ TRẢ VỀ CHUỖI VĂN BẢN TIẾNG VIỆT.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: {
      parts: [
        {
          inlineData: {
            data: sourceImage.base64,
            mimeType: sourceImage.mimeType,
          },
        },
        { text: engineeredPrompt },
      ],
    },
  });

  return response.text?.trim().replace(/^"(.*)"$/, "$1") || "";
};

export const analyzeMaterialReplacement = async (
  roomImage: SourceImage,
  materialImage: SourceImage,
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
    model: "gemini-2.0-flash",
    contents: {
      parts: [
        {
          inlineData: { data: roomImage.base64, mimeType: roomImage.mimeType },
        },
        {
          inlineData: {
            data: materialImage.base64,
            mimeType: materialImage.mimeType,
          },
        },
        { text: engineeredPrompt },
      ],
    },
  });

  return response.text?.trim().replace(/^"(.*)"$/, "$1") || "";
};

export const analyze3Dto2DConversion = async (
  renderImage: SourceImage,
): Promise<string> => {
  const ai = getGenAI();
  const engineeredPrompt =
    "Viết prompt tiếng Việt chuyển ảnh render này thành bản vẽ kỹ thuật 2D CAD nét mảnh đen trắng chuẩn kiến trúc.";
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: {
      parts: [
        {
          inlineData: {
            data: renderImage.base64,
            mimeType: renderImage.mimeType,
          },
        },
        { text: engineeredPrompt },
      ],
    },
  });
  return response.text?.trim().replace(/^"(.*)"$/, "$1") || "";
};

export const describeInteriorImage = async (
  sourceImage: SourceImage,
): Promise<string> => {
  const ai = getGenAI();
  const engineeredPrompt =
    "Describe this interior image in Vietnamese as a design expert.";
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: {
      parts: [
        {
          inlineData: {
            data: sourceImage.base64,
            mimeType: sourceImage.mimeType,
          },
        },
        { text: engineeredPrompt },
      ],
    },
  });
  return response.text?.trim() || "";
};

export interface MaterialOption {
  id: string;
  title: string;
  materials: string;
  designKeywords: string;
  gateDesign: string;
  description: string;
}

export const analyzeMaterialsForFacade = async (
  sourceImage: SourceImage,
  data: {
    houseType: string;
    style: string;
    floors: string;
    colorPalette?: { name: string; components: string };
  },
): Promise<MaterialOption[]> => {
  const ai = getGenAI();
  const engineeredPrompt = `
      Bạn là một kiến trúc sư chủ trì và dự toán viên. 
      DỰ KIẾN XÂY DỰNG:
      - Loại nhà: ${data.houseType}
      - Phong cách: ${data.style}
      - Quy mô: ${data.floors} tầng
      - Tông màu: ${data.colorPalette?.name || "Theo phong cách"} (${data.colorPalette?.components || ""})

      NHIỆM VỤ:
      Dựa trên ảnh hiện trạng khu đất và yêu cầu thiết kế, hãy đề xuất 3 phương án hoàn thiện mặt tiền theo 3 cấp độ: 
      1. Tiết kiệm: Vật liệu phổ biến, tối ưu chi phí.
      2. Trung bình: Vật liệu bền đẹp, phổ thông.
      3. Cao cấp: Vật liệu sang trọng, đẳng cấp.

      MỖI PHƯƠNG ÁN CẦN BAO GỒM:
      - materials: Danh sách vật liệu chính
      - designKeywords: Từ khóa thiết kế đặc trưng (hình khối, ánh sáng, cây xanh...)
      - gateDesign: Thiết kế cổng nhà phù hợp với phong cách và vật liệu

      YÊU CẦU TRẢ VỀ:
      Chỉ trả về duy nhất một mảng JSON (không có markdown, không có giải thích) với cấu trúc sau:
      [
        { "id": "cheap", "title": "Tiết kiệm", "materials": "...", "designKeywords": "...", "gateDesign": "...", "description": "..." },
        { "id": "medium", "title": "Trung bình", "materials": "...", "designKeywords": "...", "gateDesign": "...", "description": "..." },
        { "id": "premium", "title": "Cao cấp", "materials": "...", "designKeywords": "...", "gateDesign": "...", "description": "..." }
      ]
    `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: {
      parts: [
        {
          inlineData: {
            data: sourceImage.base64,
            mimeType: sourceImage.mimeType,
          },
        },
        { text: engineeredPrompt },
      ],
    },
  });

  const text = response.text?.trim().replace(/```json|```/g, "") || "[]";
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse material JSON:", e);
    return [
      {
        id: "cheap",
        title: "Tiết kiệm",
        materials: "Sơn nước, gạch ceramic, nhôm kính thường",
        designKeywords:
          "Bo góc tròn đơn giản, cửa sổ hình chữ nhật, đèn treo cổ điển",
        gateDesign: "Cổng sắt hộp sơn tĩnh điện, kiểu dáng đơn giản",
        description: "Tối ưu chi phí xây dựng.",
      },
      {
        id: "medium",
        title: "Trung bình",
        materials: "Sơn giả đá, gạch inax, cửa xingfa, gỗ nhựa",
        designKeywords:
          "Tường uốn cong nhẹ, vòm cung cửa chính, đèn LED viền, cây xanh ban công",
        gateDesign:
          "Cổng nhôm đúc vòm cung, ốp gỗ nhựa composite, đèn cột trang trí",
        description: "Cân bằng giữa thẩm mỹ và độ bền.",
      },
      {
        id: "premium",
        title: "Cao cấp",
        materials: "Ốp đá tự nhiên, gỗ Teak, kính Low-E, nhôm cao cấp",
        designKeywords:
          "Mặt tiền điêu khắc organic, ô tròn cutout xuyên sáng, đèn wall-washer, cây rủ từ ban công, lam gỗ sân thượng",
        gateDesign:
          "Cổng gỗ tự nhiên vòm arched, đèn LED viền ẩn, tường rào ốp đá tự nhiên",
        description: "Sang trọng, đẳng cấp và bền bỉ.",
      },
    ];
  }
};

export const analyzeFacadeFromLand = async (
  sourceImage: SourceImage,
  data: {
    houseType: string;
    style: string;
    floors: string;
    hasGate?: boolean;
    shapeCharacteristics?: {
      name: string;
      description: string;
      context: string;
    };
    colorPalette?: { name: string; description: string; components: string };
    selectedMaterial?: MaterialOption;
  },
): Promise<string> => {
  const ai = getGenAI();
  const engineeredPrompt = `
    Bạn là một kiến trúc sư chủ trì và chuyên gia Render 3D.
    DỰ KIẾN XÂY DỰNG:
    - Loại nhà: ${data.houseType}
    - Phong cách: ${data.style}
    - Quy mô: ${data.floors} tầng
    ${data.shapeCharacteristics ? `- Đặc điểm hình khối / Concept: ${data.shapeCharacteristics.name}` : ""}
    ${data.colorPalette ? `- Màu sắc chủ đạo: ${data.colorPalette.name} (${data.colorPalette.components})` : ""}
    ${data.selectedMaterial ? `- Gói vật liệu: ${data.selectedMaterial.title} (${data.selectedMaterial.materials})` : ""}
    ${data.hasGate ? "- Yêu cầu đặc biệt: Thiết kế thêm CỔNG NHÀ đẹp, phù hợp với phong cách mặt tiền." : ""}

    NHIỆM VỤ:
    1. XÁC ĐỊNH RANH GIỚI TỰ ĐỘNG: Phân tích ảnh hiện trạng để xác định chính xác ranh giới vỉa hè và lề đường phía trước khu đất.
    2. CHIẾN LƯỢC CĂN LỀ TUYỆT ĐỐI (QUAN TRỌNG NHẤT): 
       - Nếu ${data.hasGate ? "có cổng: Phải đặt cổng và hàng rào sát lề đường." : "KHÔNG CÓ CỔNG: BẮT BUỘC mặt tiền tầng trệt của ngôi nhà PHẢI ĐẶT SÁT SẠT VÀO LỀ ĐƯỜNG/VỈA HÈ."}
    3. VIẾT PROMPT: Tạo 1 prompt tiếng Việt chi tiết cưỡng chế AI đặt ngôi nhà ${data.houseType} ${data.style} vào đúng vị trí sát vỉa hè.
    4. YÊU CẦU CỐ ĐỊNH: Giữ nguyên hiện trạng xung quanh bên ngoài khu đất. Phối cảnh 3D chân thực, ánh sáng tự nhiên.

    CHỈ TRẢ VỀ CHUỖI VĂN BẢN TIẾNG VIỆT LÀ NỘI DUNG PROMPT HOÀN CHỈNH ĐỂ GỬI CHO AI RENDER.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: {
      parts: [
        {
          inlineData: {
            data: sourceImage.base64,
            mimeType: sourceImage.mimeType,
          },
        },
        { text: engineeredPrompt },
      ],
    },
  });

  return response.text?.trim().replace(/^"(.*)"$/, "$1") || "";
};

export const generateImages = async (
  sourceImage: SourceImage,
  prompt: string,
  renderType: "exterior" | "interior" | "floorplan",
  count: number = 4,
  referenceImage: SourceImage | null = null,
  isAnglePrompt: boolean = false,
  useRawPrompt: boolean = false,
  aspectRatio: string = "1:1",
  isHighQuality: boolean = false,
): Promise<string[]> => {
  const currentAi = getGenAI();
  // Rule: gemini-3-pro-image-preview cho High Quality, còn lại gemini-2.5-flash-image
  const modelName = isHighQuality
    ? "gemini-3-pro-image-preview"
    : "gemini-2.5-flash-image";

  const generationPromises = Array(count)
    .fill(0)
    .map(async () => {
      const parts: any[] = [
        {
          inlineData: {
            data: sourceImage.base64,
            mimeType: sourceImage.mimeType,
          },
        },
      ];
      if (referenceImage)
        parts.push({
          inlineData: {
            data: referenceImage.base64,
            mimeType: referenceImage.mimeType,
          },
        });
      parts.push({ text: prompt });

      const imageConfig: any = {};
      if (aspectRatio && aspectRatio !== "original") {
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
          imageConfig,
        },
      });
      return extractBase64Image(response);
    });

  const results = await Promise.all(generationPromises);
  return results.filter((result): result is string => result !== null);
};

export const upscaleImage = async (
  sourceImage: SourceImage,
  target: "2k" | "4k",
): Promise<string | null> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          inlineData: {
            data: sourceImage.base64,
            mimeType: sourceImage.mimeType,
          },
        },
        { text: `Upscale this image to ${target.toUpperCase()}.` },
      ],
    },
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  });
  return extractBase64Image(response);
};

export const editImage = async (
  sourceImage: SourceImage,
  maskImage: SourceImage,
  prompt: string,
  referenceImage: SourceImage | null = null,
  count: number = 4,
): Promise<string[]> => {
  const ai = getGenAI();

  const generationPromises = Array(count)
    .fill(0)
    .map(async () => {
      const parts: any[] = [
        {
          inlineData: {
            data: sourceImage.base64,
            mimeType: sourceImage.mimeType,
          },
        },
        {
          inlineData: { data: maskImage.base64, mimeType: maskImage.mimeType },
        },
      ];
      if (referenceImage)
        parts.push({
          inlineData: {
            data: referenceImage.base64,
            mimeType: referenceImage.mimeType,
          },
        });

      const instruction = referenceImage
        ? `SYSTEM: EXACT MATERIAL REPLACEMENT. Use material from Image 3 to replace mask area in Image 1. Target description: ${prompt}`
        : `Edit masked area: ${prompt}`;

      parts.push({ text: instruction });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      });
      return extractBase64Image(response);
    });

  const results = await Promise.all(generationPromises);
  return results.filter((result): result is string => result !== null);
};
