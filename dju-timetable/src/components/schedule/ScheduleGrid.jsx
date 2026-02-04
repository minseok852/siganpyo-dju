// src/components/schedule/ScheduleGrid.jsx
import { useMemo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import CourseBlock from './CourseBlock';
import { DAYS, GRID_CONFIG } from '../../data/constants';

export default function ScheduleGrid({ 
  courses, 
  onlineCourses = [],  // ✅ 온라인 과목 추가
  onRemoveCourse, 
  getCourseColor,
  onCourseClick,
  isExportMode = false 
}) {
  // 반응형 감지 - 768px 기준
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ 동적 시간 범위 계산 (PC + 모바일 모두 적용)
  const { startHour, endHour } = useMemo(() => {
    // 오프라인 과목만 필터링 (times 배열이 있고 비어있지 않은 것)
    const offlineCourses = courses.filter(c => c.times && c.times.length > 0);
    
    if (offlineCourses.length === 0) {
      // 과목 없으면 기본 범위 (9시~18시)
      return { startHour: 9, endHour: 18 };
    }

    // 모든 시간 수집
    const allTimes = offlineCourses.flatMap(c => c.times || []);
    
    // 시작/종료 시간 추출
    const startHours = allTimes.map(t => {
      const hour = parseInt(t.start?.split(':')[0]);
      return isNaN(hour) ? 9 : hour;
    });
    
    const endHours = allTimes.map(t => {
      const [h, m] = (t.end || '').split(':').map(Number);
      // 정각 → 그 시간까지, 30분 → 다음 정각까지
      // 예: 15:00 → 15, 15:30 → 16
      return isNaN(h) ? 18 : (m > 0 ? h + 1 : h);
    });

    // 범위 계산 (최소 9시 시작)
    const minStart = Math.min(9, ...startHours);
    const maxEnd = Math.max(...endHours); // 여유 없이 딱 맞게
    
    // 최소 범위 보장 (과목 1개일 때 너무 좁아지는 것 방지)
    const finalEnd = Math.max(maxEnd, minStart + 4); // 최소 4시간은 표시
    
    return { startHour: minStart, endHour: finalEnd };
  }, [courses]);

  // 시간 라벨 생성
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      labels.push(hour);
    }
    return labels;
  }, [startHour, endHour]);

  // 슬롯 높이 (반응형)
  const slotHeight = isMobile ? 50 : 80;

  return (
    <div 
      className={`bg-white rounded-lg shadow-lg overflow-hidden ${
        isExportMode ? 'p-4' : ''
      }`}
      id="schedule-grid"
    >
      {/* 헤더 - 요일 */}
      <div className="grid grid-cols-6 border-b border-gray-200">
        <div className="p-1.5 md:p-2 text-center text-xs font-medium text-gray-500 bg-gray-50">
          시간
        </div>
        {DAYS.map(day => (
          <div 
            key={day} 
            className="p-1.5 md:p-2 text-center text-xs md:text-sm font-medium text-gray-700 bg-gray-50 border-l border-gray-200"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 시간표 본문 */}
      <div className="relative">
        <div className="grid grid-cols-6">
          {/* 시간 라벨 열 */}
          <div className="border-r border-gray-200">
            {hourLabels.map((hour) => (
              <div 
                key={hour}
                style={{ height: `${slotHeight}px` }}
                className="border-b border-gray-100 flex items-start justify-center pt-0.5 md:pt-1"
              >
                <span className="text-[10px] md:text-xs text-gray-400">{hour}</span>
              </div>
            ))}
          </div>

          {/* 요일별 열 */}
          {DAYS.map((day) => (
            <div 
              key={day} 
              className="relative border-l border-gray-200"
            >
              {/* 시간 그리드 라인 */}
              {hourLabels.map((hour) => (
                <div 
                  key={hour}
                  style={{ height: `${slotHeight}px` }}
                  className="border-b border-gray-100"
                />
              ))}

              {/* 해당 요일의 과목들 */}
              {courses.map((course) => {
                const times = course.times?.filter(t => t.day === day) || [];
                return times.map((time, timeIdx) => (
                  <CourseBlock
                    key={`${course.course_code}-${course.section}-${timeIdx}`}
                    course={course}
                    time={time}
                    color={getCourseColor(course.course_code, course.section)}
                    onRemove={() => onRemoveCourse(course.course_code, course.section)}
                    onClick={() => onCourseClick && onCourseClick(course)}
                    isExportMode={isExportMode}
                    startHour={startHour}
                    isMobile={isMobile}
                  />
                ));
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ✅ 온라인/시간미정 과목 - 에타 스타일 (그리드에 붙임) */}
      {onlineCourses.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50/50">
          {onlineCourses.map((course, index) => {
            const color = getCourseColor(course.course_code, course.section);
            return (
              <div 
                key={`online-${course.course_code}-${course.section}-${index}`}
                className={`flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0 ${
                  !isExportMode ? 'cursor-pointer hover:bg-gray-100' : ''
                }`}
                onClick={() => !isExportMode && onCourseClick && onCourseClick(course)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-1 h-6 rounded-full ${color.border.replace('border-', 'bg-')}`} />
                  <span className={`font-medium text-sm truncate ${color.text}`}>
                    {course.course_name}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {course.professor} | {course.credits}학점
                  </span>
                  {course.room && (
                    <span className="text-xs text-purple-500 shrink-0">
                      {course.room.includes('e-learning') ? 'e-learning' : course.room.split(' - ')[0]}
                    </span>
                  )}
                </div>
                {!isExportMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCourse(course.course_code, course.section);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}