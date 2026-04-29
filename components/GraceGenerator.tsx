import React, { useState } from 'react';
import { generateGraceMessage } from '../services/geminiService';
import { GraceMessage } from '../types';
import { Heart, Sparkles, BookOpen, RefreshCw } from 'lucide-react';

const topics = [
  { id: 'comfort', label: '위로가 필요할 때', color: 'bg-teal-100 text-teal-700 hover:bg-teal-200' },
  { id: 'hope', label: '희망이 필요할 때', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { id: 'gratitude', label: '감사하고 싶을 때', color: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
  { id: 'courage', label: '용기가 필요할 때', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
  { id: 'peace', label: '평안이 필요할 때', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
];

const GraceGenerator: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GraceMessage | null>(null);

  const handleGenerate = async (topic: string) => {
    setLoading(true);
    const result = await generateGraceMessage(topic);
    setData(result);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-purple-100">
      <div className="p-8 sm:p-12">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Sparkles className="text-yellow-400" size={28} />
          <h2 className="text-3xl font-bold text-slate-800 font-serif text-center">AI 말씀 산책</h2>
          <Sparkles className="text-yellow-400" size={28} />
        </div>
        
        <p className="text-center text-slate-500 mb-8">
          오늘 당신의 마음은 어떠신가요? <br/>
          주제를 선택하시면, 성령님의 감동이 담긴 AI 묵상 메시지를 드립니다.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => handleGenerate(t.label)}
              disabled={loading}
              className={`px-5 py-2.5 rounded-full font-medium transition-all duration-200 shadow-sm ${t.color} ${loading ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-105'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <RefreshCw className="animate-spin text-rose-400" size={40} />
            <p className="text-rose-400 font-medium animate-pulse">말씀을 묵상하며 준비하고 있습니다...</p>
          </div>
        )}

        {data && !loading && (
          <div className="animate-fade-in bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100 shadow-inner">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-white rounded-full shadow-sm text-rose-400">
                <Heart size={24} fill="currentColor" />
              </div>
              <div>
                <h3 className="font-semibold text-purple-900 mb-2">섬김의 편지</h3>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{data.message}</p>
              </div>
            </div>
            
            <div className="border-t border-purple-200 my-6"></div>
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-full shadow-sm text-teal-600">
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-teal-900 mb-2">오늘의 약속</h3>
                <blockquote className="text-lg font-serif text-slate-800 italic mb-2">
                  "{data.verse}"
                </blockquote>
                <p className="text-right text-sm font-bold text-teal-700">- {data.reference} -</p>
              </div>
            </div>
          </div>
        )}

        {!data && !loading && (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400">버튼을 눌러 오늘의 은혜를 받아보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraceGenerator;