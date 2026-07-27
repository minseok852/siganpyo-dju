// src/pages/UpdateLogPage.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Settings,
  Loader2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { getUpdates } from '../services/updateService';
import SiteHeader from '../components/SiteHeader';

// 변경사항 타입별 스타일
const TYPE_CONFIG = {
  release: { label: '출시',      short: '출시', chip: 'bg-[#DFF5E6] text-[#1F8A54]', dot: 'bg-[#1FA97A]', text: 'text-[#1F8A54]' },
  feature: { label: '새 기능',   short: '기능', chip: 'bg-[#EAF1FE] text-[#2F6FEB]', dot: 'bg-[#2F6FEB]', text: 'text-[#2F6FEB]' },
  improve: { label: '개선',      short: '개선', chip: 'bg-[#FFF1C4] text-[#9C7A0E]', dot: 'bg-[#E0B429]', text: 'text-[#9C7A0E]' },
  fix:     { label: '버그 수정', short: '수정', chip: 'bg-[#FEF4F4] text-[#E5484D]', dot: 'bg-[#E5484D]', text: 'text-[#E5484D]' },
};
const TYPE_ORDER = ['release', 'feature', 'improve', 'fix'];

const CARD = 'bg-white border border-[#EBEEF3] rounded-[14px]';

// ---------- 날짜 유틸 ----------
// update.date 는 관리자 폼에서 'YYYY-MM-DD' 로 저장됨
function toDate(update) {
  if (update?.date) {
    const d = new Date(update.date);
    if (!isNaN(d)) return d;
  }
  if (update?.createdAt instanceof Date && !isNaN(update.createdAt)) return update.createdAt;
  return null;
}

