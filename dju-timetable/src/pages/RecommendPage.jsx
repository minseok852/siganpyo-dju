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
import { recommendSchedule } from '../services/aiService';
import { COLLEGES, COURSE_COLORS } from '../data/constants';

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
  });
  const [isCompletedMajorSearchOpen, setIsCompletedMajorSearchOpen] = useState(false);  // 전공선택 이수과목 검색 모달
  
  // ========== Step 3: 전공 선택 (2학년+) - 새로 추가! ==========
  const [majorSelection, setMajorSelection] = useState({
    mode: 'auto',  // 'manual' | 'auto'
    selectedCourses: [],  // 직접 선택한 전공과목
  });
  const [isMajorSearchOpen, setIsMajorSearchOpen] = useState(false);
  
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
  const [loadingCourses, setLoadingCourses] = useState(false);
  
  // 결과
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [timeConflicts, setTimeConflicts] = useState([]);

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

  // 학과 변경시 전공 선택 초기화
  useEffect(() => {
    setMajorSelection({ mode: 'auto', selectedCourses: [] });
  }, [userInfo.major]);

  const filteredColleges = COLLEGES.filter(c => 
    c !== '전체' && c !== '융합전공' && c !== '상생교양대학'
  );

  // 다음 버튼
  const handleNext = () => {
    if (step === 1 && !userInfo.major) {
      alert('전공을 선택해주세요!');
      return;
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

  // 시간표 생성
  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const availableCourses = await filterAvailableCourses();
      
      const response = await recommendSchedule({
        grade: userInfo.grade,
        major: userInfo.major,
        double_major: userInfo.hasDoubleMajor ? userInfo.doubleMajor : null,
        target_credits: userInfo.targetCredits,
        completed_general_required: completedCourses.skipGeneralRequired ? [] : completedCourses.generalRequired,
        completed_major_required: completedCourses.skipMajorRequired ? [] : completedCourses.majorRequired,
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
    let generalRequired = [];
    let generalElective = [];

    // 교양 안 듣기가 아니면 교양 과목 로드
    if (!preferences.skipGeneral) {
      const grResults = await searchCourses({ category: 'general_required', limit: 100 });
      // ✅ 부분 일치로 변경 (띄어쓰기/오타 문제 방지)
      generalRequired = grResults.filter(c => 
        completedCourses.skipGeneralRequired || !isNameMatched(c.course_name, completedCourses.generalRequired)
      );

      // 교양선택: 선호 영역 + 이수 완료 영역 제외
      const areasToSearch = preferences.preferredAreas.length > 0 
        ? preferences.preferredAreas 
        : AREA_OPTIONS.map(a => a.value);
      
      // 이수 완료 영역 제외
      const areasFiltered = areasToSearch.filter(
        area => !completedCourses.completedAreas.includes(area)
      );
      
      if (areasFiltered.length > 0) {
        let tempElective = [];
        for (const area of areasFiltered) {
          const areaResults = await searchCourses({ category: 'general_elective', area, limit: 50 });
          tempElective = [...tempElective, ...areaResults];
        }
        generalElective = tempElective;
      }
    }

    // 전공필수 (해당 학과만!)
    const mrResults = await searchCourses({ 
      category: 'major', 
      department: userInfo.major, 
      classification: '전필',
      limit: 50 
    });
    // ✅ 부분 일치로 변경 + 학년 필터링: target_year <= grade
    const majorRequired = mrResults.filter(c =>
      (completedCourses.skipMajorRequired || !isNameMatched(c.course_name, completedCourses.majorRequired)) &&
      (c.target_year === 0 || c.target_year <= grade)
    );

    // 전공선택 (해당 학과만!)
    const meResults = await searchCourses({ 
      category: 'major', 
      department: userInfo.major, 
      classification: '전선',
      limit: 50 
    });
    
    // 학년 필터링 + 이수 완료 과목 제외
    const completedMajorNames = completedCourses.completedMajorElective.map(c => c.course_name);
    const majorElective = meResults.filter(c =>
      (c.target_year === 0 || c.target_year <= grade) &&
      !isNameMatched(c.course_name, completedMajorNames)
    );

    // 듣기 싫은 과목명 목록
    const avoidCourseNames = avoidCourses.map(c => c.course_name);

    // 모든 결과에서 듣기 싫은 과목 제외 (부분 일치)
    const filterAvoid = (courses) => courses.filter(c => !isNameMatched(c.course_name, avoidCourseNames));

    return {
      general_required: filterAvoid(generalRequired).slice(0, 20),
      major_required: filterAvoid(majorRequired).slice(0, 20),
      major_elective: filterAvoid(majorElective).slice(0, 30),
      general_elective: filterAvoid(generalElective).slice(0, 30),
    };
  };

  // schedule_raw를 times 배열로 변환
  const parseScheduleToTimes = (scheduleRaw) => {
    if (!scheduleRaw) return [];
    const times = [];
    
    // 다양한 형식 처리: "월10:00-11:30, 수10:00-11:30" 또는 "월1,2,3 수1,2,3"
    // 쉼표로 먼저 분리, 그 다음 각 부분에서 요일+시간 파싱
    const segments = scheduleRaw.split(',').map(s => s.trim());
    
    for (const segment of segments) {
      // 공백으로 추가 분리 (여러 요일이 공백으로 구분된 경우)
      const parts = segment.split(/\s+/).filter(p => p.trim());
      
      for (const part of parts) {
        // "화10:00-11:30" 형식
        const timeMatch = part.match(/^(월|화|수|목|금)(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const [, day, startH, startM, endH, endM] = timeMatch;
          times.push({
            day,
            start: `${startH.padStart(2, '0')}:${startM}`,
            end: `${endH.padStart(2, '0')}:${endM}`,
          });
          continue;
        }
        
        // "월1,2,3" 형식 (교시) - 이 경우는 segment 단위로 처리됨
        const periodMatch = part.match(/^(월|화|수|목|금)([\d,]+)$/);
        if (periodMatch) {
          const [, day, periodsStr] = periodMatch;
          const periods = periodsStr.split(',').map(p => parseInt(p)).filter(p => !isNaN(p));
          if (periods.length > 0) {
            const minPeriod = Math.min(...periods);
            const maxPeriod = Math.max(...periods);
            const startHour = 8 + minPeriod;
            const endHour = 8 + maxPeriod + 1;
            times.push({
              day,
              start: `${startHour.toString().padStart(2, '0')}:00`,
              end: `${endHour.toString().padStart(2, '0')}:00`,
            });
          }
        }
      }
    }
    
    return times;
  };

  // 시간표 선택 모달 열기
  const handleReplaceSchedule = () => {
    if (!result) return;
    setIsScheduleSelectOpen(true);
  };

  // 실제로 특정 시간표에 저장
  const handleSaveToSchedule = (scheduleId) => {
    if (!result) return;
    
    // 새 시간표 데이터 준비
    const newCourses = result.selected_courses.map(course => {
      const times = parseScheduleToTimes(course.schedule_raw);
      
      return {
        course_code: course.course_code || `AI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        section: course.section || '01',
        course_name: course.course_name || '과목명 없음',
        professor: course.professor || '미정',
        credits: course.credits || 3,
        schedule_raw: course.schedule_raw || '',
        times: times,
        room: course.room || '',
        category: course.category || '전공선택',
        classification: course.category || '전선',
        college: course.college || '',
        department: course.department || '',
      };
    });
    
    // colorMap 생성
    const newColorMap = {};
    newCourses.forEach((course, idx) => {
      const key = `${course.course_code}-${course.section}`;
      newColorMap[key] = idx % COURSE_COLORS.length;
    });
    
    // 기존 시간표 데이터 로드
    let savedData = { schedules: [], activeId: 1 };
    try {
      const existing = localStorage.getItem('dju_my_schedules');
      if (existing) {
        savedData = JSON.parse(existing);
      } else {
        // 기존 단일 시간표 마이그레이션
        const oldData = localStorage.getItem('dju_my_schedule');
        if (oldData) {
          const parsed = JSON.parse(oldData);
          savedData = {
            schedules: [{
              id: 1,
              name: '시간표 1',
              courses: parsed.courses || [],
              colorMap: parsed.colorMap || {},
            }],
            activeId: 1,
          };
        } else {
          // 완전 새로 시작
          savedData = {
            schedules: [{
              id: 1,
              name: '시간표 1',
              courses: [],
              colorMap: {},
            }],
            activeId: 1,
          };
        }
      }
    } catch (e) {
      console.error('localStorage 로드 실패:', e);
    }
    
    // 해당 시간표에 저장
    const updatedSchedules = savedData.schedules.map(s => {
      if (s.id === scheduleId) {
        return {
          ...s,
          courses: newCourses,
          colorMap: newColorMap,
        };
      }
      return s;
    });
    
    // localStorage에 직접 저장
    const dataToSave = {
      schedules: updatedSchedules,
      activeId: scheduleId,
    };
    
    console.log('🔥 저장할 데이터:', JSON.stringify(dataToSave, null, 2));
    localStorage.setItem('dju_my_schedules', JSON.stringify(dataToSave));
    
    // 저장 확인
    const saved = localStorage.getItem('dju_my_schedules');
    console.log('✅ 저장된 데이터:', saved);
    
    console.log('✅ AI 시간표 저장 완료:', newCourses.length, '과목 → 시간표 ID:', scheduleId);
    
    // 홈으로 이동 (새로고침으로 localStorage 반영)
    window.location.href = '/';
  };

  // 새 시간표 생성 후 저장
  const handleSaveToNewSchedule = () => {
    if (!result) return;
    
    // 기존 데이터 로드
    let savedData = { schedules: [], activeId: 1 };
    try {
      const existing = localStorage.getItem('dju_my_schedules');
      if (existing) {
        savedData = JSON.parse(existing);
      } else {
        savedData = {
          schedules: [{
            id: 1,
            name: '시간표 1',
            courses: [],
            colorMap: {},
          }],
          activeId: 1,
        };
      }
    } catch (e) {
      console.error('localStorage 로드 실패:', e);
    }
    
    // 최대 3개 체크
    if (savedData.schedules.length >= 3) {
      alert('최대 3개까지만 만들 수 있어요');
      return;
    }
    
    // 새 시간표 ID 생성
    const newId = Math.max(...savedData.schedules.map(s => s.id), 0) + 1;
    const defaultNames = ['시간표 1', '시간표 2', '시간표 3'];
    const newName = defaultNames[savedData.schedules.length] || `시간표 ${newId}`;
    
    // 새 빈 시간표 추가
    savedData.schedules.push({
      id: newId,
      name: newName,
      courses: [],
      colorMap: {},
    });
    
    // localStorage 저장 (새 시간표 생성)
    localStorage.setItem('dju_my_schedules', JSON.stringify(savedData));
    
    // 새 시간표에 AI 결과 저장
    handleSaveToSchedule(newId);
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
          </div>
        )}

        {/* ========== Step 3: 전공 선택 (2학년+) - 새로 추가! ========== */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold mb-2">🎯 전공과목 선택</h2>
            <p className="text-sm text-gray-500 mb-4">
              전공선택 과목을 어떻게 정할까요?
            </p>

            {/* 모드 선택 */}
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
                onClick={() => setMajorSelection(prev => ({ ...prev, mode: 'auto', selectedCourses: [] }))}
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

            {/* 직접 고르기 모드 */}
            {majorSelection.mode === 'manual' && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">
                    선택한 전공과목 ({majorSelection.selectedCourses.length})
                  </h3>
                  <span className="text-xs text-gray-500">
                    {userInfo.major} 학과
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

                <p className="text-xs text-gray-400 mt-2">
                  💡 여기서 선택한 과목들이 시간표에 우선 배치됩니다
                </p>
              </div>
            )}

            {/* 상관없음 모드 */}
            {majorSelection.mode === 'auto' && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  🤖 AI가 <strong>{userInfo.grade}학년</strong>에 적합한 전공과목을 자동으로 선택합니다.
                </p>
                <ul className="mt-2 text-xs text-gray-500 space-y-1">
                  <li>• 전공필수 과목 우선 배치</li>
                  <li>• {userInfo.grade}학년 대상 과목 위주 선택</li>
                  <li>• {userInfo.major} 학과 과목만 선택</li>
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
                  <div key={idx} className="p-3 border rounded-lg">
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

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium">다시 만들기</button>
              <button onClick={handleReplaceSchedule} className="flex-1 py-3 bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <Plus size={18} />이 시간표로 교체
              </button>
            </div>
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
    </div>
  );
}