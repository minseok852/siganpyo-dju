// src/pages/HomePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Share2, 
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Loader2,
  X,
  Wand2,
  HelpCircle
} from 'lucide-react';
import ScheduleGrid from '../components/schedule/ScheduleGrid';
import CourseSearch from '../components/schedule/CourseSearch';
import CourseDetail from '../components/schedule/CourseDetail';
import { useSchedule } from '../hooks/useSchedule';
import { saveScheduleForShare } from '../services/shareService';

export default function HomePage() {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  
  // 공유 모달 상태
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const {
    courses,
    stats,
    addCourse,
    removeCourse,
    clearSchedule,
    getCourseColor,
  } = useSchedule();

  // 시간표 공유
  const handleShare = async () => {
    if (courses.length === 0) return;
    
    setIsSharing(true);
    setIsShareModalOpen(true);
    
    const result = await saveScheduleForShare(courses);
    
    if (result.success) {
      const link = `${window.location.origin}/share/${result.shareId}`;
      setShareLink(link);
    } else {
      alert('공유 링크 생성에 실패했습니다: ' + result.error);
      setIsShareModalOpen(false);
    }
    
    setIsSharing(false);
  };

  // 공유 링크 복사
  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  // 교과번호 복사
  const handleCopyCode = (courseCode, section) => {
    const code = `${courseCode}-${section}`;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // 전체 교과번호 복사
  const handleCopyAllCodes = () => {
    const allCodes = courses.map(c => `${c.course_code}-${c.section}`).join('\n');
    navigator.clipboard.writeText(allCodes);
    setCopiedCode('all');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // 온라인 과목 필터 - ✅ times가 없거나 빈 배열인 경우
  const onlineCourses = courses.filter(c => !c.times || c.times.length === 0);
  
  // ✅ 오프라인 과목 (시간표에 표시되는 과목)
  const offlineCourses = courses.filter(c => c.times && c.times.length > 0);

  // ✅ 선택된 과목이 이미 추가되었는지 확인
  const isSelectedCourseAdded = selectedCourse 
    ? courses.some(c => c.course_code === selectedCourse.course_code && c.section === selectedCourse.section)
    : false;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BookOpen className="text-blue-600" size={20} />
              <h1 className="text-base font-bold text-gray-800">대진대 시간표</h1>
            </div>
            <nav className="flex items-center gap-1">
              <a 
                href="/faq" 
                className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
              >
                <HelpCircle size={14} />
                FAQ
              </a>
              <a 
                href="/ai" 
                className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
              >
                <Sparkles size={14} />
                AI평가
              </a>
              <a 
                href="/popular" 
                className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600"
              >
                인기
              </a>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-2 py-3">
        {/* 통계 & 액션 바 */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            {/* 통계 */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <span className="text-xl font-bold text-blue-600">{stats.totalCredits}</span>
                <span className="text-xs text-gray-500 ml-0.5">학점</span>
              </div>
              <div className="text-center">
                <span className="text-xl font-bold text-gray-700">{stats.courseCount}</span>
                <span className="text-xs text-gray-500 ml-0.5">과목</span>
              </div>
              {stats.emptyDays.length > 0 && (
                <div className="text-xs text-green-600 hidden sm:block">
                  🎉 {stats.emptyDays.join(', ')} 공강
                </div>
              )}
            </div>

            {/* 액션 버튼들 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1 text-sm"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">과목</span>추가
              </button>
              <button
                onClick={() => navigate('/recommend')}
                className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 flex items-center gap-1 text-sm"
              >
                <Wand2 size={16} />
                <span className="hidden sm:inline">AI로</span>만들기
              </button>
              <button
                onClick={handleShare}
                disabled={courses.length === 0}
                className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                title="공유"
              >
                <Share2 size={18} />
              </button>
              {courses.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('시간표를 초기화할까요?')) {
                      clearSchedule();
                    }
                  }}
                  className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
                  title="초기화"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
          
          {/* 공강 표시 - 모바일 */}
          {stats.emptyDays.length > 0 && (
            <div className="text-xs text-green-600 mt-2 sm:hidden">
              🎉 {stats.emptyDays.join(', ')} 공강!
            </div>
          )}
        </div>

        {/* 시간표 그리드 */}
        {courses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-5xl mb-3">📚</div>
            <h2 className="text-lg font-medium text-gray-700 mb-2">
              시간표를 만들어보세요!
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              직접 과목을 추가하거나, AI가 만들어줄 수도 있어요
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center gap-2"
              >
                <Plus size={18} />
                과목 추가
              </button>
              <button
                onClick={() => navigate('/recommend')}
                className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 inline-flex items-center gap-2"
              >
                <Wand2 size={18} />
                AI로 만들기
              </button>
            </div>
          </div>
        ) : (
          <ScheduleGrid
            courses={offlineCourses}  
            onRemoveCourse={removeCourse}
            getCourseColor={getCourseColor}
            onCourseClick={setSelectedCourse}
          />
        )}

        {/* 온라인/시간미정 과목 */}
        {onlineCourses.length > 0 && (
          <div className="mt-3 bg-white rounded-lg shadow-sm p-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              💻 온라인/시간미정 과목 ({onlineCourses.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onlineCourses.map((course, index) => {
                const color = getCourseColor(course.course_code, course.section);
                const code = `${course.course_code || 'unknown'}-${course.section || index}`;
                const isCopied = copiedCode === code;
                
                return (
                  <div
                    key={`online-${course.course_code || index}-${course.section || index}-${index}`}
                    className={`p-2 rounded-lg border ${color.bg} ${color.border} cursor-pointer hover:shadow transition-shadow`}
                    onClick={() => setSelectedCourse(course)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium text-sm truncate ${color.text}`}>
                          {course.course_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {course.professor} | {course.credits}학점
                        </div>
                        {course.schedule_raw && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            📅 {course.schedule_raw}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(course.course_code, course.section);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-0.5 ${
                            isCopied 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-white/70 text-gray-600 hover:bg-white'
                          }`}
                        >
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}
                          {code}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCourse(course.course_code, course.section);
                          }}
                          className="p-1 hover:bg-white/50 rounded text-gray-500 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 추가된 과목 목록 + 교과번호 */}
        {courses.length > 0 && (
          <div className="mt-3 bg-white rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">
                추가된 과목 ({courses.length})
              </h3>
              <button
                onClick={handleCopyAllCodes}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {copiedCode === 'all' ? (
                  <>
                    <Check size={12} />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    전체 복사
                  </>
                )}
              </button>
            </div>

            {/* 과목 카드 리스트 */}
            <div className="space-y-1.5">
              {courses.map((course, index) => {
                const color = getCourseColor(course.course_code, course.section);
                const code = `${course.course_code || 'unknown'}-${course.section || index}`;
                const isCopied = copiedCode === code;

                return (
                  <div
                    key={`list-${course.course_code || index}-${course.section || index}-${index}`}
                    className={`p-2 rounded-lg border ${color.bg} ${color.border} cursor-pointer hover:shadow transition-shadow`}
                    onClick={() => setSelectedCourse(course)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium ${color.text} truncate`}>
                            {course.course_name}
                          </span>
                          <span className="text-xs text-gray-500 shrink-0">
                            {course.credits}학점
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {course.professor} | {course.schedule_raw}
                        </div>
                      </div>

                      {/* 교과번호 + 삭제 */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(course.course_code, course.section);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-0.5 ${
                            isCopied 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-white/70 text-gray-600 hover:bg-white'
                          }`}
                        >
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}
                          {code}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCourse(course.course_code, course.section);
                          }}
                          className="p-1 hover:bg-white/50 rounded text-gray-500 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 수강신청 팁 */}
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
              💡 교과번호 알아두기 → 장바구니 잘 안 들어가지면 바로 교과번호 입력하기
            </div>
          </div>
        )}
      </main>

      {/* 과목 검색 모달 */}
      <CourseSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onAddCourse={addCourse}
        onRemoveCourse={removeCourse}
        currentCourses={courses}
      />

      {/* ✅ 과목 상세 모달 - onRemove 추가! */}
      {selectedCourse && (
        <CourseDetail
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onAdd={addCourse}
          onRemove={removeCourse}
          isAdded={isSelectedCourseAdded}
          conflict={null}
        />
      )}

      {/* 공유 모달 */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">시간표 공유</h2>
              <button 
                onClick={() => {
                  setIsShareModalOpen(false);
                  setShareLink('');
                  setShareCopied(false);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {isSharing ? (
              <div className="text-center py-6">
                <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={32} />
                <p className="text-gray-600">공유 링크 생성 중...</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  아래 링크를 복사해서 친구에게 공유하세요!
                </p>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${
                      shareCopied 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {shareCopied ? (
                      <>
                        <Check size={16} />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        복사
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  * 링크를 받은 친구는 이 시간표를 볼 수 있고, 자신의 시간표로 가져올 수 있습니다.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}