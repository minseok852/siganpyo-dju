// src/components/schedule/ScheduleGrid.jsx
import { useMemo } from 'react';
import CourseBlock from './CourseBlock';
import { DAYS, GRID_CONFIG } from '../../data/constants';
import { generateTimeSlots } from '../../utils/timeUtils';

export default function ScheduleGrid({ 
  courses, 
  onRemoveCourse, 
  getCourseColor,
  onCourseClick,  // 추가!
  isExportMode = false 
}) {
  const timeSlots = useMemo(() => generateTimeSlots(), []);
  
  // 시간 라벨 (1시간 단위로만 표시)
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let hour = GRID_CONFIG.startHour; hour <= GRID_CONFIG.endHour; hour++) {
      labels.push(`${hour}:00`);
    }
    return labels;
  }, []);

  return (
    <div 
      className={`bg-white rounded-lg shadow-lg overflow-hidden ${
        isExportMode ? 'p-4' : ''
      }`}
      id="schedule-grid"
    >
      {/* 헤더 - 요일 */}
      <div className="grid grid-cols-6 border-b border-gray-200">
        <div className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50">
          시간
        </div>
        {DAYS.map(day => (
          <div 
            key={day} 
            className="p-2 text-center text-sm font-medium text-gray-700 bg-gray-50 border-l border-gray-200"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 시간표 본문 */}
      <div className="relative">
        {/* 시간 라인 배경 */}
        <div className="grid grid-cols-6">
          {/* 시간 라벨 열 */}
          <div className="border-r border-gray-200">
            {hourLabels.map((time, idx) => (
              <div 
                key={time}
                className="h-[100px] border-b border-gray-100 flex items-start justify-center pt-1"
              >
                <span className="text-xs text-gray-400">{time}</span>
              </div>
            ))}
          </div>

          {/* 요일별 열 */}
          {DAYS.map((day, dayIdx) => (
            <div 
              key={day} 
              className="relative border-l border-gray-200"
            >
              {/* 시간 그리드 라인 */}
              {hourLabels.map((_, idx) => (
                <div 
                  key={idx}
                  className="h-[100px] border-b border-gray-100"
                />
              ))}

              {/* 해당 요일의 과목들 */}
              {courses.map((course, courseIdx) => {
                const times = course.times?.filter(t => t.day === day) || [];
                return times.map((time, timeIdx) => (
                  <CourseBlock
                    key={`${course.course_code}-${course.section}-${timeIdx}`}
                    course={course}
                    time={time}
                    color={getCourseColor(course.course_code, course.section)}
                    onRemove={() => onRemoveCourse(course.course_code, course.section)}
                    onClick={() => onCourseClick && onCourseClick(course)}  // 추가!
                    isExportMode={isExportMode}
                  />
                ));
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}