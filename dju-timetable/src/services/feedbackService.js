// src/services/feedbackService.js
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// 피드백 상태 상수
export const FEEDBACK_STATUS = {
  RECEIVED: '접수됨',
  REVIEWING: '검토 중',
  COMPLETED: '반영 완료',
  REJECTED: '반영 불가',
};

// 카테고리 상수
export const FEEDBACK_CATEGORY = {
  TYPO: '오타 제보',
  FEATURE: '기능 제안',
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * 피드백 작성
 */
export async function createFeedback({ category, content, courseName = null }) {
  try {
    const feedbackData = {
      category,
      content,
      courseName,
      status: FEEDBACK_STATUS.RECEIVED,
      rejectionReason: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'feedbacks'), feedbackData);
    console.log('✅ 피드백 작성 완료:', docRef.id);

    // 디스코드 알림 (실패해도 피드백 저장은 성공으로 처리)
    fetch(`${API_BASE_URL}/api/feedback/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, content, courseName }),
    }).catch(() => {});

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('❌ 피드백 작성 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 피드백 목록 조회
 */
export async function getFeedbacks() {
  try {
    const feedbacksRef = collection(db, 'feedbacks');
    const q = query(feedbacksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const feedbacks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    }));
    
    return { success: true, feedbacks };
  } catch (error) {
    console.error('❌ 피드백 목록 조회 실패:', error);
    return { success: false, error: error.message, feedbacks: [] };
  }
}

/**
 * 피드백 상태 업데이트 (관리자 전용)
 */
export async function updateFeedbackStatus(feedbackId, status, rejectionReason = null) {
  try {
    const docRef = doc(db, 'feedbacks', feedbackId);
    
    const updateData = {
      status,
      updatedAt: serverTimestamp(),
    };
    
    if (status === FEEDBACK_STATUS.REJECTED && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    await updateDoc(docRef, updateData);
    console.log('✅ 피드백 상태 업데이트:', feedbackId, status);
    
    return { success: true };
  } catch (error) {
    console.error('❌ 피드백 상태 업데이트 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 피드백 삭제 (관리자 전용)
 */
export async function deleteFeedback(feedbackId) {
  try {
    await deleteDoc(doc(db, 'feedbacks', feedbackId));
    console.log('✅ 피드백 삭제:', feedbackId);
    
    return { success: true };
  } catch (error) {
    console.error('❌ 피드백 삭제 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 관리자 댓글 추가
 */
export async function addAdminComment(feedbackId, content) {
  try {
    const docRef = doc(db, 'feedbacks', feedbackId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return { success: false, error: '피드백을 찾을 수 없습니다.' };
    }

    const newComment = {
      id: Date.now().toString(),
      content,
      createdAt: new Date().toISOString(),
    };

    await updateDoc(docRef, {
      adminComments: [...(snapshot.data().adminComments || []), newComment],
      updatedAt: serverTimestamp(),
    });

    return { success: true, comment: newComment };
  } catch (error) {
    console.error('❌ 관리자 댓글 추가 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 관리자 댓글 수정
 */
export async function editAdminComment(feedbackId, commentId, newContent) {
  try {
    const docRef = doc(db, 'feedbacks', feedbackId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return { success: false, error: '피드백을 찾을 수 없습니다.' };
    }

    const updatedComments = (snapshot.data().adminComments || []).map(c =>
      c.id === commentId
        ? { ...c, content: newContent, editedAt: new Date().toISOString() }
        : c
    );

    await updateDoc(docRef, {
      adminComments: updatedComments,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('❌ 관리자 댓글 수정 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 관리자 댓글 삭제
 */
export async function deleteAdminComment(feedbackId, commentId) {
  try {
    const docRef = doc(db, 'feedbacks', feedbackId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return { success: false, error: '피드백을 찾을 수 없습니다.' };
    }

    const filteredComments = (snapshot.data().adminComments || []).filter(
      c => c.id !== commentId
    );

    await updateDoc(docRef, {
      adminComments: filteredComments,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('❌ 관리자 댓글 삭제 실패:', error);
    return { success: false, error: error.message };
  }
}

export async function verifyAdminPassword(password) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}