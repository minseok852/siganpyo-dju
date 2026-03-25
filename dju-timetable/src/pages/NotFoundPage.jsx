// src/pages/NotFoundPage.jsx
import { useNavigate } from 'react-router-dom';
import { BookOpen, Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 - 기존 스타일 그대로 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="text-blue-600" size={20} />
            <h1 className="text-base font-bold text-gray-800">대진대 시간표</h1>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">

          {/* 404 숫자 */}
          <div className="relative inline-block mb-6">
            <span
              className="text-[120px] font-black leading-none select-none"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              404
            </span>
            {/* 책 이모지 배지 */}
            <span className="absolute -top-2 -right-4 text-4xl animate-bounce">📚</span>
          </div>

          {/* 안내 텍스트 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              페이지를 찾을 수 없어요
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              주소가 잘못되었거나, 삭제된 페이지예요.<br />
              시간표 메인으로 돌아가서 다시 시작해보세요!
            </p>

            {/* 구분선 */}
            <div className="my-4 border-t border-gray-100" />

            {/* 혹시? 힌트 */}
            <div className="flex items-start gap-2 text-left bg-blue-50 rounded-xl p-3">
              <Search size={15} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-600">
                공유된 시간표 링크라면, 링크가 만료되었을 수 있어요.
                친구에게 다시 받아보세요.
              </p>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Home size={18} />
              시간표 홈으로
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} />
              이전 페이지로
            </button>
          </div>

          {/* 하단 안내 */}
          <p className="mt-6 text-xs text-gray-400">
            문제가 반복된다면{' '}
            <button
              onClick={() => navigate('/feedback')}
              className="text-blue-400 underline underline-offset-2 hover:text-blue-500"
            >
              피드백
            </button>
            으로 알려주세요
          </p>
        </div>
      </main>
    </div>
  );
}