/**
 * Firebase Firestore 과목 삭제 스크립트
 * 
 * 잘못 추가된 과목 삭제용
 * 
 * 사용법:
 * 1. npm install firebase (이미 설치되어 있으면 스킵)
 * 2. node delete_course.cjs
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, deleteDoc, getDoc } = require('firebase/firestore');

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAg2Dr2g-eLOrP9KL8K3q1GGYJdnuDmFJM",
  authDomain: "dju-timetable.firebaseapp.com",
  projectId: "dju-timetable",
  storageBucket: "dju-timetable.firebasestorage.app",
  messagingSenderId: "248759627681",
  appId: "1:248759627681:web:e925f126ba81ecff41e5e0"
};

// 삭제할 과목 문서 ID
// 형식: {course_code}_{section}
const coursesToDelete = [
  '561041_03',  // 운영체제론 03분반
];

async function main() {
  console.log('🗑️  Firebase 과목 삭제 스크립트');
  console.log('='.repeat(50));
  
  // Firebase 초기화
  console.log('\n📡 Firebase 연결 중...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  console.log('   ✅ 연결 성공!');
  
  // 과목 삭제
  console.log('\n🗑️  과목 삭제 중...');
  
  for (const docId of coursesToDelete) {
    console.log(`\n   문서 ID: ${docId}`);
    
    try {
      const docRef = doc(db, 'courses', docId);
      
      // 먼저 문서가 존재하는지 확인
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(`   과목명: ${data.course_name}`);
        console.log(`   분반: ${data.section}`);
        console.log(`   교수: ${data.professor}`);
        
        // 삭제 실행
        await deleteDoc(docRef);
        console.log(`   ✅ 삭제 완료!`);
      } else {
        console.log(`   ⚠️  문서가 존재하지 않습니다.`);
      }
    } catch (error) {
      console.error(`   ❌ 오류: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 삭제 작업 완료!');
  
  process.exit(0);
}

main();
