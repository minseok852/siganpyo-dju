// src/data/nav.js
// 헤더 내비게이션 항목 (HomePage / UpdateLogPage 공용)
import {
  MessageSquarePlus,
  FileText,
  HelpCircle,
  Sparkles,
  GraduationCap,
  Flame,
} from 'lucide-react';

// hidden: true 인 항목은 내비에 안 보이지만 라우트는 그대로 살아 있음.
// 다시 열 때는 hidden 만 지우면 됨.
export const ALL_NAV_ITEMS = [
  { href: '/feedback',   label: '피드백',     icon: MessageSquarePlus },
  { href: '/updates',    label: '업데이트',   icon: FileText },
  { href: '/faq',        label: 'FAQ',        icon: HelpCircle },
  // 2학기에는 거의 안 쓰여서 내비에서만 내려둠 (/ai 는 직접 접속 가능)
  { href: '/ai',         label: 'AI평가',     icon: Sparkles, hidden: true },
  { href: '/credits',    label: '학점 플래너', icon: GraduationCap },
  { href: '/popular',    label: '인기',       icon: Flame },
];

export const NAV_ITEMS = ALL_NAV_ITEMS.filter(item => !item.hidden);
