// src/hooks/useCourses.js
import { useState, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  startAfter,
  documentId
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLLEGE_DEPARTMENTS } from '../data/departments';  // ✅ 추가!

// ✅ 2026학번 기준 교양필수 (학년별)
const GENERAL_REQUIRED_BY_YEAR = {
  1: [
    '대학생활과진로',      // 1학점, 1학년 1학기
    '사고와표현',          // 2학점
    '영어읽기와토론',      // 2학점  
    'AI시대의컴퓨팅사고',  // 2학점
    '대순사상과상생윤리',  // 2학점
  ],
  2: [
    'LCT',                // 2학점, 2학년 (LCT(Learning by Communication & Teamwork))
  ],
  // 3, 4학년은 교양필수 없음
};

export function useCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // 과목 검색 - 결과를 직접 반환!
  const searchCourses = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const coursesRef = collection(db, 'courses');
      let constraints = [];

      // 카테고리 필터
      if (filters.category && filters.category !== 'all') {
        constraints.push(where('category', '==', filters.category));
      }

      // ✅ 학년 필터는 클라이언트 사이드에서 처리 (Firestore 복합 인덱스 문제 우회)
      // Firestore에서는 category만 필터링하고, target_year는 나중에 필터링
      const targetYearFilter = filters.targetYear && filters.targetYear > 0 
        ? filters.targetYear 
        : null;

      // 단과대학 필터
      if (filters.college && filters.college !== '전체') {
        constraints.push(where('college', '==', filters.college));
      }

      // 학과 필터
      if (filters.department) {
        constraints.push(where('department', '==', filters.department));
      }

      // 이수구분 필터 (전필/전선)
      if (filters.classification) {
        constraints.push(where('classification', '==', filters.classification));
      }

      // 영역 필터 (교양선택)
      if (filters.area) {
        constraints.push(where('area', '==', filters.area));
      }

      // 정렬
      if (constraints.length > 0) {
        constraints.push(orderBy('course_name'));
      } else {
        constraints.push(orderBy(documentId()));
      }
      
      // ✅ 검색어가 있거나 학년 필터가 있거나 이수구분 필터가 있으면 더 많이 가져와서 필터링
      // 🔧 수정: classification 필터 추가 (전선 필터 시 100개 제한 버그 수정)
      const searchTerm = filters.searchTerm?.trim();
      let fetchLimit;
      
      if (searchTerm || targetYearFilter || filters.classification || filters.onlineOnly) {
        // 클라이언트 필터링 필요 시 많이 가져옴
        fetchLimit = 2000;
      } else {
        fetchLimit = filters.limit || 100;
      }
      
      constraints.push(limit(fetchLimit));

      const q = query(coursesRef, ...constraints);
      const snapshot = await getDocs(q);

      let results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // ✅ 학년 필터 (클라이언트 사이드)
      if (targetYearFilter) {
        // 교양필수는 하드코딩된 목록으로 필터링
        if (filters.category === 'general_required') {
          const allowedNames = GENERAL_REQUIRED_BY_YEAR[targetYearFilter] || [];
          if (allowedNames.length > 0) {
            results = results.filter(course => 
              allowedNames.some(name => course.course_name?.includes(name))
            );
          } else {
            // 해당 학년에 교양필수 없으면 빈 배열
            results = [];
          }
        } else {
          // 전공/교양선택은 target_year로 필터링
          results = results.filter(course => {
            const courseYear = course.target_year || 0;
            // target_year가 0이면 전체 학년, 아니면 해당 학년만
            return courseYear === 0 || courseYear === targetYearFilter;
          });
        }
      }

      // 검색어 필터 (클라이언트 사이드)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter(course => 
          course.course_name?.toLowerCase().includes(term) ||
          course.professor?.toLowerCase().includes(term) ||
          course.course_code?.includes(term)
        );
      }

      // ✅ 온라인 필터 (클라이언트 사이드) - slice 전에 적용!
      if (filters.onlineOnly) {
        results = results.filter(course => {
          const room = (course.room || '').toLowerCase();
          const notes = (course.notes || '');
          return room.includes('e-learning') || room.includes('온라인') || 
                 notes.includes('[원격수업]') || notes.includes('[OCU');
        });
      }
      
      // 검색 결과는 100개까지만 표시
      results = results.slice(0, 100);

      setCourses(results);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(results.length === (filters.limit || 100));

      return results;

    } catch (err) {
      console.error('Search error:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 더 불러오기 (페이지네이션)
  const loadMore = useCallback(async (filters = {}) => {
    if (!lastDoc || !hasMore || loading) return [];

    setLoading(true);
    try {
      const coursesRef = collection(db, 'courses');
      let constraints = [];

      if (filters.category && filters.category !== 'all') {
        constraints.push(where('category', '==', filters.category));
      }

      constraints.push(orderBy('course_name'));
      constraints.push(startAfter(lastDoc));
      constraints.push(limit(50));

      const q = query(coursesRef, ...constraints);
      const snapshot = await getDocs(q);

      const newResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setCourses(prev => [...prev, ...newResults]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 50);

      return newResults;

    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [lastDoc, hasMore, loading]);

  // ✅ 학과 목록 가져오기 - 하드코딩 데이터 사용! (Firebase 의존성 제거)
  const getDepartments = useCallback(async (college) => {
    if (!college || college === '전체') return [];

    // ✅ departments.js의 하드코딩된 데이터 사용
    const departments = COLLEGE_DEPARTMENTS[college];
    
    if (departments && departments.length > 0) {
      return departments.sort();
    }

    // 하드코딩에 없는 단과대학이면 Firebase에서 가져오기 (fallback)
    try {
      const coursesRef = collection(db, 'courses');
      const q = query(
        coursesRef,
        where('college', '==', college),
        orderBy('department'),
        limit(200)
      );
      
      const snapshot = await getDocs(q);
      const deptSet = new Set();
      
      snapshot.docs.forEach(doc => {
        const dept = doc.data().department;
        if (dept) deptSet.add(dept);
      });

      return Array.from(deptSet).sort();
    } catch (err) {
      console.error('Get departments error:', err);
      return [];
    }
  }, []);

  // 교양필수 목록 가져오기
  const getGeneralRequired = useCallback(async () => {
    try {
      const results = await searchCourses({ 
        category: 'general_required',
        limit: 100 
      });
      
      const uniqueNames = [...new Set(results.map(c => c.course_name))];
      return uniqueNames.sort();
    } catch (err) {
      console.error('Get general required error:', err);
      return [];
    }
  }, [searchCourses]);

  // 전공필수 목록 가져오기 (학과별)
  const getMajorRequired = useCallback(async (department) => {
    if (!department) return [];

    try {
      const results = await searchCourses({ 
        category: 'major',
        department,
        classification: '전필',
        limit: 100 
      });
      
      const uniqueNames = [...new Set(results.map(c => c.course_name))];
      return uniqueNames.sort();
    } catch (err) {
      console.error('Get major required error:', err);
      return [];
    }
  }, [searchCourses]);

  return {
    courses,
    loading,
    error,
    hasMore,
    searchCourses,
    loadMore,
    getDepartments,
    getGeneralRequired,
    getMajorRequired,
  };
}