// src/components/schedule/CourseDetail.jsx
import { X, Plus, Clock, MapPin, User, BookOpen, AlertCircle, Info } from 'lucide-react';
import { CATEGORY_LABELS } from '../../data/constants';

export default function CourseDetail({ 
  course, 
  onClose, 
  onAdd, 
  isAdded, 
  conflict 
}) {
  if (!course) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white p-4 border-b flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{course.course_name}</h2>
            <p className="text-sm text-gray-500">{course.course_code}-{course.section}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">분류</div>
              <div className="font-medium">
                {course.classification || CATEGORY_LABELS[course.category]}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">학점</div>
              <div className="font-medium">{course.credits}학점</div>
            </div>
            {course.target_year > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">대상학년</div>
                <div className="font-medium">{course.target_year}학년</div>
              </div>
            )}
            {course.area && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">영역</div>
                <div className="font-medium">{course.area}</div>
              </div>
            )}
          </div>

          {/* 상세 정보 */}
          <div className="space-y-3">
            {/* 교수 */}
            <div className="flex items-center gap-3">
              <User size={18} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">담당교수</div>
                <div>{course.professor || '미정'}</div>
              </div>
            </div>

            {/* 시간 */}
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">수업시간</div>
                <div>{course.schedule_raw || '시간 미정'}</div>
              </div>
            </div>

            {/* 강의실 */}
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-gray-400 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">강의실</div>
                <div>{course.room || '미정'}</div>
              </div>
            </div>

            {/* 학과 */}
            {course.department && (
              <div className="flex items-center gap-3">
                <BookOpen size={18} className="text-gray-400 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">개설학과</div>
                  <div>{course.college} {course.department}</div>
                </div>
              </div>
            )}

            {/* 정원 */}
            {course.capacity > 0 && (
              <div className="flex items-center gap-3">
                <User size={18} className="text-gray-400 shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">수강정원</div>
                  <div>{course.capacity}명</div>
                </div>
              </div>
            )}
          </div>

          {/* 비고 (중요!) */}
          {course.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-700 font-medium mb-1">
                <Info size={16} />
                비고
              </div>
              <div className="text-yellow-800 text-sm">
                {course.notes}
              </div>
            </div>
          )}

          {/* 시간 겹침 경고 */}
          {conflict?.conflict && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                <AlertCircle size={16} />
                시간 겹침
              </div>
              <div className="text-red-600 text-sm">
                "{conflict.conflictWith.course_name}" 과목과 시간이 겹칩니다.
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="sticky bottom-0 bg-white p-4 border-t">
          <button
            onClick={() => {
              onAdd(course);
              if (!conflict?.conflict && !isAdded) {
                onClose();
              }
            }}
            disabled={conflict?.conflict || isAdded}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
              isAdded
                ? 'bg-green-100 text-green-700 cursor-default'
                : conflict?.conflict
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isAdded ? (
              '이미 추가된 과목입니다'
            ) : conflict?.conflict ? (
              '시간이 겹쳐 추가할 수 없습니다'
            ) : (
              <>
                <Plus size={18} />
                시간표에 추가
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}