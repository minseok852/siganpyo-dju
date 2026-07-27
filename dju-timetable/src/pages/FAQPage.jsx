// src/pages/FAQPage.jsx
import { useState, useMemo } from 'react';
import {
  Search, X, ChevronDown, LayoutGrid, ExternalLink, Phone,
  AlertTriangle, Info, Check, Star,
} from 'lucide-react';
import SiteHeader from '../components/SiteHeader';
import { FAQ_TABS, COURSE_META, CONTACT, TONES } from '../data/faqData';

const CARD = 'bg-white border border-[#EBEEF3] rounded-[14px]';

const CALLOUT_ICONS = { warn: AlertTriangle, info: Info, ok: Check, accent: Star };

// ---------- 답변 블록 렌더 ----------
function Block({ block }) {
  if (block.type === 'p') {
    return (
      <p className={`text-[13px] sm:text-[13.5px] leading-[1.65] ${
        block.strong ? 'font-bold text-[#1E2530]' : 'font-medium text-[#5B6472]'
      }`}>
        {block.text}
      </p>
    );
  }

  if (block.type === 'list') {
    return (
      <div className="flex flex-col gap-1.5 sm:gap-[7px]">
        {block.items.map((text, i) => (
          <div key={i} className="flex gap-2 sm:gap-2.5 items-start">
            <span className="text-[11px] font-extrabold text-[#9AA3B2] min-w-[13px] sm:min-w-[14px] mt-0.5 flex-shrink-0">
              {block.ordered ? `${i + 1}.` : '•'}
            </span>
            <span className="text-[12.5px] sm:text-[13px] leading-[1.6] text-[#5B6472]">{text}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="border border-[#EBEEF3] rounded-[10px] sm:rounded-[11px] overflow-x-auto">
        <div className="grid min-w-[300px]" style={{ gridTemplateColumns: block.cols }}>
          {block.head.map((h, i) => (
            <div
              key={`h-${i}`}
              className={`px-2.5 py-2.5 sm:px-3 sm:py-2.5 text-[12px] sm:text-[12.5px] font-bold text-[#8892A4] bg-[#F6F8FB] border-b border-[#F1F4FA] leading-[1.5] ${
                i === 0 ? 'text-left' : 'text-center'
              }`}
            >
              {h}
            </div>
          ))}
          {block.rows.map((row, ri) =>
            row.map((cell, ci) => (
              <div
                key={`${ri}-${ci}`}
                className={`px-2.5 py-2.5 sm:px-3 sm:py-2.5 text-[12px] sm:text-[12.5px] border-b border-[#F1F4FA] leading-[1.5] ${
                  ri % 2 === 1 ? 'bg-[#FBFCFE]' : 'bg-white'
                } ${ci === 0 ? 'text-left font-bold text-[#3A4150]' : 'text-center font-semibold text-[#1E2530]'}`}
              >
                {cell}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (block.type === 'callout') {
    const tone = TONES[block.tone] || TONES.info;
    const Icon = CALLOUT_ICONS[block.tone] || Info;
    return (
      <div className={`flex items-start gap-2 sm:gap-2.5 border rounded-[10px] sm:rounded-[11px] px-3 py-3 sm:px-3.5 ${tone.box}`}>
        <Icon size={15} strokeWidth={1.7} className={`flex-shrink-0 mt-px ${tone.icon}`} />
        <span className={`text-[12.5px] sm:text-[13px] leading-[1.6] ${tone.text}`}>{block.text}</span>
      </div>
    );
  }

  if (block.type === 'steps') {
    return (
      <div className="flex flex-col gap-2">
        {block.items.map((s, i) => (
          <div key={i} className="flex gap-2.5 sm:gap-[11px] items-start bg-[#F6F8FB] border border-[#EEF1F5] rounded-[10px] sm:rounded-[11px] px-3 py-3 sm:px-3.5">
            <span className="w-5 h-5 rounded-full bg-[#2F6FEB] text-white text-[11.5px] font-extrabold flex items-center justify-center flex-shrink-0 mt-px">
              {s.n}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[12.5px] sm:text-[13px] font-bold text-[#1E2530]">{s.title}</span>
              <span className="text-[12px] sm:text-[12.5px] leading-[1.55] text-[#8892A4]">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ---------- 질문 한 줄 ----------
function QuestionRow({ item, open, onToggle, last }) {
  return (
    <div className={last ? '' : 'border-b border-[#F1F4FA]'}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-start sm:items-center gap-2.5 sm:gap-3 px-3.5 py-3.5 sm:px-[18px] sm:py-4 text-left transition-colors ${
          open ? 'bg-[#FBFCFE]' : 'bg-white hover:bg-[#FBFCFE]'
        }`}
      >
        <span className={`w-5 h-5 sm:w-[22px] sm:h-[22px] rounded-md text-[11px] sm:text-[11.5px] font-extrabold flex items-center justify-center flex-shrink-0 mt-px sm:mt-0 ${
          open ? 'bg-[#2F6FEB] text-white' : 'bg-[#EEF1F6] text-[#9AA3B2]'
        }`}>
          Q
        </span>
        <span className={`flex-1 text-[13.5px] sm:text-[14px] leading-[1.5] sm:leading-[1.45] text-[#1E2530] ${
          open ? 'font-extrabold' : 'font-semibold'
        }`}>
          {item.q}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.9}
          className={`flex-shrink-0 mt-px sm:mt-0 transition-transform ${open ? 'rotate-180 text-[#2F6FEB]' : 'text-[#B0B7C3]'}`}
        />
      </button>

      {open && (
        <div className="px-3.5 pb-4 sm:pl-[52px] sm:pr-[18px] sm:pb-5 flex flex-col gap-2.5 sm:gap-3">
          {item.blocks.map((b, i) => <Block key={i} block={b} />)}
        </div>
      )}
    </div>
  );
}

// ---------- 페이지 ----------
export default function FAQPage() {
  const [tabKey, setTabKey] = useState('course');
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState({ 'course-0-0': true });

  const tab = FAQ_TABS.find(t => t.key === tabKey) || FAQ_TABS[0];
  const data = tab.data;
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  const toggle = (key) => setOpen(prev => {
    const next = { ...prev };
    if (next[key]) delete next[key]; else next[key] = true;
    return next;
  });

  const switchTab = (key) => {
    setTabKey(key);
    setCat('all');
    setQuery('');
  };

  // 검색: 질문 / 카테고리 / 답변 본문 전체
  const matches = (item, category) => {
    if (!needle) return true;
    if (category.toLowerCase().includes(needle)) return true;
    if (item.q.toLowerCase().includes(needle)) return true;
    return JSON.stringify(item.blocks).toLowerCase().includes(needle);
  };

  const groups = useMemo(() => {
    const result = [];
    data.forEach((c, ci) => {
      if (cat !== 'all' && cat !== ci) return;
      const items = c.items
        .map((it, ii) => ({ it, key: `${tabKey}-${ci}-${ii}` }))
        .filter(({ it }) => matches(it, c.category));
      if (items.length) result.push({ ...c, ci, items });
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, cat, needle, tabKey]);

  const resultCount = groups.reduce((n, g) => n + g.items.length, 0);
  const visibleKeys = groups.flatMap(g => g.items.map(i => i.key));
  const allOpen = visibleKeys.length > 0 && visibleKeys.every(k => open[k]);

  const toggleAll = () => {
    if (allOpen) {
      setOpen(prev => {
        const next = { ...prev };
        visibleKeys.forEach(k => delete next[k]);
        return next;
      });
    } else {
      setOpen(prev => {
        const next = { ...prev };
        visibleKeys.forEach(k => { next[k] = true; });
        return next;
      });
    }
  };

  const catNav = [
    { key: 'all', label: '전체', icon: LayoutGrid, count: data.reduce((n, c) => n + c.items.length, 0) },
    ...data.map((c, ci) => ({ key: ci, label: c.category, icon: c.icon, count: c.items.length })),
  ];

  const isFiltered = !!needle || cat !== 'all';
  const filterDesc = needle && cat !== 'all'
    ? `· "${trimmed}" · ${data[cat].category}`
    : needle
      ? `· "${trimmed}" 검색 결과`
      : `· ${data[cat]?.category || ''}`;

  const isCourseTab = tabKey === 'course';

  const resetFilters = () => { setQuery(''); setCat('all'); };

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <SiteHeader activeHref="/faq" title="자주 묻는 질문" />

      {/* 모바일 히어로 + 탭 + 검색 + 카테고리 칩 */}
      <div className="sm:hidden bg-white border-b border-[#EBEEF3] px-3.5 pb-3 flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[17px] font-extrabold text-[#1E2530] tracking-[-0.3px] leading-[1.35]">{tab.heroTitle}</span>
          <span className="text-[12px] leading-[1.5] text-[#8892A4]">{tab.desc}</span>
        </div>

        <div className="flex gap-1 bg-[#EEF1F6] rounded-[11px] p-1">
          {FAQ_TABS.map(t => {
            const on = t.key === tabKey;
            const count = t.data.reduce((n, c) => n + c.items.length, 0);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-[9px] px-2 transition-colors ${
                  on ? 'bg-white shadow-[0_1px_3px_rgba(30,40,60,0.12)]' : ''
                }`}
              >
                <span className={`text-[13px] whitespace-nowrap ${on ? 'font-extrabold text-[#1E2530]' : 'font-semibold text-[#8892A4]'}`}>
                  {t.label}
                </span>
                <span className={`text-[11px] font-bold ${on ? 'text-[#2F6FEB]' : 'text-[#B0B7C3]'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 bg-[#F6F8FB] border-[1.5px] border-[#E4E8F0] rounded-[11px] px-3 h-[46px] focus-within:border-[#2F6FEB]">
          <Search size={17} strokeWidth={1.8} className="text-[#9AA3B2] flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab.placeholderShort}
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-medium text-[#1E2530] placeholder:font-normal placeholder:text-[#B0B7C3]"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="w-[22px] h-[22px] rounded-full bg-[#E4E8F0] text-[#8892A4] flex items-center justify-center flex-shrink-0">
              <X size={11} strokeWidth={2.4} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 pb-0.5">
          {catNav.map(c => {
            const on = cat === c.key;
            return (
              <button
                key={String(c.key)}
                type="button"
                onClick={() => setCat(c.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border whitespace-nowrap flex-shrink-0 transition-colors ${
                  on ? 'bg-[#2F6FEB] border-[#2F6FEB]' : 'bg-white border-[#E4E8F0]'
                }`}
              >
                <span className={`text-[12.5px] font-bold ${on ? 'text-white' : 'text-[#5B6472]'}`}>{c.label}</span>
                <span className={`text-[11px] font-bold ${on ? 'text-white/70' : 'text-[#B0B7C3]'}`}>{c.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-3 sm:px-7 py-3.5 sm:py-8">
        <div className="max-w-[1000px] mx-auto flex flex-col gap-3.5 sm:gap-5">
          {/* 데스크톱 히어로 */}
          <div className={`${CARD} hidden sm:flex items-center justify-between gap-8 px-7 py-[26px]`}>
            <div className="flex flex-col gap-[7px] min-w-0">
              {isCourseTab && (
                <span className="self-start text-[11.5px] font-bold text-[#2F6FEB] bg-[#EAF1FE] px-2.5 py-[3px] rounded-full whitespace-nowrap">
                  {COURSE_META.badge}
                </span>
              )}
              <h1 className="text-[26px] font-extrabold text-[#1E2530] tracking-[-0.4px]">{tab.heroTitle}</h1>
              <p className="text-[13.5px] leading-[1.55] text-[#8892A4]">{tab.heroSub}</p>
            </div>
            {isCourseTab && (
              <div className="hidden lg:flex gap-2.5 flex-shrink-0">
                {COURSE_META.stats.map(s => (
                  <div key={s.label} className="bg-[#F6F8FB] border border-[#EBEEF3] rounded-xl px-[18px] py-3.5 flex flex-col gap-1 min-w-[104px]">
                    <span className="text-[11.5px] font-semibold text-[#8892A4] whitespace-nowrap">{s.label}</span>
                    <span className="text-[17px] font-extrabold text-[#1E2530] whitespace-nowrap">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 데스크톱 탭 */}
          <div className="hidden sm:flex gap-[5px] bg-[#E8ECF3] rounded-[13px] p-[5px] self-start">
            {FAQ_TABS.map(t => {
              const on = t.key === tabKey;
              const count = t.data.reduce((n, c) => n + c.items.length, 0);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchTab(t.key)}
                  className={`flex items-center gap-2 px-5 py-[11px] rounded-[10px] transition-colors ${
                    on ? 'bg-white shadow-[0_1px_3px_rgba(30,40,60,0.12)]' : 'hover:bg-white/50'
                  }`}
                >
                  <span className={`text-[13.5px] whitespace-nowrap ${on ? 'font-extrabold text-[#1E2530]' : 'font-semibold text-[#8892A4]'}`}>
                    {t.label}
                  </span>
                  <span className={`text-[11.5px] font-bold px-[7px] py-0.5 rounded-full ${
                    on ? 'bg-[#EAF1FE] text-[#2F6FEB]' : 'text-[#B0B7C3]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 데스크톱 검색 */}
          <div className="hidden sm:flex gap-3 items-center">
            <div className="flex-1 flex items-center gap-3 bg-white border-[1.5px] border-[#E4E8F0] rounded-xl px-4 h-[52px] focus-within:border-[#2F6FEB] transition-colors">
              <Search size={18} strokeWidth={1.8} className="text-[#9AA3B2] flex-shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab.placeholder}
                className="flex-1 min-w-0 bg-transparent outline-none text-[14.5px] font-medium text-[#1E2530] placeholder:font-normal placeholder:text-[#B0B7C3]"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="w-6 h-6 rounded-full bg-[#F1F4FA] text-[#8892A4] flex items-center justify-center flex-shrink-0 hover:bg-[#E4E8F0]">
                  <X size={12} strokeWidth={2.4} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="h-[52px] px-5 rounded-xl border border-[#E4E8F0] bg-white text-[13.5px] font-bold text-[#5B6472] whitespace-nowrap flex-shrink-0 hover:bg-[#F6F8FB] transition-colors"
            >
              {allOpen ? '전체 접기' : '전체 펼치기'}
            </button>
          </div>

          <div className="flex gap-5 items-start">
            {/* 데스크톱 사이드바 */}
            <aside className="hidden lg:flex w-[212px] flex-shrink-0 flex-col gap-3 sticky top-[76px]">
              <div className={`${CARD} p-2 flex flex-col gap-0.5`}>
                {catNav.map(c => {
                  const on = cat === c.key;
                  const Icon = c.icon;
                  return (
                    <button
                      key={String(c.key)}
                      type="button"
                      onClick={() => setCat(c.key)}
                      className={`flex items-center gap-2.5 w-full px-[11px] py-2.5 rounded-[10px] text-left transition-colors ${
                        on ? 'bg-[#EAF1FE]' : 'hover:bg-[#F6F8FB]'
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.7} className={`flex-shrink-0 ${on ? 'text-[#2F6FEB]' : 'text-[#9AA3B2]'}`} />
                      <span className={`flex-1 text-[13px] truncate ${on ? 'font-extrabold text-[#2F6FEB]' : 'font-semibold text-[#5B6472]'}`}>
                        {c.label}
                      </span>
                      <span className={`text-[11.5px] font-bold flex-shrink-0 ${on ? 'text-[#2F6FEB]' : 'text-[#B0B7C3]'}`}>
                        {c.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={`${CARD} p-4 flex flex-col gap-2.5`}>
                <span className="text-[12px] font-extrabold text-[#1E2530]">바로가기</span>
                <a
                  href="http://dreams2.daejin.ac.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 bg-[#EAF1FE] text-[#2F6FEB] rounded-[9px] px-[11px] py-2.5 text-[12.5px] font-bold hover:bg-[#DCE8FF] transition-colors"
                >
                  수강신청 사이트
                  <ExternalLink size={13} strokeWidth={1.8} />
                </a>
                <a
                  href="https://www.daejin.ac.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 bg-[#F6F8FB] text-[#5B6472] rounded-[9px] px-[11px] py-2.5 text-[12.5px] font-bold hover:bg-[#EEF1F6] transition-colors"
                >
                  대진대 홈페이지
                  <ExternalLink size={13} strokeWidth={1.8} />
                </a>
                <div className="h-px bg-[#EEF1F5]" />
                <div className="flex flex-col gap-[3px]">
                  <span className="text-[11.5px] text-[#8892A4]">답이 없다면 {CONTACT.label}</span>
                  <span className="text-[13.5px] font-extrabold text-[#1E2530]">{CONTACT.tel}</span>
                </div>
              </div>
            </aside>

            {/* 질문 목록 */}
            <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-3.5">
              {isFiltered && (
                <div className={`${CARD} flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-[15px] sm:py-[11px] rounded-[11px]`}>
                  <span className="text-[12px] sm:text-[12.5px] text-[#5B6472] truncate">
                    <strong className="text-[#1E2530]">{resultCount}개</strong> 질문 {filterDesc}
                  </span>
                  <button type="button" onClick={resetFilters} className="text-[12px] sm:text-[12.5px] font-bold text-[#2F6FEB] flex-shrink-0">
                    전체 보기
                  </button>
                </div>
              )}

              {groups.length === 0 && (
                <div className={`${CARD} px-5 py-11 sm:py-14 flex flex-col items-center gap-2 text-center`}>
                  <Search size={30} strokeWidth={1.4} className="text-[#C7CEDA]" />
                  <span className="text-[13.5px] sm:text-[14.5px] font-bold text-[#5B6472]">검색 결과가 없어요</span>
                  <span className="text-[12px] sm:text-[12.5px] leading-[1.5] text-[#9AA3B2]">
                    다른 단어로 검색하거나 {CONTACT.label}({CONTACT.tel})에 문의해 주세요
                  </span>
                </div>
              )}

              {groups.map(g => {
                const Icon = g.icon;
                return (
                  <div key={g.category} className="flex flex-col gap-2 sm:gap-[9px]">
                    <div className="flex items-center gap-2 px-[3px] sm:px-0.5">
                      <Icon size={16} strokeWidth={1.7} className={g.accent} />
                      <h2 className="text-[13px] sm:text-[14px] font-extrabold text-[#1E2530]">{g.category}</h2>
                      <span className={`text-[11px] sm:text-[11.5px] font-bold px-2 py-0.5 rounded-full ${g.tint} ${g.accent}`}>
                        {g.items.length}
                      </span>
                    </div>

                    <div className={`${CARD} overflow-hidden flex flex-col`}>
                      {g.items.map(({ it, key }, idx) => (
                        <QuestionRow
                          key={key}
                          item={it}
                          open={!!open[key]}
                          onToggle={() => toggle(key)}
                          last={idx === g.items.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* 하단 문의 */}
              <div className={`${CARD} px-4 py-4 sm:px-[22px] sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-5`}>
                <div className="flex flex-col gap-[3px]">
                  <span className="text-[13px] sm:text-[13.5px] font-extrabold text-[#1E2530]">여기서 답을 못 찾으셨나요?</span>
                  <span className="text-[12px] sm:text-[12.5px] leading-[1.55] text-[#8892A4]">
                    이 사이트는 참고용이에요. 확정된 내용은 학사팀·학과 사무실이 가장 정확합니다.
                  </span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={`tel:${CONTACT.tel.replace(/-/g, '')}`}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#EAF1FE] sm:bg-[#F6F8FB] sm:border sm:border-[#EBEEF3] text-[#2F6FEB] sm:text-[#1E2530] rounded-[10px] sm:rounded-[11px] px-4 py-3 sm:py-[11px] text-[13px] sm:text-[13.5px] font-extrabold whitespace-nowrap"
                  >
                    <Phone size={15} strokeWidth={1.7} className="text-[#2F6FEB]" />
                    {CONTACT.label} {CONTACT.tel}
                  </a>
                  <a
                    href="http://dreams2.daejin.ac.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sm:hidden flex-1 flex items-center justify-center gap-2 bg-[#F6F8FB] text-[#5B6472] rounded-[10px] px-4 py-3 text-[13px] font-extrabold whitespace-nowrap"
                  >
                    수강신청 사이트
                    <ExternalLink size={13} strokeWidth={1.8} />
                  </a>
                </div>
              </div>

              {isCourseTab && (
                <span className="text-[11px] sm:text-[11.5px] text-[#B0B7C3] text-center">{COURSE_META.footnote}</span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
