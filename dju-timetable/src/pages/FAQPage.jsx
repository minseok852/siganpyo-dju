// src/pages/FAQPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  BookOpen,
  Clock,
  GraduationCap,
  Lightbulb,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

// 아코디언 아이템 컴포넌트
function AccordionItem({ question, answer, isOpen, onClick }) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onClick}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-800 pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp size={20} className="text-gray-500 shrink-0" />
        ) : (
          <ChevronDown size={20} className="text-gray-500 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
            {answer}
          </div>
        </div>
      )}
    </div>
  );
}

// 카테고리 색상 매핑
const colorMap = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
};

// FAQ 데이터
const FAQ_DATA = [
  {
    category: '수강신청 기본',
    icon: Clock,
    color: 'blue',
    items: [
      {
        question: '2026학년도 1학기 수강신청 기간이 언제예요?',
        answer: (
          <>
            <p className="font-medium mb-2">📅 신입생/편입생</p>
            <table className="w-full mb-3 text-sm">
              <tbody>
                <tr className="border-b"><td className="py-1.5 text-gray-500 w-32">수강신청</td><td className="py-1.5 font-medium">2026.2.26(목) ~ 2.27(금) 10:00~17:00</td></tr>
                <tr className="border-b"><td className="py-1.5 text-gray-500">수강변경</td><td className="py-1.5">2026.3.3(화) ~ 3.9(월) 17:00</td></tr>
              </tbody>
            </table>
            <p className="font-medium mb-2">📅 재학생/복학생</p>
            <table className="w-full mb-3 text-sm">
              <tbody>
                <tr className="border-b"><td className="py-1.5 text-gray-500 w-32">예비수강(장바구니)</td><td className="py-1.5">2026.2.3(화) ~ 2.4(수) 17:00</td></tr>
                <tr className="border-b"><td className="py-1.5 text-gray-500">수강신청</td><td className="py-1.5">2026.2.9 <strong>10:00</strong>(월) ~ 2.11(수) 17:00</td></tr>
                <tr className="border-b"><td className="py-1.5 text-gray-500">수강변경</td><td className="py-1.5">2026.3.3(화) ~ 3.9(월) 17:00</td></tr>
              </tbody>
            </table>
            <p className="text-red-600 text-sm">⚠️ 수강변경기간 이후에는 추가/취소 불가!</p>
          </>
        )
      },
      {
        question: '수강신청 사이트 주소가 뭐예요?',
        answer: (
          <>
            <p className="mb-2"><strong>수강신청 사이트</strong>: <a href="http://dreams2.daejin.ac.kr" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">http://dreams2.daejin.ac.kr</a></p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 본교 홈페이지 → 재학생 → [수강신청] 클릭해도 됨</li>
              <li>• 종합강의시간표: 홈페이지 → 학사/장학 → 학사공지에서 다운로드</li>
            </ul>
          </>
        )
      },
      {
        question: '예비수강신청(장바구니)이 뭐예요?',
        answer: (
          <>
            <p className="mb-2">장바구니는 <strong>미리 담아두기</strong> 기능이에요!</p>
            <ul className="text-sm text-gray-600 space-y-1 mb-3">
              <li>• 최대 24학점까지 담기 가능</li>
              <li>• 여석 상관없이 담아둘 수 있음</li>
              <li>• 경쟁률(몇 명이 담았는지) 확인 가능</li>
              <li>• 시간 겹치는 과목은 담기 불가</li>
            </ul>
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
              ⚠️ <strong>중요</strong>: 장바구니에 담았다고 수강신청 완료가 아님! 반드시 <strong>수강신청기간에 '신청' 버튼</strong> 눌러야 함!
            </div>
          </>
        )
      },
      {
        question: '교과번호로 빠르게 신청하는 방법?',
        answer: (
          <>
            <p className="mb-2">수강신청 화면 상단에 <strong>"수강신청 빨리하기"</strong> 입력창이 있어요.</p>
            <ol className="text-sm text-gray-600 space-y-1 mb-3 list-decimal list-inside">
              <li>과목번호-분반 입력 (예: 123456-01)</li>
              <li>"신청" 버튼 클릭</li>
            </ol>
            <p className="text-orange-600 text-sm mb-2">⚠️ 주의: Tab 키로 이동 안 됨!</p>
            
          </>
        )
      },
    ]
  },
  {
    category: '학점 관련',
    icon: GraduationCap,
    color: 'green',
    items: [
      {
        question: '몇 학점까지 들을 수 있어요? (2026학번)',
        answer: (
          <>
            <p className="font-medium mb-2">2026학번 (신입생) 기준</p>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="bg-green-50">
                  <th className="border border-green-200 px-3 py-2 text-left">구분</th>
                  <th className="border border-green-200 px-3 py-2 text-left">수강 가능 학점</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 px-3 py-2">일반</td><td className="border border-gray-200 px-3 py-2 font-medium">12 ~ 18학점</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">성적우수자 (4.0↑)</td><td className="border border-gray-200 px-3 py-2">12 ~ 21학점</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2">학사경고자 (1.5↓)</td><td className="border border-gray-200 px-3 py-2">12 ~ 15학점</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">8학기 최소</td><td className="border border-gray-200 px-3 py-2">5학점 이상</td></tr>
              </tbody>
            </table>
            <p className="text-sm text-blue-600">💡 장바구니는 최대 24학점까지 담을 수 있어요!</p>
          </>
        )
      },
      {
        question: '학점 이월제도가 뭐예요?',
        answer: (
          <>
            <p className="mb-2">1학기에 최대 학점을 다 안 채우면, <strong>남은 학점을 2학기에 추가</strong>할 수 있는 제도예요.</p>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="bg-green-50">
                  <th className="border border-green-200 px-2 py-1.5 text-left">1학기</th>
                  <th className="border border-green-200 px-2 py-1.5 text-left">이월</th>
                  <th className="border border-green-200 px-2 py-1.5 text-left">2학기 최대</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 px-2 py-1.5">16학점</td><td className="border border-gray-200 px-2 py-1.5">+2학점</td><td className="border border-gray-200 px-2 py-1.5 font-medium">20학점</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-2 py-1.5">17학점</td><td className="border border-gray-200 px-2 py-1.5">+1학점</td><td className="border border-gray-200 px-2 py-1.5 font-medium">19학점</td></tr>
              </tbody>
            </table>
            <p className="text-sm text-gray-600">⚠️ 성적우수자, 학사경고자, 9학기 이상은 제외</p>
          </>
        )
      },
      {
        question: '재수강은 어떻게 해요?',
        answer: (
          <>
            <p className="mb-2"><strong>재수강 조건</strong>: 기존 성적이 C+ ~ F인 과목만 가능</p>
            <ul className="text-sm text-gray-600 space-y-1 mb-2">
              <li>• 최고 취득 가능 성적: <strong>B+</strong> (A 못 받음)</li>
              <li>• 성적증명서에 <strong>'R'</strong> 표시됨</li>
              <li>• 기존 성적은 삭제되고 새 성적으로 대체</li>
            </ul>
            <p className="text-sm text-blue-600">💡 재수강 여부는 수강신청 화면에서 확인 가능!</p>
          </>
        )
      },
      {
        question: '교양은 최대 몇 학점까지 인정돼요?',
        answer: (
          <>
            <p className="mb-2"><strong>2026학번 기준</strong>: 교양 32~42학점 이내</p>
            <p className="text-sm text-gray-600">42학점 초과한 교양학점은 졸업학점으로 인정 안 됨. 전공 학점을 충분히 채우는 게 중요!</p>
          </>
        )
      },
    ]
  },
  {
    category: '교양필수 (2026학번)',
    icon: BookOpen,
    color: 'purple',
    items: [
      {
        question: '2026학번 교양필수 과목이 뭐예요?',
        answer: (
          <>
            <p className="font-medium mb-2">2026학번 교양필수 (총 11학점)</p>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="bg-purple-50">
                  <th className="border border-purple-200 px-3 py-2 text-left">과목명</th>
                  <th className="border border-purple-200 px-3 py-2 text-center w-16">학점</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 px-3 py-2">대순사상과상생윤리</td><td className="border border-gray-200 px-3 py-2 text-center">2</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">대학생활과진로</td><td className="border border-gray-200 px-3 py-2 text-center">1</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2">사고와표현</td><td className="border border-gray-200 px-3 py-2 text-center">2</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">영어읽기와토론</td><td className="border border-gray-200 px-3 py-2 text-center">2</td></tr>
                <tr className="bg-yellow-50"><td className="border border-yellow-300 px-3 py-2 font-medium">⭐ AI시대의컴퓨팅사고 <span className="text-xs text-yellow-700">(NEW!)</span></td><td className="border border-yellow-300 px-3 py-2 text-center">2</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">LCT</td><td className="border border-gray-200 px-3 py-2 text-center">2</td></tr>
              </tbody>
            </table>
            <p className="text-sm text-yellow-700">⭐ 2026학번부터 "컴퓨팅사고와문제해결" → "AI시대의컴퓨팅사고"로 변경!</p>
            <p className="text-sm text-gray-600">21~24학점은 13학점에서 12학점으로 변경  </p>
            <p className="text-sm text-blue-600">"통이와함께하는평화통일이야기" 교과목 26년부터 미개설</p>
          </>
        )
      },
      {
        question: '교양필수는 언제 들어야 해요?',
        answer: (
          <>
            <p className="mb-2 font-medium">1학년 때 최대한 빨리 듣는 걸 추천!</p>
            <ul className="text-sm text-gray-600 space-y-1 mb-3">
              <li>• 대학생활과진로 (1학기 집중이수)</li>
              <li>• 사고와표현, 영어읽기와토론, AI시대의컴퓨팅사고</li>
              <li>• 대순사상과상생윤리 (1,2학년 권장)</li>
            </ul>
            <p className="text-sm text-blue-600">💡 교양필수는 분반이 많아서 시간 맞추기 쉬워요!</p>
          </>
        )
      },
    ]
  },
  {
    category: '교양선택 영역',
    icon: Lightbulb,
    color: 'yellow',
    items: [
      {
        question: '교양선택 영역별로 뭘 들어야 해요?',
        answer: (
          <>
            <p className="font-medium mb-2">2025학번 이상 교양선택 이수 기준</p>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="bg-yellow-50">
                  <th className="border border-yellow-200 px-2 py-2 text-left">영역</th>
                  <th className="border border-yellow-200 px-2 py-2 text-left">내용</th>
                  <th className="border border-yellow-200 px-2 py-2 text-center">이수</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 px-2 py-1.5 font-medium">1영역</td><td className="border border-gray-200 px-2 py-1.5">인간과 소통</td><td className="border border-gray-200 px-2 py-1.5 text-center">1과목↑</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-2 py-1.5 font-medium">2영역</td><td className="border border-gray-200 px-2 py-1.5">사회와 경제</td><td className="border border-gray-200 px-2 py-1.5 text-center">1과목↑</td></tr>
                <tr><td className="border border-gray-200 px-2 py-1.5 font-medium">3영역</td><td className="border border-gray-200 px-2 py-1.5">과학과 기술</td><td className="border border-gray-200 px-2 py-1.5 text-center">1과목↑</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-2 py-1.5 font-medium">4영역</td><td className="border border-gray-200 px-2 py-1.5">예술과 문화</td><td className="border border-gray-200 px-2 py-1.5 text-center">1과목↑</td></tr>
                <tr><td className="border border-gray-200 px-2 py-1.5 font-medium">5영역</td><td className="border border-gray-200 px-2 py-1.5">융합과 혁신</td><td className="border border-gray-200 px-2 py-1.5 text-center">1과목↑</td></tr>
                <tr className="bg-blue-50"><td className="border border-blue-200 px-2 py-1.5 font-medium">6영역</td><td className="border border-blue-200 px-2 py-1.5">AI·디지털리터러시</td><td className="border border-blue-200 px-2 py-1.5 text-center text-blue-700">학과별</td></tr>
              </tbody>
            </table>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm">
              📌 <strong>총 최소 6과목, 21학점 이상</strong> 이수해야 졸업!
            </div>
          </>
        )
      },
      {
        question: '"비고"란에 학과가 적혀있으면 뭐예요?',
        answer: (
          <>
            <p className="mb-2"><strong>수강 제한</strong>이 있다는 뜻이에요!</p>
            <ul className="text-sm text-gray-600 space-y-1 mb-3">
              <li>• "컴퓨터공학과 전용" → 해당 학과만 수강 가능</li>
              <li>• "타과생 수강불가" → 해당 학과만 가능</li>
            </ul>
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
              ⚠️ 비고 조건에 안 맞으면 <strong>수강신청이 안 될 수도 있음!</strong>
            </div>
          </>
        )
      },
    ]
  },
  {
    category: '전공 관련',
    icon: GraduationCap,
    color: 'indigo',
    items: [
      {
        question: '전필/전선이 뭐예요?',
        answer: (
          <>
            <table className="w-full border-collapse text-sm mb-3">
              <tbody>
                <tr><td className="border border-gray-200 px-3 py-2 bg-red-50 font-medium w-20">전필</td><td className="border border-gray-200 px-3 py-2">전공필수 - 졸업하려면 <strong>반드시</strong> 들어야 하는 과목</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2 bg-blue-50 font-medium">전선</td><td className="border border-gray-200 px-3 py-2">전공선택 - 전공 중에서 <strong>선택</strong>해서 들을 수 있는 과목</td></tr>
              </tbody>
            </table>
            
          </>
        )
      },
      {
        question: '전공은 총 몇 학점 들어야 해요?',
        answer: (
          <>
            <table className="w-full border-collapse text-sm mb-3">
              <thead>
                <tr className="bg-indigo-50">
                  <th className="border border-indigo-200 px-2 py-2 text-left">구분</th>
                  <th className="border border-indigo-200 px-2 py-2 text-center">주전공</th>
                  <th className="border border-indigo-200 px-2 py-2 text-center">복수전공</th>
                  <th className="border border-indigo-200 px-2 py-2 text-center">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 px-2 py-1.5">다전공자</td><td className="border border-gray-200 px-2 py-1.5 text-center">42</td><td className="border border-gray-200 px-2 py-1.5 text-center">36</td><td className="border border-gray-200 px-2 py-1.5 text-center font-medium">78</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-2 py-1.5">심화전공</td><td className="border border-gray-200 px-2 py-1.5 text-center">72</td><td className="border border-gray-200 px-2 py-1.5 text-center">-</td><td className="border border-gray-200 px-2 py-1.5 text-center font-medium">72</td></tr>
              </tbody>
            </table>
          </>
        )
      },
    ]
  },
  {
    category: '수강신청 꿀팁',
    icon: Lightbulb,
    color: 'orange',
    items: [
      {
        question: '수강신청 당일 뭘 준비해야 해요?',
        answer: (
          <>
            <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3">
              <p className="font-medium text-sm mb-1">✅ 체크리스트:</p>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>시간표 미리 짜두기 (이 사이트 활용!)</li>
                <li><strong>교과번호</strong> 메모해두기</li>
                <li>대안 과목도 2~3개 준비</li>
                <li>인터넷 빠른 곳에서 대기</li>
              </ol>
            </div>
            <p className="text-sm text-gray-600">💡 못 담을 시 정정기간을 노려보세요!</p>
          </>
        )
      },
      {
        question: '서버 터지면 어떻게 해요?',
        answer: (
          <>
            <p className="mb-2"><strong>기다리세요! 새로고침 하면 후순위로 밀려납니다!</strong></p>
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
              ⚠️ 매크로 사용 금지! (300회 이상 시도 시 징계)
            </div>
          </>
        )
      },
      {
        question: '1학년 시간표 어떻게 짜는 게 좋아요?',
        answer: (
          <>
            <div className="space-y-2 mb-3">
              <div className="bg-purple-50 border border-purple-200 rounded p-2">
                <p className="font-medium text-sm text-purple-800">1️⃣ 교양필수 먼저</p>
                <p className="text-xs text-purple-600">비고란에 본인 학과가 적혀 있으므로 그걸 담으시면 됩니다</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <p className="font-medium text-sm text-blue-800">2️⃣ 전공필수/전공선택 추가</p>
                <p className="text-xs text-blue-600">1학년 같은 경우 전공필수는 거의 없지만 있으시면 담으시고, 전공선택도 다 담으시면 좋습니다</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <p className="font-medium text-sm text-green-800">3️⃣ 교양선택으로 채우기</p>
                <p className="text-xs text-green-600">영역별 1개씩, 비고란 본인 학과 들어야 하는 게 있을 수 있음!</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">💡 학점은 저학년 일수록 꽉 채우는 게 좋아요!</p>
          </>
        )
      },
    ]
  },
  {
    category: '주의사항',
    icon: AlertCircle,
    color: 'red',
    items: [
      {
        question: '강의매매/매크로 쓰면 어떻게 돼요?',
        answer: (
          <>
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-2">
              <p className="font-bold text-red-700">🚫 징계 대상입니다!</p>
              <ul className="text-sm text-red-600 mt-1 space-y-0.5">
                <li>• 강의매매: 학칙에 따라 징계 처분</li>
                <li>• 매크로: 300회 이상 시도 시 수강신청 제한 + 징계</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">다른 학생들에게 피해를 주는 행위입니다. 절대 하지 마세요!</p>
          </>
        )
      },
      {
        question: '책임지도교수 상담은 꼭 해야 해요?',
        answer: (
          <>
            <p className="font-medium mb-2">네, 필수입니다!</p>
            <table className="w-full border-collapse text-sm mb-3">
              <tbody>
                <tr><td className="border border-gray-200 px-3 py-2 bg-gray-50">1~2학년</td><td className="border border-gray-200 px-3 py-2 text-center font-medium">매학기 2회</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2 bg-gray-50">3~4학년</td><td className="border border-gray-200 px-3 py-2 text-center font-medium">매학기 1회</td></tr>
              </tbody>
            </table>
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
              ⚠️ 졸업까지 총 12회 이상! <strong>미이수 시 졸업 불가!</strong>
            </div>
          </>
        )
      },
    ]
  },
];

