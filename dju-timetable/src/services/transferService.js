// src/services/transferService.js
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const COLLECTION = 'transfer_schedules';
const EXPIRY_MINUTES = 5;

export async function createTransfer(courses) {
  try {
    const payload = courses.map(c => ({
      course_code: c.course_code,
      section: c.section,
      course_name: c.course_name,
      professor: c.professor ?? null,
      credits: c.credits,
      schedule_raw: c.schedule_raw ?? null,
      times: c.times ?? [],
      room: c.room ?? null,
      category: c.category ?? null,
      classification: c.classification ?? null,
    }));

    const code = await generateCode();
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();

    await setDoc(doc(db, COLLECTION, code), {
      courses: payload,
      expiresAt,
      used: false,
      createdAt: serverTimestamp(),
    });

    return { success: true, code };
  } catch (error) {
    console.error('❌ 전송 코드 생성 실패:', error);
    return { success: false, error: error.message };
  }
}

async function generateCode() {
  for (let i = 0; i < 100; i++) {
    const code = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    const snap = await getDoc(doc(db, COLLECTION, code));
    if (!snap.exists()) return code;
    const data = snap.data();
    if (data.used || new Date(data.expiresAt) <= new Date()) return code;
  }
  throw new Error('코드 생성 실패');
}

export async function receiveTransfer(code) {
  try {
    const docRef = doc(db, COLLECTION, code);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, error: '존재하지 않는 코드입니다' };
    }

    const data = snap.data();

    if (data.used) {
      return { success: false, error: '이미 사용된 코드입니다' };
    }

    if (new Date(data.expiresAt) <= new Date()) {
      await deleteDoc(docRef);
      return { success: false, error: '코드가 만료되었습니다' };
    }

    await updateDoc(docRef, { used: true });
    return { success: true, courses: data.courses };
  } catch (error) {
    console.error('❌ 시간표 수신 실패:', error);
    return { success: false, error: error.message };
  }
}
