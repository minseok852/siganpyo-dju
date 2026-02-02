// src/services/updateService.js
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

// 변경사항 타입 상수
export const CHANGE_TYPES = {
  feature: '새 기능',
  fix: '버그 수정',
  improve: '개선',
  release: '출시',
};

/**
 * 업데이트 내역 목록 조회
 */
export async function getUpdates() {
  try {
    const updatesRef = collection(db, 'updates');
    const q = query(updatesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const updates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    }));
    
    return { success: true, updates };
  } catch (error) {
    console.error('❌ 업데이트 내역 조회 실패:', error);
    return { success: false, error: error.message, updates: [] };
  }
}

/**
 * 업데이트 내역 작성 (관리자 전용)
 */
export async function createUpdate({ version, date, title, highlights, changes }) {
  try {
    const updateData = {
      version,
      date,
      title,
      highlights,
      changes, // [{ type: 'feature', text: '...' }, ...]
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'updates'), updateData);
    console.log('✅ 업데이트 내역 작성:', docRef.id);
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('❌ 업데이트 내역 작성 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 업데이트 내역 수정 (관리자 전용)
 */
export async function editUpdate(updateId, { version, date, title, highlights, changes }) {
  try {
    const docRef = doc(db, 'updates', updateId);
    
    await updateDoc(docRef, {
      version,
      date,
      title,
      highlights,
      changes,
    });
    
    console.log('✅ 업데이트 내역 수정:', updateId);
    return { success: true };
  } catch (error) {
    console.error('❌ 업데이트 내역 수정 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 업데이트 내역 삭제 (관리자 전용)
 */
export async function deleteUpdate(updateId) {
  try {
    await deleteDoc(doc(db, 'updates', updateId));
    console.log('✅ 업데이트 내역 삭제:', updateId);
    
    return { success: true };
  } catch (error) {
    console.error('❌ 업데이트 내역 삭제 실패:', error);
    return { success: false, error: error.message };
  }
}