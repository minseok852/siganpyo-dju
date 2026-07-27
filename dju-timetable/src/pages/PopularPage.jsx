// src/pages/PopularPage.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Plus,
  Check,
  ChevronDown,
  Info,
  ArrowUp,
  Loader2,
} from 'lucide-react';
import { getPopularCourses } from '../services/popularService';
import { useSchedule } from '../hooks/useSchedule';
import { useCourses } from '../hooks/useCourses';
import { CATEGORY_OPTIONS, AREA_OPTIONS, COLLEGES, CURRENT_SEMESTER, formatSemester } from '../data/constants';
import { getDepartmentsByCollege } from '../data/departments';
import { isTimeConflict, parseScheduleToTimes } from '../utils/timeUtils';
import SiteHeader from '../components/SiteHeader';

const RECENT_KEY = 'dju_popular_recent';
const RECENT_MAX = 6;
const LIST_LIMIT = 30;

const CARD = 'bg-white border border-[#EBEEF3] rounded-[14px]';
const LABEL = 'text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.06em]';

// 카테고리 뱃지 (과목 분류 + 부가 정보)
function categoryBadge(course) {
  switch (course.category) {
    case 'general_required':
      return { label: '교양필수', cls: 'bg-[#FFF1E8] text-[#E2670F]' };
    case 'general_elective':
      return { label: `교양선택${course.area ? ` ${course.area}` : ''}`, cls: 'bg-[#EAF1FE] text-[#2F6FEB]' };
    case 'major':
      return { label: `전공${course.college ? ` · ${course.college}` : ''}`, cls: 'bg-[#EAF1FE] text-[#2F6FEB]' };
    case 'convergence':
      return { label: '융합전공', cls: 'bg-[#EBE0FB] text-[#6C3FC4]' };
    case 'special':
      return { label: '특수', cls: 'bg-[#F1F4FA] text-[#5B6472]' };
    default:
      return null;
  }
}

// 전필/전선 뱃지
function classificationBadge(course) {
  if (!course.classification) return null;
  if (course.classification === '전필') return { label: '전필', cls: 'bg-[#EAF1FE] text-[#2F6FEB]' };
  if (course.classification === '전선') return { label: '전선', cls: 'bg-[#F1F4FA] text-[#5B6472]' };
  return { label: course.classification, cls: 'bg-[#F1F4FA] text-[#5B6472]' };
}

// 검색어 하이라이트
function Highlight({ text, term }) {
  const value = text || '';
  if (!term) return value;
  const index = value.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return value;
  return (
    <>
      {value.slice(0, index)}
      <span className="bg-[#FFF1C4]">{value.slice(index, index + term.length)}</span>
      {value.slice(index + term.length)}
    </>
  );
}

// 담은 인원 막대
function CountBar({ count, max, top }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex-1 h-[5px] rounded-[3px] bg-[#F1F4FA] overflow-hidden">
      <div
        className={`h-full rounded-[3px] ${top ? 'bg-[#E2670F]' : 'bg-[#F0913F]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// 담기 버튼 (아이콘형)
function AddIconButton({ added, onClick, size = 'md' }) {
  const box = size === 'lg' ? 'w-10 h-10 rounded-[11px]' : 'w-[34px] h-[34px] rounded-[9px]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={added}
      title={added ? '이미 담은 과목' : '내 시간표에 담기'}
      className={`${box} flex items-center justify-center flex-shrink-0 transition-colors ${
        added ? 'bg-[#DFF5E6] text-[#1F8A54]' : 'bg-[#2F6FEB] text-white hover:bg-[#2559C4]'
      }`}
    >
      {added ? <Check size={size === 'lg' ? 17 : 15} strokeWidth={2.2} /> : <Plus size={size === 'lg' ? 17 : 15} strokeWidth={2.2} />}
    </button>
  );
}

// 순위 뱃지 (원형)
function RankCircle({ rank, size = 'md' }) {
  const top = rank <= 3;
  const box = size === 'lg' ? 'w-[30px] h-[30px] text-[14px]' : 'w-7 h-7 text-[13.5px]';
  return (
    <span
      className={`${box} inline-flex items-center justify-center rounded-full font-extrabold flex-shrink-0 ${
        rank === 1 ? 'bg-[#E2670F] text-white' : top ? 'bg-[#FFF1E8] text-[#E2670F]' : 'bg-[#F1F4FA] text-[#5B6472]'
      }`}
    >
      {rank}
    </span>
  );
}

// 순위 뱃지 (사각형 — 검색 결과용 "N위")
function RankTag({ rank }) {
  if (!rank) {
    return (
      <span className="w-[34px] h-7 inline-flex items-center justify-center rounded-lg bg-[#F1F4FA] text-[#C4CCD8] text-[12.5px] font-extrabold flex-shrink-0">
        —
      </span>
    );
  }
  return (
    <span
      className={`w-[34px] h-7 inline-flex items-center justify-center rounded-lg text-[12.5px] font-extrabold flex-shrink-0 ${
        rank <= 3 ? 'bg-[#FFF1E8] text-[#E2670F]' : 'bg-[#F1F4FA] text-[#5B6472]'
      }`}
    >
      {rank}위
    </span>
  );
}

// 필터 칩 — 사각형(구분)
function CategoryChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-[7px] rounded-[9px] text-[13px] whitespace-nowrap transition-colors ${
        active
          ? 'bg-[#1E2530] text-white font-bold'
          : 'bg-[#F6F8FB] border border-[#E4E8F0] text-[#5B6472] font-semibold hover:bg-[#EEF1F6]'
      }`}
    >
      {label}
    </button>
  );
}

