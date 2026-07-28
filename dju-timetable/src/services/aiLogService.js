// src/services/aiLogService.js
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// 진단 신호 종류 → 관리자 페이지 필터에 쓰는 짧은 키
const FLAG_KINDS = {
  no_time_slot: '시간없음',
  unmatched: '카탈로그없음',
  must_take_missing: '지정과목누락',
  locked_required_missing: '필수과목누락',
  removed_conflicts: '충돌제거',
};

/**
 * 후보 1개를 로그용으로 요약한다.
 *
 * 과목 전체를 그대로 넣지 않고 필요한 필드만 남긴다. 나중에 신고가 들어왔을 때
 * "무슨 과목을 어떤 시간으로 줬는지"를 재구성할 수 있는 최소 집합이다.
 */
function summarizeCandidate(s) {
  const d = s.diagnostics || {};
  return {
    score: s.score ?? null,
    total_credits: s.total_credits ?? null,
    theme_label: s.theme_label ?? null,
    empty_days: s.empty_days ?? [],
    warnings: s.warnings ?? [],
    courses: (s.selected_courses || []).map(c => ({
      course_code: c.course_code ?? null,
      section: c.section ?? null,
      course_name: c.course_name ?? null,
      credits: c.credits ?? null,
      schedule_raw: c.schedule_raw ?? null,
      category: c.category ?? null,
    })),
    diagnostics: {
      flagged: !!d.flagged,
      no_time_slot: d.no_time_slot ?? [],
      unmatched: d.unmatched ?? [],
      must_take_missing: d.must_take_missing ?? [],
      locked_required_missing: d.locked_required_missing ?? [],
      removed_conflicts: d.removed_conflicts ?? [],
      credits_delta: d.credits_delta ?? 0,
    },
  };
}

/** 후보들에서 걸린 신호 종류만 모아 중복 없이 반환 (관리자 필터용) */
function collectFlagKinds(schedules) {
  const kinds = new Set();
  for (const s of schedules) {
    const d = s.diagnostics || {};
    for (const key of Object.keys(FLAG_KINDS)) {
      if ((d[key] || []).length > 0) kinds.add(key);
    }
    if (Math.abs(d.credits_delta ?? 0) > 1) kinds.add('credits_off');
  }
  return [...kinds];
}

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
      error: result.error ?? null,   // 실패 원인 (관리자 페이지에서 표시)
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
      // 새 응답은 후보 배열(schedules), 구 응답은 단일 객체
      const schedules = result.schedules
        || (result.selected_courses ? [result] : []);
      const first = schedules[0] || {};

      extra = {
        target_credits: params.target_credits ?? null,
        preferences_summary: params.preferences_summary ?? null,
        result_credits: first.total_credits ?? null,
        result_course_count: first.selected_courses?.length ?? null,

        // 후보 전체를 남긴다. 신고가 들어왔을 때 "그래서 뭘 추천했는데?"에
        // 답할 수 있어야 하고, 어떤 후보를 고르는지도 품질 신호가 된다.
        candidates: schedules.map(summarizeCandidate),

        // 진단 신호 요약 — 관리자 페이지에서 이 두 필드로 거른다.
        // 교육심리 건은 success=true / 경고 없음이라 기존 로그로는 못 잡았다.
        flagged: schedules.some(s => s.diagnostics?.flagged),
        flag_kinds: collectFlagKinds(schedules),

        // 사용자 행동 (나중에 채워진다)
        selected_candidate: schedules.length > 0 ? 0 : null,
        saved: false,
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
 * 사용자가 A/B/C 중 어떤 후보를 골랐는지 기록한다.
 *
 * 👍/👎보다 훨씬 참여율이 높은 신호다 (누르지 않아도 자동으로 남는다).
 * "AI가 3개를 줬는데 사람들이 실제로 뭘 고르는가"는 추천 순위가
 * 제대로 매겨지고 있는지 판단할 유일한 근거다.
 * 1순위(A)가 아닌 후보가 계속 선택되면 점수 함수가 틀린 것이다.
 */
export async function logCandidateSelection(logId, index) {
  if (!logId) return;
  try {
    await updateDoc(doc(db, 'ai_logs', logId), {
      selected_candidate: index,
      // 기본값(0)과 실제로 A안을 고른 것을 구분한다.
      // 이게 없으면 "아무것도 안 누름"이 전부 A안 선택으로 집계돼
      // A안 비율이 실제보다 부풀려진다.
      candidate_switched: true,
    });
  } catch (e) {
    console.error('후보 선택 기록 실패:', e);
  }
}

/**
 * 추천 결과를 실제 시간표로 저장했는지 기록한다.
 *
 * 만들어만 보고 버린 추천과 실제로 쓴 추천을 구분한다.
 * 저장률이 낮은 조건(학년/전공/선호)을 찾아내는 데 쓴다.
 */
export async function logScheduleSaved(logId, candidateIndex) {
  if (!logId) return;
  try {
    await updateDoc(doc(db, 'ai_logs', logId), {
      saved: true,
      saved_candidate: candidateIndex ?? null,
      saved_at: serverTimestamp(),
    });
  } catch (e) {
    console.error('저장 기록 실패:', e);
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
