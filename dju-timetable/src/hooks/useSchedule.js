// src/hooks/useSchedule.js
import { useState, useCallback, useEffect } from 'react';
import { checkScheduleConflict, getTotalCredits, getEmptyDays, parseScheduleToTimes } from '../utils/timeUtils';
import { STORAGE_KEYS, COURSE_COLORS, THEMES } from '../data/constants';
import { incrementCoursePopularity, decrementCoursePopularity } from '../services/popularService';

// 최대 시간표 개수
const MAX_SCHEDULES = 3;

// 기본 시간표 이름
const DEFAULT_NAMES = ['시간표 1', '시간표 2', '시간표 3'];

/**
 * 과목 데이터에 times 필드 보장
 */
function ensureCourseTimes(course) {
  if (!course.times || course.times.length === 0) {
    return {
      ...course,
      times: parseScheduleToTimes(course.schedule_raw),
    };
  }
  return course;
}

/**
 * 초기 상태 로드 (마이그레이션 포함)
 */
function getInitialState() {
  try {
    // 새 형식 먼저 확인
    const newSaved = localStorage.getItem(STORAGE_KEYS.MY_SCHEDULES);
    if (newSaved) {
      const parsed = JSON.parse(newSaved);
      console.log('📂 복수 시간표 불러옴:', parsed.schedules?.length || 0, '개');
      
      // times 필드 보장
      const schedulesWithTimes = (parsed.schedules || []).map(schedule => ({
        ...schedule,
        courses: (schedule.courses || []).map(ensureCourseTimes),
      }));
      
      return {
        schedules: schedulesWithTimes,
        activeId: parsed.activeId || schedulesWithTimes[0]?.id || 1,
      };
    }
    
    // 기존 형식 마이그레이션
    const oldSaved = localStorage.getItem(STORAGE_KEYS.MY_SCHEDULE);
    if (oldSaved) {
      const parsed = JSON.parse(oldSaved);
      console.log('🔄 기존 시간표 마이그레이션:', parsed.courses?.length || 0, '개 과목');
      
      const migratedSchedule = {
        id: 1,
        name: '시간표 1',
        courses: (parsed.courses || []).map(ensureCourseTimes),
        colorMap: parsed.colorMap || {},
      };
      
      return {
        schedules: [migratedSchedule],
        activeId: 1,
      };
    }
  } catch (e) {
    console.error('Failed to load schedules:', e);
  }
  
  // 기본값: 빈 시간표 1개
  return {
    schedules: [{
      id: 1,
      name: '시간표 1',
      courses: [],
      colorMap: {},
    }],
    activeId: 1,
  };
}

