// src/pages/UpdateLogPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Sparkles, 
  Bug, 
  Wrench,
  Rocket,
  ChevronDown,
  ChevronUp,
  Tag,
  Loader2,
  Settings,
  RefreshCw
} from 'lucide-react';
import { getUpdates } from '../services/updateService';

// 업데이트 타입별 스타일
const TYPE_CONFIG = {
  feature: {
    label: '새 기능',
    icon: Sparkles,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    iconColor: 'text-blue-500',
    dot: 'bg-blue-500',
  },
  fix: {
    label: '버그 수정',
    icon: Bug,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    iconColor: 'text-red-500',
    dot: 'bg-red-500',
  },
  improve: {
    label: '개선',
    icon: Wrench,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    iconColor: 'text-amber-500',
    dot: 'bg-amber-500',
  },
  release: {
    label: '출시',
    icon: Rocket,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    iconColor: 'text-green-500',
    dot: 'bg-green-500',
  },
};

// 개별 변경사항 태그
function ChangeTag({ type }) {
  const config = TYPE_CONFIG[type];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.text}`}>
      <Icon size={10} />
      {config.label}
    </span>
  );
}

// 버전 카드
function VersionCard({ update, isLatest }) {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  // 타입별 개수 집계
  const typeCounts = {};
  (update.changes || []).forEach(c => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });

  return (
    <div className="relative">
      {/* 타임라인 점 */}
      <div className={`absolute -left-[25px] top-3 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
        isLatest ? 'bg-blue-500' : 'bg-gray-300'
      }`} />

      <div className={`bg-white rounded-xl border ${isLatest ? 'border-blue-200 shadow-md' : 'border-gray-200 shadow-sm'} overflow-hidden`}>
        {/* 헤더 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 text-left"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isLatest && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">
                    NEW
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Tag size={11} />
                  v{update.version}
                </span>
                <span className="text-xs text-gray-400">
                  {update.date}
                </span>
              </div>
              <h3 className="text-sm font-bold text-gray-800">{update.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{update.highlights}</p>

              {/* 접혀있을 때 타입 요약 뱃지 */}
              {!isExpanded && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(typeCounts).map(([type, count]) => {
                    const config = TYPE_CONFIG[type];
                    if (!config) return null;
                    return (
                      <span key={type} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${config.bg} ${config.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        {config.label} {count}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-1 text-gray-400">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </button>

        {/* 변경사항 목록 */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="mt-3 space-y-2">
              {(update.changes || []).map((change, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ChangeTag type={change.type} />
                  <span className="text-xs text-gray-700 leading-relaxed pt-0.5">{change.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UpdateLogPage() {
  const navigate = useNavigate();
  const [updates, setUpdates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUpdates = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getUpdates();
    if (result.success) {
      setUpdates(result.updates);
    } else {
      setError('업데이트 내역을 불러오는데 실패했습니다.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  const totalChanges = updates.reduce((sum, u) => sum + (u.changes?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft size={20} />
              </button>
              <Rocket className="text-blue-500" size={20} />
              <h1 className="text-base font-bold text-gray-800">업데이트 내역</h1>
            </div>
            <button
              onClick={() => navigate('/updates/admin')}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500"
              title="관리자"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {/* 로딩 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
            <p className="text-sm text-gray-500">불러오는 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button
              onClick={fetchUpdates}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <RefreshCw size={14} />
              다시 시도
            </button>
          </div>
        )}

        {/* 내용 없음 */}
        {!isLoading && !error && updates.length === 0 && (
          <div className="text-center py-20">
            <Rocket className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-sm text-gray-500">아직 업데이트 내역이 없습니다.</p>
          </div>
        )}

        {/* 내용 있음 */}
        {!isLoading && !error && updates.length > 0 && (
          <>
            {/* 요약 카드 */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 mb-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} />
                <span className="text-sm font-bold">현재 버전 v{updates[0]?.version}</span>
              </div>
              <p className="text-xs text-blue-100">
                총 {updates.length}번의 업데이트, {totalChanges}개의 변경사항이 반영되었습니다.
              </p>
            </div>

            {/* 타임라인 */}
            <div className="relative pl-6 border-l-2 border-gray-200 space-y-4 ml-1">
              {updates.map((update, index) => (
                <VersionCard
                  key={update.id}
                  update={update}
                  isLatest={index === 0}
                />
              ))}
            </div>

            {/* 하단 안내 */}
            <div className="mt-8 mb-4 text-center">
              <p className="text-xs text-gray-400">
                건의사항이 있다면 피드백 게시판을 이용해주세요 🙏
              </p>
              <button
                onClick={() => navigate('/feedback')}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                피드백 보내기 →
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}