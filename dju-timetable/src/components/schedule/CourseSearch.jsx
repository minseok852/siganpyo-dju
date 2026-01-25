// src/components/schedule/CourseSearch.jsx
import { useState, useEffect, useCallback } from 'react';
import { Search, X, Plus, AlertCircle, Filter } from 'lucide-react';
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
  });
  const [showFilters, setShowFilters] = useState(false);
  const [departments, setDepartments] = useState([]);

  const { 
    courses, 
    loading, 
    error, 
    searchCourses, 
    getDepartments 
  } = useCourses();

  // 필터 변경시 검색
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchCourses({ ...filters, searchTerm });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, filters, searchTerm, searchCourses]);

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
          </button>

          {/* 필터 옵션 */}
          {showFilters && (
            <div className="space-y-2">
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

          {!loading && courses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              검색 결과가 없습니다.
            </div>
          )}

          {courses.map((course) => {
            const conflict = getConflictInfo(course);
            const isAdded = currentCourses.some(
              c => c.course_code === course.course_code && c.section === course.section
            );

            return (
              <div
                key={`${course.course_code}-${course.section}`}
                className={`p-3 border rounded-lg ${
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
                    </div>

                    {/* 분류 & 학점 */}
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {CATEGORY_LABELS[course.category] || course.category}
                      </span>
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

                  {/* 추가 버튼 */}
                  <button
                    onClick={() => handleAddCourse(course)}
                    disabled={conflict.conflict || isAdded}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 ${
                      isAdded
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : conflict.conflict
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isAdded ? '추가됨' : conflict.conflict ? '불가' : (
                      <span className="flex items-center gap-1">
                        <Plus size={14} /> 추가
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}