export function useSchedule() {
  const [init] = useState(getInitialState);
  const [schedules, setSchedules] = useState(init.schedules);
  const [activeId, setActiveId] = useState(init.activeId);

  // 현재 활성 시간표
  const activeSchedule = schedules.find(s => s.id === activeId) || schedules[0];
  const courses = activeSchedule?.courses || [];
  const colorMap = activeSchedule?.colorMap || {};

  // 로컬스토리지에 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MY_SCHEDULES, JSON.stringify({
      schedules,
      activeId,
    }));
    console.log('💾 시간표 저장됨:', schedules.length, '개 시간표');
  }, [schedules, activeId]);

  // ========== 시간표 관리 ==========

  // 새 시간표 추가
  const addSchedule = useCallback((name) => {
    if (schedules.length >= MAX_SCHEDULES) {
      return { success: false, error: `최대 ${MAX_SCHEDULES}개까지만 만들 수 있어요` };
    }
    
    const newId = Math.max(...schedules.map(s => s.id), 0) + 1;
    const newName = name || DEFAULT_NAMES[schedules.length] || `시간표 ${newId}`;
    
    const newSchedule = {
      id: newId,
      name: newName,
      courses: [],
      colorMap: {},
    };
    
    setSchedules(prev => [...prev, newSchedule]);
    setActiveId(newId);
    
    console.log('✅ 새 시간표 생성:', newName);
    return { success: true, id: newId };
  }, [schedules]);

  // 시간표 복제
  const duplicateSchedule = useCallback((scheduleId) => {
    if (schedules.length >= MAX_SCHEDULES) {
      return { success: false, error: `최대 ${MAX_SCHEDULES}개까지만 만들 수 있어요` };
    }
    
    const source = schedules.find(s => s.id === scheduleId);
    if (!source) {
      return { success: false, error: '시간표를 찾을 수 없어요' };
    }
    
    const newId = Math.max(...schedules.map(s => s.id), 0) + 1;
    const newName = `${source.name} 복사본`;
    
    const duplicated = {
      id: newId,
      name: newName,
      courses: [...source.courses],
      colorMap: { ...source.colorMap },
    };
    
    setSchedules(prev => [...prev, duplicated]);
    setActiveId(newId);
    
    console.log('✅ 시간표 복제:', source.name, '→', newName);
    return { success: true, id: newId };
  }, [schedules]);

  // 시간표 삭제
  const deleteSchedule = useCallback((scheduleId) => {
    if (schedules.length <= 1) {
      return { success: false, error: '최소 1개의 시간표는 필요해요' };
    }
    
    const target = schedules.find(s => s.id === scheduleId);
    if (!target) {
      return { success: false, error: '시간표를 찾을 수 없어요' };
    }
    
    // 삭제되는 시간표의 과목들 인기도 감소
    target.courses.forEach(course => {
      decrementCoursePopularity(course.course_code, course.section).catch(() => {});
    });
    
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    
    // 활성 시간표가 삭제되면 첫 번째로 전환
    if (activeId === scheduleId) {
      const remaining = schedules.filter(s => s.id !== scheduleId);
      setActiveId(remaining[0]?.id || 1);
    }
    
    console.log('🗑️ 시간표 삭제:', target.name);
    return { success: true };
  }, [schedules, activeId]);

  // 시간표 이름 변경
  const renameSchedule = useCallback((scheduleId, newName) => {
    if (!newName.trim()) {
      return { success: false, error: '이름을 입력해주세요' };
    }
    
    setSchedules(prev => prev.map(s => 
      s.id === scheduleId ? { ...s, name: newName.trim() } : s
    ));
    
    console.log('✏️ 시간표 이름 변경:', newName);
    return { success: true };
  }, []);

  // 활성 시간표 전환
  const switchSchedule = useCallback((scheduleId) => {
    const target = schedules.find(s => s.id === scheduleId);
    if (target) {
      setActiveId(scheduleId);
      console.log('🔄 시간표 전환:', target.name);
    }
  }, [schedules]);

  // ========== 과목 관리 ==========

  // 과목 추가
  const addCourse = useCallback((course) => {
    const courseWithTimes = ensureCourseTimes(course);

    // 시간 충돌 체크
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
    
    setSchedules(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      return {
        ...s,
        courses: [...s.courses, courseWithTimes],
        colorMap: { ...s.colorMap, [courseKey]: colorIndex },
      };
    }));
    
    // 인기도 카운트 증가
    incrementCoursePopularity(course).catch(() => {});
    
    console.log('✅ 과목 추가됨:', course.course_name);
    return { success: true };
  }, [courses, colorMap, activeId]);

  // 과목 삭제
  const removeCourse = useCallback((courseCode, section) => {
    const courseKey = `${courseCode}-${section}`;
    
    setSchedules(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      
      const newColorMap = { ...s.colorMap };
      delete newColorMap[courseKey];
      
      return {
        ...s,
        courses: s.courses.filter(
          c => !(c.course_code === courseCode && c.section === section)
        ),
        colorMap: newColorMap,
      };
    }));
    
    // 인기도 카운트 감소
    decrementCoursePopularity(courseCode, section).catch(() => {});
  }, [activeId]);

  // 전체 삭제 (현재 시간표만)
  const clearSchedule = useCallback(() => {
    // 모든 과목의 인기도 카운트 감소
    courses.forEach(course => {
      decrementCoursePopularity(course.course_code, course.section).catch(() => {});
    });
    
    setSchedules(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      return { ...s, courses: [], colorMap: {} };
    }));
  }, [courses, activeId]);

  // 시간표 불러오기 (공유된 시간표 또는 AI 추천)
  const loadSchedule = useCallback((newCourses, targetScheduleId = null) => {
    const targetId = targetScheduleId || activeId;
    
    const coursesWithTimes = newCourses.map(ensureCourseTimes);
    
    const newColorMap = {};
    coursesWithTimes.forEach((course, idx) => {
      const key = `${course.course_code}-${course.section}`;
      newColorMap[key] = idx % COURSE_COLORS.length;
    });
    
    setSchedules(prev => prev.map(s => {
      if (s.id !== targetId) return s;
      return {
        ...s,
        courses: coursesWithTimes,
        colorMap: newColorMap,
      };
    }));
    
    if (targetId !== activeId) {
      setActiveId(targetId);
    }
  }, [activeId]);

  // 특정 시간표에 AI 추천 결과 저장
  const saveToSchedule = useCallback((newCourses, scheduleId, clearExisting = true) => {
    const coursesWithTimes = newCourses.map(ensureCourseTimes);
    
    const newColorMap = {};
    coursesWithTimes.forEach((course, idx) => {
      const key = `${course.course_code}-${course.section}`;
      newColorMap[key] = idx % COURSE_COLORS.length;
    });
    
    setSchedules(prev => prev.map(s => {
      if (s.id !== scheduleId) return s;
      
      if (clearExisting) {
        // 기존 과목 인기도 감소
        s.courses.forEach(course => {
          decrementCoursePopularity(course.course_code, course.section).catch(() => {});
        });
        
        return {
          ...s,
          courses: coursesWithTimes,
          colorMap: newColorMap,
        };
      } else {
        // 기존 과목 유지하고 추가 (TODO: 충돌 체크 필요)
        const existingKeys = new Set(s.courses.map(c => `${c.course_code}-${c.section}`));
        const newOnly = coursesWithTimes.filter(c => !existingKeys.has(`${c.course_code}-${c.section}`));
        
        const mergedColorMap = { ...s.colorMap };
        newOnly.forEach((course, idx) => {
          const key = `${course.course_code}-${course.section}`;
          mergedColorMap[key] = (s.courses.length + idx) % COURSE_COLORS.length;
        });
        
        return {
          ...s,
          courses: [...s.courses, ...newOnly],
          colorMap: mergedColorMap,
        };
      }
    }));
    
    setActiveId(scheduleId);
  }, []);

  // 활성 시간표의 테마 팔레트
  const activePalette = THEMES[activeSchedule?.theme] ?? THEMES.pastel;

  // 과목 색상 가져오기 (활성 테마 적용)
  const getCourseColor = useCallback((courseCode, section) => {
    const key = `${courseCode}-${section}`;
    const colorIndex = colorMap[key] ?? 0;
    return activePalette.colors[colorIndex % activePalette.colors.length];
  }, [colorMap, activePalette]);

  // 시간표 테마 변경
  const setScheduleTheme = useCallback((scheduleId, themeName) => {
    if (!THEMES[themeName]) return;
    setSchedules(prev => prev.map(s =>
      s.id === scheduleId ? { ...s, theme: themeName } : s
    ));
  }, []);

  // 통계 계산
  const stats = {
    totalCredits: getTotalCredits(courses),
    courseCount: courses.length,
    emptyDays: getEmptyDays(courses),
  };

  return {
    // 복수 시간표 관리
    schedules,
    activeId,
    activeSchedule,
    addSchedule,
    duplicateSchedule,
    deleteSchedule,
    renameSchedule,
    switchSchedule,
    saveToSchedule,
    setScheduleTheme,
    maxSchedules: MAX_SCHEDULES,
    
    // 기존 호환 (현재 활성 시간표)
    courses,
    stats,
    addCourse,
    removeCourse,
    clearSchedule,
    loadSchedule,
    getCourseColor,
  };
}