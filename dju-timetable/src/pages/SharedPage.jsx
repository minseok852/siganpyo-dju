// src/pages/SharedPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Download, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import ScheduleGrid from '../components/schedule/ScheduleGrid';
import { getSharedSchedule } from '../services/shareService';
import { COURSE_COLORS } from '../data/constants';

export default function SharedPage() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);

  // 시간표 불러오기
  useEffect(() => {
    async function loadSchedule() {
      setLoading(true);
      const result = await getSharedSchedule(shareId);
      
      if (result.success) {
        setSchedule(result.schedule);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    if (shareId) {
      loadSchedule();
    }
  }, [shareId]);

  // 색상 할당
  const getCourseColor = (courseCode, section) => {
    if (!schedule) return COURSE_COLORS[0];
    const index = schedule.courses.findIndex(
      c => c.course_code === courseCode && c.section === section
    );
    return COURSE_COLORS[index % COURSE_COLORS.length];
  };

  // 내 시간표로 가져오기
  const handleImport = () => {
    if (!schedule) return;
    
    setImporting(true);
    
    // localStorage에 저장
    const mySchedule = {
      courses: schedule.courses,
      colorMap: {}
    };
    
    schedule.courses.forEach((course, idx) => {
      const key = `${course.course_code}-${course.section}`;
      mySchedule.colorMap[key] = idx % COURSE_COLORS.length;
    });
    
    localStorage.setItem('dju_my_schedule', JSON.stringify(mySchedule));
    
    setTimeout(() => {
      navigate('/');
    }, 500);
  };

  // 로딩
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-3 text-blue-500" size={32} />
          <p className="text-gray-600">시간표 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 text-red-500" size={48} />
          <h1 className="text-xl font-bold text-gray-800 mb-2">시간표를 찾을 수 없습니다</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-1.5 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft size={20} />
              </button>
              <BookOpen className="text-blue-600" size={20} />
              <h1 className="text-base font-bold text-gray-800">공유된 시간표</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-2 py-3">
        {/* 정보 카드 */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-xl font-bold text-blue-600">{schedule.totalCredits}</span>
                <span className="text-xs text-gray-500 ml-0.5">학점</span>
              </div>
              <div className="text-center">
                <span className="text-xl font-bold text-gray-700">{schedule.courseCount}</span>
                <span className="text-xs text-gray-500 ml-0.5">과목</span>
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Download size={16} />
              )}
              내 시간표로 가져오기
            </button>
          </div>
        </div>

        {/* 시간표 그리드 */}
        <ScheduleGrid
          courses={schedule.courses}
          onRemoveCourse={() => {}}
          getCourseColor={getCourseColor}
          onCourseClick={() => {}}
        />

        {/* 과목 목록 */}
        <div className="mt-3 bg-white rounded-lg shadow-sm p-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            과목 목록 ({schedule.courseCount})
          </h3>
          <div className="space-y-1.5">
            {schedule.courses.map((course) => {
              const color = getCourseColor(course.course_code, course.section);
              return (
                <div
                  key={`${course.course_code}-${course.section}`}
                  className={`p-2 rounded-lg border ${color.bg} ${color.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-sm font-medium ${color.text}`}>
                        {course.course_name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {course.credits}학점
                      </span>
                    </div>
                    <span className="text-xs font-mono text-gray-500">
                      {course.course_code}-{course.section}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {course.professor} | {course.schedule_raw}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}