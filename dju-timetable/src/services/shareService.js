// src/services/shareService.js
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * 시간표를 Firebase에 저장하고 공유 ID 반환
 */
export async function saveScheduleForShare(courses) {
  try {
    // 랜덤 ID 생성 (6자리)
    const shareId = generateShareId();
    
    const scheduleData = {
      courses: courses.map(c => ({
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
      })),
      totalCredits: courses.reduce((sum, c) => sum + (c.credits || 0), 0),
      courseCount: courses.length,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'schedules', shareId), scheduleData);
    
    console.log('✅ 시간표 저장 완료:', shareId);
    return { success: true, shareId };

  } catch (error) {
    console.error('❌ 시간표 저장 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 공유된 시간표 불러오기
 */
export async function getSharedSchedule(shareId) {
  try {
    const docRef = doc(db, 'schedules', shareId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: '시간표를 찾을 수 없습니다.' };
    }

    const data = docSnap.data();
    return { 
      success: true, 
      schedule: {
        courses: data.courses,
        totalCredits: data.totalCredits,
        courseCount: data.courseCount,
        createdAt: data.createdAt?.toDate(),
      }
    };

  } catch (error) {
    console.error('❌ 시간표 불러오기 실패:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 6자리 랜덤 ID 생성
 */
function generateShareId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}