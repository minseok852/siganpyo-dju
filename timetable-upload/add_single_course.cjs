/**
 * Firebase Firestore 단일 과목 추가 스크립트
 * 
 * 기존 데이터 유지하면서 누락된 과목만 추가
 * 
 * 사용법:
 * 1. npm install firebase (이미 설치되어 있으면 스킵)
 * 2. node add_single_course.cjs
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAg2Dr2g-eLOrP9KL8K3q1GGYJdnuDmFJM",
  authDomain: "dju-timetable.firebaseapp.com",
  projectId: "dju-timetable",
  storageBucket: "dju-timetable.firebasestorage.app",
  messagingSenderId: "248759627681",
  appId: "1:248759627681:web:e925f126ba81ecff41e5e0"
};

// 추가할 과목 데이터 (01분반)
const newCourses = [
  {
    _docId: '927320_01',
    course_code: '927320',
    course_name: '커피의세계문화사',
    section: '01',
    credits: 2,
    hours: 4,
    lab_hours: 0,
    target_year: 0,
    category: 'general_elective',
    classification: '교선',
    is_micro_major: false,
    college: '상생교양대학',
    department: '교양교육원',
    professor: '정동준',
    schedule_raw: '화13:30-15:30',
    times: [
      { day: '화', start: '13:30', end: '15:30' }
    ],
    room: '인307 - 역사A/V강의실',
    capacity: 50,
    notes: '',
    semester: '2025학년도 1학기',
    updated_at: new Date().toISOString().split('T')[0],
  }
];

async function main() {
  console.log('🔥 Firebase 과목 추가 스크립트');
  console.log('='.repeat(50));
  
  // Firebase 초기화
  console.log('\n📡 Firebase 연결 중...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  console.log('   ✅ 연결 성공!');
  
  // 과목 추가
  console.log('\n📝 과목 추가 중...');
  
  for (const course of newCourses) {
    console.log(`\n   [${course.section}분반]`);
    console.log(`   과목명: ${course.course_name}`);
    console.log(`   교수: ${course.professor}`);
    console.log(`   시간: ${course.schedule_raw}`);
    
    try {
      const docId = course._docId;
      delete course._docId;
      
      const docRef = doc(db, 'courses', docId);
      await setDoc(docRef, course);
      
      console.log(`   ✅ 추가 완료! (문서 ID: ${docId})`);
    } catch (error) {
      console.error(`   ❌ 오류: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 모든 과목 추가 완료!');
  
  process.exit(0);
}

main();
