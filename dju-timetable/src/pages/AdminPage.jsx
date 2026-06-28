// src/pages/AdminPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Lock, Eye, EyeOff, ArrowLeft, Loader2,
  Activity, Bot, MessageCircle, Megaphone,
  CheckCircle, XCircle, AlertCircle, RefreshCw, Clock,
  Trash2, Send, Pencil, X,
  Plus, Save, GripVertical, Tag, ChevronUp, ChevronDown,
  Sparkles, Bug, Wrench, Rocket,
  ThumbsUp, ThumbsDown, Database, BarChart3,
} from 'lucide-react';
import {
  collection, getDocs, query, orderBy, limit, where, getCountFromServer,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  getFeedbacks, updateFeedbackStatus, deleteFeedback,
  addAdminComment, editAdminComment, deleteAdminComment,
  verifyAdminPassword, FEEDBACK_STATUS, FEEDBACK_CATEGORY,
} from '../services/feedbackService';
import { getUpdates, createUpdate, editUpdate, deleteUpdate } from '../services/updateService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── 탭 설정 ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'health',   label: '서버 상태', icon: Activity },
  { id: 'ailogs',   label: 'AI 로그',   icon: Bot },
  { id: 'data',     label: '과목 데이터', icon: Database },
  { id: 'feedback', label: '피드백',    icon: MessageCircle },
  { id: 'updates',  label: '업데이트',  icon: Megaphone },
];

// ── 피드백 상태 스타일 ──────────────────────────────────────────────────────
const STATUS_STYLES = {
  [FEEDBACK_STATUS.RECEIVED]:  { bg: 'bg-gray-100',  text: 'text-gray-700',  icon: Clock },
  [FEEDBACK_STATUS.REVIEWING]: { bg: 'bg-blue-100',  text: 'text-blue-700',  icon: AlertCircle },
  [FEEDBACK_STATUS.COMPLETED]: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  [FEEDBACK_STATUS.REJECTED]:  { bg: 'bg-red-100',   text: 'text-red-700',   icon: XCircle },
};

// ── 업데이트 타입 ───────────────────────────────────────────────────────────
const CHANGE_TYPE_OPTIONS = [
  { value: 'feature', label: '새 기능',   icon: Sparkles },
  { value: 'fix',     label: '버그 수정', icon: Bug },
  { value: 'improve', label: '개선',      icon: Wrench },
  { value: 'release', label: '출시',      icon: Rocket },
];
const TYPE_STYLES = {
  feature: { bg: 'bg-blue-50',  text: 'text-blue-700' },
  fix:     { bg: 'bg-red-50',   text: 'text-red-700' },
  improve: { bg: 'bg-amber-50', text: 'text-amber-700' },
  release: { bg: 'bg-green-50', text: 'text-green-700' },
};

// ── 날짜 포맷 ───────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '-';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

