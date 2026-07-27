// src/pages/Graduationcalculator.jsx
import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, Lock, Info, AlertTriangle, Loader2 } from "lucide-react";
import SiteHeader from "../components/SiteHeader";

// ============================================================
// 상수
// ============================================================
const TOTAL_STEPS = 4;
const STEP_LABELS = ["기본 정보", "성적표 입력", "교양영역", "결과"];

const INITIAL_USER_INFO = {
  admission_year: "",
  major_type: "주전공",
  is_humanities: false,
  current_grade: 1,
  current_semester: 1,
  gpa_range: "1.5이상~4.0미만",
};

const INITIAL_ACQUIRED = {
  total_acquired: "",
  gyopil: "",
  gyoseon: "",
  gichyo: "",
  jeongi: "",
  jeonpil: "",
  jeonseon: "",
  bokjeon: "",
};

const INITIAL_AREAS = {
  area_1: "", area_2: "", area_3: "", area_4: "", area_5: "",
  area_6: "", area_7: "", area_8: "", area_9: "",
  area_A: "", area_B: "", area_C: "",
  area_sil: "", area_foreign: "", area_deep: "",
};

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api`;

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// 성적표 입력 표 (①~⑤ / ⑥~⑧)
const CELLS_A = [
  { key: "total_acquired", num: "①", name: "졸업학점", hi: true },
  { key: "gyopil", num: "②", name: "교필" },
  { key: "gyoseon", num: "③", name: "교선" },
  { key: "gichyo", num: "④", name: "기초" },
  { key: "jeongi", num: "⑤", name: "전기" },
];
const CELLS_B = [
  { key: "jeonpil", num: "⑥", name: "전필" },
  { key: "jeonseon", num: "⑦", name: "전선" },
  { key: "bokjeon", num: "⑧", name: "복전" },
];

// 교양영역 입력 표
const AREA_ROW1 = [
  { key: "area_1", num: "①", name: "1영역", base: 1 },
  { key: "area_2", num: "②", name: "2영역", base: 1 },
  { key: "area_3", num: "③", name: "3영역", base: 1 },
  { key: "area_4", num: "④", name: "4영역", base: 1 },
  { key: "area_5", num: "⑤", name: "5영역", base: 1 },
  { key: "area_6", num: "⑥", name: "6영역", base: 0 },
  { key: "area_7", num: "⑦", name: "7영역", base: 0 },
  { key: "area_8", num: "⑧", name: "8영역", base: 0 },
];
const AREA_ROW2 = [
  { key: "area_9", num: "⑨", name: "9영역", base: 0 },
  { key: "area_A", num: "⑩", name: "A영역", base: 0 },
  { key: "area_B", num: "⑪", name: "B영역", base: 0 },
  { key: "area_C", num: "⑫", name: "C영역", base: 0 },
  { key: "area_sil", num: "⑬", name: "실용", base: 0 },
  { key: "area_foreign", num: "⑭", name: "외국어", base: 0 },
  { key: "area_deep", num: "⑮", name: "심화", base: 0 },
];

// ============================================================
// 유틸 — 계산 로직은 기존 그대로
// ============================================================
function toInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

function buildRequestBody(userInfo, acquired, areas) {
  return {
    admission_year: toInt(userInfo.admission_year),
    major_type: userInfo.major_type,
    is_humanities: userInfo.is_humanities,
    current_grade: userInfo.current_grade,
    current_semester: userInfo.current_semester,
    gpa_range: userInfo.gpa_range,
    total_acquired: toInt(acquired.total_acquired),
    acquired: {
      gyopil:   toInt(acquired.gyopil),
      gyoseon:  toInt(acquired.gyoseon),
      gichyo:   toInt(acquired.gichyo),
      jeongi:   toInt(acquired.jeongi),
      jeonpil:  toInt(acquired.jeonpil),
      jeonseon: toInt(acquired.jeonseon),
      bokjeon:  toInt(acquired.bokjeon),
    },
    acquired_areas: Object.fromEntries(
      Object.entries(areas).map(([k, v]) => [k, toInt(v)])
    ),
  };
}

// 학번/전공유형별 졸업 기준 (표의 "기준" 행 표시용)
function getReq(year, majorType) {
  let r;
  if (year >= 2025)       r = { total: 126, gyopil: 11, gyoseon: 21 };
  else if (year >= 2021)  r = { total: 126, gyopil: 12, gyoseon: 24 };
  else if (year === 2020) r = { total: 130, gyopil: 11, gyoseon: 25 };
  else                    r = { total: 130, gyopil: 6,  gyoseon: 30 };

  if (majorType === "주전공") {
    r.majorLabel = year >= 2025 ? "72" : "63";
    r.bokjeon = "-";
  } else {
    r.majorLabel = year >= 2020 ? "36" : "42";
    r.bokjeon = r.majorLabel;
  }
  return r;
}

// ============================================================
// 공통 조각
// ============================================================
const CARD = "bg-white border border-[#EBEEF3] rounded-[14px]";
const FIELD_LABEL = "text-[12.5px] font-bold text-[#3A4150]";

// 세그먼트 버튼
function SegButton({ active, label, onClick, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[10px] border-[1.5px] font-bold transition-colors ${
        compact ? "px-2 py-3 text-[12.5px] sm:text-[13px]" : "py-3 text-[13px] sm:text-[13.5px]"
      } ${
        active
          ? "border-[#2F6FEB] bg-[#EAF1FE] text-[#2F6FEB]"
          : "border-[#E4E8F0] bg-white text-[#5B6472] hover:bg-[#F6F8FB]"
      }`}
    >
      {label}
    </button>
  );
}

