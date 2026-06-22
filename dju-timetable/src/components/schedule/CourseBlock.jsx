// src/components/schedule/CourseBlock.jsx
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { timeToMinutes } from '../../utils/timeUtils';

export default function CourseBlock({ 
  course, 
  time, 
  color, 
  onRemove,
  onClick,
  isExportMode = false,
  startHour = 9,  // ✅ 동적 시작 시간
  isMobile = false
}) {
  // 위치 계산 - ✅ 동적 startHour 기준
  const position = useMemo(() => {
    const slotHeight = isMobile ? 25 : 40; // 30분당 픽셀
    const baseMinutes = startHour * 60; // 동적 시작 시간
    
    const startMinutes = timeToMinutes(time.start);
    const endMinutes = timeToMinutes(time.end);
    
    const top = ((startMinutes - baseMinutes) / 30) * slotHeight;
    const height = ((endMinutes - startMinutes) / 30) * slotHeight;
    
    return { top, height };
  }, [time, startHour, isMobile]);

  // 강의실 간단히 표시
  const shortRoom = useMemo(() => {
    if (!course.room) return '';
    const parts = course.room.split(' - ');
    return parts[0] || course.room;
  }, [course.room]);

  // 높이 임계값 - 반응형
  const thresholds = isMobile 
    ? { professor: 35, room: 50, time: 65 }
    : { professor: 55, room: 75, time: 95 };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onClick && !isExportMode) {
          onClick();
        }
      }}
      className={`absolute left-0 right-0 mx-0.5 rounded border-l-2 md:border-l-4 overflow-hidden
        ${color.bg} ${color.border} ${color.text}
        ${isExportMode ? '' : 'cursor-pointer hover:shadow-md hover:brightness-95 transition-all'}
      `}
      style={{
        top: `${position.top}px`,
        height: `${Math.max(position.height - 1, 18)}px`,
      }}
    >
      <div className="px-0.5 md:px-1 py-0.5 h-full flex flex-col overflow-hidden">
        {/* 과목명 */}
        <div className="font-semibold text-[10px] md:text-xs leading-tight truncate">
          {course.course_name}
        </div>
        
        {/* 교수 */}
        {position.height >= thresholds.professor && (
          <div className="text-[9px] md:text-[11px] opacity-75 leading-tight truncate">
            {course.professor}
          </div>
        )}
        
        {/* 강의실 */}
        {position.height >= thresholds.room && shortRoom && (
          <div className="text-[8px] md:text-[10px] opacity-60 leading-tight truncate">
            {shortRoom}
          </div>
        )}
        
        {/* 시간 */}
        {position.height >= thresholds.time && (
          <div className="text-[8px] md:text-[10px] opacity-50 mt-auto">
            {time.start}-{time.end}
          </div>
        )}
      </div>

      {/* 삭제 버튼 */}
      {!isExportMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-0 right-0 p-0.5 rounded-full bg-white/50 hover:bg-white/80 transition-colors"
        >
          <X size={isMobile ? 8 : 10} />
        </button>
      )}
    </div>
  );
}