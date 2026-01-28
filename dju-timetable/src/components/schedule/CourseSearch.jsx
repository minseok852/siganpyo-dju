// src/components/schedule/CourseSearch.jsx
import { useState, useEffect, useCallback } from 'react';
import { Search, X, Plus, AlertCircle, Filter, Info, Clock } from 'lucide-react';
import { useCourses } from '../../hooks/useCourses';
import { checkScheduleConflict } from '../../utils/timeUtils';
import { 
  CATEGORY_OPTIONS, 
  YEAR_OPTIONS, 
  AREA_OPTIONS,
  CLASSIFICATION_OPTIONS,
  COLLEGES,
  CATEGORY_LABELS 
} from '../../data/constants';
import CourseDetail from './CourseDetail';

// 요일 옵션
const DAY_OPTIONS = [
  { value: '', label: '전체' },
  { value: '월', label: '월요일' },
  { value: '화', label: '화요일' },
  { value: '수', label: '수요일' },
  { value: '목', label: '목요일' },
  { value: '금', label: '금요일' },
];

// 시작 시간 옵션 (30분 단위)
const TIME_OPTIONS = [
  { value: '', label: '전체 시간' },
  { value: '9:30', label: '9시 30분' },
  { value: '10:00', label: '10시' },
  { value: '10:30', label: '10시 30분' },
  { value: '11:00', label: '11시' },
  { value: '11:30', label: '11시 30분' },
  { value: '12:00', label: '12시' },
  { value: '12:30', label: '12시 30분' },
  { value: '13:00', label: '1시' },
  { value: '13:30', label: '1시 30분' },
  { value: '14:00', label: '2시' },
  { value: '14:30', label: '2시 30분' },
  { value: '15:00', label: '3시' },
  { value: '15:30', label: '3시 30분' },
];

