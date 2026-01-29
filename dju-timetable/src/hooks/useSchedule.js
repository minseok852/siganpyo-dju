// src/hooks/useSchedule.js
import { useState, useCallback, useEffect } from 'react';
import { checkScheduleConflict, getTotalCredits, getEmptyDays } from '../utils/timeUtils';
import { STORAGE_KEYS, COURSE_COLORS } from '../data/constants';
import { incrementCoursePopularity, decrementCoursePopularity } from '../services/popularService';

/**
 * schedule_raw를 times 배열로 파싱
 * "화10:00-11:30, 금10:00-11:30" → [{ day: '화', start: '10:00', end: '11:30' }, ...]
 */
function parseScheduleToTimes(scheduleRaw) {
  if (!scheduleRaw) return [];
  const times = [];
  
  // 쉼표로 먼저 분리
  const segments = scheduleRaw.split(',').map(s => s.trim());
  
  for (const segment of segments) {
    // 공백으로 추가 분리 (여러 요일이 공백으로 구분된 경우)
    const parts = segment.split(/\s+/).filter(p => p.trim());
    
    for (const part of parts) {
      // "화10:00-11:30" 형식
      const timeMatch = part.match(/^(월|화|수|목|금)(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (timeMatch) {
        const [, day, startH, startM, endH, endM] = timeMatch;
        times.push({
          day,
          start: `${startH.padStart(2, '0')}:${startM}`,
          end: `${endH.padStart(2, '0')}:${endM}`,
        });
        continue;
      }
      
      // "월1,2,3" 형식 (교시)
      const periodMatch = part.match(/^(월|화|수|목|금)([\d,]+)$/);
      if (periodMatch) {
        const [, day, periodsStr] = periodMatch;
        const periods = periodsStr.split(',').map(p => parseInt(p)).filter(p => !isNaN(p));
        if (periods.length > 0) {
          const minPeriod = Math.min(...periods);
          const maxPeriod = Math.max(...periods);
          // 1교시 = 9시 시작
          times.push({
            day,
            start: `${(8 + minPeriod).toString().padStart(2, '0')}:00`,
            end: `${(8 + maxPeriod + 1).toString().padStart(2, '0')}:00`,
          });
        }
      }
    }
  }
  
  return times;
}

// localStorage에서 초기값 읽기
function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MY_SCHEDULE);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('📂 저장된 시간표 불러옴:', parsed.courses?.length || 0, '개 과목');
      
      // ✅ 저장된 과목들의 times 필드 검증 및 복구
      const coursesWithTimes = (parsed.courses || []).map(course => {
        if (!course.times || course.times.length === 0) {
          // times가 없으면 schedule_raw에서 파싱
          return {
            ...course,
            times: parseScheduleToTimes(course.schedule_raw),
          };
        }
        return course;
      });
      
      return {
        courses: coursesWithTimes,
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
    // ✅ times가 없으면 schedule_raw에서 파싱!
    const courseTimes = (course.times && course.times.length > 0) 
      ? course.times 
      : parseScheduleToTimes(course.schedule_raw);
    
    const courseWithTimes = {
      ...course,
      times: courseTimes,
    };

    // 시간 충돌 체크 (파싱된 times로)
    const conflict = checkScheduleConflict(courseWithTimes, courses);
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
    
    setCourses(prev => [...prev, courseWithTimes]);
    setColorMap(prev => ({ ...prev, [courseKey]: colorIndex }));
    
    // 🔥 인기도 카운트 증가 (비동기, 실패해도 무시)
    incrementCoursePopularity(course).catch(() => {});
    
    console.log('✅ 과목 추가됨:', course.course_name, '| times:', courseTimes.length, '개');
    
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
    
    // 🔥 인기도 카운트 감소 (비동기, 실패해도 무시)
    decrementCoursePopularity(courseCode, section).catch(() => {});
  }, []);

  // 전체 삭제
  const clearSchedule = useCallback(() => {
    // 🔥 모든 과목의 인기도 카운트 감소 (비동기)
    courses.forEach(course => {
      decrementCoursePopularity(course.course_code, course.section).catch(() => {});
    });
    
    setCourses([]);
    setColorMap({});
  }, [courses]);

  // 시간표 불러오기 (공유된 시간표)
  const loadSchedule = useCallback((newCourses) => {
    // ✅ 불러오는 과목들도 times 파싱 적용
    const coursesWithTimes = newCourses.map(course => {
      if (!course.times || course.times.length === 0) {
        return {
          ...course,
          times: parseScheduleToTimes(course.schedule_raw),
        };
      }
      return course;
    });
    
    setCourses(coursesWithTimes);
    const newColorMap = {};
    coursesWithTimes.forEach((course, idx) => {
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