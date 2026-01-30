// src/pages/FeedbackPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MessageSquarePlus,
  Send,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Search,
  X
} from 'lucide-react';
import { 
  createFeedback, 
  getFeedbacks,
  FEEDBACK_STATUS,
  FEEDBACK_CATEGORY 
} from '../services/feedbackService';
import { useCourses } from '../hooks/useCourses';

// 상태별 스타일
const STATUS_STYLES = {
  [FEEDBACK_STATUS.RECEIVED]: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    icon: Clock,
  },
  [FEEDBACK_STATUS.REVIEWING]: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: AlertCircle,
  },
  [FEEDBACK_STATUS.COMPLETED]: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: CheckCircle,
  },
  [FEEDBACK_STATUS.REJECTED]: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: XCircle,
  },
};

// 피드백 카드 컴포넌트
function FeedbackCard({ feedback }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[feedback.status] || STATUS_STYLES[FEEDBACK_STATUS.RECEIVED];
  const StatusIcon = statusStyle.icon;
  
  const formatDate = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div 
        className="p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* 카테고리 & 상태 */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                feedback.category === FEEDBACK_CATEGORY.TYPO 
                  ? 'bg-orange-100 text-orange-700' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {feedback.category}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text}`}>
                <StatusIcon size={12} />
                {feedback.status}
              </span>
            </div>
            
            {/* 과목명 (오타 제보인 경우) */}
            {feedback.courseName && (
              <div className="text-xs text-gray-500 mb-1">
                📚 {feedback.courseName}
              </div>
            )}
            
            {/* 내용 미리보기 */}
            <p className={`text-sm text-gray-800 ${isExpanded ? '' : 'line-clamp-2'}`}>
              {feedback.content}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-gray-400">
              {formatDate(feedback.createdAt)}
            </span>
            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </div>
      </div>
      
      {/* 확장된 내용 */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {feedback.content}
          </p>
          
          {/* 반영 불가 사유 */}
          {feedback.status === FEEDBACK_STATUS.REJECTED && feedback.rejectionReason && (
            <div className="mt-2 p-2 bg-red-50 rounded-lg">
              <p className="text-xs text-red-600">
                <strong>반영 불가 사유:</strong> {feedback.rejectionReason}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 작성 모달 컴포넌트
function WriteModal({ isOpen, onClose, onSubmit }) {
  const [category, setCategory] = useState(FEEDBACK_CATEGORY.FEATURE);
  const [content, setContent] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(0);
  
  // 과목 검색 관련
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const { searchCourses } = useCourses();
  
  const MAX_CHARS = 800;

  // 과목 검색
  useEffect(() => {
    if (!showCourseSearch || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchCourses({ searchTerm, limit: 20 });
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm, showCourseSearch, searchCourses]);

  const handleContentChange = (e) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARS) {
      setContent(text);
      setCharCount(text.length);
    }
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setShowCourseSearch(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }
    
    if (category === FEEDBACK_CATEGORY.TYPO && !selectedCourse) {
      alert('오타 제보 시 과목을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    
    const result = await onSubmit({
      category,
      content: content.trim(),
      courseName: category === FEEDBACK_CATEGORY.TYPO && selectedCourse
        ? `${selectedCourse.course_name} (${selectedCourse.course_code}-${selectedCourse.section}, ${selectedCourse.professor})`
        : null,
    });
    
    setIsSubmitting(false);
    
    if (result.success) {
      setContent('');
      setSelectedCourse(null);
      setCharCount(0);
      onClose();
    }
  };

  // 카테고리 변경 시 선택된 과목 초기화
  useEffect(() => {
    if (category !== FEEDBACK_CATEGORY.TYPO) {
      setSelectedCourse(null);
    }
  }, [category]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">피드백 작성</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCategory(FEEDBACK_CATEGORY.TYPO)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                  category === FEEDBACK_CATEGORY.TYPO
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                🔤 오타 제보
              </button>
              <button
                onClick={() => setCategory(FEEDBACK_CATEGORY.FEATURE)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                  category === FEEDBACK_CATEGORY.FEATURE
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                💡 기능 제안
              </button>
            </div>
          </div>

          {/* 과목 선택 (오타 제보인 경우) */}
          {category === FEEDBACK_CATEGORY.TYPO && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                과목 선택 <span className="text-red-500">*</span>
              </label>
              
              {selectedCourse ? (
                <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{selectedCourse.course_name}</div>
                    <div className="text-xs text-gray-500">
                      {selectedCourse.course_code}-{selectedCourse.section} | {selectedCourse.professor}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="p-1 hover:bg-orange-100 rounded"
                  >
                    <X size={16} className="text-gray-500" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCourseSearch(true)}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 flex items-center justify-center gap-2"
                >
                  <Search size={16} />
                  과목 검색하여 선택
                </button>
              )}
            </div>
          )}

          {/* 내용 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={handleContentChange}
              placeholder={
                category === FEEDBACK_CATEGORY.TYPO
                  ? "어디에 오타가 있는지 자세히 알려주세요.\n예: '담당교수'가 '담당교스'로 잘못 표기되어 있어요."
                  : "추가되었으면 하는 기능이나 개선사항을 자유롭게 작성해주세요."
              }
              className="w-full px-3 py-2 border rounded-lg text-sm h-40 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
                {charCount}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 익명으로 작성되며, 모든 사용자가 볼 수 있어요.<br/>
              중복 제보를 피하기 위해 기존 글을 먼저 확인해주세요!
            </p>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="sticky bottom-0 bg-white p-4 border-t">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                제출 중...
              </>
            ) : (
              <>
                <Send size={18} />
                제출하기
              </>
            )}
          </button>
        </div>
      </div>

      {/* 과목 검색 모달 */}
      {showCourseSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">과목 검색</h3>
              <button 
                onClick={() => {
                  setShowCourseSearch(false);
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="과목명, 교수명, 학수번호 검색..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">2글자 이상 입력하세요</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isSearching ? (
                <div className="text-center py-8">
                  <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {searchTerm.length >= 2 ? '검색 결과가 없습니다' : '과목을 검색해주세요'}
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map(course => (
                    <div
                      key={`${course.course_code}-${course.section}`}
                      onClick={() => handleSelectCourse(course)}
                      className="p-3 rounded-lg border border-gray-200 hover:bg-orange-50 hover:border-orange-300 cursor-pointer"
                    >
                      <div className="font-medium text-sm">{course.course_name}</div>
                      <div className="text-xs text-gray-500">
                        {course.course_code}-{course.section} | {course.professor} | {course.schedule_raw}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // 피드백 목록 로드
  const loadFeedbacks = async () => {
    setLoading(true);
    const result = await getFeedbacks();
    if (result.success) {
      setFeedbacks(result.feedbacks);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  // 피드백 제출
  const handleSubmit = async (data) => {
    const result = await createFeedback(data);
    
    if (result.success) {
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      loadFeedbacks();  // 목록 새로고침
    } else {
      alert('제출에 실패했습니다: ' + result.error);
    }
    
    return result;
  };

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
              <MessageSquarePlus className="text-blue-500" size={20} />
              <h1 className="text-base font-bold text-gray-800">피드백</h1>
            </div>
            
            {/* 관리자 버튼 */}
            <button
              onClick={() => navigate('/feedback/admin')}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500"
              title="관리자"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {/* 성공 메시지 */}
        {submitSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <CheckCircle className="text-green-500" size={18} />
            <p className="text-sm text-green-700">피드백이 성공적으로 제출되었습니다!</p>
          </div>
        )}

        {/* 안내 카드 */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white mb-4">
          <h2 className="font-bold text-lg mb-1">📮 피드백 게시판</h2>
          <p className="text-sm opacity-90">
            오타 제보나 기능 제안을 익명으로 남겨주세요!
          </p>
          <button
            onClick={() => setIsWriteModalOpen(true)}
            className="mt-3 px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            ✏️ 피드백 작성하기
          </button>
        </div>

        {/* 피드백 목록 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">
              전체 피드백 ({feedbacks.length})
            </h3>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
              <p className="text-sm text-gray-500 mt-2">불러오는 중...</p>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <MessageSquarePlus className="mx-auto mb-3 text-gray-300" size={48} />
              <p className="text-gray-500">아직 피드백이 없어요</p>
              <p className="text-sm text-gray-400 mt-1">첫 번째 피드백을 남겨주세요!</p>
            </div>
          ) : (
            feedbacks.map(feedback => (
              <FeedbackCard key={feedback.id} feedback={feedback} />
            ))
          )}
        </div>
      </main>

      {/* 작성 모달 */}
      <WriteModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {/* 플로팅 작성 버튼 */}
      <button
        onClick={() => setIsWriteModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center z-30"
      >
        <MessageSquarePlus size={24} />
      </button>
    </div>
  );
}

