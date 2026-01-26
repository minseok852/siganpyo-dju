// src/services/aiService.js

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * 시간표 평가 API 호출
 */
export async function evaluateSchedule(courses, userInfo) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courses: courses.map(c => ({
          course_code: c.course_code,
          section: c.section,
          course_name: c.course_name,
          professor: c.professor || null,
          credits: c.credits,
          target_year: c.target_year || 0,
          schedule_raw: c.schedule_raw || null,
          times: c.times || null,
          room: c.room || null,
          category: c.category || null,
          classification: c.classification || null,
          college: c.college || null,
          department: c.department || null,
        })),
        user_info: {
          grade: userInfo.grade,
          major: userInfo.major,
          double_major: userInfo.double_major || null,
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || '평가 요청 실패');
    }

    return await response.json();

  } catch (error) {
    console.error('AI 평가 오류:', error);
    return {
      success: false,
      error: error.message || '서버 연결에 실패했습니다.'
    };
  }
}

/**
 * 시간표 추천 API 호출
 */
export async function recommendSchedule(userInfo, availableCourses) {
  try {
    // 과목을 API 형식으로 변환하는 함수
    const formatCourse = (c) => ({
      course_code: c.course_code,
      section: c.section,
      course_name: c.course_name,
      professor: c.professor || null,
      credits: c.credits,
      target_year: c.target_year || 0,  // 추가!
      schedule_raw: c.schedule_raw || null,
      times: c.times || null,
      room: c.room || null,
      category: c.category || null,
      classification: c.classification || null,
      college: c.college || null,
      department: c.department || null,
      notes: c.notes || null,
    });

    const response = await fetch(`${API_BASE_URL}/api/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_info: {
          grade: userInfo.grade,
          major: userInfo.major,
          double_major: userInfo.double_major || null,
          target_credits: userInfo.target_credits,
          completed_general_required: userInfo.completed_general_required || [],
          completed_major_required: userInfo.completed_major_required || [],
          preferences: {
            empty_days: userInfo.preferences?.empty_days || [],
            no_morning: userInfo.preferences?.no_morning || false,
            consecutive: userInfo.preferences?.consecutive || '상관없음',
            preferred_time: userInfo.preferences?.preferred_time || '상관없음',
            preferred_areas: userInfo.preferences?.preferred_areas || [],
            skip_general: userInfo.preferences?.skip_general || false,
            // 새로 추가된 필드들!
            major_selection_mode: userInfo.preferences?.major_selection_mode || 'auto',
            selected_major_courses: (userInfo.preferences?.selected_major_courses || []).map(formatCourse),
            must_take_courses: (userInfo.preferences?.must_take_courses || []).map(formatCourse),
            avoid_courses: userInfo.preferences?.avoid_courses || null,
          },
        },
        available_courses: {
          general_required: (availableCourses.general_required || []).map(formatCourse),
          major_required: (availableCourses.major_required || []).map(formatCourse),
          major_elective: (availableCourses.major_elective || []).map(formatCourse),
          general_elective: (availableCourses.general_elective || []).map(formatCourse),
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || '추천 요청 실패');
    }

    return await response.json();

  } catch (error) {
    console.error('AI 추천 오류:', error);
    return {
      success: false,
      error: error.message || '서버 연결에 실패했습니다.'
    };
  }
}