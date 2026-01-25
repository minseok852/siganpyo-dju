// src/utils/timeUtils.js

/**
 * 시간 문자열을 분 단위로 변환
 * @param {string} time - "09:30" 형식
 * @returns {number} 분 단위 숫자
 */
export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열로 변환
 * @param {number} minutes 
 * @returns {string} "09:30" 형식
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 두 시간이 겹치는지 확인
 * @param {Object} time1 - { day, start, end }
 * @param {Object} time2 - { day, start, end }
 * @returns {boolean}
 */
export function isTimeConflict(time1, time2) {
  if (time1.day !== time2.day) return false;
  
  const start1 = timeToMinutes(time1.start);
  const end1 = timeToMinutes(time1.end);
  const start2 = timeToMinutes(time2.start);
  const end2 = timeToMinutes(time2.end);
  
  return start1 < end2 && start2 < end1;
}

/**
 * 새 과목이 기존 시간표와 겹치는지 확인
 * @param {Object} newCourse - 추가할 과목
 * @param {Array} existingCourses - 기존 시간표의 과목들
 * @returns {Object} { conflict: boolean, conflictWith: course | null }
 */
export function checkScheduleConflict(newCourse, existingCourses) {
  for (const existing of existingCourses) {
    // 같은 과목의 같은 분반이면 스킵
    if (existing.course_code === newCourse.course_code && 
        existing.section === newCourse.section) {
      continue;
    }
    
    for (const newTime of newCourse.times || []) {
      for (const existTime of existing.times || []) {
        if (isTimeConflict(newTime, existTime)) {
          return { 
            conflict: true, 
            conflictWith: existing 
          };
        }
      }
    }
  }
  return { conflict: false, conflictWith: null };
}

/**
 * 시간표에서 공강 요일 계산
 * @param {Array} courses 
 * @returns {Array} 공강 요일 배열
 */
export function getEmptyDays(courses) {
  const days = ['월', '화', '수', '목', '금'];
  const occupiedDays = new Set();
  
  courses.forEach(course => {
    (course.times || []).forEach(time => {
      occupiedDays.add(time.day);
    });
  });
  
  return days.filter(day => !occupiedDays.has(day));
}

/**
 * 총 학점 계산
 * @param {Array} courses 
 * @returns {number}
 */
export function getTotalCredits(courses) {
  return courses.reduce((sum, course) => sum + (course.credits || 0), 0);
}

/**
 * 시간표 그리드 슬롯 생성 (30분 단위)
 * @returns {Array} 시간 슬롯 배열
 */
export function generateTimeSlots() {
  const slots = [];
  for (let hour = 9; hour <= 21; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    slots.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return slots;
}

/**
 * 과목의 시간 슬롯 위치 계산 (그리드 렌더링용)
 * @param {Object} time - { day, start, end }
 * @returns {Object} { top, height } 픽셀 값
 */
export function calculateTimePosition(time, slotHeight = 30) {
  const startMinutes = timeToMinutes(time.start);
  const endMinutes = timeToMinutes(time.end);
  const baseMinutes = timeToMinutes('09:00'); // 시간표 시작 시간
  
  const top = ((startMinutes - baseMinutes) / 30) * slotHeight;
  const height = ((endMinutes - startMinutes) / 30) * slotHeight;
  
  return { top, height };
}

// 요일 인덱스 매핑
export const dayIndex = {
  '월': 0,
  '화': 1,
  '수': 2,
  '목': 3,
  '금': 4,
  '토': 5,
  '일': 6
};

export const days = ['월', '화', '수', '목', '금'];