export default function CourseSearch({ 
  isOpen, 
  onClose, 
  onAddCourse, 
  currentCourses 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    targetYear: 0,
    college: '전체',
    department: '',
    area: '',
    classification: '',
    // 시간대 필터 추가
    day: '',
    startTime: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const { 
    courses, 
    loading, 
    error, 
    searchCourses, 
    getDepartments 
  } = useCourses();

  // schedule_raw에서 시간 정보 파싱
  const parseScheduleTime = (scheduleRaw) => {
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
            startHour: parseInt(startH),
            startMin: parseInt(startM),
            endHour: parseInt(endH),
            endMin: parseInt(endM),
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
              startMin: 0,
              endHour: 8 + maxPeriod + 1,
              endMin: 0,
            });
          }
          continue;
        }
      }
    }
    
    return result;
  };

  // 시간대 필터 적용
  const filterByTime = useCallback((courseList) => {
    const { day, startTime } = filters;
    
    // 필터가 없으면 전체 반환
    if (!day && !startTime) return courseList;
    
    return courseList.filter(course => {
      const times = parseScheduleTime(course.schedule_raw);
      
      // 시간 정보가 없는 과목 (온라인 등)은 시간 필터 적용 시 제외
      if (times.length === 0) {
        // 요일만 선택하고 시간은 안 선택한 경우, 온라인 과목도 보여줄지 결정
        // 여기서는 시간 필터 적용 시 온라인 과목 제외
        return false;
      }
      
      return times.some(t => {
        // 요일 필터
        if (day && t.day !== day) return false;
        
        // 시작 시간 필터: 해당 시간에 수업이 진행 중인지 확인
        if (startTime) {
          // "9:30" → 9시 30분 = 9.5
          const [hourStr, minStr] = startTime.split(':');
          const filterTime = parseInt(hourStr) + (parseInt(minStr) / 60);
          
          // 수업 시작/종료 시간을 소수점으로 변환
          const courseStart = t.startHour + (t.startMin / 60);
          const courseEnd = t.endHour + (t.endMin / 60);
          
          // 수업 시간 범위 내에 있는지 확인
          // 예: 10:30 필터 → 10:00-12:00 수업은 포함 (10:30에 수업 중)
          if (filterTime < courseStart || filterTime >= courseEnd) {
            return false;
          }
        }
        
        return true;
      });
    });
  }, [filters]);

  // 필터 변경시 검색
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchCourses({ 
          category: filters.category,
          targetYear: filters.targetYear,
          college: filters.college,
          department: filters.department,
          area: filters.area,
          classification: filters.classification,
          searchTerm 
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, filters.category, filters.targetYear, filters.college, filters.department, filters.area, filters.classification, searchTerm, searchCourses]);

  // 단과대학 변경시 학과 목록 불러오기
  useEffect(() => {
    if (filters.college && filters.college !== '전체') {
      getDepartments(filters.college)
        .then(depts => setDepartments(depts || []))
        .catch(() => setDepartments([]));
    } else {
      setDepartments([]);
    }
  }, [filters.college, getDepartments]);

  // 시간 겹침 체크
  const getConflictInfo = useCallback((course) => {
    return checkScheduleConflict(course, currentCourses);
  }, [currentCourses]);

  // 과목 추가 핸들러
  const handleAddCourse = (course) => {
    const result = onAddCourse(course);
    if (!result.success) {
      alert(result.error);
    }
  };

  // 시간대 필터 초기화
  const resetTimeFilter = () => {
    setFilters(f => ({ ...f, day: '', startTime: '' }));
  };

  // 시간대 필터가 활성화되어 있는지
  const isTimeFilterActive = filters.day || filters.startTime;

  // 최종 표시할 과목 (시간대 필터 적용)
  const filteredCourses = filterByTime(courses);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">과목 검색</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="과목명, 교수명, 학수번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 필터 토글 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <Filter size={16} />
            필터 {showFilters ? '접기' : '펼치기'}
            {isTimeFilterActive && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                시간대 필터 적용중
              </span>
            )}
          </button>

          {/* 필터 옵션 */}
          {showFilters && (
            <div className="space-y-3">
              {/* 1행: 카테고리, 학년 */}
              <div className="grid grid-cols-2 gap-2">
                {/* 카테고리 */}
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(f => ({ 
                    ...f, 
                    category: e.target.value,
                    area: '',
                    classification: '',
                    college: '전체',
                    department: '',
                  }))}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* 학년 */}
                <select
                  value={filters.targetYear}
                  onChange={(e) => setFilters(f => ({ ...f, targetYear: Number(e.target.value) }))}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  {YEAR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 교양선택일 때: 영역 필터 */}
              {filters.category === 'general_elective' && (
                <select
                  value={filters.area}
                  onChange={(e) => setFilters(f => ({ ...f, area: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {AREA_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}

              {/* 전공일 때: 이수구분 + 단과대학 + 학과 */}
              {(filters.category === 'major' || filters.category === 'convergence') && (
                <>
                  {/* 이수구분 */}
                  <select
                    value={filters.classification}
                    onChange={(e) => setFilters(f => ({ ...f, classification: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {CLASSIFICATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* 단과대학 + 학과 */}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filters.college}
                      onChange={(e) => setFilters(f => ({ ...f, college: e.target.value, department: '' }))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      {COLLEGES.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>

                    <select
                      value={filters.department}
                      onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
                      className="px-3 py-2 border rounded-lg text-sm"
                      disabled={departments.length === 0}
                    >
                      <option value="">전체 학과</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* 전체 선택시: 단과대학 + 학과 */}
              {filters.category === 'all' && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filters.college}
                    onChange={(e) => setFilters(f => ({ ...f, college: e.target.value, department: '' }))}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    {COLLEGES.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>

                  <select
                    value={filters.department}
                    onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
                    className="px-3 py-2 border rounded-lg text-sm"
                    disabled={departments.length === 0}
                  >
                    <option value="">전체 학과</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ========== 시간대 필터 (NEW!) ========== */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Clock size={16} className="text-blue-500" />
                    시간대 필터
                  </div>
                  {isTimeFilterActive && (
                    <button
                      onClick={resetTimeFilter}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      초기화
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {/* 요일 선택 */}
                  <select
                    value={filters.day}
                    onChange={(e) => setFilters(f => ({ ...f, day: e.target.value }))}
                    className={`px-3 py-2 border rounded-lg text-sm ${
                      filters.day ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  >
                    {DAY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* 시간 선택 */}
                  <select
                    value={filters.startTime}
                    onChange={(e) => setFilters(f => ({ ...f, startTime: e.target.value }))}
                    className={`px-3 py-2 border rounded-lg text-sm ${
                      filters.startTime ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  >
                    {TIME_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {isTimeFilterActive && (
                  <p className="text-xs text-blue-600 mt-1.5">
                    💡 {filters.day || '전체 요일'} {filters.startTime ? `${filters.startTime}에 수업 중인` : ''} 과목만 표시
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 검색 결과 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="text-center py-8 text-gray-500">
              검색 중...
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">
              오류: {error}
            </div>
          )}

          {!loading && filteredCourses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {isTimeFilterActive && courses.length > 0 ? (
                <>
                  <p>해당 시간대에 열리는 과목이 없습니다.</p>
                  <button
                    onClick={resetTimeFilter}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    시간대 필터 해제하기
                  </button>
                </>
              ) : (
                '검색 결과가 없습니다.'
              )}
            </div>
          )}

          {/* 검색 결과 카운트 */}
          {!loading && filteredCourses.length > 0 && (
            <div className="text-xs text-gray-500 mb-2">
              {isTimeFilterActive 
                ? `${courses.length}개 중 ${filteredCourses.length}개 (시간대 필터 적용)`
                : `${filteredCourses.length}개 과목`
              }
            </div>
          )}

          {filteredCourses.map((course) => {
            const conflict = getConflictInfo(course);
            const isAdded = currentCourses.some(
              c => c.course_code === course.course_code && c.section === course.section
            );

            return (
              <div
                key={`${course.course_code}-${course.section}`}
                onClick={() => setSelectedCourse(course)}
                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                  conflict.conflict ? 'border-red-200 bg-red-50' : 
                  isAdded ? 'border-green-200 bg-green-50' : 
                  'hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* 과목명 & 학수번호 */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {course.course_name}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {course.course_code}-{course.section}
                      </span>
                      {course.notes && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] shrink-0">
                          <Info size={10} />
                          비고
                        </span>
                      )}
                    </div>

                    {/* 분류 & 학점 */}
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {course.classification || CATEGORY_LABELS[course.category] || course.category}
                      </span>
                      {course.area && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                          {course.area}
                        </span>
                      )}
                      {course.department && (
                        <span className="text-gray-500 text-xs truncate">
                          {course.department}
                        </span>
                      )}
                      <span className="text-gray-500">
                        {course.credits}학점
                      </span>
                    </div>

                    {/* 교수 & 시간 */}
                    <div className="mt-1 text-sm text-gray-600">
                      {course.professor} | {course.schedule_raw || '시간 미정'}
                    </div>

                    {/* 강의실 */}
                    {course.room && (
                      <div className="text-xs text-gray-400">
                        {course.room}
                      </div>
                    )}

                    {/* 겹침 경고 */}
                    {conflict.conflict && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                        <AlertCircle size={12} />
                        "{conflict.conflictWith.course_name}"과(와) 시간 겹침
                      </div>
                    )}
                  </div>

                  {/* 상태 표시 */}
                  <div className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                    isAdded
                      ? 'bg-green-100 text-green-700'
                      : conflict.conflict
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {isAdded ? '추가됨' : conflict.conflict ? '불가' : '상세보기'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 과목 상세 모달 */}
      {selectedCourse && (
        <CourseDetail
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onAdd={handleAddCourse}
          isAdded={currentCourses.some(
            c => c.course_code === selectedCourse.course_code && 
                 c.section === selectedCourse.section
          )}
          conflict={getConflictInfo(selectedCourse)}
        />
      )}
    </div>
  );
}