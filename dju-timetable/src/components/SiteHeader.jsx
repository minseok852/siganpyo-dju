// src/components/SiteHeader.jsx
// 모든 페이지 공용 헤더
//  - 데스크톱: 로고 + 상단 내비 (현재 페이지는 알약으로 강조)
//  - 모바일: title 이 있으면 뒤로가기 + 제목, 없으면(홈) 로고 + 햄버거 메뉴
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Menu, X } from 'lucide-react';
import { NAV_ITEMS } from '../data/nav';

// 활성 항목 색 — 인기만 주황, 나머지는 파랑
const TONES = {
  '/popular': { pill: 'bg-[#FFF1E8] text-[#E2670F]', icon: 'text-[#E2670F]', badge: 'bg-[#FFF1E8] text-[#E2670F]' },
  default:    { pill: 'bg-[#EAF1FE] text-[#2F6FEB]', icon: 'text-[#2F6FEB]', badge: 'bg-[#EAF1FE] text-[#2F6FEB]' },
};

export default function SiteHeader({ activeHref, title, badge, right }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const tone = TONES[activeHref] || TONES.default;

  return (
    <header className="bg-white border-b border-[#EBEEF3] sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-7">
        <div className="flex items-center justify-between h-[52px] sm:h-[60px]">
          {/* 왼쪽 */}
          {title ? (
            <button onClick={() => navigate('/')} className="md:hidden flex items-center gap-2 min-w-0 -ml-1">
              <ArrowLeft size={19} strokeWidth={1.7} className="text-[#5B6472] flex-shrink-0" />
              <span className="text-[15px] font-extrabold text-[#1E2530] whitespace-nowrap">{title}</span>
              {badge && (
                <span className={`px-2 py-[3px] rounded-full text-[11px] font-extrabold whitespace-nowrap ${tone.badge}`}>
                  {badge}
                </span>
              )}
            </button>
          ) : (
            <a href="/" className="md:hidden flex items-center gap-2 flex-shrink-0">
              <BookOpen className="text-[#2F6FEB]" size={20} />
              <span className="text-[15px] font-extrabold text-[#1E2530] tracking-tight whitespace-nowrap">
                대진대 시간표
              </span>
            </a>
          )}

          <a href="/" className="hidden md:flex items-center gap-2 flex-shrink-0">
            <BookOpen className="text-[#2F6FEB]" size={20} />
            <span className="text-[17px] font-extrabold text-[#1E2530] tracking-tight whitespace-nowrap">
              대진대 시간표
            </span>
          </a>

          {/* 오른쪽 */}
          <div className="flex items-center gap-2 md:gap-5 lg:gap-7">
            <nav className="hidden md:flex items-center gap-5 lg:gap-7">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = href === activeHref;
                return (
                  <a
                    key={href}
                    href={href}
                    className={`group flex items-center gap-1.5 text-[13px] whitespace-nowrap transition-colors ${
                      active
                        ? `px-2.5 py-1.5 rounded-lg font-bold ${tone.pill}`
                        : 'text-[#5B6472] font-semibold hover:text-[#2F6FEB]'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={active ? tone.icon : 'text-[#9AA3B2] group-hover:text-[#2F6FEB] transition-colors'}
                    />
                    {label}
                  </a>
                );
              })}
            </nav>

            {right}

            {/* 홈에서만 모바일 햄버거 */}
            {!title && (
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="md:hidden w-9 h-9 -mr-1.5 flex items-center justify-center text-[#5B6472] hover:bg-gray-50 rounded-lg transition-colors"
                aria-label="메뉴"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 드롭다운 (홈) */}
      {!title && menuOpen && (
        <div className="md:hidden border-t border-[#EBEEF3] bg-white shadow-[0_12px_24px_-12px_rgba(30,40,60,0.2)]">
          <nav className="max-w-6xl mx-auto px-2 py-1.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-semibold text-[#3A4150] hover:bg-gray-50 transition-colors"
              >
                <Icon size={17} className="text-[#9AA3B2]" />
                {label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
