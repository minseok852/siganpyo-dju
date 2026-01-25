/**
 * Firebase Firestore에 과목 데이터 업로드 스크립트
 * 
 * 사용법:
 * 1. Node.js 환경에서 실행
 * 2. Firebase Admin SDK 설정 필요
 * 
 * node scripts/uploadCourses.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Admin 초기화 (서비스 계정 키 필요)
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// const db = admin.firestore();

async function uploadCourses() {
  // firebase_courses.json 파일 읽기
  const coursesPath = path.join(__dirname, '../firebase_courses.json');
  const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));
  
  console.log(`총 ${coursesData.length}개 과목 업로드 시작...`);
  
  // Firestore 배치 쓰기 (500개씩)
  const batchSize = 500;
  let batchCount = 0;
  
  for (let i = 0; i < coursesData.length; i += batchSize) {
    const batch = db.batch();
    const chunk = coursesData.slice(i, i + batchSize);
    
    chunk.forEach((course) => {
      // 문서 ID: course_code + section
      const docId = `${course.course_code}_${course.section}`;
      const docRef = db.collection('courses').doc(docId);
      batch.set(docRef, course);
    });
    
    await batch.commit();
    batchCount++;
    console.log(`배치 ${batchCount} 완료 (${Math.min(i + batchSize, coursesData.length)}/${coursesData.length})`);
  }
  
  console.log('✅ 모든 과목 업로드 완료!');
}

// 실행
// uploadCourses().catch(console.error);

console.log(`
===========================================
Firebase 데이터 업로드 가이드
===========================================

방법 1: Firebase Console에서 직접 가져오기
1. Firebase Console > Firestore Database
2. "데이터 가져오기" 클릭
3. firebase_courses.json 파일 선택

방법 2: 이 스크립트 사용
1. Firebase 서비스 계정 키 다운로드
2. serviceAccountKey.json으로 저장
3. 위 코드의 주석 해제
4. node scripts/uploadCourses.js 실행

방법 3: Firebase CLI 사용
firebase firestore:import ./firebase_courses.json
===========================================
`);
