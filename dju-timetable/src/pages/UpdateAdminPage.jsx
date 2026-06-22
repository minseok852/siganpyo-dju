// src/pages/UpdateAdminPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Shield,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Sparkles,
  Bug,
  Wrench,
  Rocket,
  ChevronDown,
  ChevronUp,
  Tag,
  GripVertical
} from 'lucide-react';
import { 
  getUpdates, 
  createUpdate, 
  editUpdate, 
  deleteUpdate 
} from '../services/updateService';
import { verifyAdminPassword } from '../services/feedbackService';

// 변경사항 타입 옵션
const CHANGE_TYPE_OPTIONS = [
  { value: 'feature', label: '새 기능', icon: Sparkles, color: 'text-blue-500' },
  { value: 'fix', label: '버그 수정', icon: Bug, color: 'text-red-500' },
  { value: 'improve', label: '개선', icon: Wrench, color: 'text-amber-500' },
  { value: 'release', label: '출시', icon: Rocket, color: 'text-green-500' },
];

const TYPE_STYLES = {
  feature: { bg: 'bg-blue-50', text: 'text-blue-700' },
  fix: { bg: 'bg-red-50', text: 'text-red-700' },
  improve: { bg: 'bg-amber-50', text: 'text-amber-700' },
  release: { bg: 'bg-green-50', text: 'text-green-700' },
};

