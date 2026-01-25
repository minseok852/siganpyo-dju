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
  Search
} from 'lucide-react';
import { useCourses } from '../hooks/useCourses';
import { useSchedule } from '../hooks/useSchedule';
import { recommendSchedule } from '../services/aiService';
import { COLLEGES } from '../data/constants';

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
  const HOURS = Array.from({ length: 12 }, (_, i) => i + 9);
  
  const COLORS = [
    { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
    { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
    { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
    { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800' },
    { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
    { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800' },
    { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800' },
    { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800' },
  ];

  const courseColors = {};
  courses.forEach((course, idx) => {
    courseColors[course.course_name] = COLORS[idx % COLORS.length];
  });

  const parseSchedule = (scheduleRaw) => {
    if (!scheduleRaw) return [];
    const result = [];
    const parts = scheduleRaw.split(' ');
    parts.forEach(part => {
      const dayMatch = part.match(/^(월|화|수|목|금)/);
      if (dayMatch) {
        const day = dayMatch[1];
        const periodsStr = part.slice(1);
        const periods = periodsStr.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        if (periods.length > 0) {
          result.push({ day, periods });
        }
      }
    });
    return result;
  };

  const periodToTime = (period) => {
    const hour = 8 + period;
    return { start: hour, end: hour + 1 };
  };

  const getBlocksForDay = (day) => {
    const blocks = [];
    courses.forEach(course => {
      const schedules = parseSchedule(course.schedule_raw);
      schedules.forEach(schedule => {
        if (schedule.day === day && schedule.periods.length > 0) {
          const startPeriod = Math.min(...schedule.periods);
          const endPeriod = Math.max(...schedule.periods);
          const startTime = periodToTime(startPeriod);
          const endTime = periodToTime(endPeriod);
          blocks.push({
            course,
            startHour: startTime.start,
            endHour: endTime.end,
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
          <div className="grid grid-cols-6 border-b">
            <div className="p-2 text-center text-xs font-medium text-gray-500 bg-gray-50">시간</div>
            {DAYS.map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-gray-700 bg-gray-50">{day}</div>
            ))}
          </div>
          <div className="relative">
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-6 border-b" style={{ height: '40px' }}>
                <div className="p-1 text-[10px] text-gray-400 text-center border-r bg-gray-50">{hour}:00</div>
                {DAYS.map(day => (<div key={day} className="border-r relative" />))}
              </div>
            ))}
            {DAYS.map((day, dayIdx) => {
              const blocks = getBlocksForDay(day);
              return blocks.map((block, blockIdx) => {
                const top = (block.startHour - 9) * 40;
                const height = (block.endHour - block.startHour) * 40;
                const left = `calc(${(dayIdx + 1) * (100/6)}% + 2px)`;
                const width = `calc(${100/6}% - 4px)`;
                return (
                  <div
                    key={`${day}-${blockIdx}`}
                    className={`absolute rounded p-1 ${block.color.bg} ${block.color.border} border overflow-hidden`}
                    style={{ top: `${top}px`, height: `${height}px`, left, width }}
                  >
                    <div className={`text-[10px] font-medium ${block.color.text} truncate`}>{block.course.course_name}</div>
                    <div className="text-[9px] text-gray-500 truncate">{block.course.professor}</div>
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

// 과목 검색 모달
function CourseSearchModal({ isOpen, onClose, onSelect, currentSelections }) {
  const [searchTerm, setSearchTerm] = useState('');
  const { searchCourses, loading } = useCourses();
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    async function doSearch() {
      if (isOpen && searchTerm.length >= 2) {
        const results = await searchCourses({ searchTerm, limit: 50 });
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }
    doSearch();
  }, [searchTerm, isOpen, searchCourses]);

  if (!isOpen) return null;

  const isSelected = (course) => {
    return currentSelections.some(c => 
      c.course_code === course.course_code && c.section === course.section
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold">꼭 듣고 싶은 과목 검색</h2>
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
              placeholder="과목명, 교수명 검색 (2글자 이상)"
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {searchTerm.length < 2 ? '2글자 이상 입력해주세요' : '검색 결과가 없습니다'}
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
                        ? 'bg-gray-100 border-gray-300 opacity-50' 
                        : 'hover:bg-blue-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{course.course_name}</div>
                        <div className="text-xs text-gray-500">
                          {course.professor} | {course.schedule_raw} | {course.credits}학점
                        </div>
                      </div>
                      {selected && <span className="text-xs text-gray-500">선택됨</span>}
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
  const { addCourse } = useSchedule();
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: 기본 정보
  const [userInfo, setUserInfo] = useState({
    grade: 1,
    college: '',
    major: '',
    hasDoubleMajor: false,
    doubleMajorCollege: '',
    doubleMajor: '',
    targetCredits: 18,
  });
  
  // Step 2: 이수 현황 (2학년+)
  const [completedCourses, setCompletedCourses] = useState({
    generalRequired: [],
    majorRequired: [],
    skipGeneralRequired: false,
    skipMajorRequired: false,
  });
  
  // Step 3: 선호도
  const [preferences, setPreferences] = useState({
    emptyDays: [],
    noMorning: false,
    consecutive: '상관없음',
    preferredTime: '상관없음',
    preferredAreas: [],
    skipGeneral: false,
  });
  
  // Step 4: 추가
  const [mustTakeCourses, setMustTakeCourses] = useState([]);
  const [avoidCourses, setAvoidCourses] = useState('');
  const [isCourseSearchOpen, setIsCourseSearchOpen] = useState(false);
  
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
      // Firebase에서 못 가져오면 기본값 사용
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

  const filteredColleges = COLLEGES.filter(c => 
    c !== '전체' && c !== '융합전공' && c !== '상생교양대학'
  );

  const handleNext = () => {
    if (step === 1 && !userInfo.major) {
      alert('전공을 선택해주세요!');
      return;
    }
    if (step < 4) {
      if (step === 1 && userInfo.grade === 1) {
        setStep(3);
      } else {
        setStep(step + 1);
      }
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      if (step === 3 && userInfo.grade === 1) {
        setStep(1);
      } else {
        setStep(step - 1);
      }
    }
  };

  const handleAddMustTake = (course) => {
    setMustTakeCourses(prev => [...prev, course]);
    setIsCourseSearchOpen(false);
  };

  const handleRemoveMustTake = (course) => {
    setMustTakeCourses(prev => 
      prev.filter(c => !(c.course_code === course.course_code && c.section === course.section))
    );
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
          must_take_courses: mustTakeCourses.map(c => ({
            course_name: c.course_name,
            course_code: c.course_code,
            section: c.section,
            professor: c.professor,
            schedule_raw: c.schedule_raw,
            credits: c.credits,
          })),
          avoid_courses: avoidCourses,
        }
      }, availableCourses);

      if (response.success) {
        setResult(response);
        setStep(5);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 프론트에서 과목 필터링
  const filterAvailableCourses = async () => {
    let generalRequired = [];
    let generalElective = [];

    // 교양 안 듣기가 아니면 교양 과목 로드
    if (!preferences.skipGeneral) {
      // 교양필수
      const grResults = await searchCourses({ category: 'general_required', limit: 100 });
      generalRequired = grResults.filter(c => 
        completedCourses.skipGeneralRequired || !completedCourses.generalRequired.includes(c.course_name)
      );

      // 교양선택
      if (preferences.preferredAreas.length > 0) {
        let tempElective = [];
        for (const area of preferences.preferredAreas) {
          const areaResults = await searchCourses({ category: 'general_elective', area, limit: 50 });
          tempElective = [...tempElective, ...areaResults];
        }
        generalElective = tempElective;
      } else {
        generalElective = await searchCourses({ category: 'general_elective', limit: 50 });
      }
    }

    // 전공필수
    const mrResults = await searchCourses({ 
      category: 'major', 
      department: userInfo.major, 
      classification: '전필',
      limit: 50 
    });
    const majorRequired = mrResults.filter(c =>
      completedCourses.skipMajorRequired || !completedCourses.majorRequired.includes(c.course_name)
    );

    // 전공선택
    const majorElective = await searchCourses({ 
      category: 'major', 
      department: userInfo.major, 
      classification: '전선',
      limit: 50 
    });

    return {
      general_required: generalRequired.slice(0, 20),
      major_required: majorRequired.slice(0, 20),
      major_elective: majorElective.slice(0, 30),
      general_elective: generalElective.slice(0, 30),
    };
  };

  const handleAddAll = () => {
    if (!result) return;
    result.selected_courses.forEach(course => {
      addCourse({ ...course, times: [] });
    });
    navigate('/');
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
        {step < 5 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Step {step}/4</span>
              <span>{['기본 정보', '이수 현황', '선호도', '추가 설정'][step - 1]}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Step 1: 기본 정보 */}
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
                <label className="block text-sm font-medium mb-1">목표 학점: <strong>{userInfo.targetCredits}</strong>학점</label>
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

        {/* Step 2: 이수 현황 (2학년+) */}
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
            <div>
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
          </div>
        )}

        {/* Step 3: 선호도 */}
        {step === 3 && (
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
                <label className="block text-sm font-medium mb-2">아침 수업 (9시)</label>
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

        {/* Step 4: 추가 */}
        {step === 4 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold mb-2">➕ 추가 설정</h2>
            <p className="text-sm text-gray-500 mb-4">선택사항이에요</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">⭐ 꼭 듣고 싶은 과목</label>
                <p className="text-xs text-gray-500 mb-2">AI가 이 과목들을 최우선으로 배치해요</p>
                
                {mustTakeCourses.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {mustTakeCourses.map(course => (
                      <div 
                        key={`${course.course_code}-${course.section}`}
                        className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-200 rounded-lg"
                      >
                        <div>
                          <div className="text-sm font-medium">{course.course_name}</div>
                          <div className="text-xs text-gray-500">{course.professor} | {course.schedule_raw}</div>
                        </div>
                        <button onClick={() => handleRemoveMustTake(course)} className="p-1 hover:bg-indigo-100 rounded">
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
                <label className="block text-sm font-medium mb-1">피하고 싶은 과목/교수</label>
                <textarea
                  value={avoidCourses}
                  onChange={(e) => setAvoidCourses(e.target.value)}
                  placeholder="예: 홍길동 교수, 미적분학"
                  className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: 결과 */}
        {step === 5 && result && (
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

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold mb-3">📚 추천 과목</h3>
              <div className="space-y-2">
                {result.selected_courses?.map((course, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{course.course_name}</div>
                        <div className="text-xs text-gray-500">{course.professor} | {course.schedule_raw} | {course.credits}학점</div>
                        <div className="text-xs text-indigo-600 mt-1">💡 {course.reason}</div>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{course.category}</span>
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
              <button onClick={handleAddAll} className="flex-1 py-3 bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <Plus size={18} />전체 추가
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
        {step < 5 && (
          <div className="flex gap-2 mt-4">
            {step > 1 && (
              <button onClick={handlePrev} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium flex items-center justify-center gap-1">
                <ChevronLeft size={18} />이전
              </button>
            )}
            {step < 4 ? (
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

      {/* 과목 검색 모달 */}
      <CourseSearchModal
        isOpen={isCourseSearchOpen}
        onClose={() => setIsCourseSearchOpen(false)}
        onSelect={handleAddMustTake}
        currentSelections={mustTakeCourses}
      />
    </div>
  );
}