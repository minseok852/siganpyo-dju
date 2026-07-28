// src/pages/RecommendPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  AlertTriangle,
  X,
  Search,
  BookOpen,
  Shuffle,
  RotateCcw
} from 'lucide-react';
import { useCourses } from '../hooks/useCourses';
import { useSchedule } from '../hooks/useSchedule';
import { recommendSchedule, modifySchedule } from '../services/aiService';
import { logAiSession } from '../services/aiLogService';
import { COLLEGES, COURSE_COLORS } from '../data/constants';
import { parseScheduleToTimes } from '../utils/timeUtils';
import CourseDetail from '../components/schedule/CourseDetail';
import AiFeedback from '../components/AiFeedback';

/* ========================================================================
 *  디자인 토큰 (AI Recommend Redesign)
 *  ink #1E2530 / body #3A4150 / label #5B6472 / muted #8892A4 / faint #B0B7C3
 *  primary #2F6FEB / primary-soft #EAF1FE / border #E4E8F0 / page #EEF1F6
 * ===================================================================== */
const CARD = 'bg-white rounded-[14px] shadow-[0_1px_0_0_#EBEEF3]';
const FIELD = 'w-full px-3 py-2.5 border border-[#E4E8F0] rounded-[9px] text-[13px] text-[#1E2530] bg-white outline-none focus:border-[#2F6FEB] transition-colors';
const LABEL = 'block text-[12.5px] font-bold text-[#5B6472] mb-2';
const HINT = 'text-[11.5px] text-[#8892A4]';
const DASHED = 'w-full py-2.5 border-[1.5px] border-dashed rounded-[10px] text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors';

// 선택된 과목 톤 (배경 / 아이콘색 / 점선버튼)
const TONES = {
  blue:  { bg: 'bg-[#EAF1FE]', x: 'text-[#2F6FEB]', dashed: 'border-[#B9C7F5] text-[#2F6FEB] hover:bg-[#F7FAFF]' },
  green: { bg: 'bg-[#E8F8F0]', x: 'text-[#1FA97A]', dashed: 'border-[#BEEBD3] text-[#1FA97A] hover:bg-[#F3FCF7]' },
  amber: { bg: 'bg-[#FFF8EC]', x: 'text-[#C99A2E]', dashed: 'border-[#F0DCB4] text-[#C99A2E] hover:bg-[#FFFBF3]' },
  red:   { bg: 'bg-[#FEF4F4]', x: 'text-[#E5484D]', dashed: 'border-[#FBD8D8] text-[#E5484D] hover:bg-[#FEF7F7]' },
};

