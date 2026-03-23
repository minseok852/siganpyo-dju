import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ============================================================
// 상수
// ============================================================
const TOTAL_STEPS = 4;

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

// ============================================================
// 유틸
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

// ============================================================
// 공통 스타일
// ============================================================
const thStyle = {
  background: "#F1F5F9", border: "1px solid #CBD5E1",
  padding: "8px 6px", fontSize: 11, fontWeight: 700,
  color: "#475569", textAlign: "center",
};
const tdLabelStyle = {
  background: "#F8FAFC", border: "1px solid #CBD5E1",
  padding: "8px 6px", fontSize: 11, fontWeight: 600,
  color: "#64748B", textAlign: "center",
};
const tdInputStyle = {
  border: "1px solid #CBD5E1", padding: "2px",
  textAlign: "center",
};

// 표 안 입력창 (공통)
function TableInput({ value, onChange, highlight, wide }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      placeholder="0"
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      style={{
        width: "100%", border: "none", outline: "none",
        textAlign: "center", fontSize: 14, fontWeight: 700,
        color: highlight ? "#4F46E5" : "#111827",
        background: "transparent", padding: "6px 0",
        minWidth: wide ? 56 : 36,
        boxSizing: "border-box",
      }}
    />
  );
}

// ============================================================
// 서브 컴포넌트
// ============================================================