// 표 안 숫자 입력
function NumInput({ value, onChange, highlight, className = "" }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="0"
      value={value || ""}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      className={`w-full border-none outline-none bg-transparent font-extrabold placeholder:text-[#C7CEDA] ${
        highlight ? "text-[#2F6FEB]" : "text-[#1E2530]"
      } ${className}`}
    />
  );
}

// 데스크톱 입력 표 (구분 / 기준 / 취득 3행)
function InputTable({ cells, values, onChange, bases }) {
  const cols = `74px repeat(${cells.length}, minmax(0, 1fr))`;
  return (
    <div className="hidden sm:grid border border-[#E4E8F0] rounded-xl overflow-hidden" style={{ gridTemplateColumns: cols }}>
      <div className="bg-[#F6F8FB] border-b border-[#EEF1F5] py-[11px] text-center text-[11.5px] font-bold text-[#9AA3B2]">구분</div>
      {cells.map(c => (
        <div
          key={`h-${c.key}`}
          className={`border-b border-l border-[#EEF1F5] py-2 text-center text-[12px] font-bold leading-[1.35] ${
            c.hi ? "bg-[#EAF1FE] text-[#2F6FEB]" : "bg-[#F6F8FB] text-[#5B6472]"
          }`}
        >
          {c.num}<br />{c.name}
        </div>
      ))}

      <div className="bg-[#FBFCFE] border-b border-[#EEF1F5] py-[11px] text-center text-[11.5px] font-bold text-[#9AA3B2]">기준</div>
      {cells.map((c, i) => (
        <div
          key={`b-${c.key}`}
          className={`border-b border-l border-[#EEF1F5] py-[11px] text-center text-[13px] font-bold ${
            c.hi ? "bg-[#F4F8FF] text-[#2F6FEB]" : "bg-[#FBFCFE] text-[#9AA3B2]"
          }`}
        >
          {bases[i]}
        </div>
      ))}

      <div className="bg-[#FBFCFE] py-[11px] text-center text-[11.5px] font-extrabold text-[#2F6FEB]">취득</div>
      {cells.map(c => (
        <div key={`i-${c.key}`} className={`border-l border-[#EEF1F5] flex ${c.hi ? "bg-[#F9FBFF]" : "bg-white"}`}>
          <NumInput
            value={values[c.key]}
            onChange={(v) => onChange(c.key, v)}
            highlight={c.hi}
            className="h-[52px] text-center text-[19px]"
          />
        </div>
      ))}
    </div>
  );
}

