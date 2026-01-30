
import React, { useState, useEffect } from 'react';
import { Icon } from './icons';
import { validateApiKey } from '../services/geminiService';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [apiKey, setApiKey] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Load existing key from localStorage if available
        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey) {
            setApiKey(storedKey);
        }
    }, []);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setError('Vui lòng nhập API Key.');
            return;
        }

        setIsValidating(true);
        setError(null);

        const result = await validateApiKey(apiKey);

        if (result.isValid) {
            localStorage.setItem('gemini_api_key', apiKey);
            onSuccess();
        } else {
            setError(result.error || 'API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.');
        }
        setIsValidating(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col relative">
                {/* Header */}
                <div className="bg-slate-50 p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Icon name="key" className="w-6 h-6 text-yellow-600" /> Nạp API Key Để Sử Dụng
                    </h2>
                    <p className="text-slate-500 text-sm mt-2">
                        Đây là ứng dụng render chất lượng cao, bạn cần sử dụng Key trả phí (Pay-as-you-go) từ Google AI Studio để có trải nghiệm tốt nhất.
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Video Guide */}
                    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                        <iframe
                            width="100%"
                            height="100%"
                            src="https://www.youtube.com/embed/B2rpXvCmoIU"
                            title="Hướng dẫn lấy API Key"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>

                    {/* Input Area */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">Google AI Studio API Key</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                                placeholder="Dán API Key của bạn vào đây (AI...)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 text-slate-800 focus:ring-2 focus:ring-brand focus:border-brand focus:outline-none transition-all pr-12 shadow-sm"
                            />
                            <div className="absolute right-3 top-3 text-slate-400">
                                <Icon name="lock-closed" className="w-5 h-5" />
                            </div>
                        </div>
                        {error && <p className="text-red-600 text-sm mt-2 flex items-center gap-1"><Icon name="exclamation-circle" className="w-4 h-4" /> {error}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isValidating}
                            className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md shadow-brand/10"
                        >
                            {isValidating ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                    Đang Kiểm Tra Key...
                                </>
                            ) : (
                                <>
                                    <Icon name="check-circle" className="w-5 h-5" /> Lưu Key & Bắt Đầu
                                </>
                            )}
                        </button>

                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="text-center text-brand hover:underline text-sm transition-colors flex items-center justify-center gap-1 font-medium"
                        >
                            Chưa có Key? Lấy ngay tại Google AI Studio <Icon name="arrow-top-right-on-square" className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