function ProgressBar({ step }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        {["기본 정보", "성적표 입력", "교양영역 입력", "결과"].map((label, i) => {
          const num = i + 1;
          const active = num === step;
          const done = num < step;
          return (
            <div key={num} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: done ? "#4F46E5" : active ? "#4F46E5" : "#E5E7EB",
                color: done || active ? "#fff" : "#9CA3AF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14,
                border: active ? "3px solid #818CF8" : "none",
                boxShadow: active ? "0 0 0 4px #EEF2FF" : "none",
                transition: "all 0.3s",
              }}>
                {done ? "✓" : num}
              </div>
              <span style={{
                fontSize: 11, marginTop: 4,
                color: active ? "#4F46E5" : done ? "#6B7280" : "#9CA3AF",
                fontWeight: active ? 700 : 400,
              }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ height: 4, background: "#E5E7EB", borderRadius: 2, position: "relative" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%`,
          background: "linear-gradient(90deg, #4F46E5, #818CF8)",
          borderRadius: 2, transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1.5px solid #D1D5DB",
  borderRadius: 8, fontSize: 14, color: "#111827", background: "#fff",
  outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
};
const selectStyle = { ...inputStyle, cursor: "pointer" };

function Btn({ onClick, disabled, children, variant = "primary" }) {
  const base = {
    padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer", border: "none",
    transition: "all 0.2s", opacity: disabled ? 0.5 : 1,
  };
  const styles = {
    primary: { background: "linear-gradient(135deg, #4F46E5, #6366F1)", color: "#fff" },
    secondary: { background: "#F3F4F6", color: "#374151" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}>{children}</button>;
}

function Badge({ ok }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 700,
      background: ok ? "#D1FAE5" : "#FEE2E2",
      color: ok ? "#065F46" : "#991B1B",
    }}>
      {ok ? "충족 ✓" : "미충족 ✗"}
    </span>
  );
}

// ============================================================
// Step 컴포넌트
// ============================================================

function Step1({ userInfo, setUserInfo }) {
  const set = (key) => (e) => setUserInfo((p) => ({ ...p, [key]: e.target.value }));
  const setNum = (key) => (e) => setUserInfo((p) => ({ ...p, [key]: Number(e.target.value) }));
  const setBool = (key) => (e) => setUserInfo((p) => ({ ...p, [key]: e.target.value === "true" }));

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 20 }}>📋 기본 정보</h2>

      <Field label="입학년도 (학번)">
        <select value={userInfo.admission_year} onChange={set("admission_year")} style={selectStyle}>
          <option value="">선택하세요</option>
          {[2018,2019,2020,2021,2022,2023,2024,2025,2026].map((y) => (
            <option key={y} value={y}>{y}학번</option>
          ))}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="현재 학년">
          <select value={userInfo.current_grade} onChange={setNum("current_grade")} style={selectStyle}>
            {[1, 2, 3, 4].map((g) => <option key={g} value={g}>{g}학년</option>)}
          </select>
        </Field>
        <Field label="현재 학기">
          <select value={userInfo.current_semester} onChange={setNum("current_semester")} style={selectStyle}>
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
        </Field>
      </div>

      <Field label="전공 유형">
        <select value={userInfo.major_type} onChange={set("major_type")} style={selectStyle}>
          <option value="주전공">주전공</option>
          <option value="복수전공">복수전공</option>
        </select>
      </Field>

      <Field label="계열" hint="인문사회·예술계열은 교양영역 추가 이수 조건이 있습니다">
        <select value={String(userInfo.is_humanities)} onChange={setBool("is_humanities")} style={selectStyle}>
          <option value="false">이공계열</option>
          <option value="true">인문사회·예술계열</option>
        </select>
      </Field>

      <Field label="직전학기 성적" hint="수강신청 학점 상한선 계산에 사용됩니다">
        <select value={userInfo.gpa_range} onChange={set("gpa_range")} style={selectStyle}>
          <option value="1.5미만">1.5 미만</option>
          <option value="1.5이상~4.0미만">1.5 이상 ~ 4.0 미만</option>
          <option value="4.0이상">4.0 이상</option>
        </select>
      </Field>
      {/* 개인정보 안내 */}
      <div style={{
        marginTop: 20, background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#64748B", lineHeight: 1.7,
      }}>
        🔒 입력하신 정보는 <strong>서버에 저장되지 않으며</strong>, 졸업요건 계산에만 사용됩니다.<br/>
        브라우저를 닫으면 모든 데이터가 사라집니다.
      </div>
    </div>
  );
}

function Step2({ acquired, setAcquired, userInfo }) {
  const set = (key) => (val) => setAcquired((p) => ({ ...p, [key]: val }));

  // 학번/전공유형별 기준값
  const getReq = (year, majorType) => {
    let r = {};
    if (year >= 2025)      r = { total: 126, gyopil: 11, gyoseon: 21 };
    else if (year >= 2021) r = { total: 126, gyopil: 12, gyoseon: 24 };
    else if (year === 2020) r = { total: 130, gyopil: 11, gyoseon: 25 };
    else                   r = { total: 130, gyopil: 6,  gyoseon: 30 };

    if (majorType === "주전공") {
      r.majorLabel = year >= 2025 ? "72" : "63";
      r.bokjeon = "-";
    } else {
      r.majorLabel = year >= 2020 ? "36" : "42";
      r.bokjeon = r.majorLabel;
    }
    return r;
  };

  const year = parseInt(userInfo?.admission_year) || 2022;
  const majorType = userInfo?.major_type || "주전공";
  const req = getReq(year, majorType);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4 }}>📊 성적표 입력</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>
        성적표의 <strong>취득 행</strong> 값을 아래 표에 입력해주세요.
      </p>
      <div style={{
        background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 8,
        padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#0369A1", lineHeight: 1.6,
      }}>
        📌 <strong>성적표 위치:</strong> 포털대진 → 성적 → <strong>이수구분별 성적조회 및 출력</strong>
      </div>

      {/* 학번/전공 기준 안내 */}
      <div style={{
        background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 8,
        padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#166534",
      }}>
        📋 <strong>{year}학번 {majorType}</strong> 기준 — 졸업 {req.total}학점 / 교필 {req.gyopil} / 교선 {req.gyoseon} / 전공 {req.majorLabel}학점
      </div>

      {/* 1행: 졸업학점 / 교필 / 교선 / 기초 / 전기 */}
      <div style={{ overflowX: "auto", marginBottom: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>구분</th>
              <th style={{ ...thStyle, background: "#EEF2FF", color: "#4F46E5" }}>①<br/>졸업학점</th>
              <th style={thStyle}>②<br/>교필</th>
              <th style={thStyle}>③<br/>교선</th>
              <th style={thStyle}>④<br/>기초</th>
              <th style={thStyle}>⑤<br/>전기</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdLabelStyle}>기준</td>
              <td style={{ ...tdLabelStyle, background: "#EEF2FF", fontWeight: 700 }}>{req.total}</td>
              <td style={tdLabelStyle}>{req.gyopil}</td>
              <td style={tdLabelStyle}>{req.gyoseon}</td>
              <td style={tdLabelStyle}>-</td>
              <td style={tdLabelStyle}>-</td>
            </tr>
            <tr style={{ background: "#FAFAFA" }}>
              <td style={{ ...tdLabelStyle, color: "#4F46E5", fontWeight: 700 }}>취득</td>
              <td style={{ ...tdInputStyle, background: "#EEF2FF" }}>
                <TableInput value={acquired.total_acquired} onChange={set("total_acquired")} highlight wide />
              </td>
              <td style={tdInputStyle}><TableInput value={acquired.gyopil} onChange={set("gyopil")} /></td>
              <td style={tdInputStyle}><TableInput value={acquired.gyoseon} onChange={set("gyoseon")} /></td>
              <td style={tdInputStyle}><TableInput value={acquired.gichyo} onChange={set("gichyo")} /></td>
              <td style={tdInputStyle}><TableInput value={acquired.jeongi} onChange={set("jeongi")} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2행: 전필 / 전선 / 복전 */}
      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>구분</th>
              <th style={thStyle}>⑥<br/>전필</th>
              <th style={thStyle}>⑦<br/>전선</th>
              <th style={thStyle}>⑧<br/>복전</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdLabelStyle}>기준</td>
              <td style={tdLabelStyle}>-</td>
              <td style={tdLabelStyle}>{req.majorLabel}</td>
              <td style={tdLabelStyle}>{req.bokjeon}</td>
            </tr>
            <tr style={{ background: "#FAFAFA" }}>
              <td style={{ ...tdLabelStyle, color: "#4F46E5", fontWeight: 700 }}>취득</td>
              <td style={tdInputStyle}><TableInput value={acquired.jeonpil} onChange={set("jeonpil")} /></td>
              <td style={tdInputStyle}><TableInput value={acquired.jeonseon} onChange={set("jeonseon")} /></td>
              <td style={tdInputStyle}><TableInput value={acquired.bokjeon} onChange={set("bokjeon")} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{
        background: "#EEF2FF", border: "1.5px solid #818CF8", borderRadius: 8,
        padding: "8px 12px", fontSize: 11, color: "#4F46E5",
      }}>
        💡 <strong>① 졸업학점</strong>은 일반선택 포함 실제 총 취득학점이에요. 성적표 왼쪽 상단에서 확인하세요.
      </div>
    </div>
  );
}

function Step3({ areas, setAreas }) {
  const set = (key) => (val) => setAreas((p) => ({ ...p, [key]: val }));

  // 1행: 1~8영역
  const row1 = [
    { key: "area_1", num: "①", name: "1영역", base: "1" },
    { key: "area_2", num: "②", name: "2영역", base: "1" },
    { key: "area_3", num: "③", name: "3영역", base: "1" },
    { key: "area_4", num: "④", name: "4영역", base: "1" },
    { key: "area_5", num: "⑤", name: "5영역", base: "1" },
    { key: "area_6", num: "⑥", name: "6영역", base: "" },
    { key: "area_7", num: "⑦", name: "7영역", base: "" },
    { key: "area_8", num: "⑧", name: "8영역", base: "" },
  ];

  // 2행: 9영역~심화
  const row2 = [
    { key: "area_9",       num: "⑨",  name: "9영역", base: "" },
    { key: "area_A",       num: "⑩",  name: "A영역", base: "" },
    { key: "area_B",       num: "⑪",  name: "B영역", base: "" },
    { key: "area_C",       num: "⑫",  name: "C영역", base: "" },
    { key: "area_sil",     num: "⑬",  name: "실용",   base: "" },
    { key: "area_foreign", num: "⑭",  name: "외국어", base: "" },
    { key: "area_deep",    num: "⑮",  name: "심화",   base: "" },
  ];

  const renderTable = (rows) => (
    <div style={{ overflowX: "auto", marginBottom: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>구분</th>
            {rows.map(({ key, num, name }) => (
              <th key={key} style={thStyle}>{num}<br/>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdLabelStyle}>기준</td>
            {rows.map(({ key, base }) => (
              <td key={key} style={tdLabelStyle}>{base}</td>
            ))}
          </tr>
          <tr style={{ background: "#FAFAFA" }}>
            <td style={{ ...tdLabelStyle, color: "#4F46E5", fontWeight: 700 }}>취득</td>
            {rows.map(({ key }) => (
              <td key={key} style={tdInputStyle}>
                <TableInput value={areas[key]} onChange={set(key)} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4 }}>📚 교양영역 입력</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>
        성적표의 <strong>교양영역 취득 행</strong> 값을 아래 표에 입력해주세요.
      </p>
      <div style={{
        background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 8,
        padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#0369A1", lineHeight: 1.6,
      }}>
        📌 <strong>성적표 위치:</strong> 포털대진 → 성적 → <strong>이수구분별 성적조회 및 출력</strong>
      </div>

      {renderTable(row1)}
      {renderTable(row2)}

      <div style={{
        background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 8,
        padding: "8px 12px", fontSize: 11, color: "#C2410C",
      }}>
        💡 <strong>기준 행</strong>은 최소 이수 과목 수예요. 1~5영역은 1과목 이상 필수입니다.
      </div>
    </div>
  );
}

function Step4({ result }) {
  if (!result) return null;

  const { validation } = result.validate || {};
  const plan = result.plan;

  if (!validation) return (
    <div style={{ color: "#991B1B", background: "#FEE2E2", padding: 16, borderRadius: 10 }}>
      ❌ 오류: {result.error || "알 수 없는 오류"}
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 12 }}>🎓 졸업요건 결과</h2>

      {/* 참고용 안내 */}
      <div style={{
        background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 8,
        padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#92400E", lineHeight: 1.7,
      }}>
        ⚠️ 본 계산기는 <strong>참고용</strong>입니다. 정확한 졸업요건은 <strong>학과 사무실에서 상담</strong> 받으시는 게 가장 정확합니다.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "졸업 총학점", acq: validation.total_acquired,  req: validation.total_required,  ok: validation.total_satisfied },
          { label: "전공학점",    acq: validation.major_acquired,   req: validation.major_required,   ok: validation.major_satisfied },
          { label: "교필",        acq: validation.gyopil_acquired,  req: validation.gyopil_required,  ok: validation.gyopil_satisfied },
          { label: "교선",        acq: validation.gyoseon_acquired, req: validation.gyoseon_required, ok: validation.gyoseon_satisfied },
        ].map(({ label, acq, req, ok }) => (
          <div key={label} style={{
            background: ok ? "#F0FDF4" : "#FFF7F7", border: `1.5px solid ${ok ? "#86EFAC" : "#FCA5A5"}`,
            borderRadius: 10, padding: 14,
          }}>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ok ? "#166534" : "#991B1B" }}>
              {acq} <span style={{ fontSize: 13, color: "#9CA3AF" }}>/ {req}</span>
            </div>
            <Badge ok={ok} />
          </div>
        ))}
      </div>

      <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>교양영역</span>
          <Badge ok={validation.area_all_satisfied} />
        </div>
        {validation.area_validations.map((av) => (
          <div key={av.area} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "6px 0", borderBottom: "1px solid #E5E7EB", fontSize: 13,
          }}>
            <span style={{ color: av.is_satisfied ? "#374151" : "#DC2626" }}>{av.area}</span>
            <span style={{ color: av.is_satisfied ? "#059669" : "#DC2626", fontWeight: 600 }}>
              {av.acquired} / {av.required}과목
            </span>
          </div>
        ))}
      </div>

      {validation.warnings.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>⚠️ 확인 사항</div>
          {validation.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 13, color: "#92400E", marginBottom: 4 }}>• {w}</div>
          ))}
        </div>
      )}

      {plan && plan.semester_plan?.length > 0 && (
        <div style={{ background: "#EEF2FF", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📅 학기별 수강 계획</div>
          <div style={{ fontSize: 13, color: "#4F46E5", marginBottom: 12 }}>
            남은 학점: <strong>{plan.remaining_credits}학점</strong> ({plan.remaining_semesters}학기)
          </div>
          {plan.semester_plan.map((s, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", background: "#fff", borderRadius: 8, marginBottom: 8,
            }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>
                {s.grade}학년 {s.semester}학기
              </span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#4F46E5" }}>{s.recommended_credits}학점</span>
                <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 6 }}>
                  ({s.credit_limit.min}~{s.credit_limit.max} 가능)
                </span>
              </div>
            </div>
          ))}
          {plan.warnings?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {plan.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: "#92400E", marginBottom: 2 }}>⚠️ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 메인 컴포넌트
// ============================================================
export default function GraduationCalculator() {
  const navigate = useNavigate();
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
    } catch (e) {
      setError("서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <header style={{
      background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      position: "sticky", top: 0, zIndex: 40,
    }}>
      <div style={{
        maxWidth: 600, margin: "0 auto", padding: "8px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "6px 8px", borderRadius: 8, display: "flex",
            alignItems: "center", color: "#374151", fontSize: 20,
          }}
        >
          ←
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>졸업요건 계산기</span>
      </div>
    </header>
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #EEF2FF 0%, #F8FAFF 100%)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "40px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 520, background: "#fff",
        borderRadius: 20, boxShadow: "0 8px 40px rgba(79,70,229,0.10)",
        padding: 28,
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🎓</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>졸업요건 계산기</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>대진대학교</p>
        </div>

        <ProgressBar step={step} />

        <div style={{ minHeight: 360 }}>
          {step === 1 && <Step1 userInfo={userInfo} setUserInfo={setUserInfo} />}
          {step === 2 && <Step2 acquired={acquired} setAcquired={setAcquired} userInfo={userInfo} />}
          {step === 3 && <Step3 areas={areas} setAreas={setAreas} />}
          {step === 4 && <Step4 result={result} />}
        </div>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          {step > 1 && step < 4 ? (
            <Btn variant="secondary" onClick={() => setStep((s) => s - 1)}>← 이전</Btn>
          ) : <div />}

          {step < 3 && (
            <Btn onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>다음 →</Btn>
          )}
          {step === 3 && (
            <Btn onClick={handleSubmit} disabled={loading}>
              {loading ? "계산 중..." : "결과 보기 →"}
            </Btn>
          )}
          {step === 4 && (
            <Btn onClick={() => {
              setStep(1); setResult(null);
              setUserInfo(INITIAL_USER_INFO);
              setAcquired(INITIAL_ACQUIRED);
              setAreas(INITIAL_AREAS);
            }}>
              다시 계산하기
            </Btn>
          )}
        </div>
      </div>
    </div>
    </>
  );
}