function formatFull(update) {
  const d = toDate(update);
  if (!d) return update?.date || '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatShort(update) {
  const d = toDate(update);
  if (!d) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoLabel(update) {
  const d = toDate(update);
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일`;
}

// 타입별 개수 집계 (TYPE_ORDER 순서 유지)
function countByType(changes = []) {
  const counts = {};
  changes.forEach(c => {
    if (TYPE_CONFIG[c?.type]) counts[c.type] = (counts[c.type] || 0) + 1;
  });
  return TYPE_ORDER.filter(t => counts[t]).map(t => [t, counts[t]]);
}

// ---------- 작은 조각들 ----------
function CountBadge({ type, count, compact = false }) {
  const config = TYPE_CONFIG[type];
  if (!config) return null;
  return (
    <span className={`px-[9px] py-1 rounded-md text-[11px] font-bold whitespace-nowrap ${config.chip}`}>
      {compact ? config.short : config.label} {count}
    </span>
  );
}

function VersionPill({ version }) {
  return (
    <span className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-full bg-[#EAF1FE] text-[#2F6FEB] text-[11.5px] sm:text-[12px] font-extrabold whitespace-nowrap">
      <span className="w-[5px] h-[5px] sm:w-1.5 sm:h-1.5 rounded-full bg-[#2F6FEB]" />
      현재 v{version}
    </span>
  );
}

// 필터 칩 (사이드바 / 모바일 공용)
function FilterChip({ active, label, count, type, onClick }) {
  const config = TYPE_CONFIG[type];
  const base = 'px-3 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap flex-shrink-0 transition-colors';
  if (active) {
    return (
      <button type="button" onClick={onClick} className={`${base} bg-[#1E2530] text-white`}>
        {label}{count != null && ` ${count}`}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${config ? `${config.chip} hover:brightness-95` : 'bg-white border border-[#E4E8F0] text-[#5B6472] hover:bg-[#F6F8FB]'}`}
    >
      {label}{count != null && ` ${count}`}
    </button>
  );
}

// ---------- 릴리스 카드 ----------
function ReleaseCard({ update, isLatest, expanded, onToggle, activeType, cardRef }) {
  const changes = update.changes || [];
  const visibleChanges = activeType === 'all' ? changes : changes.filter(c => c.type === activeType);
  const counts = countByType(visibleChanges);

  // 타입별 그룹 (본문)
  const groups = TYPE_ORDER
    .map(type => [type, visibleChanges.filter(c => c.type === type)])
    .filter(([, list]) => list.length > 0);

  return (
    <div
      ref={cardRef}
      className={`scroll-mt-[76px] rounded-[14px] bg-white overflow-hidden ${
        isLatest
          ? 'border border-[#D9E4FB] shadow-[0_4px_16px_rgba(47,111,235,0.08)]'
          : 'border border-[#EBEEF3]'
      }`}
    >
      {/* 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left px-4 sm:px-6 py-3.5 sm:py-5 flex items-start justify-between gap-3 sm:gap-5 transition-colors ${
          isLatest ? 'bg-[#FBFCFE]' : 'hover:bg-[#FAFBFD]'
        } ${expanded ? 'border-b border-[#EEF1F5]' : ''}`}
      >
        <div className="flex flex-col gap-1.5 sm:gap-[7px] min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            {isLatest && (
              <span className="px-2 py-[3px] rounded-md bg-[#2F6FEB] text-white text-[10.5px] font-extrabold tracking-[0.04em]">
                NEW
              </span>
            )}
            <span className={`font-extrabold text-[#1E2530] ${isLatest ? 'text-[13px] sm:text-[15px]' : 'text-[12.5px] sm:text-[14px]'}`}>
              v{update.version}
            </span>
            <span className="text-[11.5px] sm:text-[12.5px] text-[#9AA3B2]">{formatFull(update)}</span>
          </div>

          <h2 className={`font-extrabold text-[#1E2530] tracking-[-0.01em] [overflow-wrap:anywhere] ${
            isLatest ? 'text-[15.5px] sm:text-[19px]' : 'text-[14px] sm:text-[15.5px]'
          }`}>
            {update.title}
          </h2>

          {update.highlights && (
            <p className="text-[12.5px] sm:text-[13.5px] leading-[1.55] text-[#5B6472] max-w-[640px]">
              {update.highlights}
            </p>
          )}

          {/* 접혀 있을 때: 모바일에서는 여기 뱃지 노출 */}
          {!expanded && counts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-0.5 sm:hidden">
              {counts.map(([type, count]) => (
                <CountBadge key={type} type={type} count={count} compact />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {counts.length > 0 && (
            <div className="hidden sm:flex gap-1.5">
              {counts.map(([type, count]) => (
                <CountBadge key={type} type={type} count={count} compact={!isLatest} />
              ))}
            </div>
          )}
          <ChevronDown
            size={18}
            strokeWidth={1.7}
            className={`text-[#B0B7C3] transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* 본문 — 타입별 그룹 */}
      {expanded && (
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          {groups.length === 0 && (
            <p className="text-[12.5px] text-[#B0B7C3]">표시할 변경사항이 없습니다.</p>
          )}
          {groups.map(([type, list], gi) => {
            const config = TYPE_CONFIG[type];
            return (
              <div key={type}>
                {gi > 0 && <div className="h-px bg-[#F3F5F8] my-4 sm:my-[18px]" />}
                <div className="sm:grid sm:grid-cols-[104px_1fr] sm:gap-3.5 sm:items-start">
                  <div className="flex items-center gap-1.5 sm:pt-0.5">
                    <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${config.dot}`} />
                    <span className={`text-[11.5px] sm:text-[12px] font-extrabold ${config.text}`}>
                      {config.label}
                      <span className="sm:hidden"> {list.length}</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-[7px] sm:gap-[9px] pl-3 sm:pl-0 mt-1.5 sm:mt-0">
                    {list.map((change, i) => (
                      <div key={i} className="flex gap-2 sm:gap-[9px] items-start">
                        <span className="w-1 h-1 rounded-full bg-[#C4CCD8] mt-[7px] flex-shrink-0" />
                        <span className="text-[12.5px] sm:text-[13.5px] leading-[1.5] text-[#3A4150] [overflow-wrap:anywhere]">
                          {change.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- 페이지 ----------
export default function UpdateLogPage() {
  const navigate = useNavigate();
  const [updates, setUpdates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeType, setActiveType] = useState('all');
  const [expandedIds, setExpandedIds] = useState([]);
  const cardRefs = useRef({});

  const fetchUpdates = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getUpdates();
    if (result.success) {
      setUpdates(result.updates);
      setExpandedIds(result.updates[0] ? [result.updates[0].id] : []);
    } else {
      setError('업데이트 내역을 불러오는데 실패했습니다.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  const latest = updates[0];
  const totalChanges = updates.reduce((sum, u) => sum + (u.changes?.length || 0), 0);

  // 전체 변경사항 타입별 집계 (필터 칩용)
  const totalCounts = useMemo(
    () => countByType(updates.flatMap(u => u.changes || [])),
    [updates]
  );

  // 필터 적용된 버전 목록
  const visibleUpdates = useMemo(() => {
    if (activeType === 'all') return updates;
    return updates.filter(u => (u.changes || []).some(c => c.type === activeType));
  }, [updates, activeType]);

  const toggleExpanded = (id) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const jumpToVersion = (id) => {
    setExpandedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasContent = !isLoading && !error && updates.length > 0;

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <SiteHeader
        activeHref="/updates"
        title="업데이트 내역"
        right={
          <button
            onClick={() => navigate('/updates/admin')}
            className="w-8 h-8 rounded-full bg-[#F1F4FA] hover:bg-[#E4E8F0] flex items-center justify-center text-[#8892A4] transition-colors flex-shrink-0"
            title="관리자"
          >
            <Settings size={16} strokeWidth={1.6} />
          </button>
        }
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-7">
        {/* 로딩 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="animate-spin text-[#2F6FEB] mb-3" size={30} />
            <p className="text-[13px] text-[#8892A4]">불러오는 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && !isLoading && (
          <div className="text-center py-16">
            <p className="text-[13.5px] text-[#E5484D] mb-3">{error}</p>
            <button
              onClick={fetchUpdates}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-[#2F6FEB] bg-[#EAF1FE] hover:bg-[#DCE8FD] transition-colors"
            >
              <RefreshCw size={14} />
              다시 시도
            </button>
          </div>
        )}

        {/* 내용 없음 */}
        {!isLoading && !error && updates.length === 0 && (
          <div className="text-center py-24">
            <FileText className="mx-auto text-[#D3D9E3] mb-3" size={38} strokeWidth={1.5} />
            <p className="text-[13.5px] text-[#8892A4]">아직 업데이트 내역이 없습니다.</p>
          </div>
        )}

        {hasContent && (
          <div className="flex flex-col gap-3.5 sm:gap-[22px]">
            {/* 요약 카드 */}
            <div className={`${CARD} px-4 py-3.5 sm:px-6 sm:py-[22px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-6`}>
              <div className="flex flex-col gap-1.5 sm:gap-1.5 min-w-0">
                <div className="flex items-center flex-wrap gap-2 sm:gap-[9px]">
                  <h1 className="hidden sm:block text-[23px] font-extrabold text-[#1E2530] tracking-[-0.01em]">
                    업데이트 내역
                  </h1>
                  <VersionPill version={latest?.version} />
                  {daysAgoLabel(latest) && (
                    <span className="sm:hidden text-[11.5px] text-[#9AA3B2]">
                      {daysAgoLabel(latest)} 전 배포
                    </span>
                  )}
                </div>
                <p className="hidden sm:block text-[13px] text-[#8892A4]">
                  무엇이 바뀌었고 무엇이 고쳐졌는지 버전별로 정리해 둡니다.
                </p>
              </div>

              {/* 통계 */}
              <div className="flex items-stretch flex-shrink-0">
                <div className="flex-1 sm:flex-none flex flex-col gap-px sm:gap-0.5 sm:px-[22px] border-r border-[#EEF1F5]">
                  <span className="text-[21px] sm:text-[26px] font-extrabold text-[#1E2530] leading-[1.1]">
                    {updates.length}
                  </span>
                  <span className="text-[11.5px] sm:text-[12.5px] text-[#8892A4]">번의 업데이트</span>
                </div>
                <div className={`flex-1 sm:flex-none flex flex-col gap-px sm:gap-0.5 pl-4 sm:pl-[22px] sm:pr-[22px] ${
                  daysAgoLabel(latest) ? 'sm:border-r sm:border-[#EEF1F5]' : ''
                }`}>
                  <span className="text-[21px] sm:text-[26px] font-extrabold text-[#1E2530] leading-[1.1]">
                    {totalChanges}
                  </span>
                  <span className="text-[11.5px] sm:text-[12.5px] text-[#8892A4]">개의 변경사항</span>
                </div>
                {daysAgoLabel(latest) && (
                  <div className="hidden sm:flex flex-col gap-0.5 pl-[22px] pr-1">
                    <span className="text-[26px] font-extrabold text-[#1FA97A] leading-[1.1]">
                      {daysAgoLabel(latest)}
                    </span>
                    <span className="text-[12.5px] text-[#8892A4]">전 최신 배포</span>
                  </div>
                )}
              </div>
            </div>

            {/* 모바일 필터 */}
            <div className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
              <FilterChip
                active={activeType === 'all'}
                label="전체"
                onClick={() => setActiveType('all')}
              />
              {totalCounts.map(([type, count]) => (
                <FilterChip
                  key={type}
                  active={activeType === type}
                  label={TYPE_CONFIG[type].short}
                  count={count}
                  type={type}
                  onClick={() => setActiveType(activeType === type ? 'all' : type)}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[236px_1fr] gap-[22px] items-start">
              {/* 사이드바 — 버전 인덱스 + 필터 */}
              <aside className={`${CARD} hidden lg:flex flex-col gap-3.5 p-4 sticky top-[76px]`}>
                <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.06em]">VERSIONS</span>
                <div className="flex flex-col gap-0.5 max-h-[320px] overflow-y-auto no-scrollbar">
                  {updates.map((update, index) => {
                    const isLatest = index === 0;
                    return (
                      <button
                        key={update.id}
                        type="button"
                        onClick={() => jumpToVersion(update.id)}
                        className={`flex items-center gap-2.5 px-2.5 py-[9px] rounded-[9px] text-left transition-colors ${
                          isLatest ? 'bg-[#EAF1FE]' : 'hover:bg-[#F6F8FB]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isLatest ? 'bg-[#2F6FEB]' : 'bg-[#D3D9E3]'}`} />
                        <span className={`text-[13px] ${isLatest ? 'font-extrabold text-[#2F6FEB]' : 'font-bold text-[#5B6472]'}`}>
                          v{update.version}
                        </span>
                        <span className={`ml-auto text-[11.5px] ${isLatest ? 'text-[#7FA3EE]' : 'text-[#B0B7C3]'}`}>
                          {formatShort(update)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="h-px bg-[#F3F5F8]" />

                <div className="flex flex-col gap-2">
                  <span className="text-[11.5px] font-extrabold text-[#9AA3B2] tracking-[0.06em]">FILTER</span>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      active={activeType === 'all'}
                      label="전체"
                      count={totalChanges}
                      onClick={() => setActiveType('all')}
                    />
                    {totalCounts.map(([type, count]) => (
                      <FilterChip
                        key={type}
                        active={activeType === type}
                        label={TYPE_CONFIG[type].label}
                        count={count}
                        type={type}
                        onClick={() => setActiveType(activeType === type ? 'all' : type)}
                      />
                    ))}
                  </div>
                </div>

                <div className="h-px bg-[#F3F5F8]" />

                <div className="flex flex-col gap-2">
                  <p className="text-[11.5px] leading-[1.55] text-[#8892A4]">
                    고쳐야 할 게 보이면 알려주세요. 대부분 다음 배포에 반영됩니다.
                  </p>
                  <button
                    onClick={() => navigate('/feedback')}
                    className="text-left text-[12px] font-bold text-[#2F6FEB] hover:text-[#2559C4] transition-colors"
                  >
                    피드백 보내기 →
                  </button>
                </div>
              </aside>

              {/* 릴리스 스트림 */}
              <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
                {visibleUpdates.length === 0 && (
                  <div className={`${CARD} px-5 py-10 text-center`}>
                    <p className="text-[13px] text-[#8892A4]">
                      해당 유형의 변경사항이 없습니다.
                    </p>
                  </div>
                )}

                {visibleUpdates.map(update => (
                  <ReleaseCard
                    key={update.id}
                    update={update}
                    isLatest={latest?.id === update.id}
                    expanded={expandedIds.includes(update.id)}
                    onToggle={() => toggleExpanded(update.id)}
                    activeType={activeType}
                    cardRef={el => { cardRefs.current[update.id] = el; }}
                  />
                ))}

                {/* 모바일 하단 피드백 안내 */}
                <div className={`${CARD} lg:hidden px-4 py-3.5 flex flex-col gap-2.5`}>
                  <p className="text-[12px] leading-[1.55] text-[#8892A4]">
                    고쳐야 할 게 보이면 알려주세요. 대부분 다음 배포에 반영됩니다.
                  </p>
                  <button
                    onClick={() => navigate('/feedback')}
                    className="text-left text-[12.5px] font-bold text-[#2F6FEB]"
                  >
                    피드백 보내기 →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
