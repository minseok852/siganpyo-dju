// src/pages/HomePage.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Share2, Sparkles, BookOpen, Copy, Check,
  Loader2, X, Wand2, HelpCircle, Edit3, Files, ChevronDown, MessageSquarePlus,
  Smartphone, Download, CheckCircle
} from 'lucide-react';
import ScheduleGrid from '../components/schedule/ScheduleGrid';
import CourseSearch from '../components/schedule/CourseSearch';
import CourseDetail from '../components/schedule/CourseDetail';
import { useSchedule } from '../hooks/useSchedule';
import { saveScheduleForShare } from '../services/shareService';
import { createTransfer, receiveTransfer } from '../services/transferService';

// 시간표 탭 메뉴 컴포넌트
function ScheduleTabMenu({ schedule, isActive, onSwitch, onRename, onDuplicate, onDelete, canDelete, canDuplicate }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(schedule.name);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = () => {
    if (newName.trim() && newName !== schedule.name) {
      onRename(schedule.id, newName.trim());
    }
    setIsRenaming(false);
    setIsMenuOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleRename();
    else if (e.key === 'Escape') { setNewName(schedule.name); setIsRenaming(false); }
  };

  return (
    <div className="relative" ref={menuRef}>
      <div
        className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg cursor-pointer transition-all ${
          isActive ? 'bg-white text-blue-600 font-medium shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        onClick={() => !isRenaming && onSwitch(schedule.id)}
      >
        {isRenaming ? (
          <input ref={inputRef} type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()}
            className="w-20 px-1 py-0 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" maxLength={15} />
        ) : (
          <span className="text-sm truncate max-w-[80px]">{schedule.name}</span>
        )}
        <span className={`text-[10px] px-1 py-0.5 rounded ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
          {schedule.courses.reduce((sum, c) => sum + (c.credits || 0), 0)}
        </span>
        {isActive && !isRenaming && (
          <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-0.5 hover:bg-blue-100 rounded">
            <ChevronDown size={14} />
          </button>
        )}
      </div>
      {isMenuOpen && (
        <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-lg shadow-lg border z-50">
          <button onClick={() => { setIsRenaming(true); setIsMenuOpen(false); }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
            <Edit3 size={14} />이름 변경
          </button>
          {canDuplicate && (
            <button onClick={() => { onDuplicate(schedule.id); setIsMenuOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
              <Files size={14} />복제하기
            </button>
          )}
          {canDelete && (
            <button onClick={() => { if (confirm(`"${schedule.name}" 시간표를 삭제할까요?`)) onDelete(schedule.id); setIsMenuOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
              <Trash2 size={14} />삭제하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ✅ 온라인 과목인지 판별하는 헬퍼 함수
function isOnlineCourse(course) {
  // 1. times 배열이 없거나 비어있으면 온라인/시간미정
  if (!course.times || course.times.length === 0) {
    return true;
  }
  
  // 2. room이 e-learning 관련이면 온라인
  const room = (course.room || '').toLowerCase();
  if (room.includes('e-learning') || room.includes('온라인')) {
    return true;
  }
  
  // 3. notes에 원격수업 표시가 있으면 온라인
  const notes = (course.notes || '');
  if (notes.includes('[원격수업]') || notes.includes('[OCU')) {
    return true;
  }
  
  return false;
}

function TransferSendModal({ isOpen, onClose, code, isLoading }) {
  const [timeLeft, setTimeLeft] = useState(300);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !code) return;
    setTimeLeft(300);
    const timer = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, code]);

  if (!isOpen) return null;

  const isExpired = timeLeft === 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedCode = code ? `${code.slice(0, 4)} ${code.slice(4)}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">다른 기기로 보내기</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={32} />
            <p className="text-gray-600">코드 생성 중...</p>
          </div>
        ) : isExpired ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">⏰</div>
            <p className="font-medium text-gray-700">코드가 만료되었습니다.</p>
            <p className="text-sm text-gray-500 mt-1">다시 시도해주세요.</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <div className="bg-gray-50 rounded-xl py-5 px-4 mb-3">
                <p className="text-4xl font-bold tracking-[0.2em] text-gray-800 font-mono select-all">
                  {formattedCode}
                </p>
              </div>
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors ${
                  copied ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {copied ? <><Check size={16} />복사됨</> : <><Copy size={16} />코드 복사</>}
              </button>
            </div>

            <div className="text-center mb-4">
              <div className={`text-3xl font-mono font-bold ${timeLeft <= 60 ? 'text-red-500' : 'text-blue-500'}`}>
                {minutes}:{String(seconds).padStart(2, '0')}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">남은 시간</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700 text-center leading-relaxed">
                다른 기기에서 이 코드를 입력하세요.<br />
                5분 안에 1회만 사용 가능합니다.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TransferReceiveModal({ isOpen, onClose, onApply }) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [receivedCourses, setReceivedCourses] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError('');
      setReceivedCourses(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (code.length !== 8) { setError('8자리 숫자를 입력해주세요'); return; }
    setIsLoading(true);
    setError('');
    const result = await receiveTransfer(code);
    setIsLoading(false);
    if (result.success) {
      setReceivedCourses(result.courses);
    } else {
      setError(result.error);
    }
  };

  const handleApply = (mode) => {
    onApply(receivedCourses, mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">코드로 불러오기</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        {!receivedCourses ? (
          <>
            <p className="text-sm text-gray-600 mb-3">다른 기기에서 생성된 8자리 코드를 입력하세요.</p>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                setError('');
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="00000000"
              className="w-full px-4 py-3 border-2 rounded-xl text-center text-3xl font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {error && <p className="text-sm text-red-500 mt-2 text-center">{error}</p>}
            <button
              onClick={handleConfirm}
              disabled={code.length !== 8 || isLoading}
              className="w-full mt-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <><Loader2 className="animate-spin" size={18} />불러오는 중...</> : '확인'}
            </button>
          </>
        ) : (
          <>
            <div className="text-center py-4">
              <CheckCircle className="mx-auto mb-2 text-green-500" size={40} />
              <p className="font-medium text-gray-800">시간표를 가져왔어요!</p>
              <p className="text-sm text-gray-500 mt-1">{receivedCourses.length}개 과목</p>
            </div>
            <p className="text-sm text-gray-600 text-center mb-3">어떻게 적용할까요?</p>
            <div className="space-y-2">
              <button
                onClick={() => handleApply('overwrite')}
                className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
              >
                현재 시간표에 덮어쓰기
              </button>
              <button
                onClick={() => handleApply('new')}
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                새 시간표로 추가
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const [isTransferSendOpen, setIsTransferSendOpen] = useState(false);
  const [transferCode, setTransferCode] = useState('');
  const [isTransferSending, setIsTransferSending] = useState(false);
  const [isTransferReceiveOpen, setIsTransferReceiveOpen] = useState(false);

  const {
    schedules, activeId, activeSchedule, addSchedule, duplicateSchedule, deleteSchedule,
    renameSchedule, switchSchedule, maxSchedules,
    courses, stats, addCourse, removeCourse, clearSchedule, getCourseColor,
    loadSchedule, saveToSchedule,
  } = useSchedule();

  const handleShare = async () => {
    if (courses.length === 0) return;
    setIsSharing(true); setIsShareModalOpen(true);
    const result = await saveScheduleForShare(courses);
    if (result.success) setShareLink(`${window.location.origin}/share/${result.shareId}`);
    else { alert('공유 링크 생성에 실패했습니다: ' + result.error); setIsShareModalOpen(false); }
    setIsSharing(false);
  };

  const handleCopyShareLink = () => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); };
  const handleCopyCode = (courseCode, section) => { const code = `${courseCode}-${section}`; navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(null), 2000); };
  const handleCopyAllCodes = () => { const allCodes = courses.map(c => `${c.course_code}-${c.section}`).join('\n'); navigator.clipboard.writeText(allCodes); setCopiedCode('all'); setTimeout(() => setCopiedCode(null), 2000); };
  const handleAddSchedule = () => { const result = addSchedule(); if (!result.success) alert(result.error); };

  const handleTransferSend = async () => {
    if (courses.length === 0) return;
    setTransferCode('');
    setIsTransferSending(true);
    setIsTransferSendOpen(true);
    const result = await createTransfer(courses);
    if (result.success) {
      setTransferCode(result.code);
    } else {
      alert('코드 생성에 실패했습니다: ' + result.error);
      setIsTransferSendOpen(false);
    }
    setIsTransferSending(false);
  };

  const handleReceiveApply = (receivedCourses, mode) => {
    if (mode === 'overwrite') {
      loadSchedule(receivedCourses);
    } else {
      const result = addSchedule();
      if (result.success) {
        saveToSchedule(receivedCourses, result.id, true);
      } else {
        alert(result.error);
      }
    }
  };

  // ✅ 개선된 온라인/오프라인 분류
  const onlineCourses = courses.filter(c => isOnlineCourse(c));
  const offlineCourses = courses.filter(c => !isOnlineCourse(c));
  
  const isSelectedCourseAdded = selectedCourse ? courses.some(c => c.course_code === selectedCourse.course_code && c.section === selectedCourse.section) : false;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BookOpen className="text-blue-600" size={20} />
              <h1 className="text-base font-bold text-gray-800">대진대 시간표</h1>
            </div>
            <nav className="flex items-center gap-1">
              <a href="/feedback" className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"><MessageSquarePlus size={14} />피드백</a>
              <a href="/updates" className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1">📋업데이트</a>
              <a href="/faq" className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"><HelpCircle size={14} />FAQ</a>
              <a href="/ai" className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"><Sparkles size={14} />AI평가</a>
              <a href="/graduation" className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600">졸업계산기</a>
              <a href="/popular" className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600">인기</a>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-2 py-3">
        {/* 시간표 탭 */}
        <div className="flex items-end gap-1 mb-0">
          {schedules.map(schedule => (
            <ScheduleTabMenu key={schedule.id} schedule={schedule} isActive={schedule.id === activeId}
              onSwitch={switchSchedule} onRename={renameSchedule} onDuplicate={duplicateSchedule}
              onDelete={deleteSchedule} canDelete={schedules.length > 1} canDuplicate={schedules.length < maxSchedules} />
          ))}
          {schedules.length < maxSchedules && (
            <button onClick={handleAddSchedule} className="px-2 py-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-t-lg transition-colors" title="새 시간표 추가">
              <Plus size={18} />
            </button>
          )}
        </div>

        {/* 통계 & 액션 바 */}
        <div className="bg-white rounded-lg rounded-tl-none shadow-sm p-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="text-center"><span className="text-xl font-bold text-blue-600">{stats.totalCredits}</span><span className="text-xs text-gray-500 ml-0.5">학점</span></div>
              <div className="text-center"><span className="text-xl font-bold text-gray-700">{stats.courseCount}</span><span className="text-xs text-gray-500 ml-0.5">과목</span></div>
              {stats.emptyDays.length > 0 && <div className="text-xs text-green-600 hidden sm:block">🎉 {stats.emptyDays.join(', ')} 공강</div>}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsSearchOpen(true)} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1 text-sm">
                <Plus size={16} /><span className="hidden sm:inline">과목</span>추가
              </button>
              <button onClick={() => navigate('/recommend')} className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 flex items-center gap-1 text-sm">
                <Wand2 size={16} /><span className="hidden sm:inline">AI로</span>만들기
              </button>
              <button onClick={handleShare} disabled={courses.length === 0} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50" title="공유"><Share2 size={18} /></button>
              {courses.length > 0 && (
                <button onClick={handleTransferSend} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50" title="다른 기기로 보내기"><Smartphone size={18} /></button>
              )}
              <button onClick={() => setIsTransferReceiveOpen(true)} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50" title="코드로 불러오기"><Download size={18} /></button>
              {courses.length > 0 && (
                <button onClick={() => { if (confirm(`"${activeSchedule?.name}" 시간표를 초기화할까요?`)) clearSchedule(); }}
                  className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50" title="현재 시간표 초기화"><Trash2 size={18} /></button>
              )}
            </div>
          </div>
          {stats.emptyDays.length > 0 && <div className="text-xs text-green-600 mt-2 sm:hidden">🎉 {stats.emptyDays.join(', ')} 공강!</div>}
        </div>

        {/* 시간표 그리드 */}
        {courses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-5xl mb-3">📚</div>
            <h2 className="text-lg font-medium text-gray-700 mb-2">시간표를 만들어보세요!</h2>
            <p className="text-sm text-gray-500 mb-4">직접 과목을 추가하거나, AI가 만들어줄 수도 있어요</p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setIsSearchOpen(true)} className="px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center gap-2"><Plus size={18} />과목 추가</button>
              <button onClick={() => navigate('/recommend')} className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 inline-flex items-center gap-2"><Wand2 size={18} />AI로 만들기</button>
            </div>
          </div>
        ) : (
          <ScheduleGrid 
            courses={offlineCourses} 
            onlineCourses={onlineCourses}
            onRemoveCourse={removeCourse} 
            getCourseColor={getCourseColor} 
            onCourseClick={setSelectedCourse} 
          />
        )}

        {/* 추가된 과목 목록 */}
        {courses.length > 0 && (
          <div className="mt-3 bg-white rounded-lg shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">추가된 과목 ({courses.length})</h3>
              <button onClick={handleCopyAllCodes} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                {copiedCode === 'all' ? <><Check size={12} />복사됨</> : <><Copy size={12} />전체 복사</>}
              </button>
            </div>
            <div className="space-y-1.5">
              {courses.map((course, index) => {
                const color = getCourseColor(course.course_code, course.section);
                const code = `${course.course_code || 'unknown'}-${course.section || index}`;
                const isCopied = copiedCode === code;
                const isOnline = isOnlineCourse(course);
                return (
                  <div key={`list-${course.course_code || index}-${course.section || index}-${index}`}
                    className={`p-2 rounded-lg border ${color.bg} ${color.border} cursor-pointer hover:shadow transition-shadow`}
                    onClick={() => setSelectedCourse(course)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium ${color.text} truncate`}>{course.course_name}</span>
                          <span className="text-xs text-gray-500 shrink-0">{course.credits}학점</span>
                          {isOnline && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded shrink-0">온라인</span>}
                        </div>
                        <div className="text-xs text-gray-600 truncate">{course.professor} | {course.schedule_raw || '시간 미정'}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); handleCopyCode(course.course_code, course.section); }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-0.5 ${isCopied ? 'bg-green-100 text-green-700' : 'bg-white/70 text-gray-600 hover:bg-white'}`}>
                          {isCopied ? <Check size={10} /> : <Copy size={10} />}{code}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeCourse(course.course_code, course.section); }} className="p-1 hover:bg-white/50 rounded text-gray-500 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">💡 교과번호 알아두기 → 장바구니 잘 안 들어가지면 바로 교과번호 입력하기</div>
          </div>
        )}
      </main>

      <CourseSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onAddCourse={addCourse} onRemoveCourse={removeCourse} currentCourses={courses} />
      {selectedCourse && <CourseDetail course={selectedCourse} onClose={() => setSelectedCourse(null)} onAdd={addCourse} onRemove={removeCourse} isAdded={isSelectedCourseAdded} conflict={null} />}

      <TransferSendModal
        isOpen={isTransferSendOpen}
        onClose={() => { setIsTransferSendOpen(false); setTransferCode(''); }}
        code={transferCode}
        isLoading={isTransferSending}
      />

      <TransferReceiveModal
        isOpen={isTransferReceiveOpen}
        onClose={() => setIsTransferReceiveOpen(false)}
        onApply={handleReceiveApply}
      />

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">시간표 공유</h2>
              <button onClick={() => { setIsShareModalOpen(false); setShareLink(''); setShareCopied(false); }} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            {isSharing ? (
              <div className="text-center py-6"><Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={32} /><p className="text-gray-600">공유 링크 생성 중...</p></div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">아래 링크를 복사해서 친구에게 공유하세요!</p>
                <div className="flex items-center gap-2">
                  <input type="text" value={shareLink} readOnly className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50" />
                  <button onClick={handleCopyShareLink} className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${shareCopied ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                    {shareCopied ? <><Check size={16} />복사됨</> : <><Copy size={16} />복사</>}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-3">* 링크를 받은 친구는 이 시간표를 볼 수 있고, 자신의 시간표로 가져올 수 있습니다.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}