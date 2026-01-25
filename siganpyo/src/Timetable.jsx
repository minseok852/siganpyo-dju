import React, { useState, useMemo } from 'react';
import { Settings, Plus, Calendar, MessageCircle, Home, FileText, Gift, ChevronDown } from 'lucide-react';

// --- 1. 유틸리티 및 설정 ---

// 시간표 그리드 설정
const START_HOUR = 9; // 09:00 시작
const END_HOUR = 18;  // 18:00 끝
const HOUR_HEIGHT = 60; // 1시간당 높이 (px)

// 요일 배열
const DAYS = ['월', '화', '수', '목', '금'];

// 색상 팔레트 (에타 스타일 파스텔톤)
const COLORS = [
  'bg-emerald-400', // 초록 (캡스톤)
  'bg-sky-400',     // 파랑 (DB)
  'bg-rose-400',    // 빨강 (고급시스템)
  'bg-teal-400',    // 청록 (파일처리)
  'bg-amber-400',   // 노랑 (스크립트)
];

// --- 2. 샘플 데이터 (앞서 논의한 JSON 구조 반영) ---
// 실제로는 Firebase나 FastAPI에서 이 형태의 JSON을 받아오면 됩니다.
const MOCK_DATA = {
  semester: "2026학년도 1학기",
  courses: [
    {
      id: 1,
      name: "캡스톤디자인(소프트웨어공학)",
      room: "공다414-VR실습실",
      times: [{ day: "화", start: "09:30", end: "13:30" }], // 4시간 연강 예시
      colorIdx: 0
    },
    {
      id: 2,
      name: "데이터베이스설계",
      room: "공다B401-정보보안",
      times: [
        { day: "수", start: "09:30", end: "11:30" },
        { day: "목", start: "09:30", end: "11:30" }
      ],
      colorIdx: 1
    },
    {
      id: 3,
      name: "고급시스템프로그래밍",
      room: "공다A411-강의실(공용)",
      times: [
        { day: "금", start: "11:30", end: "13:30" },
        { day: "월", start: "14:30", end: "16:30" } // 예시로 월요일 추가
      ],
      colorIdx: 2
    },
    {
      id: 4,
      name: "파일처리론",
      room: "공다A411-강의실(공용)",
      times: [
        { day: "금", start: "13:30", end: "15:30" },
        { day: "화", start: "14:30", end: "16:30" }
      ],
      colorIdx: 3
    },
    {
      id: 5,
      name: "스크립트프로그래밍",
      room: "공다A410-MacOS실습실",
      times: [
        { day: "월", start: "16:30", end: "18:30" },
        { day: "화", start: "16:30", end: "18:30" }
      ],
      colorIdx: 4
    }
  ],
  online_courses: [
    { name: "통이와함께하는평화통일이야기", type: "e-learning(온라인)" },
    { name: "컴퓨터시스템구조", type: "e-learning(온라인)1" }
  ]
};

// --- 3. 컴포넌트 구현 ---

export default function TimetableApp() {
  // 시간 문자열(09:30)을 9시 기준 픽셀(top) 위치로 변환
  const getPositionStyles = (start, end) => {
    const parseTime = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h + m / 60;
    };

    const startTime = parseTime(start);
    const endTime = parseTime(end);
    const duration = endTime - startTime;

    return {
      top: `${(startTime - START_HOUR) * HOUR_HEIGHT}px`,
      height: `${duration * HOUR_HEIGHT}px`,
    };
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white max-w-md mx-auto overflow-hidden shadow-2xl">
      
      {/* 1. Header (상단 바) */}
      <header className="flex justify-between items-center px-4 py-3 bg-gray-900 z-10">
        <div className="flex items-center gap-1 cursor-pointer">
          <h1 className="text-xl font-bold">시간표 1</h1>
          <ChevronDown size={20} />
        </div>
        <div className="flex gap-4">
          <Plus size={24} className="text-gray-300" />
          <Settings size={24} className="text-gray-300" />
          <Calendar size={24} className="text-gray-300" />
        </div>
      </header>

      {/* 2. Main Content (시간표 그리드) */}
      <main className="flex-1 overflow-y-auto relative bg-gray-900">
        <div className="flex min-h-[600px] relative pb-20">
          
          {/* 왼쪽 시간 축 */}
          <div className="w-8 flex-shrink-0 flex flex-col items-center border-r border-gray-800 bg-gray-900 z-20 sticky left-0">
            <div className="h-8"></div> {/* 요일 헤더 공간 */}
            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
              <div key={i} className="h-[60px] text-xs text-gray-500 relative -top-2">
                {START_HOUR + i}
              </div>
            ))}
          </div>

          {/* 메인 그리드 영역 */}
          <div className="flex-1 relative">
            
            {/* 요일 헤더 */}
            <div className="flex border-b border-gray-800 h-8 sticky top-0 bg-gray-900 z-10">
              {DAYS.map((day) => (
                <div key={day} className="flex-1 flex items-center justify-center text-xs text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* 그리드 배경선 (가로선) */}
            <div className="absolute top-8 w-full">
              {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                <div key={i} className="h-[60px] border-b border-gray-800 box-border w-full"></div>
              ))}
            </div>

            {/* 세로선 및 강의 배치 */}
            <div className="flex h-full pt-8 relative">
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex-1 relative border-r border-gray-800 last:border-r-0">
                  {/* 해당 요일의 수업 필터링 및 렌더링 */}
                  {MOCK_DATA.courses.map((course) => 
                    course.times
                      .filter((t) => t.day === day)
                      .map((time, idx) => {
                        const style = getPositionStyles(time.start, time.end);
                        return (
                          <div
                            key={`${course.id}-${idx}`}
                            className={`absolute w-full px-1 py-0.5 z-0`}
                            style={style}
                          >
                            <div className={`w-full h-full ${COLORS[course.colorIdx]} opacity-90 p-1 text-[10px] flex flex-col justify-center leading-tight overflow-hidden`}>
                              <span className="font-bold text-white drop-shadow-md mb-0.5 block truncate">
                                {course.name}
                              </span>
                              <span className="text-white/90 truncate block text-[9px]">
                                {course.room}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 온라인 강의 목록 (Bottom Sheet 스타일) */}
        <div className="bg-gray-800 p-4 space-y-2 mb-16">
            {MOCK_DATA.online_courses.map((course, idx) => (
                <div key={idx} className="flex flex-col border-b border-gray-700 pb-2 last:border-0">
                    <span className="text-sm font-bold text-gray-200">{course.name}</span>
                    <span className="text-xs text-gray-500">{course.type}</span>
                </div>
            ))}
        </div>
      </main>

      {/* 3. Bottom Navigation (하단 메뉴) */}
      <nav className="h-14 bg-black border-t border-gray-800 flex justify-around items-center absolute bottom-0 w-full z-50">
        <NavItem icon={<Home size={24} />} label="홈" />
        <NavItem icon={<FileText size={24} />} label="시간표" active />
        <NavItem icon={<FileText size={24} />} label="게시판" />
        <NavItem icon={<MessageCircle size={24} />} label="채팅" />
        <NavItem icon={<Gift size={24} />} label="혜택" />
      </nav>
    </div>
  );
}

// 하단 네비게이션 아이템 컴포넌트
function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 cursor-pointer ${active ? 'text-white' : 'text-gray-500'}`}>
      {icon}
      {/* 활성화된 탭만 텍스트 표시 or 전체 표시 (이미지상 전체 미표시라 생략 가능) */}
      <span className="text-[9px]">{label}</span>
    </div>
  );
}