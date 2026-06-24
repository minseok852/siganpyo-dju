// src/services/aiLogService.js
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * AI 호출 세션을 Firestore에 기록하고 logId를 반환한다.
 *
 * @param {'evaluate'|'recommend'} type
 * @param {object} params  - 사용자 입력 메타데이터
 * @param {object} result  - AI 응답 결과
 * @returns {Promise<string|null>} logId (실패 시 null)
 */
export async function logAiSession(type, params, result) {
  try {
    const base = {
      type,
      grade: params.grade ?? null,
      major: params.major ?? null,
      double_major: params.double_major ?? null,
      success: result.success ?? false,
      thumbs: null,
      feedback_comment: null,
      created_at: serverTimestamp(),
    };

    let extra = {};
    if (type === 'evaluate') {
      extra = {
        course_count: params.course_count ?? 0,
        score: result.total_score ?? null,
        schedule_type: result.schedule_type?.name ?? null,
      };
    } else if (type === 'recommend') {
      extra = {
        target_credits: params.target_credits ?? null,
        preferences_summary: params.preferences_summary ?? null,
        result_credits: result.total_credits ?? null,
        result_course_count: result.selected_courses?.length ?? null,
      };
    }

    const ref = await addDoc(collection(db, 'ai_logs'), { ...base, ...extra });
    return ref.id;
  } catch (e) {
    console.error('AI 로그 저장 실패:', e);
    return null;
  }
}

/**
 * 기존 세션 로그에 사용자 피드백(👍/👎 + 코멘트)을 업데이트한다.
 *
 * @param {string} logId
 * @param {'up'|'down'} thumbs
 * @param {string} comment
 */
export async function updateAiFeedback(logId, thumbs, comment = '') {
  try {
    await updateDoc(doc(db, 'ai_logs', logId), {
      thumbs,
      feedback_comment: comment.trim() || null,
      feedback_at: serverTimestamp(),
    });

    // 👎 일 때 Discord로 즉시 알림
    if (thumbs === 'down') {
      fetch(`${API_BASE_URL}/api/ai/feedback-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, comment: comment.trim() }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('AI 피드백 업데이트 실패:', e);
  }
}
