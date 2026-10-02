'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, Loader2 } from 'lucide-react';
import { WordData } from '@/components/WordCard';

interface ImageWordUploaderProps {
  onWordGenerated: (wordData: WordData) => void;
}

export default function ImageWordUploader({ onWordGenerated }: ImageWordUploaderProps) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      // 1. 이미지를 Base64로 변환
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result as string;

        // 2. OCR API 호출
        const res = await fetch('/api/ocr-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Image }),
        });

        if (res.ok) {
          const generatedData: WordData = await res.json();
          onWordGenerated(generatedData);
        } else {
          alert('단어를 추출하지 못했습니다. 다른 이미지를 시도해 보세요.');
        }
        setLoading(false);
      };
    } catch (err) {
      console.error(err);
      alert('이미지 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">이미지로 단어 카드 만들기</p>
          <p className="text-[11px] text-slate-400">책, 이메일, 문서를 촬영하거나 첨부하세요</p>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>분석 중...</span>
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>사진 선택</span>
          </>
        )}
      </button>
    </div>
  );
}