// ══════════════════════════════════════════════════════════════════════════
// LOGIN MODAL
// ══════════════════════════════════════════════════════════════════════════
function LoginModal({ onLogin }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const ok = await verifyAdminPassword(pw);
    if (ok) {
      sessionStorage.setItem('admin_auth', 'true');
      onLogin();
    } else {
      setErr('비밀번호가 올바르지 않습니다.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="text-blue-500" size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">관리자 로그인</h1>
          <p className="text-sm text-gray-500 mt-1">대진대 시간표 관리자 페이지</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={e => { setPw(e.target.value); setErr(''); }}
              placeholder="관리자 비밀번호"
              className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button type="button" onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {err && <p className="text-sm text-red-500 mb-3">{err}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HEALTH TAB — 서버 상태 + AI 테스트 + 최근 실패
// ══════════════════════════════════════════════════════════════════════════
function HealthTab() {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [aiPing, setAiPing] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [failures, setFailures] = useState([]);
  const [loadingFail, setLoadingFail] = useState(true);
  const timerRef = useRef(null);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      const data = await res.json();
      const ms = Date.now() - start;
      setHealth({ ok: res.ok && data.status === 'healthy', ms, apiKeyOk: data.api_key_configured });
    } catch {
      setHealth({ ok: false, ms: null, apiKeyOk: false });
    } finally {
      clearTimeout(t);
    }
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  const pingAi = async () => {
    setPinging(true);
    setAiPing(null);
    try {
      const res = await fetch(`${API_BASE}/api/health/ai-ping`);
      setAiPing(await res.json());
    } catch {
      setAiPing({ success: false, error: '서버에 연결할 수 없습니다.' });
    }
    setPinging(false);
  };

  const loadFailures = async () => {
    setLoadingFail(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'ai_logs'), orderBy('created_at', 'desc'), limit(30))
      );
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFailures(all.filter(l => !l.success).slice(0, 5));
    } catch { /* ignore */ }
    setLoadingFail(false);
  };

  useEffect(() => {
    checkHealth();
    loadFailures();
    timerRef.current = setInterval(checkHealth, 30000);
    return () => clearInterval(timerRef.current);
  }, [checkHealth]);

  const color = !health ? 'gray' : !health.ok ? 'red' : health.ms > 2000 ? 'yellow' : 'green';
  const dotCls = color === 'green' ? 'bg-green-500 animate-pulse'
    : color === 'yellow' ? 'bg-yellow-400'
    : color === 'red' ? 'bg-red-500' : 'bg-gray-300';
  const borderCls = color === 'green' ? 'bg-green-50 border-green-200'
    : color === 'yellow' ? 'bg-yellow-50 border-yellow-200'
    : color === 'red' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';

  return (
    <div className="space-y-4">
      {/* 서버 상태 카드 */}
      <div className={`rounded-xl p-4 border-2 ${borderCls}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotCls}`} />
            <span className="font-bold text-gray-800">FastAPI 서버</span>
          </div>
          <button onClick={checkHealth} disabled={checking}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg">
            <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              value: !health ? '—' : health.ok ? '정상' : '오류',
              label: '상태',
              cls: !health ? 'text-gray-400' : health.ok ? 'text-green-600' : 'text-red-600',
            },
            {
              value: health?.ms != null ? `${health.ms}ms` : '—',
              label: '응답속도',
              cls: !health?.ms ? 'text-gray-400' : health.ms < 1000 ? 'text-green-600' : health.ms < 2000 ? 'text-yellow-600' : 'text-red-600',
            },
            {
              value: !health ? '—' : health.apiKeyOk ? '설정됨' : '없음',
              label: 'API 키',
              cls: !health ? 'text-gray-400' : health.apiKeyOk ? 'text-green-600' : 'text-red-600',
            },
          ].map(({ value, label, cls }) => (
            <div key={label} className="bg-white rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {lastChecked && (
          <p className="text-xs text-gray-400 mt-2 text-right">
            마지막 확인: {lastChecked.toLocaleTimeString('ko-KR')} · 30초마다 자동 갱신
          </p>
        )}
      </div>

      {/* AI 실제 동작 테스트 */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">AI 실제 동작 테스트</h3>
            <p className="text-xs text-gray-500 mt-0.5">Gemini에 실제로 요청을 보내 응답을 확인합니다</p>
          </div>
          <button onClick={pingAi} disabled={pinging}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2">
            {pinging ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            {pinging ? '테스트 중...' : 'AI 테스트'}
          </button>
        </div>

        {aiPing && (
          <div className={`rounded-lg p-3 ${aiPing.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2">
              {aiPing.success
                ? <CheckCircle size={16} className="text-green-600" />
                : <XCircle size={16} className="text-red-600" />}
              <span className={`text-sm font-medium ${aiPing.success ? 'text-green-700' : 'text-red-700'}`}>
                {aiPing.success ? 'AI 정상 응답' : 'AI 응답 실패'}
              </span>
              {aiPing.latency_ms != null && (
                <span className="text-xs text-gray-500 ml-auto">{aiPing.latency_ms}ms</span>
              )}
            </div>
            {aiPing.error && (
              <p className="text-xs text-red-600 mt-1">{aiPing.error}</p>
            )}
          </div>
        )}
      </div>

      {/* 최근 AI 실패 */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 text-sm">
            최근 AI 실패 {failures.length > 0 && <span className="text-red-500">({failures.length}건)</span>}
          </h3>
          <button onClick={loadFailures} className="text-xs text-gray-400 hover:text-gray-600">새로고침</button>
        </div>
        {loadingFail ? (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : failures.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-green-600">
            <CheckCircle size={16} /> 최근 실패 없음
          </div>
        ) : (
          <div className="space-y-2">
            {failures.map(f => (
              <div key={f.id} className="bg-red-50 border border-red-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-red-700">
                    {f.type === 'evaluate' ? '평가' : '추천'} · {f.grade && `${f.grade}학년`} {f.major}
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(f.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// AI LOGS TAB — 세션 로그 + 통계 + 피드백 코멘트
// ══════════════════════════════════════════════════════════════════════════
function AiLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'ai_logs'), orderBy('created_at', 'desc'), limit(50))
      );
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = logs.filter(l =>
    filter === 'all' ? true :
    filter === 'failed' ? !l.success :
    l.thumbs === 'down'
  );

  const total = logs.length;
  const successCount = logs.filter(l => l.success).length;
  const successRate = total ? Math.round((successCount / total) * 100) : 0;
  const thumbsUp = logs.filter(l => l.thumbs === 'up').length;
  const thumbsDown = logs.filter(l => l.thumbs === 'down').length;

  // 사용 패턴 집계 (클라이언트 사이드)
  const gradeCount = logs.reduce((acc, l) => {
    if (l.grade) acc[l.grade] = (acc[l.grade] || 0) + 1;
    return acc;
  }, {});
  const majorCount = logs.reduce((acc, l) => {
    if (l.major) acc[l.major] = (acc[l.major] || 0) + 1;
    return acc;
  }, {});
  const topMajors = Object.entries(majorCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const gradeOrder = [1, 2, 3, 4];

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-800">{total}</div>
          <div className="text-xs text-gray-500 mt-0.5">전체 AI 세션</div>
        </div>
        <div className={`border rounded-xl p-4 ${successRate >= 90 ? 'bg-green-50 border-green-200' : successRate >= 70 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`text-2xl font-bold ${successRate >= 90 ? 'text-green-700' : successRate >= 70 ? 'text-yellow-700' : 'text-red-700'}`}>
            {successRate}%
          </div>
          <div className="text-xs text-gray-500 mt-0.5">AI 성공률</div>
        </div>
        <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
          <ThumbsUp size={20} className="text-green-500" />
          <div>
            <div className="text-xl font-bold text-gray-800">{thumbsUp}</div>
            <div className="text-xs text-gray-500">좋아요</div>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
          <ThumbsDown size={20} className="text-red-500" />
          <div>
            <div className="text-xl font-bold text-gray-800">{thumbsDown}</div>
            <div className="text-xs text-gray-500">별로예요</div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: '전체' },
          { id: 'failed', label: '실패만' },
          { id: 'thumbs_down', label: '👎만' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.id ? 'bg-indigo-500 text-white' : 'bg-white border text-gray-600'
            }`}>
            {f.label}
          </button>
        ))}
        <button onClick={loadLogs} className="ml-auto p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 로그 목록 */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">데이터가 없습니다</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <div key={log.id} className={`bg-white border rounded-xl p-3 ${!log.success ? 'border-red-200' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.type === 'evaluate' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {log.type === 'evaluate' ? '평가' : '추천'}
                  </span>
                  {!log.success && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">실패</span>
                  )}
                  {log.thumbs === 'up' && <ThumbsUp size={13} className="text-green-500" />}
                  {log.thumbs === 'down' && <ThumbsDown size={13} className="text-red-500" />}
                  <span className="text-sm text-gray-700">
                    {log.grade && `${log.grade}학년`}{log.major && ` · ${log.major}`}
                  </span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{fmtDate(log.created_at)}</span>
              </div>
              {log.type === 'evaluate' && log.score != null && (
                <p className="text-xs text-gray-500 mt-1">점수: {log.score}점</p>
              )}
              {log.type === 'recommend' && log.result_credits != null && (
                <p className="text-xs text-gray-500 mt-1">추천 {log.result_credits}학점 ({log.result_course_count}과목)</p>
              )}
              {log.feedback_comment && (
                <div className="mt-2 bg-red-50 rounded-lg px-2.5 py-1.5">
                  <p className="text-xs text-red-700">💬 {log.feedback_comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 사용 패턴 */}
      {!loading && total > 0 && (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-500" />
            <h3 className="font-bold text-gray-800 text-sm">사용 패턴 <span className="text-xs font-normal text-gray-400">(최근 {total}건 기준)</span></h3>
          </div>

          {/* 학년별 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">학년별 AI 사용</p>
            <div className="flex gap-2">
              {gradeOrder.map(g => {
                const cnt = gradeCount[g] || 0;
                const pct = total ? Math.round((cnt / total) * 100) : 0;
                return (
                  <div key={g} className="flex-1 bg-gray-50 rounded-lg p-2.5 text-center">
                    <div className="text-base font-bold text-indigo-600">{cnt}</div>
                    <div className="text-[10px] text-gray-400">{g}학년</div>
                    <div className="text-[10px] text-gray-300">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 학과별 TOP 5 */}
          {topMajors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">학과별 TOP {topMajors.length}</p>
              <div className="space-y-1.5">
                {topMajors.map(([major, cnt], i) => {
                  const pct = total ? Math.round((cnt / total) * 100) : 0;
                  return (
                    <div key={major} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                      <span className="text-xs text-gray-700 flex-1 truncate">{major}</span>
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-6 text-right">{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// DATA TAB — 과목 데이터 현황
// ══════════════════════════════════════════════════════════════════════════
const COURSE_CATEGORIES = [
  { key: 'major',            label: '전공과목',   color: 'text-blue-600',  bg: 'bg-blue-50' },
  { key: 'general_required', label: '교양필수',   color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'general_elective', label: '교양선택',   color: 'text-purple-600',bg: 'bg-purple-50' },
  { key: 'convergence',      label: '융합과목',   color: 'text-orange-600',bg: 'bg-orange-50' },
];

function DataTab() {
  const [counts, setCounts] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const coll = collection(db, 'courses');
      const [totalSnap, ...catSnaps] = await Promise.all([
        getCountFromServer(coll),
        ...COURSE_CATEGORIES.map(c =>
          getCountFromServer(query(coll, where('category', '==', c.key)))
        ),
      ]);

      const result = { total: totalSnap.data().count };
      COURSE_CATEGORIES.forEach((c, i) => {
        result[c.key] = catSnaps[i].data().count;
      });
      setCounts(result);

      // 가장 최근 추가된 과목 (created_at 필드가 있는 경우)
      try {
        const snap = await getDocs(query(coll, orderBy('created_at', 'desc'), limit(1)));
        if (!snap.empty) {
          const d = snap.docs[0].data();
          setLastAdded({ name: d.course_name, date: d.created_at });
        }
      } catch { /* created_at 필드 없으면 무시 */ }
    } catch (e) {
      console.error('과목 데이터 로드 실패:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800">Firestore 과목 데이터</h3>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : !counts ? (
        <div className="text-center py-8 text-red-400 text-sm">데이터 로드 실패</div>
      ) : (
        <>
          {/* 전체 총계 */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 text-white">
            <div className="text-4xl font-bold">{counts.total.toLocaleString()}</div>
            <div className="text-sm opacity-80 mt-1">전체 과목 수</div>
            {lastAdded && (
              <div className="text-xs opacity-60 mt-2">
                마지막 추가: {fmtDate(lastAdded.date)} · {lastAdded.name}
              </div>
            )}
          </div>

          {/* 카테고리별 */}
          <div className="grid grid-cols-2 gap-3">
            {COURSE_CATEGORIES.map(c => (
              <div key={c.key} className={`${c.bg} rounded-xl p-4 border border-opacity-20`}>
                <div className={`text-2xl font-bold ${c.color}`}>
                  {counts[c.key]?.toLocaleString() ?? '—'}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{c.label}</div>
                {counts.total > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    전체의 {Math.round(((counts[c.key] || 0) / counts.total) * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 기타 (카테고리 합산 외) */}
          {(() => {
            const categorized = COURSE_CATEGORIES.reduce((s, c) => s + (counts[c.key] || 0), 0);
            const etc = counts.total - categorized;
            return etc > 0 ? (
              <div className="bg-gray-50 rounded-xl p-4 border">
                <div className="text-xl font-bold text-gray-600">{etc.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-0.5">기타 (미분류)</div>
              </div>
            ) : null;
          })()}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FEEDBACK TAB — 기존 FeedbackAdminPage 내용
// ══════════════════════════════════════════════════════════════════════════
function AdminFeedbackCard({ feedback, onStatusChange, onDelete, onAddComment, onEditComment, onDeleteComment }) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');

  const statusStyle = STATUS_STYLES[feedback.status] || STATUS_STYLES[FEEDBACK_STATUS.RECEIVED];
  const StatusIcon = statusStyle.icon;

  const handleStatusChange = async (newStatus) => {
    if (newStatus === FEEDBACK_STATUS.REJECTED) {
      setShowRejectModal(true);
      setShowStatusDropdown(false);
      return;
    }
    setIsUpdating(true);
    await onStatusChange(feedback.id, newStatus);
    setIsUpdating(false);
    setShowStatusDropdown(false);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { alert('반영 불가 사유를 입력해주세요.'); return; }
    setIsUpdating(true);
    await onStatusChange(feedback.id, FEEDBACK_STATUS.REJECTED, rejectionReason.trim());
    setIsUpdating(false);
    setShowRejectModal(false);
    setRejectionReason('');
  };

  const handleDelete = async () => {
    if (confirm('정말 삭제하시겠습니까?')) await onDelete(feedback.id);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    await onAddComment(feedback.id, commentText.trim());
    setCommentText('');
    setIsSubmittingComment(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              feedback.category === FEEDBACK_CATEGORY.TYPO ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {feedback.category}
            </span>
            <div className="relative">
              <button onClick={() => setShowStatusDropdown(v => !v)} disabled={isUpdating}
                className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text} hover:opacity-80`}>
                {isUpdating ? <Loader2 className="animate-spin" size={12} /> : <StatusIcon size={12} />}
                {feedback.status} <span className="ml-1">▼</span>
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                  {Object.values(FEEDBACK_STATUS).map(status => {
                    const s = STATUS_STYLES[status];
                    const Icon = s.icon;
                    return (
                      <button key={status} onClick={() => handleStatusChange(status)}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-50 ${feedback.status === status ? 'bg-gray-100' : ''}`}>
                        <Icon size={12} className={s.text} />{status}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <button onClick={handleDelete} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
            <Trash2 size={16} />
          </button>
        </div>

        {feedback.courseName && (
          <div className="text-xs text-gray-500 mb-1">📚 {feedback.courseName}</div>
        )}
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{feedback.content}</p>

        {feedback.status === FEEDBACK_STATUS.REJECTED && feedback.rejectionReason && (
          <div className="mt-2 p-2 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600"><strong>반영 불가 사유:</strong> {feedback.rejectionReason}</p>
          </div>
        )}

        <div className="mt-2 text-xs text-gray-400">
          작성: {fmtDate(feedback.createdAt)}
          {feedback.updatedAt && feedback.updatedAt.getTime() !== feedback.createdAt?.getTime() && (
            <span className="ml-2">| 수정: {fmtDate(feedback.updatedAt)}</span>
          )}
        </div>

        {/* 관리자 댓글 */}
        <div className="mt-3 border-t border-gray-100 pt-3">
          {feedback.adminComments?.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-1.5">
                <MessageCircle size={14} className="text-blue-500" />
                <span className="text-xs font-semibold text-gray-600">관리자 답변 ({feedback.adminComments.length})</span>
              </div>
              {feedback.adminComments.map(comment => (
                <div key={comment.id} className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                  {editingCommentId === comment.id ? (
                    <div>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)}
                        className="w-full px-2 py-1.5 border rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                      <div className="flex gap-1.5 mt-1.5 justify-end">
                        <button onClick={() => { setEditingCommentId(null); setEditText(''); }}
                          className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">취소</button>
                        <button onClick={async () => {
                          if (!editText.trim()) return;
                          await onEditComment(feedback.id, comment.id, editText.trim());
                          setEditingCommentId(null); setEditText('');
                        }} className="px-2.5 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">수정 완료</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">관리자</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(comment.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {comment.editedAt && ' (수정됨)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => { setEditingCommentId(comment.id); setEditText(comment.content); }}
                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-100 rounded">
                            <Pencil size={12} />
                          </button>
                          <button onClick={async () => { if (confirm('댓글을 삭제하시겠습니까?')) await onDeleteComment(feedback.id, comment.id); }}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="답변을 입력하세요..."
              className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-sm h-10 min-h-[40px] max-h-24 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (commentText.trim()) handleAddComment(); } }} />
            <button onClick={handleAddComment} disabled={!commentText.trim() || isSubmittingComment}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 self-end">
              {isSubmittingComment ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-4">
            <h3 className="font-bold text-lg mb-3">반영 불가 사유</h3>
            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
              placeholder="반영할 수 없는 사유를 입력해주세요..."
              className="w-full px-3 py-2 border rounded-lg text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">취소</button>
              <button onClick={handleReject} disabled={isUpdating}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm flex items-center justify-center gap-1">
                {isUpdating ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                반영 불가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackTab() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    const res = await getFeedbacks();
    if (res.success) setFeedbacks(res.feedbacks);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (id, status, reason = null) => {
    const res = await updateFeedbackStatus(id, status, reason);
    if (res.success) load(); else alert('상태 변경 실패: ' + res.error);
  };
  const handleDelete = async (id) => {
    const res = await deleteFeedback(id);
    if (res.success) load(); else alert('삭제 실패: ' + res.error);
  };
  const handleAddComment = async (id, content) => {
    const res = await addAdminComment(id, content);
    if (res.success) load(); else alert('댓글 작성 실패: ' + res.error);
  };
  const handleEditComment = async (feedbackId, commentId, newContent) => {
    const res = await editAdminComment(feedbackId, commentId, newContent);
    if (res.success) load(); else alert('댓글 수정 실패: ' + res.error);
  };
  const handleDeleteComment = async (feedbackId, commentId) => {
    const res = await deleteAdminComment(feedbackId, commentId);
    if (res.success) load(); else alert('댓글 삭제 실패: ' + res.error);
  };

  const filtered = feedbacks.filter(fb =>
    filter === 'all' ? true :
    filter === 'received' ? fb.status === FEEDBACK_STATUS.RECEIVED :
    filter === 'reviewing' ? fb.status === FEEDBACK_STATUS.REVIEWING :
    filter === 'completed' ? fb.status === FEEDBACK_STATUS.COMPLETED :
    fb.status === FEEDBACK_STATUS.REJECTED
  );

  const stats = {
    total: feedbacks.length,
    received: feedbacks.filter(f => f.status === FEEDBACK_STATUS.RECEIVED).length,
    reviewing: feedbacks.filter(f => f.status === FEEDBACK_STATUS.REVIEWING).length,
    completed: feedbacks.filter(f => f.status === FEEDBACK_STATUS.COMPLETED).length,
    rejected: feedbacks.filter(f => f.status === FEEDBACK_STATUS.REJECTED).length,
  };

  return (
    <div className="space-y-4">
      {/* 통계 필터 */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { key: 'all',       label: '전체',   count: stats.total,     active: 'bg-blue-500 text-white' },
          { key: 'received',  label: '접수됨', count: stats.received,   active: 'bg-gray-600 text-white' },
          { key: 'reviewing', label: '검토 중', count: stats.reviewing, active: 'bg-blue-600 text-white' },
          { key: 'completed', label: '완료',   count: stats.completed,  active: 'bg-green-600 text-white' },
          { key: 'rejected',  label: '불가',   count: stats.rejected,   active: 'bg-red-600 text-white' },
        ].map(({ key, label, count, active }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`p-3 rounded-lg text-center transition-colors ${filter === key ? active : 'bg-white border'}`}>
            <div className="text-xl font-bold">{count}</div>
            <div className="text-xs">{label}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">피드백이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => (
            <AdminFeedbackCard key={fb.id} feedback={fb}
              onStatusChange={handleStatusChange} onDelete={handleDelete}
              onAddComment={handleAddComment} onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment} />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// UPDATE TAB — 기존 UpdateAdminPage 내용
// ══════════════════════════════════════════════════════════════════════════
function ChangeItemRow({ change, index, onUpdate, onRemove }) {
  return (
    <div className="flex items-center gap-2 group">
      <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
      <select value={change.type} onChange={e => onUpdate(index, { ...change, type: e.target.value })}
        className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0 w-24">
        {CHANGE_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <input type="text" value={change.text} onChange={e => onUpdate(index, { ...change, text: e.target.value })}
        placeholder="변경사항 내용을 입력하세요"
        className="flex-1 text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <button onClick={() => onRemove(index)}
        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

function UpdateForm({ initial = null, onSubmit, onCancel, isSubmitting }) {
  const [version, setVersion] = useState(initial?.version || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(initial?.title || '');
  const [highlights, setHighlights] = useState(initial?.highlights || '');
  const [changes, setChanges] = useState(
    initial?.changes?.length > 0 ? initial.changes : [{ type: 'feature', text: '' }]
  );

  const handleSubmit = () => {
    const validChanges = changes.filter(c => c.text.trim());
    if (!version.trim() || !title.trim() || validChanges.length === 0) {
      alert('버전, 제목, 변경사항을 모두 입력해주세요.'); return;
    }
    onSubmit({ version: version.trim(), date, title: title.trim(), highlights: highlights.trim(), changes: validChanges });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-800">{initial ? '업데이트 수정' : '새 업데이트 작성'}</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">버전</label>
            <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="1.3.0"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">제목</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="복수전공 AI 추천 개선"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">한줄 요약</label>
          <input type="text" value={highlights} onChange={e => setHighlights(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">변경사항</label>
          <div className="space-y-2">
            {changes.map((c, i) => (
              <ChangeItemRow key={i} change={c} index={i}
                onUpdate={(idx, updated) => setChanges(prev => prev.map((v, j) => j === idx ? updated : v))}
                onRemove={idx => changes.length > 1 && setChanges(prev => prev.filter((_, j) => j !== idx))} />
            ))}
          </div>
          <button onClick={() => setChanges(prev => [...prev, { type: 'feature', text: '' }])}
            className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium">
            <Plus size={14} /> 변경사항 추가
          </button>
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">취소</button>
        <button onClick={handleSubmit} disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">
          {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</> : <><Save size={14} /> {initial ? '수정 완료' : '작성 완료'}</>}
        </button>
      </div>
    </div>
  );
}

function AdminUpdateCard({ update, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`v${update.version} "${update.title}" 을(를) 삭제하시겠습니까?`)) return;
    setDeleting(true);
    await onDelete(update.id);
    setDeleting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 cursor-pointer" onClick={() => setExpanded(v => !v)}>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 text-xs text-gray-500"><Tag size={11} /> v{update.version}</span>
              <span className="text-xs text-gray-400">{update.date}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-400">{update.changes?.length || 0}개 변경</span>
            </div>
            <h3 className="text-sm font-bold text-gray-800">{update.title}</h3>
            {update.highlights && <p className="text-xs text-gray-500 mt-0.5">{update.highlights}</p>}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => onEdit(update)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
              <Pencil size={14} />
            </button>
            <button onClick={handleDelete} disabled={deleting} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
            <button onClick={() => setExpanded(v => !v)} className="p-1.5 text-gray-400">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {(update.changes || []).map((change, i) => {
              const s = TYPE_STYLES[change.type] || {};
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${s.bg} ${s.text}`}>
                    {CHANGE_TYPE_OPTIONS.find(t => t.value === change.type)?.label || change.type}
                  </span>
                  <span className="text-xs text-gray-700">{change.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UpdateTab() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formMode, setFormMode] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await getUpdates();
    if (res.success) setUpdates(res.updates);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    setSubmitting(true);
    const res = await createUpdate(data);
    if (res.success) { setFormMode(null); await load(); } else alert('작성 실패: ' + res.error);
    setSubmitting(false);
  };

  const handleEdit = async (data) => {
    setSubmitting(true);
    const res = await editUpdate(formMode.id, data);
    if (res.success) { setFormMode(null); await load(); } else alert('수정 실패: ' + res.error);
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    const res = await deleteUpdate(id);
    if (res.success) await load(); else alert('삭제 실패: ' + res.error);
  };

  return (
    <div className="space-y-4">
      {formMode !== null && (
        <UpdateForm
          initial={formMode === 'create' ? null : formMode}
          onSubmit={formMode === 'create' ? handleCreate : handleEdit}
          onCancel={() => setFormMode(null)}
          isSubmitting={submitting} />
      )}
      {formMode === null && (
        <button onClick={() => setFormMode('create')}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
          <Plus size={16} /> 새 업데이트 작성
        </button>
      )}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-500" size={28} />
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center py-12">
          <Rocket className="mx-auto text-gray-300 mb-3" size={36} />
          <p className="text-sm text-gray-500">아직 업데이트 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map(u => (
            <AdminUpdateCard key={u.id} update={u} onEdit={u => setFormMode(u)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN ADMIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_auth') === 'true');
  const [tab, setTab] = useState('health');

  if (!authed) return <LoginModal onLogin={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/')} className="p-1.5 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={20} />
              </button>
              <Shield className="text-blue-500" size={20} />
              <h1 className="text-base font-bold text-gray-800">관리자</h1>
            </div>
            <button
              onClick={() => { sessionStorage.removeItem('admin_auth'); setAuthed(false); }}
              className="text-sm text-gray-500 hover:text-gray-700">
              로그아웃
            </button>
          </div>

          {/* 탭 바 */}
          <div className="flex gap-1 mt-2 overflow-x-auto pb-0.5">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === t.id ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {tab === 'health'   && <HealthTab />}
        {tab === 'ailogs'   && <AiLogsTab />}
        {tab === 'data'     && <DataTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'updates'  && <UpdateTab />}
      </main>
    </div>
  );
}
