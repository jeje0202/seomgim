import React from 'react';
import { NavSection } from '../types';

interface HeroProps {
  onCtaClick: () => void;
  onLocationClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onCtaClick, onLocationClick }) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-teal-100 via-purple-100 to-rose-100 py-20 sm:py-32">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        <h2 className="text-base font-semibold text-rose-600 tracking-wide uppercase mb-4">
          하나님을 섬기고, 이웃을 섬기는
        </h2>
        <h1 className="text-4xl sm:text-6xl font-bold text-slate-800 mb-6 font-serif leading-tight">
          <span className="block text-teal-700">창원섬김의교회에</span>
          <span className="block mt-2">오신 것을 환영합니다</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 font-light leading-relaxed">
          예수님의 사랑으로 따뜻한 교제를 나누며, <br className="hidden sm:inline"/>
          말씀 안에서 함께 성장하는 믿음의 공동체입니다.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <button 
            onClick={onCtaClick}
            className="px-8 py-3 rounded-full bg-rose-500 text-white font-semibold shadow-lg hover:bg-rose-600 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            예배시간 안내
          </button>
          <button 
            onClick={onLocationClick}
            className="px-8 py-3 rounded-full bg-white text-rose-500 font-semibold shadow-md hover:bg-rose-50 transition-all duration-300 border border-rose-200"
          >
            오시는 길
          </button>
        </div>
      </div>
    </div>
  );
};

export default Hero;