// ========================================
// 변경사항 한 줄 입력 컴포넌트
// ========================================
function ChangeItemRow({ change, index, onUpdate, onRemove }) {
  const typeOption = CHANGE_TYPE_OPTIONS.find(t => t.value === change.type);
  const Icon = typeOption?.icon || Sparkles;

  return (
    <div className="flex items-center gap-2 group">
      <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
      
      {/* 타입 선택 드롭다운 */}
      <select
        value={change.type}
        onChange={(e) => onUpdate(index, { ...change, type: e.target.value })}
        className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0 w-24"
      >
        {CHANGE_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 내용 입력 */}
      <input
        type="text"
        value={change.text}
        onChange={(e) => onUpdate(index, { ...change, text: e.target.value })}
        placeholder="변경사항 내용을 입력하세요"
        className="flex-1 text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* 삭제 버튼 */}
      <button
        onClick={() => onRemove(index)}
        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ========================================
// 업데이트 작성/수정 폼
// ========================================
function UpdateForm({ initial = null, onSubmit, onCancel, isSubmitting }) {
  const [version, setVersion] = useState(initial?.version || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(initial?.title || '');
  const [highlights, setHighlights] = useState(initial?.highlights || '');
  const [changes, setChanges] = useState(
    initial?.changes?.length > 0 
      ? initial.changes 
      : [{ type: 'feature', text: '' }]
  );

  const addChange = () => {
    setChanges([...changes, { type: 'feature', text: '' }]);
  };

  const updateChange = (index, updated) => {
    const newChanges = [...changes];
    newChanges[index] = updated;
    setChanges(newChanges);
  };

  const removeChange = (index) => {
    if (changes.length <= 1) return;
    setChanges(changes.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // 빈 변경사항 제거
    const validChanges = changes.filter(c => c.text.trim());
    
    if (!version.trim() || !title.trim() || validChanges.length === 0) {
      alert('버전, 제목, 변경사항을 모두 입력해주세요.');
      return;
    }

    onSubmit({
      version: version.trim(),
      date,
      title: title.trim(),
      highlights: highlights.trim(),
      changes: validChanges,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-800">
          {initial ? '업데이트 수정' : '새 업데이트 작성'}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* 버전 + 날짜 */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">버전</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.3.0"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="복수전공 AI 추천 개선"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 요약 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">한줄 요약</label>
          <input
            type="text"
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            placeholder="복수전공 학생의 시간표 추천이 대폭 개선되었습니다."
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 변경사항 목록 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">변경사항</label>
          <div className="space-y-2">
            {changes.map((change, i) => (
              <ChangeItemRow
                key={i}
                change={change}
                index={i}
                onUpdate={updateChange}
                onRemove={removeChange}
              />
            ))}
          </div>
          <button
            onClick={addChange}
            className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium"
          >
            <Plus size={14} />
            변경사항 추가
          </button>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
        >
          {isSubmitting ? (
            <><Loader2 size={14} className="animate-spin" /> 저장 중...</>
          ) : (
            <><Save size={14} /> {initial ? '수정 완료' : '작성 완료'}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ========================================
// 관리자용 업데이트 카드
// ========================================
function AdminUpdateCard({ update, onEdit, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`v${update.version} "${update.title}" 을(를) 삭제하시겠습니까?`)) return;
    setIsDeleting(true);
    await onDelete(update.id);
    setIsDeleting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center gap-2 mb-1 cursor-pointer">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Tag size={11} />
                v{update.version}
              </span>
              <span className="text-xs text-gray-400">{update.date}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-400">{update.changes?.length || 0}개 변경</span>
            </div>
            <h3 className="text-sm font-bold text-gray-800">{update.title}</h3>
            {update.highlights && (
              <p className="text-xs text-gray-500 mt-0.5">{update.highlights}</p>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => onEdit(update)}
              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-gray-400"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* 변경사항 목록 */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {(update.changes || []).map((change, i) => {
              const style = TYPE_STYLES[change.type] || {};
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
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

// ========================================
// 로그인 모달
// ========================================
function LoginModal({ onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await verifyAdminPassword(password);
    if (ok) {
      localStorage.setItem('update_admin_auth', 'true');
      onLogin();
    } else {
      setError('비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="text-blue-500" size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">관리자 로그인</h1>
          <p className="text-sm text-gray-500 mt-1">업데이트 내역 관리 페이지입니다</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="관리자 비밀번호"
              className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}

// ========================================
// 메인 관리자 페이지
// ========================================
export default function UpdateAdminPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [updates, setUpdates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 폼 모드: null(목록), 'create'(새 작성), { ...update }(수정)
  const [formMode, setFormMode] = useState(null);

  // 인증 체크
  useEffect(() => {
    const saved = localStorage.getItem('update_admin_auth');
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // 목록 로드
  const fetchUpdates = async () => {
    setIsLoading(true);
    const result = await getUpdates();
    if (result.success) {
      setUpdates(result.updates);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUpdates();
    }
  }, [isAuthenticated]);

  // 새 업데이트 작성
  const handleCreate = async (data) => {
    setIsSubmitting(true);
    const result = await createUpdate(data);
    if (result.success) {
      setFormMode(null);
      await fetchUpdates();
    } else {
      alert('작성 실패: ' + result.error);
    }
    setIsSubmitting(false);
  };

  // 업데이트 수정
  const handleEdit = async (data) => {
    setIsSubmitting(true);
    const result = await editUpdate(formMode.id, data);
    if (result.success) {
      setFormMode(null);
      await fetchUpdates();
    } else {
      alert('수정 실패: ' + result.error);
    }
    setIsSubmitting(false);
  };

  // 업데이트 삭제
  const handleDelete = async (id) => {
    const result = await deleteUpdate(id);
    if (result.success) {
      await fetchUpdates();
    } else {
      alert('삭제 실패: ' + result.error);
    }
  };

  // 비인증 상태
  if (!isAuthenticated) {
    return <LoginModal onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/updates')}
                className="p-1.5 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft size={20} />
              </button>
              <Shield className="text-blue-500" size={20} />
              <h1 className="text-base font-bold text-gray-800">업데이트 관리</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        {/* 새 작성 / 수정 폼 */}
        {formMode !== null && (
          <div className="mb-4">
            <UpdateForm
              initial={formMode === 'create' ? null : formMode}
              onSubmit={formMode === 'create' ? handleCreate : handleEdit}
              onCancel={() => setFormMode(null)}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* 새 업데이트 작성 버튼 */}
        {formMode === null && (
          <button
            onClick={() => setFormMode('create')}
            className="w-full mb-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            새 업데이트 작성
          </button>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-blue-500" size={28} />
          </div>
        )}

        {/* 목록 */}
        {!isLoading && (
          <div className="space-y-3">
            {updates.length === 0 ? (
              <div className="text-center py-12">
                <Rocket className="mx-auto text-gray-300 mb-3" size={36} />
                <p className="text-sm text-gray-500">아직 업데이트 내역이 없습니다.</p>
                <p className="text-xs text-gray-400 mt-1">위 버튼을 눌러 첫 업데이트를 작성해보세요!</p>
              </div>
            ) : (
              updates.map(update => (
                <AdminUpdateCard
                  key={update.id}
                  update={update}
                  onEdit={(u) => setFormMode(u)}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}