// src/components/schedule/CourseDetail.jsx
import { X, Plus, Clock, MapPin, User, BookOpen, AlertCircle, Info, Trash2 } from 'lucide-react';
import { CATEGORY_LABELS } from '../../data/constants';

export default function CourseDetail({
  course,
  onClose,
  onAdd,
  onRemove,
  isAdded,
  conflict,
  onModifyReplace,
}) {
  if (!course) return null;

  // 삭제 핸들러
  const handleRemove = () => {
    if (confirm(`"${course.course_name}" 과목을 삭제할까요?`)) {
      onRemove(course.course_code, course.section);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-[60] flex flex-col justify-end"
      onClick={onClose}
    >
      {/* 하단 슬라이드업 패널 */}
      <div 
        className="bg-white rounded-t-2xl w-full max-h-[75vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="px-4 pb-3 border-b flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{course.course_name}</h2>
            <p className="text-sm text-gray-500">{course.course_code}-{course.section}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* 내용 - 스크롤 가능 */}
        <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(75vh - 180px)' }}>
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">분류</div>
              <div className="font-medium text-sm">
                {course.classification || CATEGORY_LABELS[course.category]}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-xs text-gray-500 mb-0.5">학점</div>
              <div className="font-medium text-sm">{course.credits}학점</div>
            </div>
            {course.target_year > 0 && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">대상학년</div>
                <div className="font-medium text-sm">{course.target_year}학년</div>
              </div>
            )}
            {course.area && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">영역</div>
                <div className="font-medium text-sm">{course.area}</div>
              </div>
            )}
          </div>

          {/* 상세 정보 */}
          <div className="space-y-2.5">
            {/* 교수 */}
            <div className="flex items-center gap-3">
              <User size={16} className="text-gray-400 shrink-0" />
              <div className="text-sm">
                <span className="text-gray-500 mr-2">담당교수</span>
                <span>{course.professor || '미정'}</span>
              </div>
            </div>

            {/* 시간 */}
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-gray-400 shrink-0" />
              <div className="text-sm">
                <span className="text-gray-500 mr-2">수업시간</span>
                <span>{course.schedule_raw || '시간 미정'}</span>
              </div>
            </div>

            {/* 강의실 */}
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-gray-400 shrink-0" />
              <div className="text-sm">
                <span className="text-gray-500 mr-2">강의실</span>
                <span>{course.room || '미정'}</span>
              </div>
            </div>

            {/* 학과 */}
            {course.department && (
              <div className="flex items-center gap-3">
                <BookOpen size={16} className="text-gray-400 shrink-0" />
                <div className="text-sm">
                  <span className="text-gray-500 mr-2">개설학과</span>
                  <span>{course.college} {course.department}</span>
                </div>
              </div>
            )}
          </div>

          {/* 비고 (중요!) */}
          {course.notes && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-yellow-700 font-medium text-sm mb-1">
                <Info size={14} />
                비고
              </div>
              <div className="text-yellow-800 text-sm">
                {course.notes}
              </div>
            </div>
          )}

          {/* 시간 겹침 경고 */}
          {conflict?.conflict && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-red-700 font-medium text-sm mb-1">
                <AlertCircle size={14} />
                시간 겹침
              </div>
              <div className="text-red-600 text-sm">
                "{conflict.conflictWith.course_name}" 과목과 시간이 겹칩니다.
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 - 고정 */}
        <div className="px-4 py-3 border-t bg-white space-y-2">
          {onModifyReplace && (
            <button
              onClick={() => onModifyReplace(course.course_name)}
              className="w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 text-sm"
            >
              🔄 이 과목 빼고 다시 짜줘
            </button>
          )}
          {!onModifyReplace && (
            isAdded ? (
              <button
                onClick={handleRemove}
                className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              >
                <Trash2 size={18} />
                시간표에서 삭제
              </button>
            ) : (
              <button
                onClick={() => { onAdd(course); if (!conflict?.conflict) onClose(); }}
                disabled={conflict?.conflict}
                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                  conflict?.conflict ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {conflict?.conflict ? '시간이 겹쳐 추가할 수 없습니다' : <><Plus size={18} />시간표에 추가</>}
              </button>
            )
          )}
        </div>
      </div>

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