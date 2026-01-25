// src/components/schedule/CourseSearch.jsx
import { useState, useEffect, useCallback, memo } from 'react';
import { Search, X, Plus, AlertCircle, Filter, ChevronDown, Loader2 } from 'lucide-react';
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

// 과목 아이템 컴포넌트 (메모이제이션)
const CourseItem = memo(function CourseItem({ 
  course, 
  isAdded, 
  conflict, 
  onSelect 
}) {
  return (
    <div
      onClick={() => onSelect(course)}
      className={`p-2 border rounded-lg cursor-pointer transition-all ${
        conflict?.conflict ? 'border-red-200 bg-red-50' : 
        isAdded ? 'border-green-200 bg-green-50' : 
        'hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm truncate">
              {course.course_name}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0">
              {course.course_code}-{course.section}
            </span>
            {course.notes && (
              <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] shrink-0">
                비고
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
              {course.classification || CATEGORY_LABELS[course.category]}
            </span>
            {course.area && (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">
                {course.area}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {course.credits}학점
            </span>
          </div>

          <div className="mt-0.5 text-xs text-gray-600 truncate">
            {course.professor} | {course.schedule_raw || '시간 미정'}
          </div>

          {conflict?.conflict && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-red-600">
              <AlertCircle size={10} />
              시간 겹침
            </div>
          )}
        </div>

        <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
          isAdded ? 'bg-green-100 text-green-700' :
          conflict?.conflict ? 'bg-gray-100 text-gray-400' :
          'bg-blue-100 text-blue-600'
        }`}>
          {isAdded ? '추가됨' : conflict?.conflict ? '불가' : '상세'}
        </div>
      </div>
    </div>
  );
});

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
  const [showFilters, setShowFilters] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const { 
    courses, 
    loading, 
    error, 
    hasMore,
    totalCount,
    searchCourses, 
    loadMore,
    getDepartments 
  } = useCourses();

  // 모달 열릴 때 검색
  useEffect(() => {
    if (isOpen) {
      searchCourses({ ...filters, searchTerm });
    }
  }, [isOpen]);

  // 필터/검색어 변경시 검색 (디바운스)
  useEffect(() => {
    if (!isOpen) return;
    
    const timer = setTimeout(() => {
      searchCourses({ ...filters, searchTerm });
    }, 300);
    
    return () => clearTimeout(timer);
  }, [filters, searchTerm]);

  // 단과대학 변경시 학과 목록
  useEffect(() => {
    if (filters.college && filters.college !== '전체') {
      const depts = getDepartments(filters.college);
      setDepartments(depts);
    } else {
      setDepartments([]);
    }
  }, [filters.college, getDepartments]);

  // 카테고리 변경
  const handleCategoryChange = (newCategory) => {
    setFilters(f => ({
      ...f,
      category: newCategory,
      area: '',
      classification: '',
      college: '전체',
      department: '',
    }));
  };

  // 겹침 체크
  const getConflictInfo = useCallback((course) => {
    return checkScheduleConflict(course, currentCourses);
  }, [currentCourses]);

  // 과목 추가
  const handleAddCourse = (course) => {
    const result = onAddCourse(course);
    if (!result.success) {
      alert(result.error);
    }
    return result;
  };

  if (!isOpen) return null;

  const showAreaFilter = filters.category === 'general_elective';
  const showClassificationFilter = filters.category === 'major' || filters.category === 'convergence';
  const showCollegeFilter = filters.category === 'major' || filters.category === 'all';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="text-base font-bold">과목 검색</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full">
            <X size={18} />
          </button>
        </div>

        {/* 검색 */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="과목명, 교수명, 학수번호"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 필터 토글 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-xs text-gray-600"
          >
            <Filter size={14} />
            필터 {showFilters ? '접기' : '펼치기'}
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* 필터 */}
          {showFilters && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filters.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="px-2 py-1.5 border rounded text-xs"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={filters.targetYear}
                  onChange={(e) => setFilters(f => ({ ...f, targetYear: Number(e.target.value) }))}
                  className="px-2 py-1.5 border rounded text-xs"
                >
                  {YEAR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {showAreaFilter && (
                <select
                  value={filters.area}
                  onChange={(e) => setFilters(f => ({ ...f, area: e.target.value }))}
                  className="w-full px-2 py-1.5 border rounded text-xs"
                >
                  {AREA_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}

              {showClassificationFilter && (
                <select
                  value={filters.classification}
                  onChange={(e) => setFilters(f => ({ ...f, classification: e.target.value }))}
                  className="w-full px-2 py-1.5 border rounded text-xs"
                >
                  {CLASSIFICATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}

              {showCollegeFilter && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filters.college}
                    onChange={(e) => setFilters(f => ({ ...f, college: e.target.value, department: '' }))}
                    className="px-2 py-1.5 border rounded text-xs"
                  >
                    {COLLEGES.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <select
                    value={filters.department}
                    onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
                    className="px-2 py-1.5 border rounded text-xs"
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

        {/* 결과 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading && courses.length === 0 && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="animate-spin mr-2" size={18} />
              검색 중...
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500 text-sm">
              오류: {error}
            </div>
          )}

          {!loading && courses.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              검색 결과가 없습니다
            </div>
          )}

          {courses.length > 0 && (
            <div className="text-xs text-gray-500 mb-2">
              {totalCount}개 중 {courses.length}개 표시
            </div>
          )}

          {courses.map((course) => (
            <CourseItem
              key={`${course.course_code}-${course.section}`}
              course={course}
              isAdded={currentCourses.some(
                c => c.course_code === course.course_code && c.section === course.section
              )}
              conflict={getConflictInfo(course)}
              onSelect={setSelectedCourse}
            />
          ))}

          {/* 더보기 버튼 */}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>더보기 ({totalCount - courses.length}개 남음)</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
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