// src/hooks/useSchedule.js
import { useState, useCallback, useEffect } from 'react';
import { checkScheduleConflict, getTotalCredits, getEmptyDays } from '../utils/timeUtils';
import { STORAGE_KEYS, COURSE_COLORS } from '../data/constants';
import { incrementCoursePopularity } from '../services/popularService';

// localStorage에서 초기값 읽기
function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MY_SCHEDULE);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('📂 저장된 시간표 불러옴:', parsed.courses?.length || 0, '개 과목');
      return {
        courses: parsed.courses || [],
        colorMap: parsed.colorMap || {}
      };
    }
  } catch (e) {
    console.error('Failed to load schedule:', e);
  }
  return { courses: [], colorMap: {} };
}

export function useSchedule() {
  const [courses, setCourses] = useState(() => getInitialState().courses);
  const [colorMap, setColorMap] = useState(() => getInitialState().colorMap);

  // 로컬스토리지에 저장
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MY_SCHEDULE);
    if (courses.length === 0 && saved) {
      const parsed = JSON.parse(saved);
      if (parsed.courses?.length > 0) {
        console.log('⏭️ 초기 로드 중 - 저장 스킵');
        return;
      }
    }

    localStorage.setItem(STORAGE_KEYS.MY_SCHEDULE, JSON.stringify({
      courses,
      colorMap
    }));
    console.log('💾 시간표 저장됨:', courses.length, '개 과목');
  }, [courses, colorMap]);

  // 과목 추가
  const addCourse = useCallback((course) => {
    const conflict = checkScheduleConflict(course, courses);
    if (conflict.conflict) {
      return { 
        success: false, 
        error: `"${conflict.conflictWith.course_name}"과(와) 시간이 겹칩니다.` 
      };
    }

    // 이미 추가된 과목인지 확인
    const exists = courses.some(
      c => c.course_code === course.course_code && c.section === course.section
    );
    if (exists) {
      return { success: false, error: '이미 추가된 과목입니다.' };
    }

    // 색상 할당
    const usedColors = Object.values(colorMap);
    const availableColors = COURSE_COLORS.filter((_, idx) => !usedColors.includes(idx));
    const colorIndex = availableColors.length > 0 
      ? COURSE_COLORS.indexOf(availableColors[0])
      : courses.length % COURSE_COLORS.length;

    const courseKey = `${course.course_code}-${course.section}`;
    
    setCourses(prev => [...prev, course]);
    setColorMap(prev => ({ ...prev, [courseKey]: colorIndex }));
    
    // 🔥 인기도 카운트 증가 (비동기, 실패해도 무시)
    incrementCoursePopularity(course).catch(() => {});
    
    return { success: true };
  }, [courses, colorMap]);

  // 과목 삭제
  const removeCourse = useCallback((courseCode, section) => {
    const courseKey = `${courseCode}-${section}`;
    setCourses(prev => prev.filter(
      c => !(c.course_code === courseCode && c.section === section)
    ));
    setColorMap(prev => {
      const newMap = { ...prev };
      delete newMap[courseKey];
      return newMap;
    });
  }, []);

  // 전체 삭제
  const clearSchedule = useCallback(() => {
    setCourses([]);
    setColorMap({});
  }, []);

  // 시간표 불러오기 (공유된 시간표)
  const loadSchedule = useCallback((newCourses) => {
    setCourses(newCourses);
    const newColorMap = {};
    newCourses.forEach((course, idx) => {
      const key = `${course.course_code}-${course.section}`;
      newColorMap[key] = idx % COURSE_COLORS.length;
    });
    setColorMap(newColorMap);
  }, []);

  // 과목 색상 가져오기
  const getCourseColor = useCallback((courseCode, section) => {
    const key = `${courseCode}-${section}`;
    const colorIndex = colorMap[key] ?? 0;
    return COURSE_COLORS[colorIndex];
  }, [colorMap]);

  // 통계 계산
  const stats = {
    totalCredits: getTotalCredits(courses),
    courseCount: courses.length,
    emptyDays: getEmptyDays(courses),
  };

  return {
    courses,
    stats,
    addCourse,
    removeCourse,
    clearSchedule,
    loadSchedule,
    getCourseColor,
  };
}