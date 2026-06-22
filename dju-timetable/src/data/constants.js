// src/data/constants.js

// 시간표 테마 팔레트 (각 10색)
export const THEMES = {
  pastel: {
    name: '파스텔',
    preview: ['bg-red-100', 'bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-purple-100'],
    colors: [
      { bg: 'bg-red-100',    border: 'border-red-300',    text: 'text-red-800' },
      { bg: 'bg-blue-100',   border: 'border-blue-300',   text: 'text-blue-800' },
      { bg: 'bg-green-100',  border: 'border-green-300',  text: 'text-green-800' },
      { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800' },
      { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
      { bg: 'bg-pink-100',   border: 'border-pink-300',   text: 'text-pink-800' },
      { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800' },
      { bg: 'bg-teal-100',   border: 'border-teal-300',   text: 'text-teal-800' },
      { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
      { bg: 'bg-cyan-100',   border: 'border-cyan-300',   text: 'text-cyan-800' },
    ],
  },
  vivid: {
    name: '비비드',
    preview: ['bg-red-200', 'bg-blue-200', 'bg-green-200', 'bg-yellow-200', 'bg-purple-200'],
    colors: [
      { bg: 'bg-red-200',    border: 'border-red-500',    text: 'text-red-900' },
      { bg: 'bg-blue-200',   border: 'border-blue-500',   text: 'text-blue-900' },
      { bg: 'bg-green-200',  border: 'border-green-500',  text: 'text-green-900' },
      { bg: 'bg-yellow-200', border: 'border-yellow-500', text: 'text-yellow-900' },
      { bg: 'bg-purple-200', border: 'border-purple-500', text: 'text-purple-900' },
      { bg: 'bg-pink-200',   border: 'border-pink-500',   text: 'text-pink-900' },
      { bg: 'bg-indigo-200', border: 'border-indigo-500', text: 'text-indigo-900' },
      { bg: 'bg-teal-200',   border: 'border-teal-500',   text: 'text-teal-900' },
      { bg: 'bg-orange-200', border: 'border-orange-500', text: 'text-orange-900' },
      { bg: 'bg-cyan-200',   border: 'border-cyan-500',   text: 'text-cyan-900' },
    ],
  },
  cool: {
    name: '쿨톤',
    preview: ['bg-sky-100', 'bg-blue-100', 'bg-indigo-100', 'bg-violet-100', 'bg-teal-100'],
    colors: [
      { bg: 'bg-sky-100',    border: 'border-sky-300',    text: 'text-sky-800' },
      { bg: 'bg-blue-100',   border: 'border-blue-300',   text: 'text-blue-800' },
      { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800' },
      { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-800' },
      { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
      { bg: 'bg-teal-100',   border: 'border-teal-300',   text: 'text-teal-800' },
      { bg: 'bg-cyan-100',   border: 'border-cyan-300',   text: 'text-cyan-800' },
      { bg: 'bg-slate-100',  border: 'border-slate-300',  text: 'text-slate-800' },
      { bg: 'bg-sky-200',    border: 'border-sky-400',    text: 'text-sky-900' },
      { bg: 'bg-blue-200',   border: 'border-blue-400',   text: 'text-blue-900' },
    ],
  },
  warm: {
    name: '웜톤',
    preview: ['bg-rose-100', 'bg-orange-100', 'bg-amber-100', 'bg-yellow-100', 'bg-pink-100'],
    colors: [
      { bg: 'bg-rose-100',   border: 'border-rose-300',   text: 'text-rose-800' },
      { bg: 'bg-red-100',    border: 'border-red-300',    text: 'text-red-800' },
      { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
      { bg: 'bg-amber-100',  border: 'border-amber-300',  text: 'text-amber-800' },
      { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800' },
      { bg: 'bg-pink-100',   border: 'border-pink-300',   text: 'text-pink-800' },
      { bg: 'bg-rose-200',   border: 'border-rose-400',   text: 'text-rose-900' },
      { bg: 'bg-orange-200', border: 'border-orange-400', text: 'text-orange-900' },
      { bg: 'bg-amber-200',  border: 'border-amber-400',  text: 'text-amber-900' },
      { bg: 'bg-yellow-200', border: 'border-yellow-400', text: 'text-yellow-900' },
    ],
  },
  mono: {
    name: '모노톤',
    preview: ['bg-gray-100', 'bg-slate-100', 'bg-zinc-100', 'bg-stone-100', 'bg-gray-200'],
    colors: [
      { bg: 'bg-gray-100',  border: 'border-gray-400',  text: 'text-gray-700' },
      { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-700' },
      { bg: 'bg-zinc-100',  border: 'border-zinc-400',  text: 'text-zinc-700' },
      { bg: 'bg-stone-100', border: 'border-stone-400', text: 'text-stone-700' },
      { bg: 'bg-gray-200',  border: 'border-gray-500',  text: 'text-gray-800' },
      { bg: 'bg-slate-200', border: 'border-slate-500', text: 'text-slate-800' },
      { bg: 'bg-zinc-200',  border: 'border-zinc-500',  text: 'text-zinc-800' },
      { bg: 'bg-stone-200', border: 'border-stone-500', text: 'text-stone-800' },
      { bg: 'bg-gray-300',  border: 'border-gray-600',  text: 'text-gray-900' },
      { bg: 'bg-slate-300', border: 'border-slate-600', text: 'text-slate-900' },
    ],
  },
};

// 기본 팔레트 (파스텔) — 기존 코드 호환용
export const COURSE_COLORS = THEMES.pastel.colors;

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
  { value: '1영역', label: '1영역 (인간과 소통)' },
  { value: '2영역', label: '2영역 (사회와 경제)' },
  { value: '3영역', label: '3영역 (과학과 기술)' },
  { value: '4영역', label: '4영역 (예술과 문화)' },
  { value: '5영역', label: '5영역 (융합과 혁신)' },
  { value: '6영역', label: '6영역 (디지털리터러시)' },
];

// 전공 이수구분 옵션
export const CLASSIFICATION_OPTIONS = [
  { value: '', label: '전체 (전필+전선)' },
  { value: '전필', label: '전공필수' },
  { value: '전선', label: '전공선택' },
];

// 요일
export const DAYS = ['월', '화', '수', '목', '금'];

// 시간표 그리드 설정 - ✅ 컴팩트 모드 (에타 스타일)
export const GRID_CONFIG = {
  startHour: 9,
  endHour: 21,
  slotHeight: 25, // 30분당 픽셀 (변경: 50→25, 시간당 100px→50px)
  dayWidth: 120,  // 요일당 픽셀
};

// ✅ 단과대학 목록 - Firebase 실제 데이터 기준 (2025.02.01 확인)
export const COLLEGES = [
  '전체',
  'AI융합대학',
  '공공인재대학',
  '공과대학',
  '국제협력대학',
  '글로벌산업통상대학',
  '대순종학대학',
  '미래평생교육융합대학',
  '보건과학대학',
  '상생교양대학',
  '융합전공',
  '인문예술대학',
];

// LocalStorage 키
export const STORAGE_KEYS = {
  MY_SCHEDULE: 'dju_my_schedule',           // 기존 (마이그레이션용)
  MY_SCHEDULES: 'dju_my_schedules',         // 새로운 복수 시간표
  BOOKMARKED: 'dju_bookmarked_schedules',
  RECENT_SEARCHES: 'dju_recent_searches',
};