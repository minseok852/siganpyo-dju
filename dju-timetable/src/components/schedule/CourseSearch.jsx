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
  onRemoveCourse,
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
    
    const segments = scheduleRaw.split(',').map(s => s.trim());
    
    for (const segment of segments) {
      const parts = segment.split(/\s+/).filter(p => p.trim());
      
      for (const part of parts) {
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
        
        const periodMatch = part.match(/^(월|화|수|목|금)([\d,]+)$/);
        if (periodMatch) {
          const [, day, periodsStr] = periodMatch;
          const periods = periodsStr.split(',').map(p => parseInt(p)).filter(p => !isNaN(p));
          if (periods.length > 0) {
            const minPeriod = Math.min(...periods);
            const maxPeriod = Math.max(...periods);
            result.push({
              day,
              startHour: 8 + minPeriod,
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
    
    if (!day && !startTime) return courseList;
    
    return courseList.filter(course => {
      const times = parseScheduleTime(course.schedule_raw);
      
      if (times.length === 0) {
        return false;
      }
      
      return times.some(t => {
        if (day && t.day !== day) return false;
        
        if (startTime) {
          const [hourStr, minStr] = startTime.split(':');
          const filterTime = parseInt(hourStr) + (parseInt(minStr) / 60);
          
          const courseStart = t.startHour + (t.startMin / 60);
          const courseEnd = t.endHour + (t.endMin / 60);
          
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

  // 과목 삭제 핸들러
  const handleRemoveCourse = (courseCode, section) => {
    if (onRemoveCourse) {
      onRemoveCourse(courseCode, section);
    }
  };

  // 시간대 필터 초기화
  const resetTimeFilter = () => {
    setFilters(f => ({ ...f, day: '', startTime: '' }));
  };

  // 전체 필터 초기화
  const resetAllFilters = () => {
    setFilters({
      category: 'all',
      targetYear: 0,
      college: '전체',
      department: '',
      area: '',
      classification: '',
      day: '',
      startTime: '',
    });
    setSearchTerm('');
  };

  const isTimeFilterActive = filters.day || filters.startTime;
  
  // 시간대 외 다른 필터가 활성화되어 있는지
  const isAnyFilterActive = 
    filters.category !== 'all' ||
    filters.targetYear !== 0 ||
    filters.college !== '전체' ||
    filters.department !== '' ||
    filters.area !== '' ||
    filters.classification !== '';
  
  const filteredCourses = filterByTime(courses);

  const isSelectedCourseAdded = selectedCourse 
    ? currentCourses.some(c => c.course_code === selectedCourse.course_code && c.section === selectedCourse.section)
    : false;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end"
      onClick={onClose}
    >
      {/* 하단 슬라이드업 패널 */}
      <div 
        className="bg-white rounded-t-2xl w-full max-h-[70vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="px-4 pb-3 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">과목 검색</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="px-4 py-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="과목명, 교수명, 학수번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>

          {/* 필터 토글 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Filter size={14} />
              필터 {showFilters ? '접기' : '펼치기'}
              {(isTimeFilterActive || isAnyFilterActive) && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  필터 적용중
                </span>
              )}
            </button>
            
            {/* 필터 초기화 버튼 (필터가 적용중일 때만) */}
            {(isTimeFilterActive || isAnyFilterActive) && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
              >
                <X size={12} />
                초기화
              </button>
            )}
          </div>

          {/* 필터 옵션 */}
          {showFilters && (
            <div className="space-y-2 pt-2">
              {/* 1행: 카테고리, 학년 */}
              <div className="grid grid-cols-2 gap-2">
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

              {/* 교양선택: 영역 필터 */}
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
                  <select
                    value={filters.classification}
                    onChange={(e) => setFilters(f => ({ ...f, classification: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {CLASSIFICATION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

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

              {/* 시간대 필터 */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Clock size={14} className="text-blue-500" />
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
        <div className="flex-1 overflow-y-auto px-4 py-2">
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

          <div className="space-y-2 pb-4">
            {filteredCourses.map((course) => {
              const conflict = getConflictInfo(course);
              const isAdded = currentCourses.some(
                c => c.course_code === course.course_code && c.section === course.section
              );

              return (
                <div
                  key={`${course.course_code}-${course.section}`}
                  onClick={() => setSelectedCourse(course)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all ${
                    conflict.conflict ? 'border-red-200 bg-red-50' : 
                    isAdded ? 'border-green-200 bg-green-50' : 
                    'hover:border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 과목명 & 학수번호 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {course.course_name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {course.course_code}-{course.section}
                        </span>
                        {course.notes && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px]">
                            <Info size={10} />
                            비고
                          </span>
                        )}
                      </div>

                      {/* 분류 & 학점 */}
                      <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                        <span className="px-2 py-0.5 bg-gray-100 rounded">
                          {course.classification || CATEGORY_LABELS[course.category] || course.category}
                        </span>
                        {course.area && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                            {course.area}
                          </span>
                        )}
                        {course.department && (
                          <span className="text-gray-500 truncate">
                            {course.department}
                          </span>
                        )}
                        <span className="text-gray-500">
                          {course.credits}학점
                        </span>
                      </div>

                      {/* 교수 & 시간 */}
                      <div className="mt-1 text-xs text-gray-600">
                        {course.professor} | {course.schedule_raw || '시간 미정'}
                      </div>

                      {/* 강의실 */}
                      {course.room && (
                        <div className="text-xs text-gray-400 truncate">
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
                    <div className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${
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
      </div>

      {/* 과목 상세 모달 */}
      {selectedCourse && (
        <CourseDetail
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onAdd={handleAddCourse}
          onRemove={handleRemoveCourse}
          isAdded={isSelectedCourseAdded}
          conflict={getConflictInfo(selectedCourse)}
        />
      )}

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}