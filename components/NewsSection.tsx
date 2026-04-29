import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, Megaphone, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { getNews, NewsItem, getTagColor, formatNewsDate } from '../services/newsApi';
import { getUserInfo, hasRole } from '../services/authApi';
import NewsWriteModal from './NewsWriteModal';
import NewsEditModal from './NewsEditModal';
import NewsDeleteModal from './NewsDeleteModal';
import NewsDetailModal from './NewsDetailModal';

const NewsSection: React.FC = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(getUserInfo());
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(6); // 기본 6개만 표시

  useEffect(() => {
    loadNews();
    const userInfo = getUserInfo();
    setUser(userInfo);
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const news = await getNews(50);
      setNewsItems(news);
    } catch (error) {
      console.error('교회소식 로드 오류:', error);
      setNewsItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 mb-4 bg-white rounded-full text-rose-500 shadow-sm">
            <Megaphone size={24} />
          </div>
          <h2 className="text-3xl font-serif font-bold text-slate-800">교회 소식</h2>
          <p className="mt-4 text-slate-500">창원섬김의교회의 새로운 소식을 전해드립니다.</p>

          {/* 관리자 이상만 작성 버튼 표시 */}
          {user && hasRole(user, 'admin', 'super-admin') && (
            <div className="mt-6">
              <button
                onClick={() => setShowWriteModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-full font-semibold hover:bg-teal-600 transition-all shadow-md hover:shadow-lg"
              >
                <PlusCircle size={20} />
                교회소식 작성
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mb-4"></div>
            <p className="text-slate-500">교회소식을 불러오는 중...</p>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Megaphone size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">아직 교회소식이 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {newsItems.slice(0, visibleCount).map((item) => (
              <div
                key={item.news_id}
                onClick={() => {
                  setSelectedNewsId(item.news_id);
                  setShowDetailModal(true);
                }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-rose-100 transition-all duration-300 group relative cursor-pointer"
              >
                {/* 상단 오른쪽 아이콘 영역 - 달력, 수정, 삭제 */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  {/* 달력 아이콘 */}
                  <div className="flex items-center text-slate-400 text-xs">
                    <Calendar size={14} className="mr-1" />
                    <span className="hidden sm:inline">{formatNewsDate(item.created_at)}</span>
                  </div>

                  {/* 관리자 이상만 수정/삭제 버튼 표시 */}
                  {user && hasRole(user, 'admin', 'super-admin') && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNews(item);
                          setShowEditModal(true);
                        }}
                        className="p-2 bg-white/90 backdrop-blur-sm hover:bg-slate-100 rounded-full transition-colors shadow-sm border border-slate-200"
                        title="수정"
                      >
                        <Edit size={16} className="text-slate-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNews(item);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 bg-white/90 backdrop-blur-sm hover:bg-rose-100 rounded-full transition-colors shadow-sm border border-rose-200"
                        title="삭제"
                      >
                        <Trash2 size={16} className="text-rose-600" />
                      </button>
                    </>
                  )}
                </div>

                {/* 배지 - 왼쪽 상단, 오른쪽 버튼 공간 확보 */}
                <div className="mb-4 pr-24">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTagColor(item.tag)}`}>
                    {item.tag}
                  </span>
                </div>

                {/* 제목 - 오른쪽 버튼 공간 확보 */}
                <h3 className="text-lg font-bold text-slate-800 mb-3 group-hover:text-rose-500 transition-colors pr-24 line-clamp-2">
                  {item.title}
                </h3>

                {/* 설명 텍스트 */}
                <p className="text-slate-600 text-sm leading-relaxed mb-6 line-clamp-3">
                  {(() => {
                    const raw = item.summary || item.content.substring(0, 150);
                    // HTML 태그 제거하여 텍스트만 표시
                    const div = document.createElement('div');
                    div.innerHTML = raw;
                    return div.textContent || div.innerText || raw;
                  })()}
                </p>

                {/* 자세히 보기 링크 */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNewsId(item.news_id);
                    setShowDetailModal(true);
                  }}
                  className="flex items-center text-rose-500 text-sm font-semibold group-hover:translate-x-1 transition-transform cursor-pointer"
                >
                  자세히 보기 <ChevronRight size={16} className="ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}

        {newsItems.length > visibleCount && (
          <div className="mt-12 text-center">
            <button
              onClick={() => setVisibleCount(prev => prev + 6)}
              className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-full font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              소식 더보기 ({visibleCount}/{newsItems.length})
            </button>
          </div>
        )}
      </div>

      {/* 교회소식 작성 모달 */}
      <NewsWriteModal
        isOpen={showWriteModal}
        onClose={() => setShowWriteModal(false)}
        onSuccess={() => {
          loadNews();
          setShowWriteModal(false);
        }}
      />

      {/* 교회소식 수정 모달 */}
      <NewsEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedNews(null);
        }}
        news={selectedNews}
        onSuccess={() => {
          loadNews();
          setShowEditModal(false);
          setSelectedNews(null);
        }}
      />

      {/* 교회소식 삭제 모달 */}
      <NewsDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedNews(null);
        }}
        news={selectedNews}
        onSuccess={() => {
          loadNews();
          setShowDeleteModal(false);
          setSelectedNews(null);
        }}
      />

      {/* 교회소식 상세 모달 */}
      <NewsDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedNewsId(null);
        }}
        newsId={selectedNewsId || 0}
        onUpdate={() => {
          loadNews();
        }}
      />
    </div>
  );
};

export default NewsSection;