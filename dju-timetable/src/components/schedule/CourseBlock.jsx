// src/components/schedule/CourseBlock.jsx
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { calculateTimePosition } from '../../utils/timeUtils';

export default function CourseBlock({ 
  course, 
  time, 
  color, 
  onRemove,
  onClick,
  isExportMode = false 
}) {
  // 위치 계산 (30분 = 50px 기준)
  const position = useMemo(() => {
    return calculateTimePosition(time, 50);
  }, [time]);

  // 강의실 간단히 표시
  const shortRoom = useMemo(() => {
    if (!course.room) return '';
    const parts = course.room.split(' - ');
    return parts[0] || course.room;
  }, [course.room]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (onClick && !isExportMode) {
          onClick();
        }
      }}
      className={`absolute left-0 right-0 mx-0.5 rounded border-l-4 overflow-hidden
        ${color.bg} ${color.border} ${color.text}
        ${isExportMode ? '' : 'cursor-pointer hover:shadow-md hover:brightness-95 transition-all'}
      `}
      style={{
        top: `${position.top}px`,
        height: `${position.height - 2}px`,
      }}
    >
      <div className="p-1 h-full flex flex-col overflow-hidden">
        {/* 과목명 - 전체 표시 */}
        <div className="font-bold text-xs leading-tight break-words">
          {course.course_name}
        </div>
        
        {/* 교수 */}
        {position.height > 50 && (
          <div className="text-[10px] opacity-80 leading-tight mt-0.5">
            {course.professor}
          </div>
        )}
        
        {/* 강의실 */}
        {position.height > 65 && shortRoom && (
          <div className="text-[10px] opacity-70 leading-tight break-words">
            {shortRoom}
          </div>
        )}
        
        {/* 시간 */}
        {position.height > 85 && (
          <div className="text-[10px] opacity-60 mt-auto">
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
          className="absolute top-0 right-0 p-0.5 rounded-full bg-white/60 hover:bg-white/90 transition-colors"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}