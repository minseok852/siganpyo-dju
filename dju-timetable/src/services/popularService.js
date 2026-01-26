// src/services/popularService.js
import { 
  doc, 
  getDoc, 
  setDoc, 
  increment,
  collection,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * 과목 추가 시 인기도 카운트 증가
 */
export async function incrementCoursePopularity(course) {
  try {
    // 필수 필드 검증
    if (!course.course_code || !course.section) {
      console.warn('⚠️ 인기도 카운트 스킵: course_code 또는 section 누락');
      return;
    }
    
    const courseId = `${course.course_code}-${course.section}`;
    const docRef = doc(db, 'popular_courses', courseId);
    
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // 기존 문서 업데이트
      await setDoc(docRef, {
        count: increment(1),
        lastAdded: new Date()
      }, { merge: true });
    } else {
      // 새 문서 생성 - undefined 값 필터링!
      const courseData = {
        course_code: course.course_code,
        section: course.section,
        course_name: course.course_name || '과목명 없음',
        professor: course.professor || '미정',
        credits: course.credits || 3,
        category: course.category || '',
        classification: course.classification || course.category || '',
        college: course.college || '',
        department: course.department || '',
        area: course.area || '',
        schedule_raw: course.schedule_raw || '',
        times: course.times || [],
        room: course.room || '',
        count: 1,
        lastAdded: new Date()
      };
      
      await setDoc(docRef, courseData);
    }
    
    console.log('📈 인기도 카운트 증가:', courseId);
  } catch (error) {
    console.error('인기도 카운트 실패:', error);
  }
}

/**
 * 과목 삭제 시 인기도 카운트 감소
 */
export async function decrementCoursePopularity(courseCode, section) {
  try {
    // 필수 필드 검증
    if (!courseCode || !section) {
      console.warn('⚠️ 인기도 카운트 감소 스킵: course_code 또는 section 누락');
      return;
    }
    
    const courseId = `${courseCode}-${section}`;
    const docRef = doc(db, 'popular_courses', courseId);
    
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const currentCount = docSnap.data().count || 0;
      
      if (currentCount > 1) {
        // 1 이상이면 감소
        await setDoc(docRef, {
          count: increment(-1),
          lastRemoved: new Date()
        }, { merge: true });
        console.log('📉 인기도 카운트 감소:', courseId, `(${currentCount} → ${currentCount - 1})`);
      } else {
        // 0 이하가 되면 그냥 0으로 유지 (문서 삭제 안 함)
        await setDoc(docRef, {
          count: 0,
          lastRemoved: new Date()
        }, { merge: true });
        console.log('📉 인기도 카운트 0:', courseId);
      }
    } else {
      console.log('📉 인기도 문서 없음 (스킵):', courseId);
    }
  } catch (error) {
    console.error('인기도 카운트 감소 실패:', error);
  }
}

// 캐시
let allPopularCourses = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

/**
 * 전체 인기 과목 로드 (캐시 사용)
 */
async function loadAllPopularCourses() {
  const now = Date.now();
  
  // 캐시가 유효하면 캐시 반환
  if (allPopularCourses && lastFetchTime && (now - lastFetchTime < CACHE_DURATION)) {
    return allPopularCourses;
  }
  
  try {
    const popularRef = collection(db, 'popular_courses');
    const snapshot = await getDocs(popularRef);
    
    allPopularCourses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    lastFetchTime = now;
    console.log('📊 인기 과목 로드:', allPopularCourses.length, '개');
    
    return allPopularCourses;
  } catch (error) {
    console.error('인기 과목 로드 실패:', error);
    return [];
  }
}

/**
 * 인기 과목 가져오기 (클라이언트 필터링)
 */
export async function getPopularCourses(filters = {}) {
  try {
    // 전체 데이터 로드
    let courses = await loadAllPopularCourses();
    
    // 카테고리 필터
    if (filters.category) {
      courses = courses.filter(c => c.category === filters.category);
    }
    
    // 학과 필터
    if (filters.department) {
      courses = courses.filter(c => c.department === filters.department);
    }
    
    // 영역 필터 (교양선택)
    if (filters.area) {
      courses = courses.filter(c => c.area === filters.area);
    }
    
    // count가 0인 과목은 제외
    courses = courses.filter(c => (c.count || 0) > 0);
    
    // count 기준 정렬 (내림차순)
    courses.sort((a, b) => (b.count || 0) - (a.count || 0));
    
    // 제한
    const limitCount = filters.limit || 20;
    courses = courses.slice(0, limitCount);
    
    return { success: true, courses };

  } catch (error) {
    console.error('인기 과목 조회 실패:', error);
    return { success: false, error: error.message, courses: [] };
  }
}