// 모바일 입력 카드 그리드
function InputCards({ cells, values, onChange, bases, cols = 2 }) {
  return (
    <div
      className="sm:hidden border border-[#E4E8F0] rounded-xl overflow-hidden grid"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cells.map((c, i) => (
        <div
          key={c.key}
          className={`border-b border-r border-[#EEF1F5] px-2.5 pt-2.5 pb-1.5 flex flex-col gap-0.5 ${
            c.hi ? "bg-[#F9FBFF]" : "bg-white"
          }`}
        >
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-[11.5px] font-bold text-[#5B6472] truncate">
              {cols > 2 ? c.name : `${c.num} ${c.name}`}
            </span>
            <span className="text-[10.5px] text-[#B0B7C3] flex-shrink-0">
              {cols > 2 ? bases[i] : `기준 ${bases[i]}`}
            </span>
          </div>
          <NumInput
            value={values[c.key]}
            onChange={(v) => onChange(c.key, v)}
            highlight={c.hi}
            className={cols > 2 ? "h-[38px] text-[19px]" : "h-10 text-[20px]"}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Step 1 — 기본 정보
// ============================================================
function Step1({ userInfo, setUserInfo }) {
  const set = (key, value) => setUserInfo(p => ({ ...p, [key]: value }));

  return (
    <div className="flex flex-col gap-[18px] sm:gap-[22px]">
      <div className="hidden sm:flex flex-col gap-[3px]">
        <h2 className="text-[17px] font-extrabold text-[#1E2530]">기본 정보</h2>
        <p className="text-[12.5px] text-[#8892A4]">학번과 학기에 따라 졸업 기준 학점이 달라져요</p>
      </div>

      <div className="sm:hidden flex items-start gap-2.5 bg-[#F6F8FB] border border-[#EBEEF3] rounded-[11px] px-3 py-3">
        <Lock size={15} strokeWidth={1.7} className="text-[#1FA97A] flex-shrink-0 mt-px" />
        <span className="text-[11.5px] leading-[1.6] text-[#5B6472]">
          입력하신 성적 정보는 <strong className="text-[#1E2530]">서버에 저장되지 않고</strong>, 이 화면 안에서만 계산에 쓰여요.
          창을 닫으면 모두 사라집니다.
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:gap-[9px] sm:max-w-[320px]">
        <span className={FIELD_LABEL}>입학년도 (학번)</span>
        <select
          value={userInfo.admission_year}
          onChange={(e) => set("admission_year", e.target.value)}
          className="w-full h-12 px-3.5 rounded-[11px] border-[1.5px] border-[#E4E8F0] bg-white text-[14.5px] font-bold text-[#1E2530] outline-none cursor-pointer focus:border-[#2F6FEB]"
        >
          <option value="">선택하세요</option>
          {YEARS.map(y => <option key={y} value={y}>{y}학번</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="flex flex-col gap-2 sm:gap-[9px]">
          <span className={FIELD_LABEL}>현재 학년</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(g => (
              <SegButton key={g} label={`${g}학년`} active={userInfo.current_grade === g} onClick={() => set("current_grade", g)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:gap-[9px]">
          <span className={FIELD_LABEL}>현재 학기</span>
          <div className="flex gap-1.5">
            {[1, 2].map(s => (
              <SegButton key={s} label={`${s}학기`} active={userInfo.current_semester === s} onClick={() => set("current_semester", s)} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="flex flex-col gap-2 sm:gap-[9px]">
          <span className={FIELD_LABEL}>전공 유형</span>
          <div className="flex gap-1.5">
            {["주전공", "복수전공"].map(m => (
              <SegButton key={m} label={m} active={userInfo.major_type === m} onClick={() => set("major_type", m)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:gap-[9px]">
          <span className={FIELD_LABEL}>계열</span>
          <div className="flex gap-1.5">
            <SegButton compact label="이공계열" active={!userInfo.is_humanities} onClick={() => set("is_humanities", false)} />
            <SegButton compact label="인문사회·예술" active={userInfo.is_humanities} onClick={() => set("is_humanities", true)} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:gap-[9px]">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={FIELD_LABEL}>직전학기 성적</span>
          <span className="text-[11.5px] text-[#9AA3B2]">수강신청 학점 상한선 계산에 쓰여요</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-1.5">
          {[
            { value: "1.5미만", label: "1.5 미만" },
            { value: "1.5이상~4.0미만", label: "1.5 ~ 4.0" },
            { value: "4.0이상", label: "4.0 이상" },
          ].map(o => (
            <SegButton key={o.value} compact label={o.label} active={userInfo.gpa_range === o.value} onClick={() => set("gpa_range", o.value)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step 2 — 성적표 입력
// ============================================================
function Step2({ acquired, setAcquired, userInfo }) {
  const set = (key, value) => setAcquired(p => ({ ...p, [key]: value }));

  const year = parseInt(userInfo?.admission_year) || 2022;
  const majorType = userInfo?.major_type || "주전공";
  const req = getReq(year, majorType);

  const basesA = [req.total, req.gyopil, req.gyoseon, "-", "-"];
  const basesB = ["-", req.majorLabel, req.bokjeon];

  return (
    <div className="flex flex-col gap-3.5 sm:gap-[18px]">
      <div className="hidden sm:flex flex-col gap-[3px]">
        <h2 className="text-[17px] font-extrabold text-[#1E2530]">성적표 입력</h2>
        <p className="text-[12.5px] text-[#8892A4]">
          성적표의 <strong className="text-[#5B6472]">취득 행</strong> 값을 그대로 옮겨 적어주세요
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1 flex items-center gap-2.5 bg-[#F4F8FF] border border-[#D7E5FD] rounded-[11px] px-3.5 py-3 text-[12px] sm:text-[12.5px] leading-[1.55] text-[#2F6FEB]">
          <Info size={15} strokeWidth={1.7} className="flex-shrink-0" />
          <span>포털대진 → 성적 → <strong>이수구분별 성적조회 및 출력</strong></span>
        </div>
        <div className="flex-1 flex items-center gap-2.5 bg-[#F3FAF6] border border-[#CDEBDB] rounded-[11px] px-3.5 py-3 text-[12px] sm:text-[12.5px] leading-[1.55] text-[#1FA97A]">
          <Check size={15} strokeWidth={1.9} className="flex-shrink-0" />
          <span>
            <strong>{year}학번 {majorType}</strong> 기준 — 졸업 {req.total} / 교필 {req.gyopil} / 교선 {req.gyoseon} / 전공 {req.majorLabel}학점
          </span>
        </div>
      </div>

      <InputTable cells={CELLS_A} values={acquired} onChange={set} bases={basesA} />
      <InputTable cells={CELLS_B} values={acquired} onChange={set} bases={basesB} />
      <InputCards cells={[...CELLS_A, ...CELLS_B]} values={acquired} onChange={set} bases={[...basesA, ...basesB]} />

      <p className="text-[12px] leading-[1.6] text-[#8892A4]">
        <strong className="text-[#5B6472]">① 졸업학점</strong>은 일반선택을 포함한 실제 총 취득학점이에요. 성적표 왼쪽 상단에서 확인할 수 있어요.
      </p>
    </div>
  );
}

// ============================================================
// Step 3 — 교양영역 입력
// ============================================================
function Step3({ areas, setAreas }) {
  const set = (key, value) => setAreas(p => ({ ...p, [key]: value }));
  const basesOf = (rows) => rows.map(r => (r.base > 0 ? r.base : "-"));

  return (
    <div className="flex flex-col gap-3 sm:gap-[18px]">
      <div className="flex flex-col gap-[3px]">
        <h2 className="hidden sm:block text-[17px] font-extrabold text-[#1E2530]">교양영역 입력</h2>
        <p className="text-[12px] sm:text-[12.5px] leading-[1.55] text-[#8892A4]">
          영역별로 들은 <strong className="text-[#5B6472]">과목 수</strong>를 적어주세요. 1~5영역은 각각 1과목 이상 필수예요
        </p>
      </div>

      <InputTable cells={AREA_ROW1} values={areas} onChange={set} bases={basesOf(AREA_ROW1)} />
      <InputTable cells={AREA_ROW2} values={areas} onChange={set} bases={basesOf(AREA_ROW2)} />
      <InputCards
        cells={[...AREA_ROW1, ...AREA_ROW2]}
        values={areas}
        onChange={set}
        bases={[...basesOf(AREA_ROW1), ...basesOf(AREA_ROW2)]}
        cols={3}
      />
    </div>
  );
}

// ============================================================
// Step 4 — 결과 (백엔드 응답 그대로 사용)
// ============================================================
function Step4({ result }) {
  if (!result) return null;

  const validation = result.validate?.validation;
  const plan = result.plan;

  if (!validation) {
    return (
      <div className="flex items-start gap-2.5 bg-[#FEF6F6] border border-[#F8D9D9] rounded-xl px-4 py-3.5 text-[13px] text-[#E5484D]">
        <AlertTriangle size={16} strokeWidth={1.7} className="flex-shrink-0 mt-px" />
        <span>결과를 불러오지 못했습니다. {result.error || "알 수 없는 오류"}</span>
      </div>
    );
  }

  const totalAcquired = validation.total_acquired || 0;
  const totalRequired = validation.total_required || 1;
  const progressPct = Math.min(100, Math.round((totalAcquired / totalRequired) * 100));

  const remainingCredits = plan?.remaining_credits ?? Math.max(0, totalRequired - totalAcquired);
  const remainingSemesters = plan?.remaining_semesters ?? 0;
  const avgPerSemester = remainingSemesters > 0
    ? Math.round((remainingCredits / remainingSemesters) * 10) / 10
    : 0;

  const semesterPlan = plan?.semester_plan || [];
  const limitMax = semesterPlan[0]?.credit_limit?.max;
  const maxCredit = Math.max(limitMax || 0, ...semesterPlan.map(s => s.recommended_credits || 0), 1);

  const summary = [
    { label: "졸업 총학점", acq: validation.total_acquired,   req: validation.total_required,   ok: validation.total_satisfied },
    { label: "전공학점",    acq: validation.major_acquired,   req: validation.major_required,   ok: validation.major_satisfied },
    { label: "교필",        acq: validation.gyopil_acquired,  req: validation.gyopil_required,  ok: validation.gyopil_satisfied },
    { label: "교선",        acq: validation.gyoseon_acquired, req: validation.gyoseon_required, ok: validation.gyoseon_satisfied },
  ];

  const areaValidations = validation.area_validations || [];
  const unmet = areaValidations.filter(a => !a.is_satisfied).length;
  const warnings = [...(validation.warnings || []), ...(plan?.warnings || [])];

  return (
    <div className="flex flex-col gap-3.5 sm:gap-5">
      {/* 참고용 안내 */}
      <div className="flex items-start sm:items-center gap-2.5 bg-[#FFFBF3] border border-[#F7E2BE] rounded-[11px] px-3.5 py-3 text-[11.5px] sm:text-[12.5px] leading-[1.55] text-[#A9761B]">
        <AlertTriangle size={15} strokeWidth={1.7} className="flex-shrink-0 mt-px sm:mt-0" />
        <span>참고용 계산이에요. 정확한 졸업요건은 <strong>학과 사무실 상담</strong>이 가장 확실합니다.</span>
      </div>

      {/* 요약 */}
      <div className="bg-[#F4F8FF] border border-[#D7E5FD] rounded-[13px] sm:rounded-[14px] p-4 sm:px-6 sm:py-[22px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-6">
        <div className="flex flex-col gap-2 sm:gap-2.5 sm:min-w-[280px] sm:flex-1">
          <span className="text-[12px] sm:text-[12.5px] font-bold text-[#2F6FEB]">졸업까지</span>
          <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-[36px] sm:text-[44px] font-extrabold text-[#1E2530] leading-none tracking-[-1px] sm:tracking-[-1.5px]">
              {remainingCredits}
            </span>
            <span className="text-[14px] sm:text-[16px] font-bold text-[#5B6472]">
              학점<span className="sm:hidden"> · {remainingSemesters}학기</span>
              <span className="hidden sm:inline"> 남았어요</span>
            </span>
            <span className="hidden sm:inline text-[13px] text-[#8892A4] ml-1">{remainingSemesters}학기 동안</span>
          </div>
          <div className="h-[7px] sm:h-2 rounded-lg bg-[#DCE7FA] overflow-hidden">
            <div className="h-full rounded-lg bg-[#2F6FEB]" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[11.5px] sm:text-[12px] text-[#8892A4]">
            {totalAcquired} / {totalRequired}학점 이수 · {progressPct}% 완료
            <span className="sm:hidden"> · 학기 평균 {avgPerSemester}학점</span>
          </span>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1.5">
          <span className="text-[12px] text-[#8892A4]">학기 평균</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-extrabold text-[#2F6FEB]">{avgPerSemester}</span>
            <span className="text-[13px] font-bold text-[#5B6472]">학점씩</span>
          </div>
        </div>
      </div>

      {/* 학기별 수강 계획 */}
      {semesterPlan.length > 0 && (
        <div className="flex flex-col gap-2 sm:gap-[11px]">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] sm:text-[15px] font-extrabold text-[#1E2530]">학기별 수강 계획</h3>
            {limitMax != null && (
              <span className="hidden sm:block text-[11.5px] text-[#9AA3B2]">직전학기 성적 기준 상한 {limitMax}학점</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {semesterPlan.map((s, i) => {
              const credits = s.recommended_credits || 0;
              const free = credits === 0;
              const short = !free && s.credit_limit?.min != null && credits < s.credit_limit.min;
              const barPct = Math.round((credits / maxCredit) * 100);
              return (
                <div
                  key={`${s.grade}-${s.semester}-${i}`}
                  className={`flex items-center gap-2.5 sm:gap-4 bg-white border rounded-[11px] sm:rounded-xl px-3.5 py-3 sm:px-[18px] sm:py-3.5 ${
                    free ? "border-[#F1F4FA]" : i === 0 ? "border-[#BFD6FA]" : "border-[#EBEEF3]"
                  }`}
                >
                  <span className="text-[12.5px] sm:text-[13.5px] font-bold text-[#3A4150] flex-1 sm:flex-none sm:w-[92px] sm:flex-shrink-0">
                    {s.grade}학년 {s.semester}학기{i === 0 && <span className="hidden sm:inline"> · 이번</span>}
                  </span>
                  <div className="w-16 sm:w-auto sm:flex-1 h-[7px] sm:h-2.5 rounded-lg bg-[#F1F4FA] overflow-hidden flex-shrink-0">
                    <div
                      className={`h-full rounded-lg ${free ? "bg-[#E4E8F0]" : i === 0 ? "bg-[#2F6FEB]" : "bg-[#9CC0F7]"}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="flex items-baseline gap-1 sm:w-[120px] sm:justify-end flex-shrink-0">
                    <span className={`text-[16px] sm:text-[20px] font-extrabold ${
                      free ? "text-[#B0B7C3]" : i === 0 ? "text-[#2F6FEB]" : "text-[#3A4150]"
                    }`}>
                      {credits}
                    </span>
                    <span className="text-[11px] sm:text-[12px] font-semibold text-[#8892A4]">학점</span>
                  </div>
                  <span className="hidden sm:block text-[11.5px] text-[#B0B7C3] w-20 text-right flex-shrink-0">
                    {free ? "여유" : short ? "남은 학점" : s.credit_limit ? `${s.credit_limit.min}~${s.credit_limit.max}학점` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 요건 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[7px] sm:gap-2.5">
        {summary.map(c => (
          <div
            key={c.label}
            className={`rounded-[11px] sm:rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5 flex flex-col gap-[3px] sm:gap-1.5 ${
              c.ok ? "bg-[#F3FAF6] border-[#CDEBDB]" : "bg-[#FEF6F6] border-[#F8D9D9]"
            }`}
          >
            <span className="text-[11px] sm:text-[12px] font-semibold text-[#8892A4]">{c.label}</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-[18px] sm:text-[22px] font-extrabold ${c.ok ? "text-[#1FA97A]" : "text-[#E5484D]"}`}>
                {c.acq}
              </span>
              <span className="text-[11.5px] sm:text-[13px] text-[#9AA3B2]">/ {c.req}</span>
            </div>
            <span className={`hidden sm:block text-[11.5px] font-bold ${c.ok ? "text-[#1FA97A]" : "text-[#E5484D]"}`}>
              {c.ok ? "충족" : "미충족"}
            </span>
          </div>
        ))}
      </div>

      {/* 교양영역 */}
      {areaValidations.length > 0 && (
        <div className="border border-[#EBEEF3] rounded-[11px] sm:rounded-xl p-3 sm:px-[18px] sm:py-4 flex flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#1E2530]">교양영역</span>
            <span className={`text-[11px] sm:text-[11.5px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-[3px] rounded-full ${
              unmet === 0 ? "bg-[#E4F6EC] text-[#1FA97A]" : "bg-[#FDECEC] text-[#E5484D]"
            }`}>
              {unmet === 0 ? "모두 충족" : `${unmet}개 영역 부족`}
            </span>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-[5px] sm:gap-[7px]">
            {areaValidations.map(a => {
              const optional = !a.required;
              return (
                <div
                  key={a.area}
                  className={`flex items-center justify-between gap-1 rounded-lg sm:rounded-[9px] border px-2 py-1.5 sm:px-2.5 sm:py-2 ${
                    optional
                      ? "bg-[#FBFCFE] border-[#EEF1F5]"
                      : a.is_satisfied
                        ? "bg-[#F3FAF6] border-[#CDEBDB]"
                        : "bg-[#FEF6F6] border-[#F8D9D9]"
                  }`}
                >
                  <span className={`text-[11px] sm:text-[12px] font-semibold truncate ${
                    optional ? "text-[#8892A4]" : a.is_satisfied ? "text-[#3A4150]" : "text-[#E5484D]"
                  }`}>
                    {a.area}
                  </span>
                  <span className={`text-[11px] sm:text-[12px] font-bold flex-shrink-0 ${
                    optional ? "text-[#B0B7C3]" : a.is_satisfied ? "text-[#1FA97A]" : "text-[#E5484D]"
                  }`}>
                    {optional ? a.acquired : `${a.acquired}/${a.required}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 확인 사항 */}
      {warnings.length > 0 && (
        <div className="bg-[#FFFBF3] border border-[#F7E2BE] rounded-[11px] sm:rounded-xl px-3.5 py-3 sm:px-4 sm:py-3.5 flex flex-col gap-1.5">
          <span className="text-[12.5px] font-extrabold text-[#A9761B]">확인 사항</span>
          {warnings.map((w, i) => (
            <span key={i} className="text-[11.5px] sm:text-[12.5px] leading-[1.55] text-[#A9761B]">• {w}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 메인 컴포넌트
// ============================================================
export default function CreditPlanner() {
  const [step, setStep] = useState(1);
  const [userInfo, setUserInfo] = useState(INITIAL_USER_INFO);
  const [acquired, setAcquired] = useState(INITIAL_ACQUIRED);
  const [areas, setAreas] = useState(INITIAL_AREAS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canNext = () => {
    if (step === 1) return userInfo.admission_year !== "";
    if (step === 2) return acquired.total_acquired !== "";
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = buildRequestBody(userInfo, acquired, areas);

      const vRes = await fetch(`${API_BASE}/graduation/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const vData = await vRes.json();

      const pRes = await fetch(`${API_BASE}/graduation/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const pData = await pRes.json();

      setResult({ validate: vData, plan: pData });
      setStep(4);
    } catch {
      setError("서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setStep(1);
    setResult(null);
    setError(null);
    setUserInfo(INITIAL_USER_INFO);
    setAcquired(INITIAL_ACQUIRED);
    setAreas(INITIAL_AREAS);
  };

  const handleNext = () => {
    if (step === 4) return restart();
    if (step === 3) return handleSubmit();
    if (canNext()) setStep(s => s + 1);
  };

  const nextLabel = loading ? "계산 중..." : step === 3 ? "결과 보기" : step === 4 ? "다시 계산하기" : "다음";
  const nextDisabled = loading || !canNext();
  const showPrev = step > 1 && step < 4;

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <SiteHeader activeHref="/credits" title="학점 플래너" />

      {/* 모바일 스텝 진행바 */}
      <div className="sm:hidden bg-white border-b border-[#EBEEF3] px-4 pb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13.5px] font-extrabold text-[#1E2530]">{STEP_LABELS[step - 1]}</span>
          <span className="text-[11.5px] font-bold text-[#2F6FEB] bg-[#EAF1FE] px-2.5 py-[3px] rounded-full">
            {step} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-[5px] rounded-md bg-[#EEF1F6] overflow-hidden">
          <div className="h-full rounded-md bg-[#2F6FEB] transition-[width] duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-8 flex justify-center">
        <div className="w-full max-w-[780px] flex flex-col gap-3.5 sm:gap-[18px]">
          {/* 타이틀 (데스크톱) */}
          <div className="hidden sm:flex items-end justify-between gap-5">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[26px] font-extrabold text-[#1E2530] tracking-[-0.4px]">학점 플래너</h1>
              <p className="text-[13.5px] leading-[1.5] text-[#8892A4]">
                지금까지 들은 학점을 넣으면, 남은 학기마다 몇 학점씩 들어야 하는지 알려드려요
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#8892A4] bg-white border border-[#EBEEF3] px-3 py-[7px] rounded-[9px] whitespace-nowrap flex-shrink-0">
              <Lock size={13} strokeWidth={1.7} className="text-[#9AA3B2]" />
              입력값은 서버에 저장되지 않아요
            </div>
          </div>

          {/* 스텝 레일 (데스크톱) */}
          <div className={`${CARD} hidden sm:flex items-center gap-2 px-5 py-4`}>
            {STEP_LABELS.map((label, i) => {
              const num = i + 1;
              const done = num < step;
              const active = num === step;
              const clickable = num < step;
              return (
                <div
                  key={label}
                  onClick={() => clickable && setStep(num)}
                  className={`flex items-center gap-2.5 min-w-0 ${num === TOTAL_STEPS ? "flex-none" : "flex-1"} ${clickable ? "cursor-pointer" : ""}`}
                >
                  <div className={`w-[30px] h-[30px] rounded-full flex-shrink-0 flex items-center justify-center text-[13.5px] font-extrabold ${
                    done ? "bg-[#DCE8FF] text-[#2F6FEB]" : active ? "bg-[#2F6FEB] text-white" : "bg-[#F1F4FA] text-[#B0B7C3]"
                  }`}>
                    {done ? <Check size={15} strokeWidth={2.6} /> : num}
                  </div>
                  <span className={`text-[13px] whitespace-nowrap ${
                    active ? "font-extrabold text-[#1E2530]" : done ? "font-semibold text-[#5B6472]" : "font-semibold text-[#B0B7C3]"
                  }`}>
                    {label}
                  </span>
                  {num !== TOTAL_STEPS && (
                    <div className={`flex-1 h-0.5 rounded-sm min-w-4 ${done ? "bg-[#BFD6FA]" : "bg-[#EEF1F6]"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* 본문 */}
          <div className={`${CARD} px-3.5 py-4 sm:px-7 sm:py-[26px] sm:min-h-[420px]`}>
            {step === 1 && <Step1 userInfo={userInfo} setUserInfo={setUserInfo} />}
            {step === 2 && <Step2 acquired={acquired} setAcquired={setAcquired} userInfo={userInfo} />}
            {step === 3 && <Step3 areas={areas} setAreas={setAreas} />}
            {step === 4 && <Step4 result={result} />}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-[#FEF6F6] border border-[#F8D9D9] rounded-xl px-3.5 py-3 text-[12.5px] text-[#E5484D]">
              <AlertTriangle size={15} strokeWidth={1.7} className="flex-shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          {/* 하단 내비 */}
          <div className="flex items-center gap-2 sm:justify-between sm:gap-3">
            {showPrev ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="w-[52px] h-12 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-[7px] bg-white border border-[#E4E8F0] text-[#5B6472] sm:px-[22px] sm:py-[13px] rounded-[11px] text-[14px] font-bold flex-shrink-0 hover:bg-[#F6F8FB] transition-colors"
              >
                <ChevronLeft size={17} strokeWidth={1.9} />
                <span className="hidden sm:inline">이전</span>
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={nextDisabled}
              className={`flex-1 sm:flex-none h-12 sm:h-auto flex items-center justify-center gap-[7px] text-white sm:px-[26px] sm:py-[13px] rounded-[11px] text-[14.5px] sm:text-[14px] font-bold transition-colors ${
                nextDisabled ? "bg-[#B7C6DC] cursor-not-allowed" : "bg-[#2F6FEB] hover:bg-[#2559C4]"
              }`}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {nextLabel}
              {!loading && <ChevronRight size={15} strokeWidth={1.9} className="hidden sm:block" />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
