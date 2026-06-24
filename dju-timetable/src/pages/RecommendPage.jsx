// src/pages/RecommendPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Wand2, 
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  AlertTriangle,
  X,
  Search,
  BookOpen,
  Shuffle
} from 'lucide-react';
import { useCourses } from '../hooks/useCourses';
import { useSchedule } from '../hooks/useSchedule';
import { recommendSchedule, modifySchedule } from '../services/aiService';
import { logAiSession } from '../services/aiLogService';
import { COLLEGES, COURSE_COLORS } from '../data/constants';
import { parseScheduleToTimes } from '../utils/timeUtils';
import CourseDetail from '../components/schedule/CourseDetail';
import AiFeedback from '../components/AiFeedback';

// 시간표 선택 모달 컴포넌트
function ScheduleSelectModal({ isOpen, onClose, schedules, onSelect, onAddNew, maxSchedules }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">저장할 시간표 선택</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          AI 추천 시간표를 어디에 저장할까요?
        </p>
        
        <div className="space-y-2">
          {schedules.map(schedule => (
            <button
              key={schedule.id}
              onClick={() => onSelect(schedule.id)}
              className="w-full p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 text-left transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{schedule.name}</span>
                <span className="text-xs text-gray-500">
                  {schedule.courses.length > 0 
                    ? `${schedule.courses.length}과목 (교체됨)` 
                    : '비어있음'}
                </span>
              </div>
            </button>
          ))}
          
          {schedules.length < maxSchedules && (
            <button
              onClick={onAddNew}
              className="w-full p-3 border-2 border-dashed border-indigo-300 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              새 시간표로 저장
            </button>
          )}
        </div>
        
        <p className="text-xs text-gray-400 mt-4">
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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* 헤더 */}
          <div className="grid grid-cols-6 border-b">
            <div className="p-2 text-center text-xs font-medium text-gray-500 bg-gray-50">시간</div>
            {DAYS.map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-gray-700 bg-gray-50 border-l">{day}</div>
            ))}
          </div>
          
          {/* 시간 그리드 */}
          <div className="relative">
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-6 border-b" style={{ height: '40px' }}>
                <div className="p-1 text-[10px] text-gray-400 text-center border-r bg-gray-50">{hour}:00</div>
                {DAYS.map(day => (<div key={day} className="border-l relative" />))}
              </div>
            ))}
            
            {/* 과목 블록 */}
            {DAYS.map((day, dayIdx) => {
              const blocks = getBlocksForDay(day);
              return blocks.map((block, blockIdx) => {
                const top = (block.startHour - 9) * 40;
                const height = (block.endHour - block.startHour) * 40;
                const left = `calc(${(dayIdx + 1) * (100/6)}% + 2px)`;
                const width = `calc(${100/6}% - 4px)`;
                
                if (height <= 0 || top < 0) return null;
                
                return (
                  <div
                    key={`${day}-${blockIdx}-${block.course.course_name}`}
                    className={`absolute rounded p-1 ${block.color.bg} ${block.color.border} border overflow-hidden`}
                    style={{ top: `${top}px`, height: `${Math.max(height, 20)}px`, left, width }}
                  >
                    <div className={`text-[10px] font-medium ${block.color.text} truncate`}>
                      {block.course.course_name}
                    </div>
                    {height > 30 && (
                      <div className="text-[9px] text-gray-500 truncate">{block.course.professor}</div>
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
  const { searchCourses, loading } = useCourses();
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    async function doSearch() {
      if (isOpen) {
        // 필터 옵션 적용
        const filters = {
          ...filterOptions,
          limit: 50
        };
        
        if (searchTerm.length >= 2) {
          filters.searchTerm = searchTerm;
        }
        
        const results = await searchCourses(filters);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }
    doSearch();
  }, [searchTerm, isOpen, searchCourses, filterOptions]);

  // 모달 열릴 때 초기 로드
  useEffect(() => {
    async function initialLoad() {
      if (isOpen && filterOptions.category) {
        const results = await searchCourses({ ...filterOptions, limit: 50 });
        setSearchResults(results);
      }
    }
    initialLoad();
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
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
              placeholder="과목명, 교수명 검색..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              autoFocus
            />
          </div>
          {filterOptions.department && (
            <p className="text-xs text-indigo-600 mt-2">
              📌 {filterOptions.department} 학과 전공과목만 표시됩니다
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              검색 결과가 없습니다
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map(course => {
                const selected = isSelected(course);
                return (
                  <div
                    key={`${course.course_code}-${course.section}`}
                    onClick={() => !selected && onSelect(course)}
                    className={`p-3 rounded-lg border cursor-pointer ${
                      selected 
                        ? 'bg-green-50 border-green-300' 
                        : 'hover:bg-blue-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{course.course_name}</div>
                        <div className="text-xs text-gray-500">
                          {course.professor} | {course.schedule_raw} | {course.credits}학점
                          {course.target_year > 0 && (
                            <span className="ml-1 text-indigo-500">({course.target_year}학년 대상)</span>
                          )}
                        </div>
                      </div>
                      {selected ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">선택됨</span>
                      ) : (
                        <Plus size={18} className="text-blue-500" />
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
  const [result, setResult] = useState(null);
  const [logId, setLogId] = useState(null);
  const [error, setError] = useState(null);
  const [timeConflicts, setTimeConflicts] = useState([]);

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
  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

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
        }
      }, availableCourses);

      if (response.success) {
        setResult(response);
        setLogId(null);
        logAiSession('recommend', {
          grade: userInfo.grade,
          major: userInfo.major,
          double_major: userInfo.hasDoubleMajor ? userInfo.doubleMajor : null,
          target_credits: userInfo.targetCredits,
          preferences_summary: {
            empty_days: preferences.emptyDays,
            no_morning: preferences.noMorning,
          },
        }, response).then(id => setLogId(id));
        // 시간 충돌 검사
        if (response.selected_courses) {
          const conflicts = checkTimeConflicts(response.selected_courses);
          setTimeConflicts(conflicts);
        }
        setStep(6);  // 결과 화면
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
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
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-1.5 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} />
            </button>
            <Wand2 className="text-indigo-500" size={20} />
            <h1 className="text-base font-bold text-gray-800">AI 시간표 추천</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        
        {/* 진행 바 */}
        {step <= 5 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Step {displayStep}/{stepConfig.totalSteps}</span>
              <span>{stepConfig.stepNames[displayStep - 1]}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all" 
                style={{ width: `${(displayStep / stepConfig.totalSteps) * 100}%` }} 
              />
            </div>
          </div>
        )}

        {/* ========== Step 1: 기본 정보 ========== */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold mb-4">📋 기본 정보</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">학년</label>
                <select
                  value={userInfo.grade}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, grade: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value={1}>1학년 (신입생)</option>
                  <option value={2}>2학년</option>
                  <option value={3}>3학년</option>
                  <option value={4}>4학년</option>
                </select>
                {userInfo.grade === 1 && (
                  <p className="text-xs text-indigo-600 mt-1">
                    💡 1학년은 전공기초 과목이 자동으로 포함됩니다
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">단과대학</label>
                <select
                  value={userInfo.college}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, college: e.target.value, major: '' }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">선택하세요</option>
                  {filteredColleges.map(c => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">전공</label>
                <select
                  value={userInfo.major}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, major: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  disabled={!userInfo.college}
                >
                  <option value="">선택하세요</option>
                  {departments.map(d => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userInfo.hasDoubleMajor}
                    onChange={(e) => setUserInfo(prev => ({ ...prev, hasDoubleMajor: e.target.checked, doubleMajorCollege: '', doubleMajor: '' }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">복수전공 있음</span>
                </label>
              </div>

              {userInfo.hasDoubleMajor && (
                <div className="pl-6 space-y-3 border-l-2 border-indigo-200">
                  <select
                    value={userInfo.doubleMajorCollege}
                    onChange={(e) => setUserInfo(prev => ({ ...prev, doubleMajorCollege: e.target.value, doubleMajor: '' }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">복수전공 단과대학</option>
                    {filteredColleges.map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <select
                    value={userInfo.doubleMajor}
                    onChange={(e) => setUserInfo(prev => ({ ...prev, doubleMajor: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    disabled={!userInfo.doubleMajorCollege}
                  >
                    <option value="">복수전공 학과</option>
                    {doubleMajorDepts.map(d => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  목표 학점: <strong className="text-indigo-600">{userInfo.targetCredits}</strong>학점
                </label>
                <input
                  type="range"
                  min={12}
                  max={21}
                  value={userInfo.targetCredits}
                  onChange={(e) => setUserInfo(prev => ({ ...prev, targetCredits: Number(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>12</span>
                  <span>21</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== Step 2: 이수 현황 (2학년+) ========== */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold mb-2">📚 이수 현황</h2>
            <p className="text-sm text-gray-500 mb-4">이미 들은 과목을 체크해주세요</p>
            
            {loadingCourses && (
              <div className="text-center py-4">
                <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
                <p className="text-sm text-gray-500 mt-2">과목 불러오는 중...</p>
              </div>
            )}

            {/* 교양필수 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">교양필수</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completedCourses.skipGeneralRequired}
                    onChange={(e) => setCompletedCourses(prev => ({ ...prev, skipGeneralRequired: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-xs text-gray-500">다 들었어요</span>
                </label>
              </div>
              
              {!completedCourses.skipGeneralRequired && (
                <div className="space-y-2 pl-2">
                  {generalRequiredList.length > 0 ? (
                    generalRequiredList.map(course => (
                      <label key={course} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={completedCourses.generalRequired.includes(course)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCompletedCourses(prev => ({ ...prev, generalRequired: [...prev.generalRequired, course] }));
                            } else {
                              setCompletedCourses(prev => ({ ...prev, generalRequired: prev.generalRequired.filter(c => c !== course) }));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{course}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">교양필수 과목이 없습니다</p>
                  )}
                </div>
              )}
            </div>

            {/* 전공필수 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">전공필수 ({userInfo.major})</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completedCourses.skipMajorRequired}
                    onChange={(e) => setCompletedCourses(prev => ({ ...prev, skipMajorRequired: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span className="text-xs text-gray-500">다 들었어요</span>
                </label>
              </div>
              
              {!completedCourses.skipMajorRequired && (
                <div className="space-y-2 pl-2">
                  {majorRequiredList.length > 0 ? (
                    majorRequiredList.map(course => (
                      <label key={course} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={completedCourses.majorRequired.includes(course)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCompletedCourses(prev => ({ ...prev, majorRequired: [...prev.majorRequired, course] }));
                            } else {
                              setCompletedCourses(prev => ({ ...prev, majorRequired: prev.majorRequired.filter(c => c !== course) }));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{course}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400">전공필수 과목이 없습니다</p>
                  )}
                </div>
              )}
            </div>

            {/* 교양선택 이수 영역 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">교양선택 이수 영역</h3>
              <p className="text-xs text-gray-500 mb-2">이미 들은 영역을 체크하면 해당 영역 과목은 추천에서 제외돼요</p>
              <div className="grid grid-cols-3 gap-2">
                {AREA_OPTIONS.map(area => (
                  <button
                    key={area.value}
                    onClick={() => {
                      if (completedCourses.completedAreas.includes(area.value)) {
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
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      completedCourses.completedAreas.includes(area.value) 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {completedCourses.completedAreas.includes(area.value) ? '✓ ' : ''}{area.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 전공선택 이수 과목 */}
            <div>
              <h3 className="text-sm font-medium mb-2">전공선택 이수 과목</h3>
              <p className="text-xs text-gray-500 mb-2">이미 들은 전공선택은 모든 분반이 추천에서 제외돼요</p>
              
              {completedCourses.completedMajorElective.length > 0 && (
                <div className="space-y-2 mb-3">
                  {completedCourses.completedMajorElective.map((course, idx) => (
                    <div 
                      key={`completed-${course.course_name}-${idx}`}
                      className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div>
                        <div className="text-sm font-medium">{course.course_name}</div>
                        <div className="text-xs text-gray-500">{course.credits}학점</div>
                      </div>
                      <button 
                        onClick={() => setCompletedCourses(prev => ({
                          ...prev,
                          completedMajorElective: prev.completedMajorElective.filter(
                            c => c.course_name !== course.course_name
                          )
                        }))} 
                        className="p-1 hover:bg-green-100 rounded"
                      >
                        <X size={16} className="text-gray-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <button
                onClick={() => setIsCompletedMajorSearchOpen(true)}
                className="w-full py-2 border-2 border-dashed border-green-300 rounded-lg text-sm text-green-600 hover:bg-green-50 flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                이수한 전공선택 추가
              </button>
            </div>

            {/* ========== 복수전공 이수 현황 ========== */}
            {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
              <>
                {/* 구분선 */}
                <div className="mt-6 mb-4 flex items-center gap-3">
                  <div className="flex-1 h-px bg-indigo-200" />
                  <span className="text-xs font-semibold text-indigo-500 px-2">복수전공 ({userInfo.doubleMajor})</span>
                  <div className="flex-1 h-px bg-indigo-200" />
                </div>

                {/* 복수전공 전필 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">
                      <span className="text-indigo-500">복전</span> 전공필수 ({userInfo.doubleMajor})
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completedCourses.skipDoubleMajorRequired}
                        onChange={(e) => setCompletedCourses(prev => ({ ...prev, skipDoubleMajorRequired: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-gray-500">다 들었어요</span>
                    </label>
                  </div>
                  
                  {!completedCourses.skipDoubleMajorRequired && (
                    <div className="space-y-2 pl-2">
                      {doubleMajorRequiredList.length > 0 ? (
                        doubleMajorRequiredList.map(course => (
                          <label key={`dm-${course}`} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={completedCourses.doubleMajorRequired.includes(course)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCompletedCourses(prev => ({ ...prev, doubleMajorRequired: [...prev.doubleMajorRequired, course] }));
                                } else {
                                  setCompletedCourses(prev => ({ ...prev, doubleMajorRequired: prev.doubleMajorRequired.filter(c => c !== course) }));
                                }
                              }}
                              className="w-4 h-4 accent-indigo-500"
                            />
                            <span className="text-sm">{course}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400">복수전공 전공필수 과목이 없습니다</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 복수전공 전선 이수 과목 */}
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    <span className="text-indigo-500">복전</span> 전공선택 이수 과목
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">이미 들은 복전 전공선택은 추천에서 제외돼요</p>
                  
                  {completedCourses.completedDoubleMajorElective.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {completedCourses.completedDoubleMajorElective.map((course, idx) => (
                        <div 
                          key={`dm-completed-${course.course_name}-${idx}`}
                          className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-200 rounded-lg"
                        >
                          <div>
                            <div className="text-sm font-medium">{course.course_name}</div>
                            <div className="text-xs text-gray-500">{course.credits}학점</div>
                          </div>
                          <button 
                            onClick={() => setCompletedCourses(prev => ({
                              ...prev,
                              completedDoubleMajorElective: prev.completedDoubleMajorElective.filter(
                                c => c.course_name !== course.course_name
                              )
                            }))} 
                            className="p-1 hover:bg-indigo-100 rounded"
                          >
                            <X size={16} className="text-gray-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <button
                    onClick={() => setIsCompletedDoubleMajorSearchOpen(true)}
                    className="w-full py-2 border-2 border-dashed border-indigo-300 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    이수한 복전 전공선택 추가
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========== Step 3: 전공 선택 (2학년+) - 새로 추가! ========== */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold mb-2">🎯 전공과목 선택</h2>

            {/* ===== 학점 배분 (복수전공 전용) ===== */}
            {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
              <div className="mb-5">
                <h3 className="text-sm font-medium mb-2">📊 학점 배분</h3>
                <p className="text-xs text-gray-500 mb-3">
                  총 {userInfo.targetCredits}학점을 주전공 / 복수전공 / 교양으로 나눠주세요
                </p>
                
                <div className="space-y-3">
                  {/* 주전공 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-indigo-700">🔵 주전공 ({userInfo.major})</span>
                    <select
                      value={creditAllocation.major}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCreditAllocation(prev => ({ ...prev, major: val }));
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 text-center"
                    >
                      {Array.from({ length: userInfo.targetCredits + 1 }, (_, i) => (
                        <option key={i} value={i}>{i}학점</option>
                      ))}
                    </select>
                  </div>

                  {/* 복수전공 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-700">🟢 복수전공 ({userInfo.doubleMajor})</span>
                    <select
                      value={creditAllocation.doubleMajor}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCreditAllocation(prev => ({ ...prev, doubleMajor: val }));
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 text-center"
                    >
                      {Array.from({ length: userInfo.targetCredits + 1 }, (_, i) => (
                        <option key={i} value={i}>{i}학점</option>
                      ))}
                    </select>
                  </div>

                  {/* 교양 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-700">🟡 교양</span>
                    <select
                      value={creditAllocation.general}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCreditAllocation(prev => ({ ...prev, general: val }));
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 text-center"
                    >
                      {Array.from({ length: userInfo.targetCredits + 1 }, (_, i) => (
                        <option key={i} value={i}>{i}학점</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 합계 표시 */}
                {(() => {
                  const total = creditAllocation.major + creditAllocation.doubleMajor + creditAllocation.general;
                  const isMatch = total === userInfo.targetCredits;
                  return (
                    <div className={`mt-3 p-2.5 rounded-lg flex items-center justify-between ${isMatch ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <span className="text-sm font-medium">
                        합계: {total} / {userInfo.targetCredits}학점
                      </span>
                      {isMatch ? (
                        <span className="text-xs text-green-600 font-medium">✅ 딱 맞아요!</span>
                      ) : total > userInfo.targetCredits ? (
                        <span className="text-xs text-red-600 font-medium">❌ {total - userInfo.targetCredits}학점 초과</span>
                      ) : (
                        <span className="text-xs text-red-600 font-medium">⚠️ {userInfo.targetCredits - total}학점 부족</span>
                      )}
                    </div>
                  );
                })()}

                <p className="text-xs text-gray-400 mt-2">
                  💡 전필 + 전선 합산 학점이에요. AI가 전필 먼저 배치 후 남은 학점을 전선으로 채워요.
                </p>
              </div>
            )}

            {/* ===== 모드 선택 ===== */}
            <p className="text-sm text-gray-500 mb-3">
              전공선택 과목을 어떻게 정할까요?
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setMajorSelection(prev => ({ ...prev, mode: 'manual' }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  majorSelection.mode === 'manual' 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <BookOpen className={`mb-2 ${majorSelection.mode === 'manual' ? 'text-indigo-500' : 'text-gray-400'}`} size={24} />
                <div className="font-medium text-sm">직접 고르기</div>
                <p className="text-xs text-gray-500 mt-1">
                  듣고 싶은 전공 선택과목을 직접 골라요
                </p>
              </button>
              
              <button
                onClick={() => setMajorSelection(prev => ({ ...prev, mode: 'auto', selectedCourses: [], selectedDoubleMajorCourses: [] }))}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  majorSelection.mode === 'auto' 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Shuffle className={`mb-2 ${majorSelection.mode === 'auto' ? 'text-indigo-500' : 'text-gray-400'}`} size={24} />
                <div className="font-medium text-sm">상관없음</div>
                <p className="text-xs text-gray-500 mt-1">
                  AI가 {userInfo.grade}학년에 맞게 알아서 선택해요
                </p>
              </button>
            </div>

            {/* ===== 직접 고르기 모드 ===== */}
            {majorSelection.mode === 'manual' && (
              <div className="mt-4 space-y-5">
                {/* --- 주전공 전공과목 --- */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">
                      🔵 주전공 과목 ({majorSelection.selectedCourses.length})
                    </h3>
                    <span className="text-xs text-gray-500">
                      {userInfo.major}
                    </span>
                  </div>

                  {majorSelection.selectedCourses.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {majorSelection.selectedCourses.map(course => (
                        <div 
                          key={`${course.course_code}-${course.section}`}
                          className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-200 rounded-lg"
                        >
                          <div>
                            <div className="text-sm font-medium">{course.course_name}</div>
                            <div className="text-xs text-gray-500">
                              {course.professor} | {course.schedule_raw} | {course.credits}학점
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveMajorCourse(course)} 
                            className="p-1 hover:bg-indigo-100 rounded"
                          >
                            <X size={16} className="text-gray-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setIsMajorSearchOpen(true)}
                    className="w-full py-3 border-2 border-dashed border-indigo-300 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    {userInfo.major} 전공과목 검색
                  </button>
                </div>

                {/* --- 복전 전공과목 (복수전공일 때만) --- */}
                {userInfo.hasDoubleMajor && userInfo.doubleMajor && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">
                        🟢 복전 과목 ({majorSelection.selectedDoubleMajorCourses.length})
                      </h3>
                      <span className="text-xs text-gray-500">
                        {userInfo.doubleMajor}
                      </span>
                    </div>

                    {majorSelection.selectedDoubleMajorCourses.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {majorSelection.selectedDoubleMajorCourses.map(course => (
                          <div 
                            key={`dm-${course.course_code}-${course.section}`}
                            className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg"
                          >
                            <div>
                              <div className="text-sm font-medium">{course.course_name}</div>
                              <div className="text-xs text-gray-500">
                                {course.professor} | {course.schedule_raw} | {course.credits}학점
                              </div>
                            </div>
                            <button 
                              onClick={() => handleRemoveDoubleMajorCourse(course)} 
                              className="p-1 hover:bg-emerald-100 rounded"
                            >
                              <X size={16} className="text-gray-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setIsDoubleMajorSearchOpen(true)}
                      className="w-full py-3 border-2 border-dashed border-emerald-300 rounded-lg text-sm text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-2"
                    >
                      <Plus size={18} />
                      {userInfo.doubleMajor} 복전 과목 검색
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  💡 여기서 선택한 과목들이 시간표에 우선 배치됩니다
                </p>
              </div>
            )}

            {/* ===== 상관없음 모드 ===== */}
            {majorSelection.mode === 'auto' && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  🤖 AI가 <strong>{userInfo.grade}학년</strong>에 적합한 전공과목을 자동으로 선택합니다.
                </p>
                <ul className="mt-2 text-xs text-gray-500 space-y-1">
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
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold mb-4">⭐ 선호도</h2>
            
            <div className="space-y-4">
              {/* 교양 옵션 (2학년+) */}
              {userInfo.grade >= 2 && (
                <div>
                  <label className="block text-sm font-medium mb-2">교양 수강</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreferences(prev => ({ ...prev, skipGeneral: false }))}
                      className={`flex-1 py-2 rounded-lg text-sm ${!preferences.skipGeneral ? 'bg-indigo-500 text-white' : 'bg-gray-100'}`}
                    >
                      영역 선택
                    </button>
                    <button
                      onClick={() => setPreferences(prev => ({ ...prev, skipGeneral: true, preferredAreas: [] }))}
                      className={`flex-1 py-2 rounded-lg text-sm ${preferences.skipGeneral ? 'bg-indigo-500 text-white' : 'bg-gray-100'}`}
                    >
                      교양 안 듣기 🚫
                    </button>
                  </div>
                </div>
              )}

              {/* 교양 영역 */}
              {!preferences.skipGeneral && (
                <div>
                  <label className="block text-sm font-medium mb-2">듣고 싶은 교양 영역</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AREA_OPTIONS.map(area => (
                      <button
                        key={area.value}
                        onClick={() => {
                          if (preferences.preferredAreas.includes(area.value)) {
                            setPreferences(prev => ({ ...prev, preferredAreas: prev.preferredAreas.filter(a => a !== area.value) }));
                          } else {
                            setPreferences(prev => ({ ...prev, preferredAreas: [...prev.preferredAreas, area.value] }));
                          }
                        }}
                        className={`py-2 rounded-lg text-xs ${preferences.preferredAreas.includes(area.value) ? 'bg-indigo-500 text-white' : 'bg-gray-100'}`}
                      >
                        {area.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">공강 원하는 요일</label>
                <div className="flex gap-2">
                  {['월', '화', '수', '목', '금'].map(day => (
                    <button
                      key={day}
                      onClick={() => {
                        if (preferences.emptyDays.includes(day)) {
                          setPreferences(prev => ({ ...prev, emptyDays: prev.emptyDays.filter(d => d !== day) }));
                        } else {
                          setPreferences(prev => ({ ...prev, emptyDays: [...prev.emptyDays, day] }));
                        }
                      }}
                      className={`w-10 h-10 rounded-full text-sm font-medium ${preferences.emptyDays.includes(day) ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">아침 수업 (9시 30분)</label>
                <div className="flex gap-2">
                  <button onClick={() => setPreferences(prev => ({ ...prev, noMorning: false }))} className={`flex-1 py-2 rounded-lg text-sm ${!preferences.noMorning ? 'bg-indigo-500 text-white' : 'bg-gray-100'}`}>괜찮음</button>
                  <button onClick={() => setPreferences(prev => ({ ...prev, noMorning: true }))} className={`flex-1 py-2 rounded-lg text-sm ${preferences.noMorning ? 'bg-indigo-500 text-white' : 'bg-gray-100'}`}>싫음 😴</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">연강</label>
                <div className="flex gap-2">
                  {['좋음', '싫음', '상관없음'].map(opt => (
                    <button key={opt} onClick={() => setPreferences(prev => ({ ...prev, consecutive: opt }))} className={`flex-1 py-2 rounded-lg text-sm ${preferences.consecutive === opt ? 'bg-indigo-500 text-white' : 'bg-gray-100'}`}>{opt}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">선호 시간대</label>
                <div className="flex gap-2">
                  {['오전', '오후', '상관없음'].map(opt => (
                    <button key={opt} onClick={() => setPreferences(prev => ({ ...prev, preferredTime: opt }))} className={`flex-1 py-2 rounded-lg text-sm ${preferences.preferredTime === opt ? 'bg-indigo-500 text-white' : 'bg-gray-100'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== Step 5: 추가 설정 ========== */}
        {step === 5 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold mb-2">➕ 추가 설정</h2>
            <p className="text-sm text-gray-500 mb-4">선택사항이에요</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">⭐ 꼭 듣고 싶은 과목</label>
                <p className="text-xs text-gray-500 mb-2">전공/교양 관계없이 꼭 넣고 싶은 과목</p>
                
                {mustTakeCourses.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {mustTakeCourses.map(course => (
                      <div 
                        key={`${course.course_code}-${course.section}`}
                        className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div>
                          <div className="text-sm font-medium">{course.course_name}</div>
                          <div className="text-xs text-gray-500">{course.professor} | {course.schedule_raw}</div>
                        </div>
                        <button onClick={() => handleRemoveMustTake(course)} className="p-1 hover:bg-yellow-100 rounded">
                          <X size={16} className="text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => setIsCourseSearchOpen(true)}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  과목 검색하여 추가
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">🚫 듣기 싫은 과목</label>
                <p className="text-xs text-gray-500 mb-2">이 과목은 모든 분반이 추천에서 제외돼요</p>
                
                {avoidCourses.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {avoidCourses.map((course, idx) => (
                      <div 
                        key={`avoid-${course.course_name}-${idx}`}
                        className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <div>
                          <div className="text-sm font-medium">{course.course_name}</div>
                          {course.professor && (
                            <div className="text-xs text-gray-500">{course.professor}</div>
                          )}
                        </div>
                        <button 
                          onClick={() => setAvoidCourses(prev => prev.filter(
                            c => c.course_name !== course.course_name
                          ))} 
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <X size={16} className="text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => setIsAvoidSearchOpen(true)}
                  className="w-full py-2 border-2 border-dashed border-red-300 rounded-lg text-sm text-red-500 hover:bg-red-50 flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  듣기 싫은 과목 추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== Step 6: 결과 ========== */}
        {step === 6 && result && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
              <h2 className="text-lg font-bold mb-2">✨ AI 추천 시간표</h2>
              <div className="flex gap-4">
                <div><span className="text-2xl font-bold">{result.total_credits}</span><span className="text-sm opacity-80">학점</span></div>
                <div><span className="text-2xl font-bold">{result.selected_courses?.length || 0}</span><span className="text-sm opacity-80">과목</span></div>
                {result.empty_days?.length > 0 && (
                  <div><span className="text-2xl font-bold">{result.empty_days.join(', ')}</span><span className="text-sm opacity-80">공강</span></div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2">📅 시간표 미리보기</h3>
              <SchedulePreview courses={result.selected_courses || []} />
            </div>

            {result.warnings?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-700 font-medium text-sm mb-1">
                  <AlertTriangle size={16} />주의사항
                </div>
                <ul className="text-sm text-yellow-600 space-y-1">
                  {result.warnings.map((w, i) => (<li key={i}>• {w}</li>))}
                </ul>
              </div>
            )}

            {/* 시간 충돌 경고 (프론트엔드 검사) */}
            {timeConflicts.length > 0 && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                  <AlertTriangle size={18} />⚠️ 시간 충돌 발견!
                </div>
                <p className="text-xs text-red-600 mb-2">
                  AI가 실수로 시간이 겹치는 과목을 추천했습니다. 다시 만들기를 권장합니다.
                </p>
                <ul className="text-sm text-red-600 space-y-1">
                  {timeConflicts.map((conflict, i) => (
                    <li key={i}>• {conflict.day}요일: <strong>{conflict.course1}</strong> ↔ <strong>{conflict.course2}</strong> 시간 겹침</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold mb-3">📚 추천 과목</h3>
              <div className="space-y-2">
                {result.selected_courses?.map((course, idx) => (
                  <div key={idx} onClick={() => setSelectedResultCourse(course)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{course.course_name}</div>
                        <div className="text-xs text-gray-500">{course.professor} | {course.schedule_raw} | {course.credits}학점</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-medium shrink-0 ${
                        course.category?.includes('필수')
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {course.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h3 className="font-bold text-indigo-800 mb-2">📝 AI 총평</h3>
              <p className="text-sm text-indigo-700">{result.summary}</p>
            </div>

            {/* 수정 버튼 영역 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 text-sm mb-3">✏️ 시간표 수정</h3>

              {isModifying ? (
                <div className="flex items-center justify-center gap-2 py-3 text-indigo-600">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-sm">AI가 시간표를 수정하고 있어요...</span>
                </div>
              ) : showDayPicker ? (
                /* 요일 선택 */
                <div>
                  <p className="text-xs text-gray-500 mb-2">공강 만들 요일을 선택하세요</p>
                  {(() => {
                    const emptyDays = result.empty_days || [];
                    const allEmpty = emptyDays.length >= 4;
                    return (
                      <>
                        <div className="flex gap-1.5 mb-2">
                          {['월', '화', '수', '목', '금'].map(day => {
                            const alreadyEmpty = emptyDays.includes(day);
                            const isLastActive = allEmpty && !alreadyEmpty;
                            const disabled = alreadyEmpty || isLastActive;
                            return (
                              <button key={day} onClick={() => !disabled && handleModify('EMPTY_DAY', { day })}
                                disabled={disabled}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-0.5 transition-colors
                                  ${alreadyEmpty ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                                    isLastActive ? 'bg-orange-50 text-orange-400 cursor-not-allowed' :
                                    'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}>
                                {day}
                                {alreadyEmpty && <span className="text-[9px] leading-none">이미 공강</span>}
                              </button>
                            );
                          })}
                          <button onClick={() => setShowDayPicker(false)} className="px-1.5 text-gray-400 hover:text-gray-600">
                            <X size={16} />
                          </button>
                        </div>
                        {allEmpty && (
                          <p className="text-xs text-orange-500">⚠️ 최소 1일은 수업이 있어야 해요</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                /* 기본 버튼 */
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => { setShowDayPicker(true); setShowMore(false); }} disabled={isModifying}
                      className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium disabled:opacity-50">
                      🗓️ 공강 만들기
                    </button>
                    <button onClick={() => { setShowMore(v => !v); setShowDayPicker(false); }} disabled={isModifying}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50">
                      {showMore ? '접기 ▲' : '더보기 ▼'}
                    </button>
                  </div>

                  {showMore && (
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      {[
                        { type: 'NO_EARLY_MORNING', label: '⏰ 9시 30분 수업 빼줘' },
                        { type: 'ADD_MAJOR',         label: '📚 전공 더 넣어줘' },
                        { type: 'REDUCE_GENERAL',    label: '🎓 교양 줄여줘' },
                        { type: 'REDUCE_CREDITS',    label: '➖ 학점 줄여줘' },
                        { type: 'INCREASE_CREDITS',  label: '➕ 학점 늘려줘' },
                      ].map(({ type, label }) => (
                        <button key={type} onClick={() => handleModify(type, {})} disabled={isModifying}
                          className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium disabled:opacity-50 text-left px-4">
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {history.length > 0 && (
                    <button onClick={handleUndo}
                      className="w-full py-2 text-sm text-indigo-500 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                      ↩ 이전으로 되돌리기 ({history.length}단계)
                    </button>
                  )}
                </div>
              )}
            </div>

            {logId && <AiFeedback logId={logId} />}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium">다시 만들기</button>
              <button onClick={handleReplaceSchedule} className="flex-1 py-3 bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <Plus size={18} />이 시간표로 교체
              </button>
            </div>
          </div>
        )}

        {/* 수정 에러 토스트 */}
        {modifyError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 max-w-sm w-full mx-4">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="text-sm">{modifyError}</span>
          </div>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 text-center">
              <Loader2 className="animate-spin mx-auto mb-3 text-indigo-500" size={40} />
              <p className="font-medium">AI가 시간표를 만들고 있어요...</p>
              <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요 🪄</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* 네비게이션 버튼 */}
        {step <= 5 && (
          <div className="flex gap-2 mt-4">
            {displayStep > 1 && (
              <button onClick={handlePrev} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium flex items-center justify-center gap-1">
                <ChevronLeft size={18} />이전
              </button>
            )}
            {displayStep < stepConfig.totalSteps ? (
              <button onClick={handleNext} className="flex-1 py-3 bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-1">
                다음<ChevronRight size={18} />
              </button>
            ) : (
              <button onClick={handleGenerate} disabled={isLoading} className="flex-1 py-3 bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <Wand2 size={18} />시간표 생성하기
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