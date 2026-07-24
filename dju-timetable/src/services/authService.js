// src/services/authService.js
// 관리자 Firebase Auth (이메일/비밀번호) 로그인
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * 관리자 로그인
 * @returns {Promise<{success: boolean, uid?: string, error?: string}>}
 */
export async function adminLogin(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { success: true, uid: cred.user.uid };
  } catch (e) {
    return { success: false, error: mapAuthError(e.code) };
  }
}

/** 관리자 로그아웃 */
export async function adminLogout() {
  await signOut(auth);
}

/**
 * 로그인 상태 변화 구독. 콜백에 user(로그인) 또는 null(로그아웃)이 전달됨.
 * 반환값은 구독 해제 함수.
 */
export function onAdminAuthChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

/** 현재 로그인된 관리자 UID (없으면 null) */
export function currentAdminUid() {
  return auth.currentUser?.uid ?? null;
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.';
    case 'auth/user-disabled':
      return '비활성화된 계정입니다.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    default:
      return `로그인에 실패했습니다. (${code || '알 수 없음'})`;
  }
}
