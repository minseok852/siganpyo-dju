// src/hooks/useCourses.js
import { useState, useCallback, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

const PAGE_SIZE = 30; // 한 번에 보여줄 개수

export function useCourses() {
  const [allCourses, setAllCourses] = useState([]); // 전체 캐시
  const [filteredCourses, setFilteredCourses] = useState([]); // 필터링된 결과
  const [courses, setCourses] = useState([]); // 화면에 표시할 과목
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const isLoaded = useRef(false);
  const currentPage = useRef(0);

  // 전체 데이터 로드 (최초 1회)
  const loadAllCourses = useCallback(async () => {
    if (isLoaded.current) return allCourses;
    
    setLoading(true);
    setError(null);

    try {
      console.log('📚 전체 과목 데이터 로딩 중...');
      const coursesRef = collection(db, 'courses');
      const snapshot = await getDocs(coursesRef);

      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`✅ ${results.length}개 과목 로드 완료`);
      setAllCourses(results);
      isLoaded.current = true;
      return results;

    } catch (err) {
      console.error('❌ 데이터 로드 오류:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [allCourses]);

  // 필터링 함수
  const filterCourses = useCallback((data, filters) => {
    let results = [...data];

    // 카테고리 필터
    if (filters.category && filters.category !== 'all') {
      results = results.filter(c => c.category === filters.category);
    }

    // 학년 필터 (엄격)
    if (filters.targetYear && filters.targetYear > 0) {
      results = results.filter(c => c.target_year === filters.targetYear);
    }

    // 영역 필터 (교양선택)
    if (filters.area) {
      results = results.filter(c => c.area === filters.area);
    }

    // 이수구분 필터 (전공)
    if (filters.classification) {
      results = results.filter(c => c.classification === filters.classification);
    }

    // 단과대학 필터
    if (filters.college && filters.college !== '전체') {
      results = results.filter(c => c.college === filters.college);
    }

    // 학과 필터
    if (filters.department) {
      results = results.filter(c => c.department === filters.department);
    }

    // 검색어 필터
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      results = results.filter(c => 
        c.course_name?.toLowerCase().includes(term) ||
        c.professor?.toLowerCase().includes(term) ||
        c.course_code?.includes(term)
      );
    }

    // 정렬
    results.sort((a, b) => {
      if (a.target_year !== b.target_year) {
        if (a.target_year === 0) return 1;
        if (b.target_year === 0) return -1;
        return a.target_year - b.target_year;
      }
      return (a.course_name || '').localeCompare(b.course_name || '');
    });

    return results;
  }, []);

  // 과목 검색
  const searchCourses = useCallback(async (filters = {}) => {
    setLoading(true);
    
    try {
      // 데이터 로드
      let data = allCourses;
      if (!isLoaded.current) {
        data = await loadAllCourses();
      }

      // 필터링
      const filtered = filterCourses(data, filters);
      setFilteredCourses(filtered);

      // 첫 페이지만 표시
      currentPage.current = 1;
      const firstPage = filtered.slice(0, PAGE_SIZE);
      setCourses(firstPage);
      setHasMore(filtered.length > PAGE_SIZE);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [allCourses, loadAllCourses, filterCourses]);

  // 더보기
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    currentPage.current += 1;
    const start = 0;
    const end = currentPage.current * PAGE_SIZE;
    
    setCourses(filteredCourses.slice(start, end));
    setHasMore(end < filteredCourses.length);
  }, [filteredCourses, loading, hasMore]);

  // 학과 목록 가져오기
  const getDepartments = useCallback((college) => {
    if (!college || college === '전체') return [];

    const departments = new Set();
    allCourses.forEach(course => {
      if (course.college === college && course.department) {
        departments.add(course.department);
      }
    });

    return Array.from(departments).sort();
  }, [allCourses]);

  return {
    courses,
    loading,
    error,
    hasMore,
    totalCount: filteredCourses.length,
    searchCourses,
    loadMore,
    getDepartments,
  };
}