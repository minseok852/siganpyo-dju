// src/pages/FeedbackAdminPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Shield,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Trash2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  getFeedbacks,
  updateFeedbackStatus,
  deleteFeedback,
  verifyAdminPassword,
  FEEDBACK_STATUS,
  FEEDBACK_CATEGORY 
} from '../services/feedbackService';

// 상태별 스타일
const STATUS_STYLES = {
  [FEEDBACK_STATUS.RECEIVED]: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    icon: Clock,
  },
  [FEEDBACK_STATUS.REVIEWING]: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: AlertCircle,
  },
  [FEEDBACK_STATUS.COMPLETED]: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: CheckCircle,
  },
  [FEEDBACK_STATUS.REJECTED]: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: XCircle,
  },
};

// 관리자 피드백 카드
function AdminFeedbackCard({ feedback, onStatusChange, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const statusStyle = STATUS_STYLES[feedback.status] || STATUS_STYLES[FEEDBACK_STATUS.RECEIVED];
  const StatusIcon = statusStyle.icon;
  
  const formatDate = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

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
    if (!rejectionReason.trim()) {
      alert('반영 불가 사유를 입력해주세요.');
      return;
    }
    
    setIsUpdating(true);
    await onStatusChange(feedback.id, FEEDBACK_STATUS.REJECTED, rejectionReason.trim());
    setIsUpdating(false);
    setShowRejectModal(false);
    setRejectionReason('');
  };

  const handleDelete = async () => {
    if (confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      await onDelete(feedback.id);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {/* 카테고리 */}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              feedback.category === FEEDBACK_CATEGORY.TYPO 
                ? 'bg-orange-100 text-orange-700' 
                : 'bg-purple-100 text-purple-700'
            }`}>
              {feedback.category}
            </span>
            
            {/* 상태 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${statusStyle.bg} ${statusStyle.text} hover:opacity-80`}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="animate-spin" size={12} />
                ) : (
                  <StatusIcon size={12} />
                )}
                {feedback.status}
                <span className="ml-1">▼</span>
              </button>
              
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                  {Object.values(FEEDBACK_STATUS).map(status => {
                    const style = STATUS_STYLES[status];
                    const Icon = style.icon;
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-50 ${
                          feedback.status === status ? 'bg-gray-100' : ''
                        }`}
                      >
                        <Icon size={12} className={style.text} />
                        {status}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* 삭제 버튼 */}
          <button
            onClick={handleDelete}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
            title="삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* 과목명 */}
        {feedback.courseName && (
          <div className="text-xs text-gray-500 mb-1">
            📚 {feedback.courseName}
          </div>
        )}
        
        {/* 내용 */}
        <p className="text-sm text-gray-800 whitespace-pre-wrap">
          {feedback.content}
        </p>
        
        {/* 반영 불가 사유 */}
        {feedback.status === FEEDBACK_STATUS.REJECTED && feedback.rejectionReason && (
          <div className="mt-2 p-2 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600">
              <strong>반영 불가 사유:</strong> {feedback.rejectionReason}
            </p>
          </div>
        )}
        
        {/* 날짜 */}
        <div className="mt-2 text-xs text-gray-400">
          작성: {formatDate(feedback.createdAt)}
          {feedback.updatedAt && feedback.updatedAt.getTime() !== feedback.createdAt?.getTime() && (
            <span className="ml-2">| 수정: {formatDate(feedback.updatedAt)}</span>
          )}
        </div>
      </div>

      {/* 반영 불가 사유 입력 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-4">
            <h3 className="font-bold text-lg mb-3">반영 불가 사유</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="반영할 수 없는 사유를 입력해주세요..."
              className="w-full px-3 py-2 border rounded-lg text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={isUpdating}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm flex items-center justify-center gap-1"
              >
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

// 로그인 모달
function LoginModal({ onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (verifyAdminPassword(password)) {
      localStorage.setItem('feedback_admin_auth', 'true');
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
          <p className="text-sm text-gray-500 mt-1">피드백 관리 페이지입니다</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
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
          
          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}
          
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

export default function FeedbackAdminPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');  // all, received, reviewing, completed, rejected

  // 인증 확인
  useEffect(() => {
    const auth = localStorage.getItem('feedback_admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // 피드백 로드
  const loadFeedbacks = async () => {
    setLoading(true);
    const result = await getFeedbacks();
    if (result.success) {
      setFeedbacks(result.feedbacks);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFeedbacks();
    }
  }, [isAuthenticated]);

  // 상태 변경
  const handleStatusChange = async (feedbackId, status, rejectionReason = null) => {
    const result = await updateFeedbackStatus(feedbackId, status, rejectionReason);
    if (result.success) {
      loadFeedbacks();
    } else {
      alert('상태 변경에 실패했습니다: ' + result.error);
    }
  };

  // 삭제
  const handleDelete = async (feedbackId) => {
    const result = await deleteFeedback(feedbackId);
    if (result.success) {
      loadFeedbacks();
    } else {
      alert('삭제에 실패했습니다: ' + result.error);
    }
  };

  // 로그아웃
  const handleLogout = () => {
    localStorage.removeItem('feedback_admin_auth');
    setIsAuthenticated(false);
  };

  // 필터링된 피드백
  const filteredFeedbacks = feedbacks.filter(fb => {
    if (filter === 'all') return true;
    if (filter === 'received') return fb.status === FEEDBACK_STATUS.RECEIVED;
    if (filter === 'reviewing') return fb.status === FEEDBACK_STATUS.REVIEWING;
    if (filter === 'completed') return fb.status === FEEDBACK_STATUS.COMPLETED;
    if (filter === 'rejected') return fb.status === FEEDBACK_STATUS.REJECTED;
    return true;
  });

  // 통계
  const stats = {
    total: feedbacks.length,
    received: feedbacks.filter(f => f.status === FEEDBACK_STATUS.RECEIVED).length,
    reviewing: feedbacks.filter(f => f.status === FEEDBACK_STATUS.REVIEWING).length,
    completed: feedbacks.filter(f => f.status === FEEDBACK_STATUS.COMPLETED).length,
    rejected: feedbacks.filter(f => f.status === FEEDBACK_STATUS.REJECTED).length,
  };

  if (!isAuthenticated) {
    return <LoginModal onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/feedback')}
                className="p-1.5 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft size={20} />
              </button>
              <Shield className="text-blue-500" size={20} />
              <h1 className="text-base font-bold text-gray-800">피드백 관리</h1>
            </div>
            
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 py-4">
        {/* 통계 카드 */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`p-3 rounded-lg text-center ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-white border'}`}
          >
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-xs">전체</div>
          </button>
          <button
            onClick={() => setFilter('received')}
            className={`p-3 rounded-lg text-center ${filter === 'received' ? 'bg-gray-600 text-white' : 'bg-white border'}`}
          >
            <div className="text-xl font-bold">{stats.received}</div>
            <div className="text-xs">접수됨</div>
          </button>
          <button
            onClick={() => setFilter('reviewing')}
            className={`p-3 rounded-lg text-center ${filter === 'reviewing' ? 'bg-blue-600 text-white' : 'bg-white border'}`}
          >
            <div className="text-xl font-bold">{stats.reviewing}</div>
            <div className="text-xs">검토 중</div>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`p-3 rounded-lg text-center ${filter === 'completed' ? 'bg-green-600 text-white' : 'bg-white border'}`}
          >
            <div className="text-xl font-bold">{stats.completed}</div>
            <div className="text-xs">완료</div>
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`p-3 rounded-lg text-center ${filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-white border'}`}
          >
            <div className="text-xl font-bold">{stats.rejected}</div>
            <div className="text-xs">불가</div>
          </button>
        </div>

        {/* 피드백 목록 */}
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="animate-spin mx-auto text-gray-400" size={32} />
            <p className="text-sm text-gray-500 mt-2">불러오는 중...</p>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">피드백이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFeedbacks.map(feedback => (
              <AdminFeedbackCard
                key={feedback.id}
                feedback={feedback}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}