// 세그먼트 버튼 (선택형)
function SegButton({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 rounded-[9px] border text-[13px] font-bold whitespace-nowrap transition-colors ${
        active
          ? 'border-[#2F6FEB] bg-[#EAF1FE] text-[#2F6FEB]'
          : 'border-[#E4E8F0] bg-white text-[#5B6472] hover:border-[#C9D3E4]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

// 칩 버튼 (요일/영역 등 다중 선택)
function ChipButton({ active, onClick, children, tone = 'blue', className = '' }) {
  const activeCls = tone === 'ink' ? 'bg-[#1E2530] text-white' : 'bg-[#2F6FEB] text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 rounded-[8px] text-[12.5px] font-bold whitespace-nowrap transition-colors ${
        active ? activeCls : 'bg-[#EEF1F6] text-[#8892A4] hover:bg-[#E4E8F0]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

// 선택된 과목 한 줄 (과목명 + 교수/시간/학점 유지)
function SelectedRow({ name, meta, tone = 'blue', onRemove }) {
  const t = TONES[tone];
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-[10px] ${t.bg}`}>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-[#1E2530] truncate">{name}</div>
        {meta && <div className="text-[11.5px] text-[#5B6472] truncate mt-px">{meta}</div>}
      </div>
      <button onClick={onRemove} className={`${t.x} shrink-0`}>
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// 카드 헤더 (제목 + 설명)
function CardHead({ title, desc }) {
  return (
    <div className="mb-4">
      <h2 className="text-[17px] font-extrabold text-[#1E2530] tracking-[-0.2px]">{title}</h2>
      {desc && <p className="mt-0.5 text-[13px] text-[#8892A4]">{desc}</p>}
    </div>
  );
}

// 시간표 선택 모달 컴포넌트
function ScheduleSelectModal({ isOpen, onClose, schedules, onSelect, onAddNew, maxSchedules }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(20,26,38,.5)] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[360px] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-[#1E2530]">저장할 시간표 선택</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#8892A4] hover:bg-[#F1F4FA] rounded-lg">
            <X size={16} />
          </button>
        </div>

        <p className="mt-1 mb-3.5 text-[12.5px] text-[#8892A4]">
          AI 추천 시간표를 어디에 저장할까요?
        </p>

        <div className="space-y-2">
          {schedules.map(schedule => (
            <button
              key={schedule.id}
              onClick={() => onSelect(schedule.id)}
              className="w-full px-3.5 py-3 border border-[#E4E8F0] rounded-[10px] bg-white text-left hover:border-[#2F6FEB] hover:bg-[#F7FAFF] transition-colors flex items-center justify-between gap-2"
            >
              <span className="text-[13px] font-bold text-[#1E2530]">{schedule.name}</span>
              <span className="text-[11.5px] text-[#8892A4] shrink-0">
                {schedule.courses.length > 0
                  ? `${schedule.courses.length}과목 (교체됨)`
                  : '비어있음'}
              </span>
            </button>
          ))}

          {schedules.length < maxSchedules && (
            <button
              onClick={onAddNew}
              className={`${DASHED} ${TONES.blue.dashed} py-3`}
            >
              <Plus size={14} />
              새 시간표로 저장
            </button>
          )}
        </div>

        <p className="text-[11px] text-[#B0B7C3] mt-3.5">
          ⚠️ 기존 과목이 있는 시간표는 교체됩니다
        </p>
      </div>
    </div>
  );
}

// 교양 영역 옵션
const AREA_OPTIONS = [
  { value: '1영역', label: '1영역' },
  { value: '2영역', label: '2영역' },
  { value: '3영역', label: '3영역' },
  { value: '4영역', label: '4영역' },
  { value: '5영역', label: '5영역' },
  { value: '6영역', label: '6영역' },
];

// 교양필수 하드코딩 (Firebase에 없을 경우 대비)
const DEFAULT_GENERAL_REQUIRED = [
  '대학생활과진로',
  '사고와표현',
  '영어1',
  '영어2',
  '정보능력',
  'AI시대의컴퓨팅사고',
];

// 시간표 미리보기 컴포넌트
function SchedulePreview({ courses }) {
  const DAYS = ['월', '화', '수', '목', '금'];
  const HOURS = Array.from({ length: 13 }, (_, i) => i + 9); // 9시~21시
  const ROW_H = 36;  // 1시간 높이

  // 변경 - COLORS 배열 삭제하고:
  const courseColors = {};
  courses.forEach((course, idx) => {
    courseColors[course.course_name] = COURSE_COLORS[idx % COURSE_COLORS.length];
  });

  // schedule_raw 파싱: "화10:00-11:30, 금10:00-11:30" 또는 "월1,2,3 수1,2,3"
  const parseSchedule = (scheduleRaw) => {
    if (!scheduleRaw) return [];
    const result = [];

    // 쉼표로 먼저 분리
    const segments = scheduleRaw.split(',').map(s => s.trim());

    for (const segment of segments) {
      // 공백으로 추가 분리
      const parts = segment.split(/\s+/).filter(p => p.trim());

      for (const part of parts) {
        // "화10:00-11:30" 형식
        const timeMatch = part.match(/^(월|화|수|목|금)(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const [, day, startH, startM, endH, endM] = timeMatch;
          result.push({
            day,
            startHour: parseInt(startH) + parseInt(startM) / 60,
            endHour: parseInt(endH) + parseInt(endM) / 60,
          });
          continue;
        }

        // "월1,2,3" 형식 (교시)
        const periodMatch = part.match(/^(월|화|수|목|금)([\d,]+)$/);
        if (periodMatch) {
          const [, day, periodsStr] = periodMatch;
          const periods = periodsStr.split(',').map(p => parseInt(p)).filter(p => !isNaN(p));
          if (periods.length > 0) {
            const minPeriod = Math.min(...periods);
            const maxPeriod = Math.max(...periods);
            result.push({
              day,
              startHour: 8 + minPeriod,  // 1교시 = 9시
              endHour: 8 + maxPeriod + 1,
            });
          }
          continue;
        }
      }
    }

    return result;
  };

  const getBlocksForDay = (day) => {
    const blocks = [];
    courses.forEach(course => {
      const schedules = parseSchedule(course.schedule_raw);
      schedules.forEach(schedule => {
        if (schedule.day === day) {
          blocks.push({
            course,
            startHour: schedule.startHour,
            endHour: schedule.endHour,
            color: courseColors[course.course_name],
          });
        }
      });
    });
    return blocks;
  };

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* 헤더 */}
          <div className="grid grid-cols-6 border-b border-[#EEF1F5]">
            <div className="py-2.5 text-center text-[11px] font-semibold text-[#8892A4] bg-[#F9FAFC]">시간</div>
            {DAYS.map(day => (
              <div key={day} className="py-2.5 text-center text-[12px] font-bold text-[#5B6472] bg-[#F9FAFC] border-l border-[#EEF1F5]">
                {day}
              </div>
            ))}
          </div>

          {/* 시간 그리드 */}
          <div className="relative">
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-6 border-b border-[#F3F5F8]" style={{ height: `${ROW_H}px` }}>
                <div className="pt-1 text-[10.5px] font-semibold text-[#B0B7C3] text-center border-r border-[#F3F5F8]">{hour}:00</div>
                {DAYS.map(day => (<div key={day} className="border-l border-[#F3F5F8]" />))}
              </div>
            ))}

            {/* 과목 블록 */}
            {DAYS.map((day, dayIdx) => {
              const blocks = getBlocksForDay(day);
              return blocks.map((block, blockIdx) => {
                const top = (block.startHour - 9) * ROW_H;
                const height = (block.endHour - block.startHour) * ROW_H;
                const left = `calc(${(dayIdx + 1) * (100/6)}% + 3px)`;
                const width = `calc(${100/6}% - 6px)`;

                if (height <= 0 || top < 0) return null;

                return (
                  <div
                    key={`${day}-${blockIdx}-${block.course.course_name}`}
                    className={`absolute rounded-lg px-1.5 py-1 ${block.color.bg} ${block.color.border} border-[1.5px] overflow-hidden`}
                    style={{ top: `${top + 2}px`, height: `${Math.max(height - 4, 18)}px`, left, width }}
                  >
                    <div className={`text-[11px] font-bold ${block.color.text} truncate leading-tight`}>
                      {block.course.course_name}
                    </div>
                    {height > 34 && (
                      <div className="text-[9.5px] text-[#8892A4] truncate mt-0.5">{block.course.professor}</div>
                    )}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// 과목 검색 모달 (범용)
function CourseSearchModal({
  isOpen,
  onClose,
  onSelect,
  currentSelections,
  title = "과목 검색",
  filterOptions = {},  // { category, department, classification }
  matchByName = false  // true면 과목명 기준 체크, false면 분반까지 정확히 체크
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const { searchCourses, loading } = useCourses();
  const [searchResults, setSearchResults] = useState([]);

  // filterOptions는 호출부에서 객체 리터럴로 넘어와 렌더마다 새 객체가 된다.
  // 그대로 의존성에 쓰면 부모가 리렌더될 때마다 Firestore 쿼리가 다시 나가므로
  // 내용이 실제로 바뀔 때만 새 객체가 되도록 고정한다.
  const filterKey = JSON.stringify(filterOptions);
  const filters = useMemo(() => JSON.parse(filterKey), [filterKey]);

  // 타이핑할 때마다 쿼리하지 않도록 300ms 디바운스
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (!isOpen) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const query = { ...filters, limit: 50 };
      if (debouncedTerm.length >= 2) {
        query.searchTerm = debouncedTerm;
      }
      const results = await searchCourses(query);
      // 응답이 늦게 도착한 이전 요청이 최신 결과를 덮어쓰지 않도록
      if (!cancelled) setSearchResults(results);
    })();

    return () => { cancelled = true; };
  }, [debouncedTerm, isOpen, searchCourses, filters]);

  // 모달을 닫았다 열면 이전 검색어가 남지 않게 초기화
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setDebouncedTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // matchByName이면 과목명 기준, 아니면 분반까지 정확히 체크
  const isSelected = (course) => {
    if (matchByName) {
      return currentSelections.some(c => c.course_name === course.course_name);
    }
    return currentSelections.some(c =>
      c.course_code === course.course_code && c.section === course.section
    );
  };

  return (
    <div className="fixed inset-0 bg-[rgba(20,26,38,.5)] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EBEEF3] flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold text-[#1E2530]">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#8892A4] hover:bg-[#F1F4FA] rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3.5 border-b border-[#EBEEF3]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B7C3]" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="과목명, 교수명 검색..."
              className={`${FIELD} pl-9`}
              autoFocus
            />
          </div>
          {filterOptions.department && (
            <p className="text-[11.5px] text-[#2F6FEB] mt-2">
              📌 {filterOptions.department} 학과 전공과목만 표시됩니다
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto text-[#B0B7C3]" size={22} />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-[#8892A4]">
              검색 결과가 없습니다
            </div>
          ) : (
            <div className="space-y-1.5">
              {searchResults.map(course => {
                const selected = isSelected(course);
                return (
                  <div
                    key={`${course.course_code}-${course.section}`}
                    onClick={() => !selected && onSelect(course)}
                    className={`px-3 py-2.5 rounded-[10px] border cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#E8F8F0] border-[#BEEBD3]'
                        : 'bg-white border-[#E4E8F0] hover:border-[#2F6FEB] hover:bg-[#F7FAFF]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-[#1E2530] truncate">{course.course_name}</div>
                        <div className="text-[11.5px] text-[#8892A4] truncate">
                          {course.professor} | {course.schedule_raw} | {course.credits}학점
                          {course.target_year > 0 && (
                            <span className="ml-1 text-[#2F6FEB]">({course.target_year}학년 대상)</span>
                          )}
                        </div>
                      </div>
                      {selected ? (
                        <span className="text-[10.5px] font-bold bg-[#D5F2E3] text-[#1FA97A] px-2 py-0.5 rounded-full shrink-0">선택됨</span>
                      ) : (
                        <Plus size={16} className="text-[#2F6FEB] shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecommendPage() {
  const navigate = useNavigate();
  const { getDepartments, searchCourses, getGeneralRequired, getMajorRequired } = useCourses();
  const { addCourse, clearSchedule, schedules, addSchedule, saveToSchedule, maxSchedules } = useSchedule();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);   // 로딩 경과 초
  const [hasGenerated, setHasGenerated] = useState(false);   // 결과를 한 번이라도 본 적 있는지
  const [isScheduleSelectOpen, setIsScheduleSelectOpen] = useState(false);  // 시간표 선택 모달

  // ========== Step 1: 기본 정보 ==========
  const [userInfo, setUserInfo] = useState({
    grade: 1,
    college: '',
    major: '',
    hasDoubleMajor: false,
    doubleMajorCollege: '',
    doubleMajor: '',
    targetCredits: 18,
  });

  // ========== Step 2: 이수 현황 (2학년+) ==========
  const [completedCourses, setCompletedCourses] = useState({
    generalRequired: [],
    majorRequired: [],
    skipGeneralRequired: false,
    skipMajorRequired: false,
    completedAreas: [],          // 이수한 교양선택 영역
    completedMajorElective: [],  // 이수한 전공선택 과목들
    // 복수전공
    doubleMajorRequired: [],
    skipDoubleMajorRequired: false,
    completedDoubleMajorElective: [],
  });
  const [isCompletedMajorSearchOpen, setIsCompletedMajorSearchOpen] = useState(false);  // 전공선택 이수과목 검색 모달
  const [isCompletedDoubleMajorSearchOpen, setIsCompletedDoubleMajorSearchOpen] = useState(false);  // 복전 전선 이수과목 검색 모달

  // ========== Step 3: 전공 선택 (2학년+) - 새로 추가! ==========
  const [majorSelection, setMajorSelection] = useState({
    mode: 'auto',  // 'manual' | 'auto'
    selectedCourses: [],  // 직접 선택한 주전공 과목
    selectedDoubleMajorCourses: [],  // 직접 선택한 복전 과목
  });
  const [isMajorSearchOpen, setIsMajorSearchOpen] = useState(false);
  const [isDoubleMajorSearchOpen, setIsDoubleMajorSearchOpen] = useState(false);  // 복전 과목 검색 모달

  // 학점 배분 (복수전공 전용)
  const [creditAllocation, setCreditAllocation] = useState({
    major: 9,
    doubleMajor: 6,
    general: 3,
  });

  // ========== Step 4: 선호도 ==========
  const [preferences, setPreferences] = useState({
    emptyDays: [],
    noMorning: false,
    consecutive: '상관없음',
    preferredTime: '상관없음',
    preferredAreas: [],
    skipGeneral: false,
  });

  // ========== Step 5: 추가 설정 ==========
  const [mustTakeCourses, setMustTakeCourses] = useState([]);
  const [avoidCourses, setAvoidCourses] = useState([]);  // 배열로 변경
  const [isCourseSearchOpen, setIsCourseSearchOpen] = useState(false);
  const [isAvoidSearchOpen, setIsAvoidSearchOpen] = useState(false);  // 듣기 싫은 과목 검색 모달

  // 학과 목록
  const [departments, setDepartments] = useState([]);
  const [doubleMajorDepts, setDoubleMajorDepts] = useState([]);

  // 필수과목 목록
  const [generalRequiredList, setGeneralRequiredList] = useState([]);
  const [majorRequiredList, setMajorRequiredList] = useState([]);
  const [doubleMajorRequiredList, setDoubleMajorRequiredList] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // 결과
  const [result, setResult] = useState(null);            // 현재 선택된 후보 (작업본)
  const [candidates, setCandidates] = useState([]);      // A/B/C 후보 배열
  const [selectedIndex, setSelectedIndex] = useState(0); // 선택된 후보 인덱스
  const [logId, setLogId] = useState(null);
  const [error, setError] = useState(null);
  const [timeConflicts, setTimeConflicts] = useState([]);

  // ⭐ 반드시 포함할 필수과목명 (점수 깎여도 강제 포함)
  const [lockedRequired, setLockedRequired] = useState([]);

  // 수정 기능 state
  const [savedAvailableCourses, setSavedAvailableCourses] = useState(null);
  const [isModifying, setIsModifying] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [history, setHistory] = useState([]); // 최대 3단계
  const [modifyError, setModifyError] = useState(null);
  const [selectedResultCourse, setSelectedResultCourse] = useState(null);

  // 시간 충돌 검사 함수
  const checkTimeConflicts = (courses) => {
    const conflicts = [];

    // schedule_raw 파싱 함수
    const parseSchedule = (scheduleRaw) => {
      if (!scheduleRaw) return [];
      const times = [];
      const segments = scheduleRaw.split(',').map(s => s.trim());

      for (const segment of segments) {
        const parts = segment.split(/\s+/).filter(p => p.trim());
        for (const part of parts) {
          // "화10:00-11:30" 형식
          const timeMatch = part.match(/^(월|화|수|목|금)(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
          if (timeMatch) {
            const [, day, startH, startM, endH, endM] = timeMatch;
            times.push({
              day,
              startMin: parseInt(startH) * 60 + parseInt(startM),
              endMin: parseInt(endH) * 60 + parseInt(endM),
            });
          }
        }
      }
      return times;
    };

    // 시간 겹침 확인 함수
    const isOverlap = (t1, t2) => {
      if (t1.day !== t2.day) return false;
      return t1.startMin < t2.endMin && t1.endMin > t2.startMin;
    };

    // 모든 과목 쌍 비교
    for (let i = 0; i < courses.length; i++) {
      for (let j = i + 1; j < courses.length; j++) {
        const times1 = parseSchedule(courses[i].schedule_raw);
        const times2 = parseSchedule(courses[j].schedule_raw);

        for (const t1 of times1) {
          for (const t2 of times2) {
            if (isOverlap(t1, t2)) {
              conflicts.push({
                course1: courses[i].course_name,
                course2: courses[j].course_name,
                day: t1.day,
              });
            }
          }
        }
      }
    }

    return conflicts;
  };

  // ========== Step 계산 ==========
  // 1학년: 1 → 4 → 5 → 결과 (이수현황, 전공선택 스킵)
  // 2학년+: 1 → 2 → 3 → 4 → 5 → 결과
  const getStepConfig = () => {
    if (userInfo.grade === 1) {
      return {
        totalSteps: 3,
        stepNames: ['기본 정보', '선호도', '추가 설정'],
        stepMapping: { 1: 1, 2: 4, 3: 5 },  // 실제 step → 표시 step
        reverseMapping: { 1: 1, 4: 2, 5: 3 }  // 표시 step → 실제 step
      };
    } else {
      return {
        totalSteps: 5,
        stepNames: ['기본 정보', '이수 현황', '전공 선택', '선호도', '추가 설정'],
        stepMapping: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
        reverseMapping: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }
      };
    }
  };

  const stepConfig = getStepConfig();
  const displayStep = stepConfig.reverseMapping[step] || step;

  // 단과대학 변경시 학과 로드
  useEffect(() => {
    async function load() {
      if (userInfo.college) {
        const depts = await getDepartments(userInfo.college);
        setDepartments(depts);
      }
    }
    load();
  }, [userInfo.college, getDepartments]);

  // 복수전공 단과대학 변경시
  useEffect(() => {
    async function load() {
      if (userInfo.doubleMajorCollege) {
        const depts = await getDepartments(userInfo.doubleMajorCollege);
        setDoubleMajorDepts(depts);
      }
    }
    load();
  }, [userInfo.doubleMajorCollege, getDepartments]);

  // 교양필수 목록 로드
  useEffect(() => {
    async function loadGeneralRequired() {
      setLoadingCourses(true);
      const results = await getGeneralRequired();
      if (results.length > 0) {
        setGeneralRequiredList(results);
      } else {
        setGeneralRequiredList(DEFAULT_GENERAL_REQUIRED);
      }
      setLoadingCourses(false);
    }
    loadGeneralRequired();
  }, [getGeneralRequired]);

  // 전공필수 목록 로드 (학과 선택시)
  useEffect(() => {
    async function loadMajorRequired() {
      if (userInfo.major) {
        setLoadingCourses(true);
        const results = await getMajorRequired(userInfo.major);
        setMajorRequiredList(results);
        setLoadingCourses(false);
      }
    }
    loadMajorRequired();
  }, [userInfo.major, getMajorRequired]);

  // 복수전공 전필 목록 로드
  useEffect(() => {
    async function loadDoubleMajorRequired() {
      if (userInfo.hasDoubleMajor && userInfo.doubleMajor) {
        setLoadingCourses(true);
        const results = await getMajorRequired(userInfo.doubleMajor);
        setDoubleMajorRequiredList(results);
        setLoadingCourses(false);
      } else {
        setDoubleMajorRequiredList([]);
      }
    }
    loadDoubleMajorRequired();
  }, [userInfo.doubleMajor, userInfo.hasDoubleMajor, getMajorRequired]);

  // 학과 변경시 전공 선택 초기화
  useEffect(() => {
    setMajorSelection({ mode: 'auto', selectedCourses: [], selectedDoubleMajorCourses: [] });
  }, [userInfo.major]);

  // 목표학점 변경 시 학점 배분 자동 조정
  useEffect(() => {
    if (userInfo.hasDoubleMajor) {
      const tc = userInfo.targetCredits;
      // 기본 비율: 주전공 50%, 복전 33%, 교양 17% (3의 배수로 반올림)
      const majorCredits = Math.round(tc * 0.5 / 3) * 3;
      const dmCredits = Math.round(tc * 0.33 / 3) * 3;
      const genCredits = tc - majorCredits - dmCredits;
      setCreditAllocation({
        major: Math.max(0, majorCredits),
        doubleMajor: Math.max(0, dmCredits),
        general: Math.max(0, genCredits),
      });
    }
  }, [userInfo.targetCredits, userInfo.hasDoubleMajor]);

  // 로딩 경과 시간 카운터.
  // 정적 스피너만 보여주면 5초 걸릴지 60초 걸릴지 몰라 사용자가 이탈한다.
  // 이탈 후 재시도는 AI를 처음부터 다시 돌리게 만들어 비용이 배로 든다.
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setLoadingSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // 경과 시간에 따라 지금 무슨 작업 중인지 알려준다 (멈춘 게 아니라는 신호)
  const loadingStage = (() => {
    if (loadingSeconds < 6) return '수강 가능한 과목을 추리는 중';
    if (loadingSeconds < 14) return '시간이 겹치지 않는 조합을 찾는 중';
    if (loadingSeconds < 24) return '학점과 공강을 맞춰보는 중';
    if (loadingSeconds < 40) return '거의 다 됐어요, 마무리하는 중';
    return '조금만 더 기다려주세요';
  })();

  const filteredColleges = COLLEGES.filter(c =>
    c !== '전체' && c !== '융합전공' && c !== '상생교양대학'
  );

  // 다음 버튼
  const handleNext = () => {
    if (step === 1 && !userInfo.major) {
      alert('전공을 선택해주세요!');
      return;
    }

    // Step 3 → 4로 넘어갈 때 학점 배분 검증 (복수전공)
    if (step === 3 && userInfo.hasDoubleMajor && userInfo.doubleMajor) {
      const total = creditAllocation.major + creditAllocation.doubleMajor + creditAllocation.general;
      if (total !== userInfo.targetCredits) {
        alert(`학점 배분 합계가 ${total}학점이에요. 목표 학점 ${userInfo.targetCredits}학점에 맞춰주세요!`);
        return;
      }
    }

    if (userInfo.grade === 1) {
      // 1학년: 1 → 4 → 5
      if (step === 1) setStep(4);
      else if (step === 4) setStep(5);
    } else {
      // 2학년+: 1 → 2 → 3 → 4 → 5
      if (step < 5) setStep(step + 1);
    }
  };

  // 이전 버튼
  const handlePrev = () => {
    if (userInfo.grade === 1) {
      // 1학년: 5 → 4 → 1
      if (step === 5) setStep(4);
      else if (step === 4) setStep(1);
    } else {
      // 2학년+: 5 → 4 → 3 → 2 → 1
      if (step > 1) setStep(step - 1);
    }
  };

  // 꼭 듣고 싶은 과목 추가
  const handleAddMustTake = (course) => {
    setMustTakeCourses(prev => [...prev, course]);
    setIsCourseSearchOpen(false);
  };

  // 전공과목 직접 선택 추가
  const handleAddMajorCourse = (course) => {
    setMajorSelection(prev => ({
      ...prev,
      selectedCourses: [...prev.selectedCourses, course]
    }));
    setIsMajorSearchOpen(false);
  };

  // 전공과목 제거
  const handleRemoveMajorCourse = (course) => {
    setMajorSelection(prev => ({
      ...prev,
      selectedCourses: prev.selectedCourses.filter(
        c => !(c.course_code === course.course_code && c.section === course.section)
      )
    }));
  };

  // 복전 과목 직접 선택 추가
  const handleAddDoubleMajorCourse = (course) => {
    setMajorSelection(prev => ({
      ...prev,
      selectedDoubleMajorCourses: [...prev.selectedDoubleMajorCourses, course]
    }));
    setIsDoubleMajorSearchOpen(false);
  };

  // 복전 과목 제거
  const handleRemoveDoubleMajorCourse = (course) => {
    setMajorSelection(prev => ({
      ...prev,
      selectedDoubleMajorCourses: prev.selectedDoubleMajorCourses.filter(
        c => !(c.course_code === course.course_code && c.section === course.section)
      )
    }));
  };

  // 시간표 생성
  // hasGenerated: 이미 한 번 결과를 본 뒤 '다시 만들기'로 온 경우.
  // 이때는 같은 조건이라도 새 시간표를 원하는 것이므로 서버 캐시를 건너뛴다.
  const handleGenerate = async (forceRefresh = false) => {
    setIsLoading(true);
    setLoadingSeconds(0);
    setError(null);

    // 성공/실패 모두 같은 메타데이터로 기록한다 (관리자 페이지 실패 목록용)
    const logParams = {
      grade: userInfo.grade,
      major: userInfo.major,
      double_major: userInfo.hasDoubleMajor ? userInfo.doubleMajor : null,
      target_credits: userInfo.targetCredits,
      preferences_summary: {
        empty_days: preferences.emptyDays,
        no_morning: preferences.noMorning,
      },
    };

    try {
      const availableCourses = await filterAvailableCourses();
      setSavedAvailableCourses(availableCourses);

      const response = await recommendSchedule({
        grade: userInfo.grade,
        major: userInfo.major,
        double_major: userInfo.hasDoubleMajor ? userInfo.doubleMajor : null,
        target_credits: userInfo.targetCredits,
        completed_general_required: completedCourses.skipGeneralRequired ? [] : completedCourses.generalRequired,
        completed_major_required: completedCourses.skipMajorRequired ? [] : completedCourses.majorRequired,
        completed_double_major_required: completedCourses.skipDoubleMajorRequired ? [] : completedCourses.doubleMajorRequired,
        completed_double_major_elective: completedCourses.completedDoubleMajorElective.map(c => c.course_name),
        preferences: {
          empty_days: preferences.emptyDays,
          no_morning: preferences.noMorning,
          consecutive: preferences.consecutive,
          preferred_time: preferences.preferredTime,
          preferred_areas: preferences.skipGeneral ? [] : preferences.preferredAreas,
          skip_general: preferences.skipGeneral,
          // 새로 추가된 필드들
          major_selection_mode: majorSelection.mode,
          selected_major_courses: majorSelection.selectedCourses.map(c => ({
            course_name: c.course_name,
            course_code: c.course_code,
            section: c.section,
            professor: c.professor,
            schedule_raw: c.schedule_raw,
            credits: c.credits,
            target_year: c.target_year || 0,
          })),
          selected_double_major_courses: majorSelection.selectedDoubleMajorCourses.map(c => ({
            course_name: c.course_name,
            course_code: c.course_code,
            section: c.section,
            professor: c.professor,
            schedule_raw: c.schedule_raw,
            credits: c.credits,
            target_year: c.target_year || 0,
          })),
          // 학점 배분 (복수전공)
          credit_allocation: userInfo.hasDoubleMajor ? {
            major: creditAllocation.major,
            double_major: creditAllocation.doubleMajor,
            general: creditAllocation.general,
          } : null,
          must_take_courses: mustTakeCourses.map(c => ({
            course_name: c.course_name,
            course_code: c.course_code,
            section: c.section,
            professor: c.professor,
            schedule_raw: c.schedule_raw,
            credits: c.credits,
            target_year: c.target_year || 0,
          })),
          // 듣기 싫은 과목 (문자열로 전달 - 백엔드 호환성)
          avoid_courses: avoidCourses.length > 0 ? avoidCourses.map(c => c.course_name).join(', ') : '',
          // 이수 완료 교양 영역
          completed_areas: completedCourses.completedAreas,
          // 이수 완료 전공선택 (과목명 배열)
          completed_major_elective: completedCourses.completedMajorElective.map(c => c.course_name),
          // ⭐ 반드시 포함할 필수과목명
          locked_required: lockedRequired,
        }
      }, availableCourses, forceRefresh);

      if (response.success) {
        // 새 응답: schedules 배열 / 구 응답: 단일 객체 → 배열로 정규화
        const schedules = response.schedules
          || (response.selected_courses ? [response] : []);
        setCandidates(schedules);
        setSelectedIndex(0);
        const first = schedules[0] || null;
        setResult(first);
        setHistory([]);
        setLogId(null);
        logAiSession('recommend', logParams, response).then(id => setLogId(id));
        // 시간 충돌 검사 (선택된 후보 기준)
        setTimeConflicts(first?.selected_courses ? checkTimeConflicts(first.selected_courses) : []);
        setStep(6);  // 결과 화면
      } else {
        setError(response.error);
        logAiSession('recommend', logParams, response);
      }
    } catch (err) {
      setError(err.message);
      logAiSession('recommend', logParams, { success: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ 부분 일치 헬퍼 함수 (띄어쓰기/오타 문제 방지)
  const isNameMatched = (courseName, completedList) => {
    if (!courseName || !completedList || completedList.length === 0) return false;
    return completedList.some(completed =>
      courseName.includes(completed) || completed.includes(courseName)
    );
  };

  // 과목 필터링
  const filterAvailableCourses = async () => {
    const grade = userInfo.grade;
    const avoidCourseNames = avoidCourses.map(c => c.course_name);
    const filterAvoid = (list) => list.filter(c => !isNameMatched(c.course_name, avoidCourseNames));

    // 모든 독립적인 쿼리를 한 번에 병렬 실행
    const areasToSearch = !preferences.skipGeneral
      ? (preferences.preferredAreas.length > 0 ? preferences.preferredAreas : AREA_OPTIONS.map(a => a.value))
          .filter(area => !completedCourses.completedAreas.includes(area))
      : [];

    const [
      grResults,
      mrResults,
      meResults,
      dmrResults,
      dmeResults,
      ...areaResults
    ] = await Promise.all([
      preferences.skipGeneral ? Promise.resolve([]) : searchCourses({ category: 'general_required', limit: 100 }),
      searchCourses({ category: 'major', department: userInfo.major, classification: '전필', limit: 50 }),
      searchCourses({ category: 'major', department: userInfo.major, classification: '전선', limit: 50 }),
      (userInfo.hasDoubleMajor && userInfo.doubleMajor)
        ? searchCourses({ category: 'major', department: userInfo.doubleMajor, classification: '전필', limit: 50 })
        : Promise.resolve([]),
      (userInfo.hasDoubleMajor && userInfo.doubleMajor)
        ? searchCourses({ category: 'major', department: userInfo.doubleMajor, classification: '전선', limit: 50 })
        : Promise.resolve([]),
      ...areasToSearch.map(area => searchCourses({ category: 'general_elective', area, limit: 50 })),
    ]);

    const generalRequired = grResults.filter(c =>
      completedCourses.skipGeneralRequired || !isNameMatched(c.course_name, completedCourses.generalRequired)
    );

    const generalElective = areaResults.flat();

    const majorRequired = mrResults.filter(c =>
      (completedCourses.skipMajorRequired || !isNameMatched(c.course_name, completedCourses.majorRequired)) &&
      (c.target_year === 0 || c.target_year <= grade)
    );

    const completedMajorNames = completedCourses.completedMajorElective.map(c => c.course_name);
    const majorElective = meResults.filter(c =>
      (c.target_year === 0 || c.target_year <= grade) &&
      !isNameMatched(c.course_name, completedMajorNames)
    );

    const doubleMajorRequired = dmrResults.filter(c =>
      (completedCourses.skipDoubleMajorRequired || !isNameMatched(c.course_name, completedCourses.doubleMajorRequired)) &&
      (c.target_year === 0 || c.target_year <= grade)
    );

    const completedDoubleMajorNames = completedCourses.completedDoubleMajorElective.map(c => c.course_name);
    const doubleMajorElective = dmeResults.filter(c =>
      (c.target_year === 0 || c.target_year <= grade) &&
      !isNameMatched(c.course_name, completedDoubleMajorNames)
    );

    return {
      general_required: filterAvoid(generalRequired).slice(0, 20),
      major_required: filterAvoid(majorRequired).slice(0, 20),
      major_elective: filterAvoid(majorElective).slice(0, 30),
      general_elective: filterAvoid(generalElective).slice(0, 30),
      double_major_required: filterAvoid(doubleMajorRequired).slice(0, 20),
      double_major_elective: filterAvoid(doubleMajorElective).slice(0, 30),
    };
  };

  // 시간표 수정 요청
  const handleModify = async (modifyType, modifyParams = {}) => {
    if (!result || !savedAvailableCourses) return;
    setShowDayPicker(false);
    setIsModifying(true);
    setModifyError(null);

    // 현재 결과를 히스토리에 저장 (최대 3단계)
    setHistory(prev => [...prev.slice(-2), result]);

    const response = await modifySchedule(
      result.selected_courses,
      modifyType,
      modifyParams,
      savedAvailableCourses,
      {
        grade: userInfo.grade,
        major: userInfo.major,
        double_major: userInfo.hasDoubleMajor ? userInfo.doubleMajor : null,
        credit_allocation: userInfo.hasDoubleMajor ? {
          major: creditAllocation.major,
          double_major: creditAllocation.doubleMajor,
          general: creditAllocation.general,
        } : null,
      },
    );

    setIsModifying(false);

    if (response.success) {
      setResult(response);
      setTimeConflicts(checkTimeConflicts(response.selected_courses || []));
    } else {
      // 실패 시 히스토리에서 제거
      setHistory(prev => prev.slice(0, -1));
      setModifyError(response.error);
      setTimeout(() => setModifyError(null), 4000);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setResult(prev);
    setTimeConflicts(checkTimeConflicts(prev.selected_courses || []));
    setHistory(h => h.slice(0, -1));
  };

  // 시간표 선택 모달 열기
  const handleReplaceSchedule = () => {
    if (!result) return;
    setIsScheduleSelectOpen(true);
  };

  // 실제로 특정 시간표에 저장
  const handleSaveToSchedule = (scheduleId) => {
    if (!result) return;

    const newCourses = result.selected_courses.map(course => ({
      course_code: course.course_code || `AI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      section: course.section || '01',
      course_name: course.course_name || '과목명 없음',
      professor: course.professor || '미정',
      credits: course.credits || 3,
      schedule_raw: course.schedule_raw || '',
      times: parseScheduleToTimes(course.schedule_raw),
      room: course.room || '',
      category: course.category || '전공선택',
      classification: course.category || '전선',
      college: course.college || '',
      department: course.department || '',
    }));

    saveToSchedule(newCourses, scheduleId);
    navigate('/');
  };

  // 새 시간표 생성 후 저장
  const handleSaveToNewSchedule = () => {
    if (!result) return;

    const newScheduleResult = addSchedule();
    if (!newScheduleResult.success) {
      alert(newScheduleResult.error);
      return;
    }

    handleSaveToSchedule(newScheduleResult.id);
  };

  const handleRemoveMustTake = (course) => {
    setMustTakeCourses(prev =>
      prev.filter(c => !(c.course_code === course.course_code && c.section === course.section))
    );
  };

  // ========== 필수과목 3-상태 (이수함 / 꼭 넣기 / —) ==========
  // "이수함" 토글 → completed에 추가/제거, locked에서는 해제 (상호배타)
  const toggleCompletedRequired = (course, completedKey) => {
    setCompletedCourses(prev => {
      const has = prev[completedKey].includes(course);
      return {
        ...prev,
        [completedKey]: has
          ? prev[completedKey].filter(c => c !== course)
          : [...prev[completedKey], course],
      };
    });
    setLockedRequired(prev => prev.filter(c => c !== course));
  };

  // "⭐ 꼭 넣기" 토글 → locked에 추가/제거, 모든 이수 목록에서는 해제 (상호배타)
  const toggleLockedRequired = (course) => {
    setLockedRequired(prev =>
      prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]
    );
    setCompletedCourses(prev => ({
      ...prev,
      generalRequired: prev.generalRequired.filter(c => c !== course),
      majorRequired: prev.majorRequired.filter(c => c !== course),
      doubleMajorRequired: prev.doubleMajorRequired.filter(c => c !== course),
    }));
  };

  // 필수과목 한 줄 렌더 (이수함 / 꼭 넣기 세그먼트 버튼)
  const renderRequiredRow = (course, completedKey) => {
    const completed = completedCourses[completedKey].includes(course);
    const locked = lockedRequired.includes(course);
    return (
      <div key={course} className="flex items-center justify-between gap-2 py-[7px] border-b border-[#F6F7FA] last:border-b-0">
        {/* 긴 과목명(예: LCT(LearningbyCommunication&Teamwork))도 넘치지 않게 줄바꿈 */}
        <span className="flex-1 min-w-0 text-[13px] leading-[1.35] text-[#3A4150] [overflow-wrap:anywhere]">
          {course}
        </span>
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleCompletedRequired(course, completedKey)}
            className={`text-[11px] font-bold px-2.5 py-[5px] rounded-[7px] transition-colors ${
              completed ? 'bg-[#3A4150] text-white' : 'bg-[#EEF1F6] text-[#8892A4] hover:bg-[#E4E8F0]'
            }`}
          >
            이수함
          </button>
          <button
            type="button"
            onClick={() => toggleLockedRequired(course)}
            className={`text-[11px] font-bold px-2.5 py-[5px] rounded-[7px] transition-colors ${
              locked ? 'bg-[#F5A524] text-white' : 'bg-[#EEF1F6] text-[#8892A4] hover:bg-[#E4E8F0]'
            }`}
          >
            꼭 넣기
          </button>
        </div>
      </div>
    );
  };

  // 후보 전환 (A/B/C 탭 선택)
  const selectCandidate = (i) => {
    const cand = candidates[i];
    if (!cand) return;
    setSelectedIndex(i);
    setResult(cand);
    setHistory([]);  // 후보 바꾸면 수정 히스토리 초기화
    setTimeConflicts(checkTimeConflicts(cand.selected_courses || []));
  };

  // 이수한 전공선택 추가 (과목명만 저장 - 분반 무관)
  const handleAddCompletedMajor = (course) => {
    // 이미 같은 과목명이 있는지 확인 (분반 무관)
    const exists = completedCourses.completedMajorElective.some(
      c => c.course_name === course.course_name
    );
    if (!exists) {
      setCompletedCourses(prev => ({
        ...prev,
        completedMajorElective: [...prev.completedMajorElective, {
          course_name: course.course_name,
          credits: course.credits,
        }]
      }));
    }
    setIsCompletedMajorSearchOpen(false);
  };

  // 이수한 복전 전공선택 추가
  const handleAddCompletedDoubleMajor = (course) => {
    const exists = completedCourses.completedDoubleMajorElective.some(
      c => c.course_name === course.course_name
    );
    if (!exists) {
      setCompletedCourses(prev => ({
        ...prev,
        completedDoubleMajorElective: [...prev.completedDoubleMajorElective, {
          course_name: course.course_name,
          credits: course.credits,
        }]
      }));
    }
    setIsCompletedDoubleMajorSearchOpen(false);
  };

  // 듣기 싫은 과목 추가 (과목명 기준 - 분반 무관)
  const handleAddAvoidCourse = (course) => {
    // 이미 같은 과목명이 있는지 확인 (분반 무관)
    const exists = avoidCourses.some(
      c => c.course_name === course.course_name
    );
    if (!exists) {
      setAvoidCourses(prev => [...prev, {
        course_name: course.course_name,
        professor: course.professor,
      }]);
    }
    setIsAvoidSearchOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#EEF1F6]">
      {/* 헤더 */}
      <header className="bg-white border-b border-[#EBEEF3] sticky top-0 z-40">
        <div className="max-w-[640px] mx-auto px-5 h-14 flex items-center gap-2.5">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center text-[#5B6472] hover:bg-[#F1F4FA] rounded-lg shrink-0 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <Sparkles className="text-[#2F6FEB] shrink-0" size={19} />
          <h1 className="text-[16px] font-extrabold text-[#1E2530] tracking-[-0.2px] whitespace-nowrap">AI 시간표 추천</h1>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-4 pt-5 pb-16 space-y-4">

        {/* 진행 바 */}
        {step <= 5 && (
          <div>
            <div className="flex justify-between text-[12px] font-semibold text-[#8892A4] mb-[7px]">
              <span>Step {displayStep}/{stepConfig.totalSteps}</span>
              <span className="text-[#3A4150] font-bold">{stepConfig.stepNames[displayStep - 1]}</span>
            </div>
            <div className="h-1.5 bg-[#E4E8F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2F6FEB] rounded-full transition-all duration-300"
                style={{ width: `${(displayStep / stepConfig.totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ========== Step 1: 기본 정보 ========== */}
        {step === 1 && (
          <div className={`${CARD} px-5 py-[22px]`}>
            <CardHead title="기본 정보" desc="학년과 전공을 알려주면 딱 맞는 조합을 짜드려요" />

            <div className="space-y-4">
              <div>
                <label className={LABEL}>학년</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map(g => (
                    <SegButton
                      key={g}
                      active={userInfo.grade === g}
                      onClick={() => setUserInfo(prev => ({ ...prev, grade: g }))}
                    >
                      {g}학년
                    </SegButton>
                  ))}
                </div>
                {userInfo.grade === 1 && (
                  <p className="mt-2 text-[11.5px] text-[#2F6FEB]">
                    💡 1학년(신입생)은 전공기초 과목이 자동으로 포함됩니다
                  </p>
                )}
              </div>

              <div>
                <label className={LABEL}>단과대학</label>
                <select
                  value={userInfo.college}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, college: e.target.value, major: '' }))}
                  className={FIELD}
                >
                  <option value="">선택하세요</option>
                  {filteredColleges.map(c => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              <div>
                <label className={LABEL}>전공</label>
                <select
                  value={userInfo.major}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, major: e.target.value }))}
                  className={`${FIELD} ${!userInfo.college ? 'bg-[#F6F8FB] text-[#B0B7C3]' : ''}`}
                  disabled={!userInfo.college}
                >
                  <option value="">선택하세요</option>
                  {departments.map(d => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userInfo.hasDoubleMajor}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, hasDoubleMajor: e.target.checked, doubleMajorCollege: '', doubleMajor: '' }))}
                  className="w-4 h-4 accent-[#2F6FEB]"
                />
                <span className="text-[13px] font-semibold text-[#3A4150]">복수전공 있음</span>
              </label>

              {userInfo.hasDoubleMajor && (
                <div className="pl-3.5 space-y-2.5 border-l-2 border-[#EAF1FE]">
                  <select
                    value={userInfo.doubleMajorCollege}
                    onChange={(e) => setUserInfo(prev => ({ ...prev, doubleMajorCollege: e.target.value, doubleMajor: '' }))}
                    className={FIELD}
                  >
                    <option value="">복수전공 단과대학</option>
                    {filteredColleges.map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <select
                    value={userInfo.doubleMajor}
                    onChange={(e) => setUserInfo(prev => ({ ...prev, doubleMajor: e.target.value }))}
                    className={`${FIELD} ${!userInfo.doubleMajorCollege ? 'bg-[#F6F8FB] text-[#B0B7C3]' : ''}`}
                    disabled={!userInfo.doubleMajorCollege}
                  >
                    <option value="">복수전공 학과</option>
                    {doubleMajorDepts.map(d => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[12.5px] font-bold text-[#5B6472]">목표 학점</span>
                  <span className="whitespace-nowrap">
                    <span className="text-[22px] font-extrabold text-[#2F6FEB]">{userInfo.targetCredits}</span>
                    <span className="text-[12.5px] font-bold text-[#5B6472]"> 학점</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={21}
                  value={userInfo.targetCredits}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, targetCredits: Number(e.target.value) }))}
                  className="w-full accent-[#2F6FEB]"
                />
                <div className="flex justify-between text-[11px] text-[#B0B7C3] mt-0.5">
                  <span>12</span>
                  <span>21</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== Step 2: 이수 현황 (2학년+) ========== */}
        {step === 2 && (
          <div className={`${CARD} px-5 py-[22px] space-y-5`}>
            <CardHead title="이수 현황" desc="이미 들은 과목을 표시해주세요" />

            {loadingCourses && (
              <div className="text-center py-4">
                <Loader2 className="animate-spin mx-auto text-[#B0B7C3]" size={22} />
                <p className="text-[12.5px] text-[#8892A4] mt-2">과목 불러오는 중...</p>
              </div>
            )}

            {/* 교양필수 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13.5px] font-bold text-[#3A4150]">교양필수</h3>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completedCourses.skipGeneralRequired}
                    onChange={(e) => setCompletedCourses(prev => ({ ...prev, skipGeneralRequired: e.target.checked }))}
                    className="w-[15px] h-[15px] accent-[#2F6FEB]"
                  />
                  <span className="text-[11.5px] font-semibold text-[#8892A4]">다 들었어요</span>
                </label>
              </div>

              {!completedCourses.skipGeneralRequired && (
                <>
                  <p className={`${HINT} mb-1`}>
                    이수한 과목은 <b>이수함</b>, 이번에 꼭 넣을 과목은 <b>꼭 넣기</b>를 눌러주세요
                  </p>
                  {generalRequiredList.length > 0 ? (
                    <div>{generalRequiredList.map(course => renderRequiredRow(course, 'generalRequired'))}</div>
                  ) : (
                    <p className="text-[13px] text-[#B0B7C3]">교양필수 과목이 없습니다</p>
                  )}
                </>
              )}
            </div>

            {/* 전공필수 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13.5px] font-bold text-[#3A4150]">전공필수 ({userInfo.major})</h3>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completedCourses.skipMajorRequired}
                    onChange={(e) => setCompletedCourses(prev => ({ ...prev, skipMajorRequired: e.target.checked }))}
                    className="w-[15px] h-[15px] accent-[#2F6FEB]"
                  />
                  <span className="text-[11.5px] font-semibold text-[#8892A4]">다 들었어요</span>
                </label>
              </div>

              {!completedCourses.skipMajorRequired && (
                <>
                  <p className={`${HINT} mb-1`}>
                    내년에 들을 필수는 그냥 두면 AI가 알아서 판단해요
                  </p>
                  {majorRequiredList.length > 0 ? (
                    <div>{majorRequiredList.map(course => renderRequiredRow(course, 'majorRequired'))}</div>
                  ) : (
                    <p className="text-[13px] text-[#B0B7C3]">전공필수 과목이 없습니다</p>
                  )}
                </>
              )}
            </div>

            {/* 교양선택 이수 영역 */}
            <div>
              <h3 className="text-[13.5px] font-bold text-[#3A4150] mb-1.5">교양선택 이수 영역</h3>
              <p className={`${HINT} mb-2`}>이미 들은 영역을 체크하면 해당 영역 과목은 추천에서 제외돼요</p>
              <div className="grid grid-cols-3 gap-[7px]">
                {AREA_OPTIONS.map(area => {
                  const selected = completedCourses.completedAreas.includes(area.value);
                  return (
                    <ChipButton
                      key={area.value}
                      tone="ink"
                      active={selected}
                      onClick={() => {
                        if (selected) {
                          setCompletedCourses(prev => ({
                            ...prev,
                            completedAreas: prev.completedAreas.filter(a => a !== area.value)
                          }));
                        } else {
                          setCompletedCourses(prev => ({
                            ...prev,
                            completedAreas: [...prev.completedAreas, area.value]
                          }));
                        }
                      }}
                    >
                      {selected ? '✓ ' : ''}{area.label}
                    </ChipButton>
                  );
                })}
              </div>
            </div>

            {/* 전공선택 이수 과목 */}
            <div>
              <h3 className="text-[13.5px] font-bold text-[#3A4150] mb-1.5">전공선택 이수 과목</h3>
              <p className={`${HINT} mb-2`}>이미 들은 전공선택은 모든 분반이 추천에서 제외돼요</p>

              {completedCourses.completedMajorElective.length > 0 && (
                <div className="space-y-1.5 mb-2.5">
                  {completedCourses.completedMajorElective.map((course, idx) => (
                    <SelectedRow
                      key={`completed-${course.course_name}-${idx}`}
                      name={course.course_name}
                      meta={`${course.credits}학점`}
                      tone="green"
                      onRemove={() => setCompletedCourses(prev => ({
                        ...prev,
                        completedMajorElective: prev.completedMajorElective.filter(
                          c => c.course_name !== course.course_name
                        )
                      }))}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => setIsCompletedMajorSearchOpen(true)}
                className={`${DASHED} ${TONES.green.dashed}`}
              >
                <Plus size={14} />
                이수한 전공선택 추가
              </button>
            </div>

            {/* ========== 복수전공 이수 현황 ========== */}
            {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
              <>
                {/* 구분선 */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#E4E8F0]" />
                  <span className="text-[11.5px] font-bold text-[#2F6FEB]">복수전공 ({userInfo.doubleMajor})</span>
                  <div className="flex-1 h-px bg-[#E4E8F0]" />
                </div>

                {/* 복수전공 전필 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13.5px] font-bold text-[#3A4150]">
                      <span className="text-[#2F6FEB]">복전</span> 전공필수 ({userInfo.doubleMajor})
                    </h3>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completedCourses.skipDoubleMajorRequired}
                        onChange={(e) => setCompletedCourses(prev => ({ ...prev, skipDoubleMajorRequired: e.target.checked }))}
                        className="w-[15px] h-[15px] accent-[#2F6FEB]"
                      />
                      <span className="text-[11.5px] font-semibold text-[#8892A4]">다 들었어요</span>
                    </label>
                  </div>

                  {!completedCourses.skipDoubleMajorRequired && (
                    doubleMajorRequiredList.length > 0 ? (
                      <div>{doubleMajorRequiredList.map(course => renderRequiredRow(course, 'doubleMajorRequired'))}</div>
                    ) : (
                      <p className="text-[13px] text-[#B0B7C3]">복수전공 전공필수 과목이 없습니다</p>
                    )
                  )}
                </div>

                {/* 복수전공 전선 이수 과목 */}
                <div>
                  <h3 className="text-[13.5px] font-bold text-[#3A4150] mb-1.5">
                    <span className="text-[#2F6FEB]">복전</span> 전공선택 이수 과목
                  </h3>
                  <p className={`${HINT} mb-2`}>이미 들은 복전 전공선택은 추천에서 제외돼요</p>

                  {completedCourses.completedDoubleMajorElective.length > 0 && (
                    <div className="space-y-1.5 mb-2.5">
                      {completedCourses.completedDoubleMajorElective.map((course, idx) => (
                        <SelectedRow
                          key={`dm-completed-${course.course_name}-${idx}`}
                          name={course.course_name}
                          meta={`${course.credits}학점`}
                          tone="blue"
                          onRemove={() => setCompletedCourses(prev => ({
                            ...prev,
                            completedDoubleMajorElective: prev.completedDoubleMajorElective.filter(
                              c => c.course_name !== course.course_name
                            )
                          }))}
                        />
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setIsCompletedDoubleMajorSearchOpen(true)}
                    className={`${DASHED} ${TONES.blue.dashed}`}
                  >
                    <Plus size={14} />
                    이수한 복전 전공선택 추가
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========== Step 3: 전공 선택 (2학년+) ========== */}
        {step === 3 && (
          <div className={`${CARD} px-5 py-[22px]`}>
            <CardHead title="전공 선택" desc="전공 과목을 AI가 고를지, 직접 고를지 정해주세요" />

            {/* ===== 학점 배분 (복수전공 전용) ===== */}
            {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
              <div className="mb-6 pb-6 border-b border-[#F1F4FA]">
                <h3 className="text-[13.5px] font-bold text-[#3A4150] mb-1">📊 학점 배분</h3>
                <p className={`${HINT} mb-3`}>
                  총 {userInfo.targetCredits}학점을 주전공 / 복수전공 / 교양으로 나눠주세요
                </p>

                <div className="space-y-2.5">
                  {[
                    { key: 'major', label: `주전공 (${userInfo.major})`, dot: 'bg-[#2F6FEB]' },
                    { key: 'doubleMajor', label: `복수전공 (${userInfo.doubleMajor})`, dot: 'bg-[#1FA97A]' },
                    { key: 'general', label: '교양', dot: 'bg-[#F5A524]' },
                  ].map(({ key, label, dot }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-[#3A4150] min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className="truncate">{label}</span>
                      </span>
                      <select
                        value={creditAllocation[key]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCreditAllocation(prev => ({ ...prev, [key]: val }));
                        }}
                        className="border border-[#E4E8F0] rounded-[9px] px-3 py-1.5 text-[13px] text-[#1E2530] bg-white w-[92px] text-center shrink-0 outline-none focus:border-[#2F6FEB]"
                      >
                        {Array.from({ length: userInfo.targetCredits + 1 }, (_, i) => (
                          <option key={i} value={i}>{i}학점</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* 합계 표시 */}
                {(() => {
                  const total = creditAllocation.major + creditAllocation.doubleMajor + creditAllocation.general;
                  const isMatch = total === userInfo.targetCredits;
                  return (
                    <div className={`mt-3 px-3.5 py-2.5 rounded-[10px] border flex items-center justify-between ${
                      isMatch ? 'bg-[#E8F8F0] border-[#BEEBD3]' : 'bg-[#FEF4F4] border-[#FBD8D8]'
                    }`}>
                      <span className="text-[12.5px] font-bold text-[#3A4150]">
                        합계: {total} / {userInfo.targetCredits}학점
                      </span>
                      {isMatch ? (
                        <span className="text-[11.5px] font-bold text-[#1FA97A]">✅ 딱 맞아요!</span>
                      ) : total > userInfo.targetCredits ? (
                        <span className="text-[11.5px] font-bold text-[#C23A46]">❌ {total - userInfo.targetCredits}학점 초과</span>
                      ) : (
                        <span className="text-[11.5px] font-bold text-[#C23A46]">⚠️ {userInfo.targetCredits - total}학점 부족</span>
                      )}
                    </div>
                  );
                })()}

                <p className={`${HINT} mt-2`}>
                  💡 전필 + 전선 합산 학점이에요. AI가 전필 먼저 배치 후 남은 학점을 전선으로 채워요.
                </p>
              </div>
            )}

            {/* ===== 모드 선택 ===== */}
            <p className={`${HINT} mb-2.5`}>전공선택 과목을 어떻게 정할까요?</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMajorSelection(prev => ({ ...prev, mode: 'auto', selectedCourses: [], selectedDoubleMajorCourses: [] }))}
                className={`p-4 rounded-[12px] border text-left transition-colors ${
                  majorSelection.mode === 'auto'
                    ? 'border-[#2F6FEB] bg-[#EAF1FE]'
                    : 'border-[#E4E8F0] bg-white hover:border-[#C9D3E4]'
                }`}
              >
                <Shuffle className={`mb-2 ${majorSelection.mode === 'auto' ? 'text-[#2F6FEB]' : 'text-[#B0B7C3]'}`} size={22} />
                <div className={`text-[13px] font-bold ${majorSelection.mode === 'auto' ? 'text-[#2F6FEB]' : 'text-[#1E2530]'}`}>상관없음</div>
                <p className="text-[11.5px] text-[#8892A4] mt-1 leading-snug">
                  AI가 {userInfo.grade}학년에 맞게 알아서 선택해요
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMajorSelection(prev => ({ ...prev, mode: 'manual' }))}
                className={`p-4 rounded-[12px] border text-left transition-colors ${
                  majorSelection.mode === 'manual'
                    ? 'border-[#2F6FEB] bg-[#EAF1FE]'
                    : 'border-[#E4E8F0] bg-white hover:border-[#C9D3E4]'
                }`}
              >
                <BookOpen className={`mb-2 ${majorSelection.mode === 'manual' ? 'text-[#2F6FEB]' : 'text-[#B0B7C3]'}`} size={22} />
                <div className={`text-[13px] font-bold ${majorSelection.mode === 'manual' ? 'text-[#2F6FEB]' : 'text-[#1E2530]'}`}>직접 고르기</div>
                <p className="text-[11.5px] text-[#8892A4] mt-1 leading-snug">
                  듣고 싶은 전공 선택과목을 직접 골라요
                </p>
              </button>
            </div>

            {/* ===== 직접 고르기 모드 ===== */}
            {majorSelection.mode === 'manual' && (
              <div className="space-y-5">
                {/* --- 주전공 전공과목 --- */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[13.5px] font-bold text-[#3A4150]">
                      🔵 주전공 과목 ({majorSelection.selectedCourses.length})
                    </h3>
                    <span className="text-[11.5px] text-[#8892A4]">{userInfo.major}</span>
                  </div>

                  {majorSelection.selectedCourses.length > 0 && (
                    <div className="space-y-1.5 mb-2.5">
                      {majorSelection.selectedCourses.map(course => (
                        <SelectedRow
                          key={`${course.course_code}-${course.section}`}
                          name={course.course_name}
                          meta={`${course.professor} | ${course.schedule_raw} | ${course.credits}학점`}
                          tone="blue"
                          onRemove={() => handleRemoveMajorCourse(course)}
                        />
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setIsMajorSearchOpen(true)}
                    className={`${DASHED} ${TONES.blue.dashed} py-3`}
                  >
                    <Plus size={16} />
                    {userInfo.major} 전공과목 검색
                  </button>
                </div>

                {/* --- 복전 전공과목 (복수전공일 때만) --- */}
                {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[13.5px] font-bold text-[#3A4150]">
                        🟢 복전 과목 ({majorSelection.selectedDoubleMajorCourses.length})
                      </h3>
                      <span className="text-[11.5px] text-[#8892A4]">{userInfo.doubleMajor}</span>
                    </div>

                    {majorSelection.selectedDoubleMajorCourses.length > 0 && (
                      <div className="space-y-1.5 mb-2.5">
                        {majorSelection.selectedDoubleMajorCourses.map(course => (
                          <SelectedRow
                            key={`dm-${course.course_code}-${course.section}`}
                            name={course.course_name}
                            meta={`${course.professor} | ${course.schedule_raw} | ${course.credits}학점`}
                            tone="green"
                            onRemove={() => handleRemoveDoubleMajorCourse(course)}
                          />
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setIsDoubleMajorSearchOpen(true)}
                      className={`${DASHED} ${TONES.green.dashed} py-3`}
                    >
                      <Plus size={16} />
                      {userInfo.doubleMajor} 복전 과목 검색
                    </button>
                  </div>
                )}

                <p className={HINT}>💡 여기서 선택한 과목들이 시간표에 우선 배치됩니다</p>
              </div>
            )}

            {/* ===== 상관없음 모드 ===== */}
            {majorSelection.mode === 'auto' && (
              <div className="px-4 py-3.5 bg-[#F7F9FC] rounded-[10px]">
                <p className="text-[13px] text-[#3A4150]">
                  🤖 AI가 <strong>{userInfo.grade}학년</strong>에 적합한 전공과목을 자동으로 선택합니다.
                </p>
                <ul className="mt-2 text-[11.5px] text-[#8892A4] space-y-1">
                  <li>• 전공필수 과목 우선 배치</li>
                  <li>• {userInfo.grade}학년 대상 과목 위주 선택</li>
                  <li>• {userInfo.major} 학과 과목{userInfo.hasDoubleMajor ? ` + ${userInfo.doubleMajor} 복전 과목` : '만'} 선택</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ========== Step 4: 선호도 ========== */}
        {step === 4 && (
          <div className={`${CARD} px-5 py-[22px] space-y-[18px]`}>
            <CardHead title="선호도" desc="원하는 시간표 스타일을 알려주세요" />

            {/* 교양 옵션 (2학년+) */}
            {userInfo.grade >= 2 && (
              <div>
                <label className={LABEL}>교양 수강</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <SegButton
                    active={!preferences.skipGeneral}
                    onClick={() => setPreferences(prev => ({ ...prev, skipGeneral: false }))}
                  >
                    영역 선택
                  </SegButton>
                  <SegButton
                    active={preferences.skipGeneral}
                    onClick={() => setPreferences(prev => ({ ...prev, skipGeneral: true, preferredAreas: [] }))}
                  >
                    교양 안 듣기 🚫
                  </SegButton>
                </div>
              </div>
            )}

            {/* 교양 영역 */}
            {!preferences.skipGeneral && (
              <div>
                <label className={LABEL}>듣고 싶은 교양 영역</label>
                <div className="grid grid-cols-3 gap-[7px]">
                  {AREA_OPTIONS.map(area => (
                    <ChipButton
                      key={area.value}
                      tone="ink"
                      active={preferences.preferredAreas.includes(area.value)}
                      onClick={() => {
                        if (preferences.preferredAreas.includes(area.value)) {
                          setPreferences(prev => ({ ...prev, preferredAreas: prev.preferredAreas.filter(a => a !== area.value) }));
                        } else {
                          setPreferences(prev => ({ ...prev, preferredAreas: [...prev.preferredAreas, area.value] }));
                        }
                      }}
                    >
                      {area.label}
                    </ChipButton>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={LABEL}>공강 원하는 요일</label>
              <div className="grid grid-cols-5 gap-1.5">
                {['월', '화', '수', '목', '금'].map(day => (
                  <ChipButton
                    key={day}
                    active={preferences.emptyDays.includes(day)}
                    onClick={() => {
                      if (preferences.emptyDays.includes(day)) {
                        setPreferences(prev => ({ ...prev, emptyDays: prev.emptyDays.filter(d => d !== day) }));
                      } else {
                        setPreferences(prev => ({ ...prev, emptyDays: [...prev.emptyDays, day] }));
                      }
                    }}
                  >
                    {day}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL}>아침 수업 (9시 30분)</label>
              <div className="grid grid-cols-2 gap-1.5">
                <SegButton active={!preferences.noMorning} onClick={() => setPreferences(prev => ({ ...prev, noMorning: false }))}>
                  괜찮음
                </SegButton>
                <SegButton active={preferences.noMorning} onClick={() => setPreferences(prev => ({ ...prev, noMorning: true }))}>
                  싫음 😴
                </SegButton>
              </div>
            </div>

            <div>
              <label className={LABEL}>연강</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['좋음', '싫음', '상관없음'].map(opt => (
                  <SegButton
                    key={opt}
                    active={preferences.consecutive === opt}
                    onClick={() => setPreferences(prev => ({ ...prev, consecutive: opt }))}
                    className="!py-2 !text-[12.5px]"
                  >
                    {opt}
                  </SegButton>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL}>선호 시간대</label>
              <div className="grid grid-cols-3 gap-1.5">
                {['오전', '오후', '상관없음'].map(opt => (
                  <SegButton
                    key={opt}
                    active={preferences.preferredTime === opt}
                    onClick={() => setPreferences(prev => ({ ...prev, preferredTime: opt }))}
                    className="!py-2 !text-[12.5px]"
                  >
                    {opt}
                  </SegButton>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== Step 5: 추가 설정 ========== */}
        {step === 5 && (
          <div className={`${CARD} px-5 py-[22px] space-y-5`}>
            <CardHead title="추가 설정" desc="선택사항이에요 — 꼭 넣거나 빼고 싶은 과목이 있나요?" />

            <div>
              <label className={LABEL}>⭐ 꼭 듣고 싶은 과목</label>
              <p className={`${HINT} mb-2`}>전공/교양 관계없이 꼭 넣고 싶은 과목</p>

              {mustTakeCourses.length > 0 && (
                <div className="space-y-1.5 mb-2.5">
                  {mustTakeCourses.map(course => (
                    <SelectedRow
                      key={`${course.course_code}-${course.section}`}
                      name={course.course_name}
                      meta={`${course.professor} | ${course.schedule_raw}`}
                      tone="amber"
                      onRemove={() => handleRemoveMustTake(course)}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => setIsCourseSearchOpen(true)}
                className={`${DASHED} ${TONES.blue.dashed}`}
              >
                <Plus size={14} />
                과목 검색하여 추가
              </button>
            </div>

            <div>
              <label className={LABEL}>🚫 듣기 싫은 과목</label>
              <p className={`${HINT} mb-2`}>이 과목은 모든 분반이 추천에서 제외돼요</p>

              {avoidCourses.length > 0 && (
                <div className="space-y-1.5 mb-2.5">
                  {avoidCourses.map((course, idx) => (
                    <SelectedRow
                      key={`avoid-${course.course_name}-${idx}`}
                      name={course.course_name}
                      meta={course.professor}
                      tone="red"
                      onRemove={() => setAvoidCourses(prev => prev.filter(
                        c => c.course_name !== course.course_name
                      ))}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => setIsAvoidSearchOpen(true)}
                className={`${DASHED} ${TONES.red.dashed}`}
              >
                <Plus size={14} />
                듣기 싫은 과목 추가
              </button>
            </div>
          </div>
        )}

        {/* ========== Step 6: 결과 ========== */}
        {step === 6 && result && (
          <div className="space-y-4">
            {/* 후보 선택 (A/B/C) */}
            {candidates.length > 1 && (
              <div>
                <p className={`${HINT} mb-1.5`}>
                  마음에 드는 시간표를 골라보세요 ({candidates.length}개 추천)
                </p>
                <div className="flex items-end gap-1">
                  {candidates.map((cand, i) => {
                    const active = i === selectedIndex;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectCandidate(i)}
                        className={`flex-1 min-w-0 px-3 py-2.5 rounded-t-[10px] transition-colors ${
                          active ? 'bg-white' : 'bg-transparent hover:bg-white/50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-[7px]">
                          <span className={`text-[13px] font-bold whitespace-nowrap ${active ? 'text-[#2F6FEB]' : 'text-[#8892A4]'}`}>
                            {['A', 'B', 'C', 'D'][i] || i + 1}안
                          </span>
                          {typeof cand.score === 'number' && (
                            <span className={`text-[10.5px] font-bold px-1.5 py-px rounded-full ${
                              active ? 'bg-[#EAF1FE] text-[#2F6FEB]' : 'bg-[#EEF1F6] text-[#9AA3B2]'
                            }`}>
                              {cand.score}점
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] leading-tight truncate mt-0.5 ${active ? 'text-[#5B6472]' : 'text-[#9AA3B2]'}`}>
                          {cand.theme_label || `${cand.total_credits}학점`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 유형 카드 */}
            <div className={`rounded-2xl px-[22px] py-[26px] text-white bg-gradient-to-br from-[#1E2530] to-[#2F6FEB] ${candidates.length > 1 ? '-mt-4' : ''}`}>
              <p className="text-[12.5px] font-semibold opacity-75 mb-2">✨ AI가 추천한 시간표</p>
              <h2 className="text-[23px] font-extrabold mb-2">{result.theme_label || 'AI 추천 시간표'}</h2>
              {result.empty_days?.length > 0 && (
                <p className="text-[13px] opacity-90 leading-relaxed mb-4">
                  {result.empty_days.join(', ')}요일이 공강이에요
                </p>
              )}
              {typeof result.score === 'number' && (
                <span className="inline-block px-3.5 py-1.5 rounded-full bg-white/[.18] text-[14px] font-extrabold">
                  {result.score}
                  <span className="text-[11px] font-semibold opacity-80"> / 100</span>
                </span>
              )}
            </div>

            {/* 요약 바 */}
            <div className={`${CARD} px-[18px] py-3.5 flex items-center justify-between`}>
              <div className="flex items-baseline gap-[18px]">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-extrabold text-[#2F6FEB]">{result.total_credits}</span>
                  <span className="text-[12px] font-semibold text-[#8892A4]">학점</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-extrabold text-[#1E2530]">{result.selected_courses?.length || 0}</span>
                  <span className="text-[12px] font-semibold text-[#8892A4]">과목</span>
                </div>
              </div>
              {result.empty_days?.length > 0 && (
                <div className="text-[12px] font-semibold text-[#1FA97A]">공강 {result.empty_days.join(', ')}</div>
              )}
            </div>

            {/* 시간표 미리보기 */}
            <div>
              <h3 className="text-[14px] font-extrabold text-[#1E2530] mb-2">📅 시간표 미리보기</h3>
              <SchedulePreview courses={result.selected_courses || []} />
            </div>

            {/* 주의사항 */}
            {result.warnings?.length > 0 && (
              <div className="bg-[#FFF8EC] border border-[#F7E3BC] rounded-[10px] px-3.5 py-3 flex gap-2.5 items-start">
                <AlertTriangle size={16} className="text-[#F5A524] shrink-0 mt-px" />
                <div>
                  <span className="text-[12.5px] font-bold text-[#9C7A0E]">주의사항</span>
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-[12px] text-[#9C7A0E] mt-1">• {w}</p>
                  ))}
                </div>
              </div>
            )}

            {/* 시간 충돌 경고 (프론트엔드 검사) */}
            {timeConflicts.length > 0 && (
              <div className="bg-[#FEF4F4] border border-[#FBD8D8] rounded-[10px] px-3.5 py-3 flex gap-2.5 items-start">
                <AlertTriangle size={16} className="text-[#E5484D] shrink-0 mt-px" />
                <div>
                  <span className="text-[12.5px] font-bold text-[#C23A46]">⚠️ 시간 충돌 발견!</span>
                  <p className="text-[11.5px] text-[#C23A46] opacity-80 mt-0.5">
                    AI가 실수로 시간이 겹치는 과목을 추천했습니다. 다시 만들기를 권장합니다.
                  </p>
                  {timeConflicts.map((conflict, i) => (
                    <p key={i} className="text-[12px] text-[#C23A46] mt-1">
                      • {conflict.day}요일: <strong>{conflict.course1}</strong> ↔ <strong>{conflict.course2}</strong> 시간 겹침
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 추천 과목 */}
            <div className={`${CARD} p-[18px]`}>
              <h3 className="text-[14px] font-extrabold text-[#1E2530] mb-3">📚 추천 과목</h3>
              <div>
                {result.selected_courses?.map((course, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedResultCourse(course)}
                    className="flex items-start justify-between gap-2.5 py-2.5 border-b border-[#F6F7FA] last:border-b-0 cursor-pointer hover:bg-[#FAFBFD] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#1E2530] truncate">{course.course_name}</div>
                      <div className="text-[11.5px] text-[#8892A4] truncate mt-0.5">
                        {course.professor} | {course.schedule_raw} | {course.credits}학점
                      </div>
                    </div>
                    <span className={`text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0 whitespace-nowrap ${
                      course.category?.includes('필수')
                        ? 'bg-[#FEF4F4] text-[#C23A46]'
                        : 'bg-[#EAF1FE] text-[#2F6FEB]'
                    }`}>
                      {course.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 총평 */}
            {result.summary && (
              <div className="bg-[#EAF1FE] border border-[#D3E3FC] rounded-[14px] p-[18px]">
                <h3 className="text-[13.5px] font-extrabold text-[#2559C4] mb-2">📝 AI 총평</h3>
                <p className="text-[13px] text-[#2F4E86] leading-[1.65]">{result.summary}</p>
              </div>
            )}

            {/* 시간표 수정 */}
            <div className={`${CARD} px-4 py-3.5`}>
              <h3 className="text-[13px] font-extrabold text-[#1E2530] mb-2.5">✏️ 시간표 수정</h3>

              {isModifying ? (
                <div className="flex items-center justify-center gap-2 py-2 text-[#2F6FEB]">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-[13px] font-semibold">AI가 시간표를 수정하고 있어요...</span>
                </div>
              ) : showDayPicker ? (
                /* 요일 선택 */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={HINT}>공강 만들 요일을 선택하세요</p>
                    <button onClick={() => setShowDayPicker(false)} className="text-[#8892A4] hover:text-[#5B6472]">
                      <X size={14} />
                    </button>
                  </div>
                  {(() => {
                    const emptyDays = result.empty_days || [];
                    const allEmpty = emptyDays.length >= 4;
                    return (
                      <>
                        <div className="grid grid-cols-5 gap-1.5">
                          {['월', '화', '수', '목', '금'].map(day => {
                            const alreadyEmpty = emptyDays.includes(day);
                            const isLastActive = allEmpty && !alreadyEmpty;
                            const disabled = alreadyEmpty || isLastActive;
                            return (
                              <button
                                key={day}
                                onClick={() => !disabled && handleModify('EMPTY_DAY', { day })}
                                disabled={disabled}
                                className={`py-2 rounded-[8px] text-[12.5px] font-bold flex flex-col items-center transition-colors ${
                                  alreadyEmpty
                                    ? 'bg-[#F1F4FA] text-[#B0B7C3] cursor-not-allowed'
                                    : isLastActive
                                      ? 'bg-[#FFF8EC] text-[#DDB05E] cursor-not-allowed'
                                      : 'bg-[#EAF1FE] text-[#2F6FEB] hover:bg-[#DCE8FF]'
                                }`}
                              >
                                {day}
                                {alreadyEmpty && <span className="text-[9px] font-semibold leading-none mt-0.5">이미 공강</span>}
                              </button>
                            );
                          })}
                        </div>
                        {allEmpty && (
                          <p className="text-[11.5px] text-[#DDB05E] mt-2">⚠️ 최소 1일은 수업이 있어야 해요</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                /* 기본 버튼 */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDayPicker(true); setShowMore(false); }}
                      disabled={isModifying}
                      className="flex-1 py-2.5 rounded-[9px] bg-[#EAF1FE] text-[#2F6FEB] text-[13px] font-bold hover:bg-[#DCE8FF] disabled:opacity-50 transition-colors"
                    >
                      🗓️ 공강 만들기
                    </button>
                    <button
                      onClick={() => { setShowMore(v => !v); setShowDayPicker(false); }}
                      disabled={isModifying}
                      className="px-4 py-2.5 rounded-[9px] bg-[#EEF1F6] text-[#5B6472] text-[13px] font-bold hover:bg-[#E4E8F0] disabled:opacity-50 transition-colors"
                    >
                      {showMore ? '접기 ▲' : '더보기 ▼'}
                    </button>
                  </div>

                  {showMore && (
                    <div className="space-y-1.5 pt-1.5 border-t border-[#F1F4FA]">
                      {[
                        { type: 'NO_EARLY_MORNING', label: '⏰ 9시 30분 수업 빼줘' },
                        { type: 'ADD_MAJOR',         label: '📚 전공 더 넣어줘' },
                        { type: 'REDUCE_GENERAL',    label: '🎓 교양 줄여줘' },
                        { type: 'REDUCE_CREDITS',    label: '➖ 학점 줄여줘' },
                        { type: 'INCREASE_CREDITS',  label: '➕ 학점 늘려줘' },
                      ].map(({ type, label }) => (
                        <button
                          key={type}
                          onClick={() => handleModify(type, {})}
                          disabled={isModifying}
                          className="w-full px-4 py-2.5 rounded-[9px] bg-[#EAF1FE] text-[#2F6FEB] text-[13px] font-bold text-left hover:bg-[#DCE8FF] disabled:opacity-50 transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {history.length > 0 && (
                    <button
                      onClick={handleUndo}
                      className="w-full py-2 rounded-[9px] border border-[#E4E8F0] text-[12.5px] font-bold text-[#5B6472] hover:bg-[#F7F9FC] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RotateCcw size={13} />
                      이전으로 되돌리기 ({history.length}단계)
                    </button>
                  )}
                </div>
              )}
            </div>

            {logId && <AiFeedback logId={logId} />}

            <div className="flex gap-2">
              <button
                onClick={() => { setHasGenerated(true); setStep(1); }}
                className="flex-1 py-3.5 rounded-[10px] border border-[#E4E8F0] bg-white text-[13.5px] font-bold text-[#5B6472] flex items-center justify-center gap-1.5 hover:border-[#C9D3E4] transition-colors"
              >
                <RotateCcw size={14} />
                다시 만들기
              </button>
              <button
                onClick={handleReplaceSchedule}
                className="flex-[2] py-3.5 rounded-[10px] bg-[#2F6FEB] text-white text-[13.5px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#2559C4] transition-colors"
              >
                <Plus size={16} />
                이 시간표로 교체
              </button>
            </div>
          </div>
        )}

        {/* 수정 에러 토스트 */}
        {modifyError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1E2530] text-white px-4 py-3 rounded-[12px] shadow-lg flex items-center gap-2 max-w-sm w-full mx-4">
            <AlertTriangle size={16} className="shrink-0 text-[#FF9BA3]" />
            <span className="text-[13px]">{modifyError}</span>
          </div>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="fixed inset-0 bg-[rgba(20,26,38,.5)] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl px-7 py-8 flex flex-col items-center max-w-[340px] w-full">
              <div className="w-11 h-11 rounded-full border-[3px] border-[#EAF1FE] border-t-[#2F6FEB] animate-spin" />

              <h2 className="mt-4 text-[15.5px] font-extrabold text-[#1E2530]">
                AI가 시간표를 만들고 있어요
              </h2>

              {/* 예상 시간을 먼저 알려줘야 기다릴지 판단할 수 있다 */}
              <p className="mt-1 text-[12.5px] text-[#8892A4]">
                보통 <b className="text-[#2F6FEB]">20~30초</b> 걸려요
              </p>

              {/* 경과 시간 + 진행 막대: 멈춘 게 아니라는 신호 */}
              <div className="w-full mt-5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-[#5B6472]">{loadingStage}</span>
                  <span className="text-[12px] font-bold text-[#2F6FEB] tabular-nums">
                    {loadingSeconds}초
                  </span>
                </div>
                <div className="h-1.5 bg-[#EEF1F6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2F6FEB] rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.min(95, loadingSeconds / 30 * 100)}%` }}
                  />
                </div>
              </div>

              <p className="mt-4 text-[11.5px] text-[#B0B7C3] text-center leading-relaxed">
                {loadingSeconds < 30
                  ? '창을 닫지 말고 잠시만 기다려주세요'
                  : '조금 오래 걸리고 있어요. 나갔다 다시 시도하면 처음부터 다시 만들어야 해서 더 느려져요'}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[#FEF4F4] border border-[#FBD8D8] rounded-[10px] px-3.5 py-3">
            <p className="text-[13px] text-[#C23A46]">{error}</p>
          </div>
        )}

        {/* 네비게이션 버튼 */}
        {step <= 5 && (
          <div className="flex gap-2">
            {displayStep > 1 && (
              <button
                onClick={handlePrev}
                className="flex-1 py-3 rounded-[10px] border border-[#E4E8F0] bg-white text-[13.5px] font-bold text-[#5B6472] flex items-center justify-center gap-1.5 hover:border-[#C9D3E4] transition-colors"
              >
                <ChevronLeft size={15} />
                이전
              </button>
            )}
            {displayStep < stepConfig.totalSteps ? (
              <button
                onClick={handleNext}
                className="flex-[2] py-3 rounded-[10px] bg-[#2F6FEB] text-white text-[13.5px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#2559C4] transition-colors"
              >
                다음
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => handleGenerate(hasGenerated)}
                disabled={isLoading}
                className="flex-[2] py-3 rounded-[10px] bg-[#1E2530] text-white text-[13.5px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[#151B24] transition-colors"
              >
                <Sparkles size={16} />
                시간표 생성하기
              </button>
            )}
          </div>
        )}
      </main>

      {/* 전공과목 검색 모달 */}
      <CourseSearchModal
        isOpen={isMajorSearchOpen}
        onClose={() => setIsMajorSearchOpen(false)}
        onSelect={handleAddMajorCourse}
        currentSelections={majorSelection.selectedCourses}
        title={`${userInfo.major} 전공과목 검색`}
        filterOptions={{
          category: 'major',
          department: userInfo.major,
        }}
      />

      {/* 복전 전공과목 검색 모달 */}
      {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
        <CourseSearchModal
          isOpen={isDoubleMajorSearchOpen}
          onClose={() => setIsDoubleMajorSearchOpen(false)}
          onSelect={handleAddDoubleMajorCourse}
          currentSelections={majorSelection.selectedDoubleMajorCourses}
          title={`${userInfo.doubleMajor} 복전 과목 검색`}
          filterOptions={{
            category: 'major',
            department: userInfo.doubleMajor,
          }}
        />
      )}

      {/* 꼭 듣고 싶은 과목 검색 모달 */}
      <CourseSearchModal
        isOpen={isCourseSearchOpen}
        onClose={() => setIsCourseSearchOpen(false)}
        onSelect={handleAddMustTake}
        currentSelections={mustTakeCourses}
        title="꼭 듣고 싶은 과목 검색"
        filterOptions={{}}
      />

      {/* 이수한 전공선택 검색 모달 */}
      <CourseSearchModal
        isOpen={isCompletedMajorSearchOpen}
        onClose={() => setIsCompletedMajorSearchOpen(false)}
        onSelect={handleAddCompletedMajor}
        currentSelections={completedCourses.completedMajorElective}
        title={`${userInfo.major} 이수한 전공선택`}
        filterOptions={{
          category: 'major',
          department: userInfo.major,
          classification: '전선',
        }}
        matchByName={true}
      />

      {/* 이수한 복전 전공선택 검색 모달 */}
      {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
        <CourseSearchModal
          isOpen={isCompletedDoubleMajorSearchOpen}
          onClose={() => setIsCompletedDoubleMajorSearchOpen(false)}
          onSelect={handleAddCompletedDoubleMajor}
          currentSelections={completedCourses.completedDoubleMajorElective}
          title={`${userInfo.doubleMajor} 이수한 복전 전공선택`}
          filterOptions={{
            category: 'major',
            department: userInfo.doubleMajor,
            classification: '전선',
          }}
          matchByName={true}
        />
      )}

      {/* 듣기 싫은 과목 검색 모달 */}
      <CourseSearchModal
        isOpen={isAvoidSearchOpen}
        onClose={() => setIsAvoidSearchOpen(false)}
        onSelect={handleAddAvoidCourse}
        currentSelections={avoidCourses}
        title="듣기 싫은 과목 검색"
        filterOptions={{}}
        matchByName={true}
      />

      {/* 시간표 선택 모달 */}
      <ScheduleSelectModal
        isOpen={isScheduleSelectOpen}
        onClose={() => setIsScheduleSelectOpen(false)}
        schedules={schedules}
        onSelect={handleSaveToSchedule}
        onAddNew={handleSaveToNewSchedule}
        maxSchedules={maxSchedules}
      />

      {/* AI 추천 과목 상세 모달 */}
      {selectedResultCourse && (
        <CourseDetail
          course={selectedResultCourse}
          onClose={() => setSelectedResultCourse(null)}
          onAdd={() => {}}
          onRemove={() => {}}
          isAdded={false}
          conflict={null}
          onModifyReplace={(courseName) => {
            setSelectedResultCourse(null);
            handleModify('REMOVE_COURSE', { course_to_remove: courseName });
          }}
        />
      )}
    </div>
  );
}
