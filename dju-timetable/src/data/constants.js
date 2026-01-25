// src/data/constants.js

// 과목 블록 색상 팔레트
export const COURSE_COLORS = [
  { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
  { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
  { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800' },
  { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800' },
  { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800' },
  { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
  { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-800' },
];

// 카테고리 라벨
export const CATEGORY_LABELS = {
  general_required: '교양필수',
  general_elective: '교양선택',
  major: '전공',
  convergence: '융합전공',
  special: '특수'
};

// 카테고리 필터 옵션
export const CATEGORY_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'general_required', label: '교양필수' },
  { value: 'general_elective', label: '교양선택' },
  { value: 'major', label: '전공' },
  { value: 'convergence', label: '융합전공' },
  { value: 'special', label: '특수(ROTC/교직)' },
];

// 학년 필터 옵션
export const YEAR_OPTIONS = [
  { value: 0, label: '전체 학년' },
  { value: 1, label: '1학년' },
  { value: 2, label: '2학년' },
  { value: 3, label: '3학년' },
  { value: 4, label: '4학년' },
];

// 교양선택 영역 옵션
export const AREA_OPTIONS = [
  { value: '', label: '전체 영역' },
  { value: '1영역', label: '1영역 (인간과소통)' },
  { value: '2영역', label: '2영역 (자연과기술)' },
  { value: '3영역', label: '3영역 (문화와예술)' },
  { value: '4영역', label: '4영역 (사회와경제)' },
  { value: '5영역', label: '5영역 (세계와역사)' },
  { value: '6영역', label: '6영역 (자기개발)' },
];

// 전공 이수구분 옵션
export const CLASSIFICATION_OPTIONS = [
  { value: '', label: '전체 (전필+전선)' },
  { value: '전필', label: '전공필수' },
  { value: '전선', label: '전공선택' },
];

// 요일
export const DAYS = ['월', '화', '수', '목', '금'];

// 시간표 그리드 설정
export const GRID_CONFIG = {
  startHour: 9,
  endHour: 21,
  slotHeight: 50, // 30분당 픽셀
  dayWidth: 120,  // 요일당 픽셀
};

// ✅ 단과대학 목록 - departments.js와 일치하도록 수정!
export const COLLEGES = [
  '전체',
  '공과대학',
  '인문예술대학',
  '글로벌산업통상대학',  // 변경: 글로벌비즈니스대학 → 글로벌산업통상대학
  '공공인재대학',        // 추가
  '보건과학대학',        // 변경: 보건의료과학대학 → 보건과학대학
  'AI융합대학',
  '국제협력대학',        // 변경: 국제학부 → 국제협력대학
  '미래평생교육융합대학', // 변경: 미래융합교육원 → 미래평생교육융합대학
  '대순종학대학',
  '상생교양대학',
  '융합전공',
];

// LocalStorage 키
export const STORAGE_KEYS = {
  MY_SCHEDULE: 'dju_my_schedule',
  BOOKMARKED: 'dju_bookmarked_schedules',
  RECENT_SEARCHES: 'dju_recent_searches',
};