// 필터 칩 — 알약(영역/단과대/학과)
function PillChip({ active, label, onClick, tone = 'plain' }) {
  const activeCls = tone === 'solid' ? 'bg-[#2F6FEB] text-white font-bold' : 'bg-[#EAF1FE] text-[#2F6FEB] font-extrabold';
  const idleCls =
    tone === 'solid'
      ? 'bg-white border border-[#E4E8F0] text-[#5B6472] font-semibold hover:bg-[#F6F8FB]'
      : 'bg-[#F9FAFC] border border-[#EEF1F5] text-[#5B6472] font-semibold hover:bg-[#F1F4FA]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12.5px] whitespace-nowrap transition-colors ${active ? activeCls : idleCls}`}
    >
      {label}
    </button>
  );
}

// 모바일 바텀시트 (영역 / 단과대 / 학과 선택)
function BottomSheet({ open, title, subtitle, options, value, onSelect, onClose }) {
  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-[#1E2530]/[0.42]" />
      <div
        className="relative bg-white rounded-t-[18px] px-4 pt-3.5 pb-5 max-h-[70vh] flex flex-col gap-3 shadow-[0_-8px_28px_rgba(30,37,48,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[38px] h-1 rounded-sm bg-[#E4E8F0] self-center" />
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-[#1E2530]">{title}</span>
          {subtitle && <span className="text-[12px] text-[#8892A4]">{subtitle}</span>}
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {options.map(opt => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => { onSelect(opt.value); onClose(); }}
                className={`px-3 py-[11px] rounded-[9px] text-left text-[13.5px] flex items-center justify-between transition-colors ${
                  selected ? 'bg-[#EAF1FE] text-[#2F6FEB] font-extrabold' : 'text-[#3A4150] font-semibold hover:bg-[#F6F8FB]'
                }`}
              >
                {opt.label}
                {selected && <Check size={15} strokeWidth={2.2} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- 결과 렌더 조각 ----------

// 데스크톱 TOP 3 카드
function TopCard({ course, rank, max, added, onAdd }) {
  const badge = categoryBadge(course);
  return (
    <div
      className={`bg-white rounded-[14px] p-[18px] flex flex-col gap-3 ${
        rank === 1 ? 'border-[1.5px] border-[#F7C9A6] shadow-[0_4px_16px_rgba(226,103,15,0.08)]' : 'border border-[#EBEEF3]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <RankCircle rank={rank} size="lg" />
        {badge && (
          <span className={`px-[9px] py-1 rounded-md text-[11.5px] font-extrabold truncate ${badge.cls}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[16px] font-extrabold text-[#1E2530] truncate">{course.course_name}</span>
        <span className="text-[12.5px] text-[#8892A4] truncate">
          {[course.professor, `${course.credits}학점`, course.schedule_raw].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[21px] font-extrabold text-[#E2670F] leading-none">{course.count}</span>
          <span className="text-[12px] text-[#8892A4]">명이 담음</span>
        </div>
        <div className="flex"><CountBar count={course.count} max={max} top={rank === 1} /></div>
      </div>
      <div className="flex items-center justify-between gap-2.5 pt-0.5">
        <span className="text-[11.5px] text-[#9AA3B2] truncate">{course.room || `${course.course_code}-${course.section}`}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={added}
          className={`inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[9px] text-[12.5px] font-bold flex-shrink-0 transition-colors ${
            added ? 'bg-[#DFF5E6] text-[#1F8A54]' : 'bg-[#2F6FEB] text-white hover:bg-[#2559C4]'
          }`}
        >
          {added ? <Check size={14} strokeWidth={2.2} /> : <Plus size={14} strokeWidth={2.2} />}
          {added ? '담음' : '담기'}
        </button>
      </div>
    </div>
  );
}

const GRID_COLS = 'grid-cols-[56px_1fr_150px_132px_168px_96px]';

// 데스크톱 표 행
function RankRow({ course, rank, max, added, onAdd, term, circleRank = false, unranked = false }) {
  const badge = categoryBadge(course);
  const cls = classificationBadge(course);
  return (
    <div className={`grid ${GRID_COLS} items-center gap-3.5 px-5 py-[13px] border-b border-[#F3F5F8] last:border-b-0`}>
      {unranked ? (
        <span className="text-[13px] font-extrabold text-[#C4CCD8]">—</span>
      ) : circleRank ? (
        <span><RankCircle rank={rank} /></span>
      ) : (
        <span className="text-[14px] font-extrabold text-[#5B6472]">{rank}</span>
      )}

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[14px] font-bold text-[#1E2530] truncate">
          <Highlight text={course.course_name} term={term} />
        </span>
        {badge && (
          <span className={`px-[7px] py-0.5 rounded-[5px] text-[10.5px] font-bold flex-shrink-0 ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {cls && (
          <span className={`px-[7px] py-0.5 rounded-[5px] text-[10.5px] font-bold flex-shrink-0 ${cls.cls}`}>
            {cls.label}
          </span>
        )}
        <span className="text-[12px] text-[#B0B7C3] flex-shrink-0">{course.credits}학점</span>
      </div>

      <span className="text-[13px] text-[#5B6472] truncate">{course.professor}</span>
      <span className="text-[13px] text-[#5B6472] truncate">{course.schedule_raw}</span>

      {unranked ? (
        <span className="text-[12.5px] text-[#B0B7C3]">0명이 담음</span>
      ) : (
        <div className="flex items-center gap-2.5">
          <CountBar count={course.count} max={max} top={rank === 1} />
          <span className={`text-[12.5px] w-11 text-right ${rank === 1 ? 'font-extrabold text-[#E2670F]' : 'font-bold text-[#3A4150]'}`}>
            {course.count}명
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <AddIconButton added={added} onClick={onAdd} />
      </div>
    </div>
  );
}

// 모바일 카드
function MobileCard({ course, rank, max, added, onAdd, term, tag = false, unranked = false }) {
  const badge = categoryBadge(course);
  return (
    <div
      className={`bg-white rounded-[14px] px-4 py-3.5 flex flex-col gap-[11px] ${
        unranked
          ? 'border border-dashed border-[#E4E8F0]'
          : rank === 1
            ? 'border-[1.5px] border-[#F7C9A6] shadow-[0_4px_16px_rgba(226,103,15,0.08)]'
            : 'border border-[#EBEEF3]'
      }`}
    >
      <div className="flex items-start gap-[11px]">
        {tag || unranked ? <RankTag rank={unranked ? 0 : rank} /> : <RankCircle rank={rank} />}
        <div className="flex flex-col gap-[3px] min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-extrabold text-[#1E2530] truncate">
              <Highlight text={course.course_name} term={term} />
            </span>
            <span className="text-[11.5px] text-[#B0B7C3] flex-shrink-0">{course.credits}학점</span>
          </div>
          <span className="text-[12px] text-[#8892A4] truncate">
            {[course.professor, course.schedule_raw, course.room].filter(Boolean).join(' · ')}
            {unranked && ' · 0명이 담음'}
          </span>
          {badge && !unranked && (
            <span className={`w-fit mt-0.5 px-[7px] py-0.5 rounded-[5px] text-[10.5px] font-bold ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </div>
        <AddIconButton added={added} onClick={onAdd} size="lg" />
      </div>
      {!unranked && (
        <div className="flex items-center gap-2.5">
          <CountBar count={course.count} max={max} top={rank === 1} />
          <span className={`text-[12.5px] whitespace-nowrap ${rank === 1 ? 'font-extrabold text-[#E2670F]' : 'font-bold text-[#3A4150]'}`}>
            {course.count}명
          </span>
        </div>
      )}
    </div>
  );
}

// 검색 결과가 1건일 때의 상세 카드
function HeroResult({ course, rank, total, topCourse, added, onAdd }) {
  const badge = categoryBadge(course);
  const cls = classificationBadge(course);
  const ratio = topCourse?.count ? Math.round((course.count / topCourse.count) * 100) : null;
  return (
    <div className="bg-white border-[1.5px] border-[#F7C9A6] rounded-[14px] p-5 sm:px-6 sm:py-[22px] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7 shadow-[0_4px_16px_rgba(226,103,15,0.08)]">
      <div className="flex sm:flex-col items-center gap-3 sm:gap-1 flex-shrink-0 sm:pr-7 sm:border-r sm:border-[#EEF1F5]">
        <span className={LABEL}>전체 순위</span>
        <span className="text-[28px] sm:text-[34px] font-extrabold text-[#E2670F] leading-none">{rank}위</span>
        <span className="text-[11.5px] text-[#8892A4]">{total}개 중</span>
      </div>

      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-[17px] sm:text-[19px] font-extrabold text-[#1E2530] [overflow-wrap:anywhere]">{course.course_name}</span>
          {badge && <span className={`px-2 py-[3px] rounded-md text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>}
          {cls && <span className={`px-2 py-[3px] rounded-md text-[11px] font-bold ${cls.cls}`}>{cls.label}</span>}
        </div>
        <span className="text-[12.5px] sm:text-[13px] text-[#5B6472]">
          {[course.professor, `${course.credits}학점`, course.schedule_raw, course.room, `분반 ${course.section}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <div className="flex items-center gap-2.5 max-w-[520px] mt-1">
          <div className="flex-1 h-1.5 rounded-[3px] bg-[#F1F4FA] overflow-hidden">
            <div
              className="h-full rounded-[3px] bg-[#F0913F]"
              style={{ width: `${topCourse?.count ? Math.max(4, Math.round((course.count / topCourse.count) * 100)) : 0}%` }}
            />
          </div>
          <span className="text-[13px] font-extrabold text-[#3A4150] whitespace-nowrap">{course.count}명이 담음</span>
        </div>
        {ratio != null && rank > 1 && (
          <span className="text-[12px] text-[#9AA3B2]">
            1위 {topCourse.course_name}({topCourse.count}명)의 {ratio}% 수준
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onAdd}
          disabled={added}
          className={`inline-flex items-center justify-center gap-1.5 px-[18px] py-2.5 rounded-[9px] text-[13.5px] font-bold transition-colors ${
            added ? 'bg-[#DFF5E6] text-[#1F8A54]' : 'bg-[#2F6FEB] text-white hover:bg-[#2559C4]'
          }`}
        >
          {added ? <Check size={15} strokeWidth={2.2} /> : <Plus size={15} strokeWidth={2.2} />}
          {added ? '이미 담음' : '내 시간표에 담기'}
        </button>
        <span className="text-center text-[12px] text-[#9AA3B2]">시간 겹침 자동 확인</span>
      </div>
    </div>
  );
}

// ---------- 페이지 ----------
export default function PopularPage() {
  const navigate = useNavigate();
  const { courses: myCourses, addCourse } = useSchedule();
  const { searchCourses } = useCourses();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: 'all', area: '', college: '', department: '' });
  const [departments, setDepartments] = useState([]);

  const [term, setTerm] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const searchBoxRef = useRef(null);

  const [sheet, setSheet] = useState(null); // 'area' | 'college' | 'department'

  const [fallback, setFallback] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  // 최근 검색어 로드
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(saved)) setRecent(saved.slice(0, RECENT_MAX));
    } catch {
      setRecent([]);
    }
  }, []);

  const pushRecent = useCallback((value) => {
    const keyword = value.trim();
    if (!keyword) return;
    setRecent(prev => {
      const next = [keyword, ...prev.filter(k => k !== keyword)].slice(0, RECENT_MAX);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* 저장 실패는 무시 */ }
      return next;
    });
  }, []);

  const removeRecent = (keyword) => {
    setRecent(prev => {
      const next = prev.filter(k => k !== keyword);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* 저장 실패는 무시 */ }
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch { /* 무시 */ }
  };

  // 단과대학 변경 시 학과 목록
  useEffect(() => {
    setDepartments(filters.college ? (getDepartmentsByCollege(filters.college) || []) : []);
  }, [filters.college]);

  // 인기 과목 로드
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const query = { limit: LIST_LIMIT };
      if (filters.category !== 'all') query.category = filters.category;
      if (filters.area) query.area = filters.area;
      if (filters.department) query.department = filters.department;

      const result = await getPopularCourses(query);
      if (!alive) return;
      setCourses(result.success ? result.courses : []);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [filters]);

  // 검색창 바깥 클릭 시 자동완성 닫기
  useEffect(() => {
    const onDown = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const isAdded = (course) =>
    myCourses.some(c => c.course_code === course.course_code && c.section === course.section);

  const handleAdd = (course) => {
    const result = addCourse(course);
    if (!result.success) alert(result.error);
  };

  const handleCategoryChange = (category) => {
    setFilters({ category, area: '', college: '', department: '' });
  };

  const resetFilters = () => setFilters({ category: 'all', area: '', college: '', department: '' });

  const showAreaFilter = filters.category === 'general_elective';
  const showCollegeFilter = filters.category === 'major' || filters.category === 'convergence';
  const needsDepartment = showCollegeFilter && !filters.department;

  // 순위가 매겨진 전체 목록 (검색과 무관하게 순위 고정)
  const ranked = useMemo(
    () => courses.map((course, index) => ({ course, rank: index + 1 })),
    [courses]
  );
  const maxCount = ranked[0]?.course.count || 0;
  const totalRecords = useMemo(() => courses.reduce((sum, c) => sum + (c.count || 0), 0), [courses]);

  const trimmed = term.trim();
  const searching = trimmed.length > 0;

  const matches = useMemo(() => {
    if (!searching) return [];
    const needle = trimmed.toLowerCase();
    return ranked.filter(({ course }) =>
      course.course_name?.toLowerCase().includes(needle) ||
      course.professor?.toLowerCase().includes(needle)
    );
  }, [ranked, trimmed, searching]);

  // 검색 결과가 1건이면 상세 카드 + 같은 시간대 과목
  const heroEntry = searching && matches.length === 1 ? matches[0] : null;
  const sameTimeCourses = useMemo(() => {
    if (!heroEntry) return [];
    const base = heroEntry.course.times?.length
      ? heroEntry.course.times
      : parseScheduleToTimes(heroEntry.course.schedule_raw);
    if (!base.length) return [];
    return ranked
      .filter(({ course }) => course.id !== heroEntry.course.id)
      .filter(({ course }) => {
        const other = course.times?.length ? course.times : parseScheduleToTimes(course.schedule_raw);
        return other.some(t2 => base.some(t1 => isTimeConflict(t1, t2)));
      })
      .slice(0, 5);
  }, [heroEntry, ranked]);

  // 자동완성 후보
  const suggestions = useMemo(() => (searching ? matches.slice(0, 5) : []), [matches, searching]);

  // 인기 집계에 없으면 전체 강의 목록에서 폴백 검색
  useEffect(() => {
    if (!searching || trimmed.length < 2 || matches.length > 0 || loading) {
      setFallback(prev => (prev.length ? [] : prev));
      setFallbackLoading(false);
      return;
    }
    let alive = true;
    setFallbackLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchCourses({ searchTerm: trimmed, limit: 100 });
      if (!alive) return;
      setFallback(results.slice(0, 20));
      setFallbackLoading(false);
    }, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, [searching, trimmed, matches.length, loading, searchCourses]);

  const areaOptions = AREA_OPTIONS;
  const collegeOptions = COLLEGES.filter(c => c !== '전체' && c !== '융합전공');

  const visible = searching ? matches : ranked;
  const top3 = searching ? [] : ranked.slice(0, 3);
  const rest = searching ? matches : ranked.slice(3);

  const showEmptyPrompt = needsDepartment && !searching;
  const showNoResult = searching && matches.length === 0 && !fallbackLoading && fallback.length === 0;

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <SiteHeader activeHref="/popular" title="인기 과목" badge={CURRENT_SEMESTER} />

      <main className="max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-7 flex flex-col gap-3.5 sm:gap-5">
        {/* 페이지 헤더 (데스크톱) */}
        <div className="hidden sm:flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-[9px]">
              <h1 className="text-[23px] font-extrabold text-[#1E2530] tracking-[-0.01em]">인기 과목</h1>
              <span className="px-2.5 py-1 rounded-full bg-[#FFF1E8] text-[#E2670F] text-[12px] font-extrabold">
                {formatSemester(CURRENT_SEMESTER)}
              </span>
            </div>
            <p className="text-[13px] text-[#8892A4]">
              다른 학생들이 시간표에 많이 담은 과목입니다. 수강신청 참고용으로만 활용하세요.
            </p>
          </div>
          <div className="flex items-center gap-3.5 flex-shrink-0">
            <div className="flex flex-col items-end gap-px">
              <span className="text-[22px] font-extrabold text-[#1E2530] leading-[1.1]">{totalRecords.toLocaleString()}</span>
              <span className="text-[12px] text-[#8892A4]">명의 담은 기록</span>
            </div>
            <div className="w-px h-[34px] bg-[#E4E8F0]" />
            <div className="flex flex-col items-end gap-px">
              <span className="text-[22px] font-extrabold text-[#1E2530] leading-[1.1]">{courses.length}</span>
              <span className="text-[12px] text-[#8892A4]">개 과목 집계</span>
            </div>
            <div className="w-px h-[34px] bg-[#E4E8F0]" />
            <span className="text-[12px] text-[#9AA3B2] whitespace-nowrap">5분 주기 갱신</span>
          </div>
        </div>

        {/* 필터 카드 */}
        <div className={`${CARD} px-4 py-3.5 sm:px-[18px] sm:py-4 flex flex-col gap-3`}>
          {/* 검색 */}
          <div className="flex items-center gap-2.5">
            <span className={`${LABEL} hidden sm:block w-[52px] flex-shrink-0`}>검색</span>
            <div className="flex-1 relative" ref={searchBoxRef}>
              <div
                className={`flex items-center gap-2.5 h-10 sm:h-[42px] px-3 sm:px-3.5 rounded-[11px] border transition-colors ${
                  suggestOpen || searching ? 'border-[1.5px] border-[#2F6FEB] bg-white' : 'border-[#E4E8F0] bg-[#FBFCFE]'
                }`}
              >
                <Search size={16} strokeWidth={1.7} className={suggestOpen || searching ? 'text-[#2F6FEB]' : 'text-[#9AA3B2]'} />
                <input
                  value={term}
                  onChange={(e) => { setTerm(e.target.value); setSuggestOpen(true); }}
                  onFocus={() => setSuggestOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { pushRecent(term); setSuggestOpen(false); }
                    if (e.key === 'Escape') setSuggestOpen(false);
                  }}
                  placeholder="과목명 또는 교수명으로 찾기"
                  className="flex-1 min-w-0 bg-transparent text-[13.5px] sm:text-[14px] font-semibold text-[#1E2530] placeholder:font-normal placeholder:text-[#B0B7C3] outline-none"
                />
                {term && (
                  <button
                    type="button"
                    onClick={() => { setTerm(''); setSuggestOpen(false); }}
                    className="w-5 h-5 sm:w-[22px] sm:h-[22px] rounded-full bg-[#F1F4FA] text-[#8892A4] flex items-center justify-center flex-shrink-0 hover:bg-[#E4E8F0]"
                  >
                    <X size={11} strokeWidth={2.4} />
                  </button>
                )}
              </div>

              {/* 자동완성 */}
              {suggestOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[46px] sm:top-12 bg-white border border-[#E4E8F0] rounded-xl shadow-[0_14px_34px_rgba(30,37,48,0.14)] overflow-hidden z-20">
                  <div className="px-3.5 py-2.5 bg-[#FBFCFE] border-b border-[#F3F5F8] flex items-center justify-between">
                    <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.05em]">
                      과목명 · 교수 일치 {matches.length}건
                    </span>
                    <span className="hidden sm:block text-[11.5px] text-[#B0B7C3]">Enter로 검색 저장</span>
                  </div>
                  {suggestions.map(({ course, rank }) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => { setTerm(course.course_name); pushRecent(course.course_name); setSuggestOpen(false); }}
                      className="w-full flex items-center gap-3 px-3.5 py-[11px] border-b border-[#F3F5F8] last:border-b-0 text-left hover:bg-[#F6F9FF] transition-colors"
                    >
                      <RankTag rank={rank} />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="text-[13.5px] font-bold text-[#1E2530] truncate">
                          <Highlight text={course.course_name} term={trimmed} />
                        </span>
                        <span className="text-[12px] text-[#8892A4] truncate">
                          {[course.professor, categoryBadge(course)?.label, course.schedule_raw].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <span className={`text-[12.5px] font-extrabold whitespace-nowrap ${rank <= 3 ? 'text-[#E2670F]' : 'text-[#3A4150]'}`}>
                        {course.count}명
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 최근 검색어 */}
          {recent.length > 0 && (
            <div className="flex items-center gap-2.5">
              <span className={`${LABEL} hidden sm:block w-[52px] flex-shrink-0`}>최근</span>
              <div className="flex gap-1.5 flex-wrap items-center">
                {recent.map(keyword => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-[5px] rounded-full bg-[#F6F8FB] border border-[#E4E8F0] text-[12px] font-semibold text-[#5B6472]"
                  >
                    <button type="button" onClick={() => { setTerm(keyword); setSuggestOpen(false); }}>{keyword}</button>
                    <button type="button" onClick={() => removeRecent(keyword)} className="text-[#B0B7C3] hover:text-[#5B6472]">
                      <X size={10} strokeWidth={2.4} />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={clearRecent} className="text-[12px] text-[#B0B7C3] px-1 py-[5px] hover:text-[#8892A4]">
                  전체 지우기
                </button>
              </div>
            </div>
          )}

          <div className="h-px bg-[#F3F5F8]" />

          {/* 구분 */}
          <div className="flex items-center gap-2.5">
            <span className={`${LABEL} hidden sm:block w-[52px] flex-shrink-0`}>구분</span>
            <div className="flex gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {CATEGORY_OPTIONS.map(opt => (
                <CategoryChip
                  key={opt.value}
                  active={filters.category === opt.value}
                  label={opt.label}
                  onClick={() => handleCategoryChange(opt.value)}
                />
              ))}
            </div>
          </div>

          {/* 영역 (교양선택) */}
          {showAreaFilter && (
            <>
              <div className="h-px bg-[#F3F5F8]" />
              <div className="flex items-start gap-2.5">
                <span className={`${LABEL} hidden sm:block w-[52px] flex-shrink-0 pt-[7px]`}>영역</span>
                {/* 데스크톱: 칩 */}
                <div className="hidden sm:flex gap-1.5 flex-wrap">
                  {areaOptions.map(opt => (
                    <PillChip
                      key={opt.value || 'all'}
                      active={filters.area === opt.value}
                      label={opt.label}
                      onClick={() => setFilters(f => ({ ...f, area: opt.value }))}
                    />
                  ))}
                </div>
                {/* 모바일: 바텀시트 */}
                <button
                  type="button"
                  onClick={() => setSheet('area')}
                  className="sm:hidden flex-1 flex items-center justify-between px-3 py-2 rounded-[9px] bg-[#EAF1FE] text-[#2F6FEB] text-[12.5px] font-bold"
                >
                  {areaOptions.find(o => o.value === filters.area)?.label || '전체 영역'}
                  <ChevronDown size={12} strokeWidth={2} />
                </button>
              </div>
            </>
          )}

          {/* 단과대 / 학과 (전공·융합전공) */}
          {showCollegeFilter && (
            <>
              <div className="h-px bg-[#F3F5F8]" />
              <div className="flex items-start gap-2.5">
                <span className={`${LABEL} hidden sm:block w-[52px] flex-shrink-0 pt-[7px]`}>단과대</span>
                <div className="hidden sm:flex gap-1.5 flex-wrap">
                  {collegeOptions.map(college => (
                    <PillChip
                      key={college}
                      active={filters.college === college}
                      label={college}
                      onClick={() => setFilters(f => ({ ...f, college: f.college === college ? '' : college, department: '' }))}
                    />
                  ))}
                </div>
                {/* 모바일: 단과대 + 학과 드롭다운 2개 */}
                <div className="sm:hidden flex gap-1.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSheet('college')}
                    className={`flex-1 min-w-0 flex items-center justify-between gap-1 px-3 py-2 rounded-[9px] text-[12.5px] font-bold ${
                      filters.college ? 'bg-[#EAF1FE] text-[#2F6FEB]' : 'bg-[#F6F8FB] border border-[#E4E8F0] text-[#5B6472]'
                    }`}
                  >
                    <span className="truncate">{filters.college || '단과대학'}</span>
                    <ChevronDown size={12} strokeWidth={2} className="flex-shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => filters.college && setSheet('department')}
                    disabled={!filters.college}
                    className={`flex-1 min-w-0 flex items-center justify-between gap-1 px-3 py-2 rounded-[9px] text-[12.5px] font-bold ${
                      filters.department
                        ? 'bg-[#2F6FEB] text-white'
                        : filters.college
                          ? 'bg-[#F6F8FB] border border-[#E4E8F0] text-[#5B6472]'
                          : 'bg-[#F6F8FB] border border-[#EEF1F5] text-[#C4CCD8]'
                    }`}
                  >
                    <span className="truncate">{filters.department || '학과'}</span>
                    <ChevronDown size={12} strokeWidth={2} className="flex-shrink-0" />
                  </button>
                </div>
              </div>

              {/* 데스크톱 학과 칩 */}
              {filters.college ? (
                <div className="hidden sm:flex items-start gap-2.5 p-3 rounded-[11px] bg-[#FBFCFE] border border-[#EEF1F5]">
                  <span className={`${LABEL} w-10 flex-shrink-0 pt-1.5`}>학과</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {departments.map(dept => (
                      <PillChip
                        key={dept}
                        tone="solid"
                        active={filters.department === dept}
                        label={dept}
                        onClick={() => setFilters(f => ({ ...f, department: f.department === dept ? '' : dept }))}
                      />
                    ))}
                    {departments.length === 0 && (
                      <span className="text-[12.5px] text-[#B0B7C3] py-1.5">학과 정보가 없습니다</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2.5">
                  <span className="text-[11.5px] font-extrabold text-[#C4CCD8] tracking-[0.06em] w-[52px] flex-shrink-0">학과</span>
                  <span className="text-[12.5px] text-[#B0B7C3]">단과대학을 먼저 선택하세요</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 선택 요약 + 초기화 */}
        {(filters.category !== 'all' || filters.area || filters.department) && !searching && (
          <div className="flex items-center justify-between gap-4 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] sm:text-[14px] font-extrabold text-[#1E2530] truncate">
                {[
                  CATEGORY_OPTIONS.find(o => o.value === filters.category)?.label,
                  filters.college,
                  filters.department,
                  filters.area,
                ].filter(Boolean).join(' · ')}
              </span>
              <span className="text-[12px] sm:text-[12.5px] text-[#8892A4] whitespace-nowrap">{courses.length}개 과목 집계</span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 sm:px-[11px] py-[5px] rounded-full bg-white border border-[#E4E8F0] text-[12px] font-semibold text-[#5B6472] whitespace-nowrap hover:bg-[#F6F8FB]"
            >
              필터 초기화
            </button>
          </div>
        )}

        {/* 검색 요약 */}
        {searching && !loading && (
          <p className="text-[11.5px] sm:text-[12.5px] text-[#8892A4] px-1">
            "{trimmed}" 검색 결과 {matches.length}개 · 순위는 전체 {ranked.length}개 기준
          </p>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-[#2F6FEB]" size={30} />
            <p className="text-[13px] text-[#8892A4]">인기 과목을 불러오는 중...</p>
          </div>
        )}

        {/* 전공: 학과 미선택 안내 */}
        {!loading && showEmptyPrompt && (
          <div className="bg-white border border-dashed border-[#D9E4FB] rounded-[14px] px-6 py-11 flex flex-col items-center gap-2.5">
            <span className="w-11 h-11 rounded-full bg-[#EAF1FE] flex items-center justify-center">
              <ArrowUp size={22} strokeWidth={1.6} className="text-[#2F6FEB]" />
            </span>
            <span className="text-[15px] font-extrabold text-[#1E2530]">단과대학과 학과를 선택해 주세요</span>
            <p className="text-[13px] text-[#8892A4] text-center max-w-[520px]">
              전공 과목은 학과별로 집계됩니다. 학과를 고르면 해당 학과에서 많이 담은 과목이 순위로 보입니다.
            </p>
          </div>
        )}

        {/* 집계 없음 */}
        {!loading && !showEmptyPrompt && !searching && ranked.length === 0 && (
          <div className={`${CARD} px-6 py-16 flex flex-col items-center gap-2.5`}>
            <span className="text-[15px] font-extrabold text-[#1E2530]">아직 집계된 과목이 없어요</span>
            <p className="text-[13px] text-[#8892A4] text-center">
              학생들이 시간표에 과목을 담으면 여기에 순위로 표시됩니다.
            </p>
          </div>
        )}

        {/* 결과 */}
        {!loading && !showEmptyPrompt && (
          <>
            {/* 검색 1건 — 상세 카드 */}
            {heroEntry && (
              <HeroResult
                course={heroEntry.course}
                rank={heroEntry.rank}
                total={ranked.length}
                topCourse={ranked[0]?.course}
                added={isAdded(heroEntry.course)}
                onAdd={() => handleAdd(heroEntry.course)}
              />
            )}

            {/* TOP 3 (데스크톱, 검색 중이 아닐 때) */}
            {top3.length > 0 && (
              <div className="hidden lg:grid grid-cols-3 gap-3.5">
                {top3.map(({ course, rank }) => (
                  <TopCard
                    key={course.id}
                    course={course}
                    rank={rank}
                    max={maxCount}
                    added={isAdded(course)}
                    onAdd={() => handleAdd(course)}
                  />
                ))}
              </div>
            )}

            {/* 같은 시간대 과목 제목 */}
            {heroEntry && sameTimeCourses.length > 0 && (
              <span className="text-[12.5px] font-extrabold text-[#5B6472] px-1 -mb-1">
                같은 시간대에 많이 담긴 다른 과목
              </span>
            )}

            {/* 데스크톱 표 */}
            {(heroEntry ? sameTimeCourses : rest).length > 0 && (
              <div className={`${CARD} hidden lg:block overflow-hidden`}>
                {!heroEntry && (
                  <div className={`grid ${GRID_COLS} items-center gap-3.5 px-5 py-[11px] bg-[#FBFCFE] border-b border-[#EEF1F5]`}>
                    <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.05em]">순위</span>
                    <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.05em]">과목명</span>
                    <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.05em]">교수</span>
                    <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.05em]">시간</span>
                    <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.05em]">담은 인원</span>
                    <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.05em] text-right">담기</span>
                  </div>
                )}
                {(heroEntry ? sameTimeCourses : rest).map(({ course, rank }) => (
                  <RankRow
                    key={course.id}
                    course={course}
                    rank={rank}
                    max={maxCount}
                    term={searching ? trimmed : ''}
                    circleRank={searching && rank <= 3}
                    added={isAdded(course)}
                    onAdd={() => handleAdd(course)}
                  />
                ))}
              </div>
            )}

            {/* 모바일 카드 목록 */}
            <div className="lg:hidden flex flex-col gap-2.5">
              {(heroEntry ? sameTimeCourses : visible).map(({ course, rank }) => (
                <MobileCard
                  key={course.id}
                  course={course}
                  rank={rank}
                  max={maxCount}
                  term={searching ? trimmed : ''}
                  tag={searching}
                  added={isAdded(course)}
                  onAdd={() => handleAdd(course)}
                />
              ))}
            </div>

            {/* 폴백 — 인기 집계에 없는 과목 */}
            {searching && matches.length === 0 && fallbackLoading && (
              <div className="flex flex-col items-center gap-3 py-14">
                <Loader2 className="animate-spin text-[#2F6FEB]" size={28} />
                <span className="text-[13px] font-bold text-[#5B6472]">전체 강의 목록에서 찾는 중…</span>
                <span className="text-[11.5px] text-[#B0B7C3]">순위 집계에 없는 과목만 여기서 조회합니다</span>
              </div>
            )}

            {searching && matches.length === 0 && !fallbackLoading && fallback.length > 0 && (
              <>
                <div className="flex items-start sm:items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#FBFCFE] border border-[#EEF1F5]">
                  <Info size={16} strokeWidth={1.7} className="text-[#8892A4] flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span className="text-[12px] sm:text-[13px] leading-[1.55] text-[#5B6472]">
                    아직 아무도 담지 않은 과목이라 순위가 없습니다. 전체 강의 목록에서 찾은 결과를 보여드릴게요.
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 px-1">
                  <span className="text-[12px] sm:text-[12.5px] font-extrabold text-[#5B6472]">
                    아직 순위 없는 과목 <span className="text-[#B0B7C3] font-semibold">{fallback.length}건</span>
                  </span>
                  <span className="hidden sm:block text-[12px] text-[#9AA3B2]">담으면 다음 갱신부터 순위에 반영됩니다</span>
                </div>

                <div className="hidden lg:block bg-white border border-dashed border-[#E4E8F0] rounded-[14px] overflow-hidden">
                  {fallback.map(course => (
                    <RankRow
                      key={course.id}
                      course={course}
                      unranked
                      max={maxCount}
                      term={trimmed}
                      added={isAdded(course)}
                      onAdd={() => handleAdd(course)}
                    />
                  ))}
                </div>

                <div className="lg:hidden flex flex-col gap-2.5">
                  {fallback.map(course => (
                    <MobileCard
                      key={course.id}
                      course={course}
                      unranked
                      max={maxCount}
                      term={trimmed}
                      added={isAdded(course)}
                      onAdd={() => handleAdd(course)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* 검색 결과 없음 */}
            {showNoResult && (
              <div className={`${CARD} px-6 py-12 flex flex-col items-center gap-2.5`}>
                <span className="w-11 h-11 rounded-full bg-[#F1F4FA] flex items-center justify-center">
                  <Search size={21} strokeWidth={1.7} className="text-[#9AA3B2]" />
                </span>
                <span className="text-[14.5px] font-extrabold text-[#1E2530]">검색 결과가 없어요</span>
                <p className="text-[12.5px] leading-[1.55] text-[#8892A4] text-center max-w-[360px]">
                  아직 아무도 담지 않았거나 이번 학기에 개설되지 않은 과목일 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setTerm('')}
                  className="mt-1 px-3.5 py-2 rounded-[9px] bg-white border border-[#E4E8F0] text-[12.5px] font-bold text-[#2F6FEB] hover:bg-[#F6F8FB]"
                >
                  전체 순위로 돌아가기
                </button>
              </div>
            )}
          </>
        )}

        {/* 하단 안내 */}
        {!loading && (
          <p className="text-center text-[11.5px] sm:text-[12px] leading-[1.55] text-[#9AA3B2] mt-1">
            이 서비스에서 담은 횟수 기준입니다.
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>
            실제 수강신청 경쟁률과는 다를 수 있어요.
          </p>
        )}
      </main>

      {/* 모바일 바텀시트 */}
      <BottomSheet
        open={sheet === 'area'}
        title="영역 선택"
        options={areaOptions}
        value={filters.area}
        onSelect={(value) => setFilters(f => ({ ...f, area: value }))}
        onClose={() => setSheet(null)}
      />
      <BottomSheet
        open={sheet === 'college'}
        title="단과대학 선택"
        subtitle={`${collegeOptions.length}개`}
        options={[{ value: '', label: '전체' }, ...collegeOptions.map(c => ({ value: c, label: c }))]}
        value={filters.college}
        onSelect={(value) => setFilters(f => ({ ...f, college: value, department: '' }))}
        onClose={() => setSheet(null)}
      />
      <BottomSheet
        open={sheet === 'department'}
        title="학과 선택"
        subtitle={`${filters.college} · ${departments.length}개`}
        options={[{ value: '', label: '전체' }, ...departments.map(d => ({ value: d, label: d }))]}
        value={filters.department}
        onSelect={(value) => setFilters(f => ({ ...f, department: value }))}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
