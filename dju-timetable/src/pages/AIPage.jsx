// src/pages/AIPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Sparkles, 
  Loader2,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { evaluateSchedule } from '../services/aiService';
import { COLLEGES } from '../data/constants';
import { getDepartmentsByCollege } from '../data/departments';  // ✅ 하드코딩 데이터 사용

export default function AIPage() {
  const navigate = useNavigate();
  const { courses } = useSchedule();
  
  // 단계: 'form' | 'loading' | 'result'
  const [step, setStep] = useState('form');
  
  // 사용자 정보
  const [userInfo, setUserInfo] = useState({
    grade: 1,
    college: '',
    major: '',
    hasDoubleMajor: false,
    doubleMajorCollege: '',
    doubleMajor: '',
  });
  
  // 학과 목록 - ✅ 하드코딩 데이터에서 가져오기
  const [departments, setDepartments] = useState([]);
  const [doubleMajorDepartments, setDoubleMajorDepartments] = useState([]);
  
  // 결과
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ✅ 단과대학 변경시 학과 목록 로드 (하드코딩 사용 - 즉시 로드)
  useEffect(() => {
    if (userInfo.college && userInfo.college !== '전체') {
      const depts = getDepartmentsByCollege(userInfo.college);
      setDepartments(depts);
    } else {
      setDepartments([]);
    }
  }, [userInfo.college]);

  // ✅ 복수전공 단과대학 변경시 학과 목록 로드 (하드코딩 사용)
  useEffect(() => {
    if (userInfo.doubleMajorCollege && userInfo.doubleMajorCollege !== '전체') {
      const depts = getDepartmentsByCollege(userInfo.doubleMajorCollege);
      setDoubleMajorDepartments(depts);
    } else {
      setDoubleMajorDepartments([]);
    }
  }, [userInfo.doubleMajorCollege]);

  // 평가 시작
  const handleEvaluate = async () => {
    if (courses.length === 0) {
      alert('시간표에 과목을 먼저 추가해주세요!');
      return;
    }
    
    if (!userInfo.major) {
      alert('전공을 선택해주세요!');
      return;
    }

    setStep('loading');
    setError(null);

    try {
      const response = await evaluateSchedule(courses, {
        grade: userInfo.grade,
        major: userInfo.major,
        double_major: userInfo.hasDoubleMajor ? userInfo.doubleMajor : null,
      });

      if (response.success) {
        setResult(response);
        setStep('result');
      } else {
        setError(response.error || '평가 중 오류가 발생했습니다');
        setStep('form');
      }
    } catch (err) {
      setError(err.message);
      setStep('form');
    }
  };

  // 다시 평가
  const handleRetry = () => {
    setStep('form');
    setResult(null);
    setError(null);
  };

  // 단과대학 필터 (전체, 융합전공 등 제외)
  const filteredColleges = COLLEGES.filter(c => 
    c !== '전체' && c !== '융합전공' && c !== '상생교양대학'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 hover:bg-gray-100 rounded-full"
            >
              <ArrowLeft size={20} />
            </button>
            <Sparkles className="text-purple-500" size={20} />
            <h1 className="text-base font-bold text-gray-800">AI 시간표 평가</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4">
        
        {/* 과목 없음 경고 */}
        {courses.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">
              ⚠️ 시간표에 과목이 없어요! 먼저 과목을 추가해주세요.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-2 text-sm text-yellow-700 underline"
            >
              시간표로 돌아가기
            </button>
          </div>
        )}

        {/* Step 1: 정보 입력 폼 */}
        {step === 'form' && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              📝 평가 전 몇 가지 질문!
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              정확한 분석을 위해 알려주세요
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* 학년 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  학년
                </label>
                <select
                  value={userInfo.grade}
                  onChange={(e) => setUserInfo(prev => ({ 
                    ...prev, 
                    grade: Number(e.target.value) 
                  }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value={1}>1학년</option>
                  <option value={2}>2학년</option>
                  <option value={3}>3학년</option>
                  <option value={4}>4학년</option>
                </select>
              </div>

              {/* 단과대학 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  단과대학
                </label>
                <select
                  value={userInfo.college}
                  onChange={(e) => setUserInfo(prev => ({ 
                    ...prev, 
                    college: e.target.value,
                    major: '' 
                  }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">선택하세요</option>
                  {filteredColleges.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* 전공 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전공
                </label>
                <select
                  value={userInfo.major}
                  onChange={(e) => setUserInfo(prev => ({ 
                    ...prev, 
                    major: e.target.value 
                  }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  disabled={!userInfo.college}
                >
                  <option value="">선택하세요</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {/* ✅ 학과 없음 안내 */}
                {userInfo.college && departments.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    ⚠️ 해당 단과대학의 학과 정보가 없습니다. 관리자에게 문의하세요.
                  </p>
                )}
              </div>

              {/* 복수전공 여부 */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userInfo.hasDoubleMajor}
                    onChange={(e) => setUserInfo(prev => ({
                      ...prev,
                      hasDoubleMajor: e.target.checked,
                      doubleMajorCollege: '',
                      doubleMajor: '',
                    }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-700">복수전공 있음</span>
                </label>
              </div>

              {/* 복수전공 선택 */}
              {userInfo.hasDoubleMajor && (
                <div className="pl-6 space-y-3 border-l-2 border-purple-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      복수전공 단과대학
                    </label>
                    <select
                      value={userInfo.doubleMajorCollege}
                      onChange={(e) => setUserInfo(prev => ({ 
                        ...prev, 
                        doubleMajorCollege: e.target.value,
                        doubleMajor: '' 
                      }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">선택하세요</option>
                      {filteredColleges.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      복수전공
                    </label>
                    <select
                      value={userInfo.doubleMajor}
                      onChange={(e) => setUserInfo(prev => ({ 
                        ...prev, 
                        doubleMajor: e.target.value 
                      }))}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      disabled={!userInfo.doubleMajorCollege}
                    >
                      <option value="">선택하세요</option>
                      {doubleMajorDepartments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* 현재 시간표 요약 */}
            <div className="mt-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                📚 현재 시간표: <strong>{courses.length}</strong>과목, 
                <strong> {courses.reduce((sum, c) => sum + (c.credits || 0), 0)}</strong>학점
              </p>
            </div>

            {/* 평가 버튼 */}
            <button
              onClick={handleEvaluate}
              disabled={courses.length === 0 || !userInfo.major}
              className="w-full mt-4 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              시간표 분석하기
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: 로딩 */}
        {step === 'loading' && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <Loader2 className="animate-spin mx-auto mb-4 text-purple-500" size={48} />
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              AI가 시간표를 분석 중...
            </h2>
            <p className="text-sm text-gray-500">
              잠시만 기다려주세요! 🔍
            </p>
          </div>
        )}

        {/* Step 3: 결과 */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {/* 유형 카드 */}
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6 text-white text-center">
              <p className="text-sm opacity-80 mb-2">당신의 시간표 유형은...</p>
              <div className="text-6xl mb-3">{result.schedule_type.emoji}</div>
              <h2 className="text-2xl font-bold mb-2">
                【 {result.schedule_type.name} 】
              </h2>
              <p className="text-sm opacity-90">
                "{result.schedule_type.description}"
              </p>
              <div className="mt-4 inline-block px-4 py-1 bg-white/20 rounded-full">
                <span className="text-lg font-bold">{result.total_score}</span>
                <span className="text-sm opacity-80">/100점</span>
              </div>
            </div>

            {/* 지표 목록 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 mb-3">📊 세부 지표</h3>
              <div className="space-y-2">
                {result.indicators.map((indicator, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg flex items-start gap-3 ${
                      indicator.status === 'good' ? 'bg-green-50' :
                      indicator.status === 'warning' ? 'bg-yellow-50' :
                      'bg-red-50'
                    }`}
                  >
                    <span className="text-xl">{indicator.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{indicator.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          indicator.status === 'good' ? 'bg-green-200 text-green-800' :
                          indicator.status === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {indicator.status === 'good' ? '좋음' :
                           indicator.status === 'warning' ? '주의' : '위험'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {indicator.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 조언 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-gray-800 mb-3">💡 AI의 조언</h3>
              <ul className="space-y-2">
                {result.advice.map((advice, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-purple-500">•</span>
                    {advice}
                  </li>
                ))}
              </ul>
            </div>

            {/* 총평 */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h3 className="font-bold text-purple-800 mb-2">📝 총평</h3>
              <p className="text-sm text-purple-700">{result.summary}</p>
            </div>

            {/* 다시 평가 버튼 */}
            <button
              onClick={handleRetry}
              className="w-full py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              다시 평가하기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}