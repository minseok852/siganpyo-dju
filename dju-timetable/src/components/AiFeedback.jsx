// src/components/AiFeedback.jsx
import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import { updateAiFeedback } from '../services/aiLogService';

export default function AiFeedback({ logId }) {
  const [thumbs, setThumbs] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (value) => {
    if (submitted) return;
    setThumbs(value);
    if (value === 'up') {
      updateAiFeedback(logId, 'up', '');
      setSubmitted(true);
    }
  };

  const handleSubmitDown = () => {
    if (!logId || submitted) return;
    updateAiFeedback(logId, 'down', comment);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
        {thumbs === 'up' ? '😊 감사해요! 더 좋은 AI를 만들겠습니다.' : '📝 소중한 피드백 감사해요!'}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-700 text-center mb-3">이 결과가 도움이 됐나요?</p>
      <div className="flex justify-center gap-3 mb-3">
        <button
          onClick={() => handleSelect('up')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            thumbs === 'up'
              ? 'bg-green-500 text-white border-green-500'
              : 'border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600'
          }`}
        >
          <ThumbsUp size={16} /> 좋아요
        </button>
        <button
          onClick={() => handleSelect('down')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
            thumbs === 'down'
              ? 'bg-red-500 text-white border-red-500'
              : 'border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-600'
          }`}
        >
          <ThumbsDown size={16} /> 별로예요
        </button>
      </div>

      {thumbs === 'down' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmitDown()}
            placeholder="어떤 점이 아쉬웠나요? (선택)"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
            autoFocus
          />
          <button
            onClick={handleSubmitDown}
            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
