import React from 'react';
import { Youtube, Video, Music, ExternalLink } from 'lucide-react';

const VideoSection: React.FC = () => {
  // YouTube 채널 URL
  const channelUrlEncoded = "https://www.youtube.com/@%EC%B0%BD%EC%9B%90%EC%84%AC%EA%B9%80%EC%9D%98%EA%B5%90%ED%9A%8C";
  
  // 예배영상: 라이브 탭 (최신순)
  const worshipUrl = `${channelUrlEncoded}/streams`;
  
  // 찬양영상: 동영상 탭 (최신순)
  const praiseUrl = `${channelUrlEncoded}/videos`;

  // 예배영상 버튼 클릭
  const handleWorshipClick = () => {
    window.open(worshipUrl, '_blank', 'noopener,noreferrer');
  };

  // 찬양영상 버튼 클릭
  const handlePraiseClick = () => {
    window.open(praiseUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="py-24 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* 섹션 헤더 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 mb-4 bg-red-50 rounded-full text-red-600 shadow-sm">
            <Youtube size={28} />
          </div>
          <h2 className="text-4xl font-serif font-bold text-slate-800 mb-4">
            말씀과 찬양
          </h2>
          <p className="text-slate-600 text-lg">
            주일 설교 말씀과 은혜로운 찬양을 영상으로 만나보실 수 있습니다
          </p>
        </div>

        {/* 버튼 영역 */}
        <div className="flex gap-4 mb-8 justify-center flex-wrap">
          <button
            onClick={handleWorshipClick}
            className="flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Video size={24} />
            예배영상 보러가기
            <ExternalLink size={18} />
          </button>
          <button
            onClick={handlePraiseClick}
            className="flex items-center gap-3 px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Music size={24} />
            찬양영상 보러가기
            <ExternalLink size={18} />
          </button>
        </div>

        {/* 통합 설명 영역 */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="p-3 bg-red-50 text-red-600 rounded-full">
                <Video size={28} />
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
                <Music size={28} />
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-lg text-slate-700 leading-relaxed">
                우리의 삶을 새롭게 하시는 주님의 말씀과, 
                주님을 향한 찬양과 예배로 우리의 마음을 드리는 은혜로운 시간을 
                창원섬김의교회 YouTube 채널에서 만나보실 수 있습니다.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div className="bg-red-50 rounded-xl p-6 border border-red-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Video size={20} className="text-red-600" />
                    <h4 className="font-bold text-slate-800">예배영상</h4>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    창원섬김의교회에서 드려진 주일 예배와 특별 예배의 말씀을 만나보실 수 있습니다. 
                    언제 어디서나 하나님의 말씀을 통해 위로와 힘을 얻으시길 소망합니다.
                  </p>
                </div>
                
                <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Music size={20} className="text-purple-600" />
                    <h4 className="font-bold text-slate-800">찬양영상</h4>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    창원섬김의교회에서 준비된 아름다운 찬양과 찬송을 만나보실 수 있습니다. 
                    찬양을 통해 하나님의 사랑과 은혜를 경험하시고, 일상 속에서도 주님과 함께하는 시간을 가지시길 소망합니다.
                  </p>
                </div>
              </div>
              
              <p className="text-base text-slate-600 leading-relaxed mt-4">
                각 버튼을 클릭하시면 YouTube 채널의 해당 탭이 새 창에서 열려 
                최신 영상을 바로 확인하실 수 있습니다.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VideoSection;