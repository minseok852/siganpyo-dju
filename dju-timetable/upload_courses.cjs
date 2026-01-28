/**
 * Firebase Firestore 과목 데이터 업로드 스크립트
 * 
 * 사용법:
 * 1. 이 파일을 프로젝트 루트에 저장
 * 2. firebase_courses.json 파일도 같은 위치에
 * 3. npm install firebase 실행
 * 4. 아래 firebaseConfig 값 수정
 * 5. node upload_courses.js 실행
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, writeBatch } = require('firebase/firestore');
const fs = require('fs');

// ⚠️ 여기에 Firebase 설정 값 입력!
const firebaseConfig = {
  apiKey: "AIzaSyAg2Dr2g-eLOrP9KL8K3q1GGYJdnuDmFJM",
  authDomain: "dju-timetable.firebaseapp.com",
  projectId: "dju-timetable",
  storageBucket: "dju-timetable.firebasestorage.app",
  messagingSenderId: "248759627681",
  appId: "1:248759627681:web:e925f126ba81ecff41e5e0"
};

async function uploadCourses() {
  console.log('🔥 Firebase 초기화 중...');
  
  // Firebase 초기화
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  console.log('✅ Firebase 연결 성공!\n');

  // JSON 파일 읽기
  console.log('📁 firebase_courses.json 파일 읽는 중...');
  // 내가 보내고 싶은 파일 같은 폴더에 넣고 보내기
  const coursesData = JSON.parse(fs.readFileSync('firebase_general_required.json', 'utf-8'));
  console.log(`✅ ${coursesData.length}개 과목 로드됨\n`);

  // 배치 업로드 (500개씩)
  const batchSize = 450; // Firestore 제한이 500이라 여유있게
  let uploaded = 0;
  const total = coursesData.length;

  console.log('🚀 업로드 시작...\n');

  for (let i = 0; i < total; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = coursesData.slice(i, Math.min(i + batchSize, total));

    chunk.forEach(course => {
      const docId = `${course.course_code}_${course.section}`;
      const docRef = doc(collection(db, 'courses'), docId);
      batch.set(docRef, course);  // ← course 데이터 추가!
    });

    await batch.commit();
    uploaded += chunk.length;

    const percent = Math.round((uploaded / total) * 100);
    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
    process.stdout.write(`\r[${bar}] ${percent}% (${uploaded}/${total})`);
  }

  console.log('\n\n🎉 모든 데이터 업로드 완료!');
  console.log(`📊 총 ${total}개 과목이 Firestore에 저장되었습니다.`);
  
  process.exit(0);
}

// 실행
uploadCourses().catch(err => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
