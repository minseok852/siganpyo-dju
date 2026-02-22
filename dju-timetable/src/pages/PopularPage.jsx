// src/pages/PopularPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  TrendingUp, 
  Loader2, 
  Users,
  Plus,
  Check
} from 'lucide-react';
import { getPopularCourses } from '../services/popularService';
import { useSchedule } from '../hooks/useSchedule';
import { CATEGORY_OPTIONS, AREA_OPTIONS, COLLEGES } from '../data/constants';
import { getDepartmentsByCollege } from '../data/departments';

export default function PopularPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    area: '',
    college: '',
    department: '',
  });
  const [departments, setDepartments] = useState([]);

  const { courses: myCourses, addCourse } = useSchedule();

  // 단과대학 변경시 학과 목록 로드 - ✅ 하드코딩 데이터 사용 (즉시 로드!)
  useEffect(() => {
    if (filters.college && filters.college !== '') {
      const depts = getDepartmentsByCollege(filters.college);
      setDepartments(depts || []);
    } else {
      setDepartments([]);
    }
  }, [filters.college]);

  // 인기 과목 로드
  useEffect(() => {
    async function loadPopular() {
      setLoading(true);
      
      const queryFilters = {
        limit: 30
      };
      
      if (filters.category && filters.category !== 'all') {
        queryFilters.category = filters.category;
      }
      if (filters.area) {
        queryFilters.area = filters.area;
      }
      if (filters.department) {
        queryFilters.department = filters.department;
      }
      
      const result = await getPopularCourses(queryFilters);
      
      if (result.success) {
        setCourses(result.courses);
      }
      setLoading(false);
    }

    loadPopular();
  }, [filters]);

  // 이미 추가된 과목인지 확인
  const isAdded = (course) => {
    return myCourses.some(
      c => c.course_code === course.course_code && c.section === course.section
    );
  };

  // 과목 추가
  const handleAdd = (course) => {
    const result = addCourse(course);
    if (!result.success) {
      alert(result.error);
    }
  };

  // 카테고리 변경
  const handleCategoryChange = (category) => {
    setFilters({
      category,
      area: '',
      college: '',
      department: '',
    });
  };

  const showAreaFilter = filters.category === 'general_elective';
  const showCollegeFilter = filters.category === 'major' || filters.category === 'convergence';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft size={20} />
            </button>
            <TrendingUp className="text-orange-500" size={20} />
            <h1 className="text-base font-bold text-gray-800">인기 과목</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 py-4">
        {/* 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
          <div className="space-y-2">
            {/* 1행: 카테고리 */}
            <select
              value={filters.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-1.5 border rounded-lg text-sm"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 교양선택: 영역 필터 */}
            {showAreaFilter && (
              <select
                value={filters.area}
                onChange={(e) => setFilters(f => ({ ...f, area: e.target.value }))}
                className="w-full px-3 py-1.5 border rounded-lg text-sm"
              >
                {AREA_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {/* 전공: 단과대학 + 학과 필터 */}
            {showCollegeFilter && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filters.college}
                  onChange={(e) => setFilters(f => ({ 
                    ...f, 
                    college: e.target.value, 
                    department: '' 
                  }))}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="">단과대학 선택</option>
                  {COLLEGES.filter(c => c !== '전체').map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                  disabled={departments.length === 0}
                >
                  <option value="">학과 선택</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-orange-700">
            🔥 다른 학생들이 많이 담은 과목이에요. 수강신청 참고용으로 활용하세요!
          </p>
        </div>

        {/* 전공 선택 안내 */}
        {showCollegeFilter && !filters.department && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-700">
              👆 단과대학과 학과를 선택하면 해당 학과의 인기 과목을 볼 수 있어요
            </p>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        )}

        {/* 과목 목록 */}
        {!loading && courses.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <TrendingUp className="mx-auto mb-3 opacity-30" size={48} />
            <p>아직 인기 과목 데이터가 없어요</p>
            <p className="text-sm mt-1">학생들이 시간표에 과목을 추가하면 여기에 표시됩니다</p>
          </div>
        )}

        {!loading && courses.length > 0 && (
          <div className="space-y-2">
            {courses.map((course, index) => {
              const added = isAdded(course);
              
              return (
                <div
                  key={course.id}
                  className="bg-white rounded-lg shadow-sm p-3 flex items-center gap-3"
                >
                  {/* 순위 */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    index < 3 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>

                  {/* 과목 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {course.course_name}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {course.credits}학점
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {course.professor} | {course.schedule_raw}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-orange-600">
                      <Users size={12} />
                      {course.count}명이 담음
                    </div>
                  </div>

                  {/* 추가 버튼 */}
                  <button
                    onClick={() => !added && handleAdd(course)}
                    disabled={added}
                    className={`p-2 rounded-lg shrink-0 ${
                      added 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {added ? <Check size={18} /> : <Plus size={18} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}