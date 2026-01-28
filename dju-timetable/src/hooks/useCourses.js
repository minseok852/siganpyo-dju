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

      // 학년 필터
      if (filters.targetYear && filters.targetYear > 0) {
        constraints.push(where('target_year', '==', filters.targetYear));
      }

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
      
      // ✅ 검색어가 있으면 더 많이 가져와서 필터링
      const searchTerm = filters.searchTerm?.trim();
      let fetchLimit;
      
      if (searchTerm) {
        // 검색어 있으면 전체에서 찾아야 하니까 많이 가져옴
        fetchLimit = 2000;  // 전체 1,583개니까 2000이면 충분
      } else {
        // 검색어 없으면 기본 100개
        fetchLimit = filters.limit || 100;
      }
      
      constraints.push(limit(fetchLimit));

      const q = query(coursesRef, ...constraints);
      const snapshot = await getDocs(q);

      let results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 검색어 필터 (클라이언트 사이드)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter(course => 
          course.course_name?.toLowerCase().includes(term) ||
          course.professor?.toLowerCase().includes(term) ||
          course.course_code?.includes(term)
        );
        
        // 검색 결과는 100개까지만 표시
        results = results.slice(0, 100);
      }

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

  // 학과 목록 가져오기
  const getDepartments = useCallback(async (college) => {
    if (!college || college === '전체') return [];

    try {
      const coursesRef = collection(db, 'courses');
      const q = query(
        coursesRef,
        where('college', '==', college),
        orderBy('department'),
        limit(200)
      );
      
      const snapshot = await getDocs(q);
      const departments = new Set();
      
      snapshot.docs.forEach(doc => {
        const dept = doc.data().department;
        if (dept) departments.add(dept);
      });

      return Array.from(departments).sort();
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