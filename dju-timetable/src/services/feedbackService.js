// src/services/feedbackService.js
import { 
  collection, 
  doc, 
  addDoc, 
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

/**
 * 피드백 작성
 */
export async function createFeedback({ category, content, courseName = null }) {
  try {
    const feedbackData = {
      category,
      content,
      courseName,  // 오타 제보일 경우 과목명
      status: FEEDBACK_STATUS.RECEIVED,
      rejectionReason: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'feedbacks'), feedbackData);
    console.log('✅ 피드백 작성 완료:', docRef.id);
    
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
    const commentData = {
      content,
      createdAt: new Date().toISOString(),
    };
    
    // 기존 댓글 배열에 추가 (arrayUnion 대신 직접 관리)
    const feedbacksRef = collection(db, 'feedbacks');
    const snapshot = await getDocs(query(feedbacksRef));
    const feedbackDoc = snapshot.docs.find(d => d.id === feedbackId);
    
    if (!feedbackDoc) {
      return { success: false, error: '피드백을 찾을 수 없습니다.' };
    }
    
    const existingComments = feedbackDoc.data().adminComments || [];
    const newComment = {
      id: Date.now().toString(),
      ...commentData,
    };
    
    await updateDoc(docRef, {
      adminComments: [...existingComments, newComment],
      updatedAt: serverTimestamp(),
    });
    
    console.log('✅ 관리자 댓글 추가:', feedbackId);
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
    const feedbacksRef = collection(db, 'feedbacks');
    const snapshot = await getDocs(query(feedbacksRef));
    const feedbackDoc = snapshot.docs.find(d => d.id === feedbackId);
    
    if (!feedbackDoc) {
      return { success: false, error: '피드백을 찾을 수 없습니다.' };
    }
    
    const comments = feedbackDoc.data().adminComments || [];
    const updatedComments = comments.map(c => 
      c.id === commentId 
        ? { ...c, content: newContent, editedAt: new Date().toISOString() }
        : c
    );
    
    await updateDoc(docRef, {
      adminComments: updatedComments,
      updatedAt: serverTimestamp(),
    });
    
    console.log('✅ 관리자 댓글 수정:', commentId);
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
    const feedbacksRef = collection(db, 'feedbacks');
    const snapshot = await getDocs(query(feedbacksRef));
    const feedbackDoc = snapshot.docs.find(d => d.id === feedbackId);
    
    if (!feedbackDoc) {
      return { success: false, error: '피드백을 찾을 수 없습니다.' };
    }
    
    const comments = feedbackDoc.data().adminComments || [];
    const filteredComments = comments.filter(c => c.id !== commentId);
    
    await updateDoc(docRef, {
      adminComments: filteredComments,
      updatedAt: serverTimestamp(),
    });
    
    console.log('✅ 관리자 댓글 삭제:', commentId);
    return { success: true };
  } catch (error) {
    console.error('❌ 관리자 댓글 삭제 실패:', error);
    return { success: false, error: error.message };
  }
}

// 관리자 비밀번호 검증 (실제로는 환경변수나 Firebase Auth 사용 권장)
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

export function verifyAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}