export default function FAQPage() {
  const navigate = useNavigate();
  const [openItems, setOpenItems] = useState({});
  const [allOpen, setAllOpen] = useState(false);

  const toggleItem = (categoryIdx, itemIdx) => {
    const key = `${categoryIdx}-${itemIdx}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    if (allOpen) {
      setOpenItems({});
    } else {
      const newState = {};
      FAQ_DATA.forEach((category, cIdx) => {
        category.items.forEach((_, iIdx) => {
          newState[`${cIdx}-${iIdx}`] = true;
        });
      });
      setOpenItems(newState);
    }
    setAllOpen(!allOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="p-1.5 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} />
            </button>
            <HelpCircle className="text-blue-500" size={20} />
            <h1 className="text-base font-bold text-gray-800">자주 묻는 질문</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 text-white mb-4">
          <h2 className="font-bold text-lg mb-1">📚 2026학년도 1학기 수강신청 가이드</h2>
          <p className="text-sm opacity-90">신입생을 위한 수강신청 A to Z!</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-white/20 rounded">신입생 신청: 2/26~27</span>
            <span className="px-2 py-1 bg-white/20 rounded">12~18학점</span>
            <span className="px-2 py-1 bg-white/20 rounded">교필 11학점</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <h3 className="font-medium text-gray-800 mb-2 text-sm">🔗 바로가기</h3>
          <div className="flex flex-wrap gap-2">
            <a href="http://dreams2.daejin.ac.kr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">
              수강신청 사이트 <ExternalLink size={14} />
            </a>
            <a href="https://www.daejin.ac.kr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
              대진대 홈페이지 <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="flex justify-end mb-2">
          <button onClick={toggleAll} className="text-sm text-blue-600 hover:text-blue-700">
            {allOpen ? '전체 접기' : '전체 펼치기'}
          </button>
        </div>

        <div className="space-y-4">
          {FAQ_DATA.map((category, categoryIdx) => {
            const Icon = category.icon;
            return (
              <div key={categoryIdx} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className={`px-4 py-3 flex items-center gap-2 ${colorMap[category.color]}`}>
                  <Icon size={18} />
                  <h2 className="font-bold">{category.category}</h2>
                  <span className="text-xs opacity-70">({category.items.length})</span>
                </div>
                <div>
                  {category.items.map((item, itemIdx) => (
                    <AccordionItem
                      key={itemIdx}
                      question={item.question}
                      answer={item.answer}
                      isOpen={openItems[`${categoryIdx}-${itemIdx}`] || false}
                      onClick={() => toggleItem(categoryIdx, itemIdx)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 bg-gray-100 rounded-xl p-4 text-center">
            <p className="font-medium text-gray-800 mb-1">이 사이트는 참고일 뿐 입니다</p>
          <p className="text-sm text-gray-600 mb-2">더 궁금한 점이 있으면?</p>
          <p className="text-xs text-gray-500">학사팀 ☎ 031-539-1034</p>
        </div>
        <div className="mt-4 text-center text-xs text-gray-400">* 2026학년도 1학기 수강신청 안내 기준</div>
      </main>
    </div>
  );
}