/**
 * 2026학년도 2학기 시간표 Firebase 업로드 스크립트
 *
 * 동작:
 *   1. 기존 courses 컬렉션을 JSON 파일로 백업
 *   2. 기존 courses 컬렉션 전체 삭제
 *   3. 2026_2 폴더의 JSON을 프론트엔드 형식으로 변환 후 업로드
 *
 * 사용법:
 *   node upload_2026_2.cjs            → 검증만 (드라이런, Firebase 변경 없음)
 *   node upload_2026_2.cjs --confirm  → 실제 백업 + 삭제 + 업로드
 *
 * 쓰기에는 서비스 계정 키가 필요합니다.
 * courses 컬렉션은 보안 규칙상 앱에서 읽기 전용이라, 클라이언트 SDK로는
 * 쓸 수 없습니다. Admin SDK가 규칙을 우회해 서버 권한으로 씁니다.
 *
 *   1. Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *   2. 받은 JSON을 이 폴더에 serviceAccountKey.json 이름으로 저장
 *   3. node upload_2026_2.cjs --confirm
 *
 * 키 경로를 바꾸려면 환경변수 GOOGLE_APPLICATION_CREDENTIALS 를 쓰세요.
 * ⚠️ 서비스 계정 키는 절대 커밋하지 마세요 (.gitignore에 등록되어 있음).
 *
 * 주의: 프론트엔드는 courses 컬렉션에 semester 필터를 걸지 않으므로,
 *       두 학기가 섞이면 안 됩니다. 반드시 전체 교체 방식으로만 쓰세요.
 */

// firebase-admin v13+ 모듈러 API
// (v14에서 admin.credential 네임스페이스가 제거되어 cert가 최상위로 이동함)
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, 'serviceAccountKey.json');

const SEMESTER = '2026학년도 2학기';
const DRY_RUN = !process.argv.includes('--confirm');

// ─────────────────────────────────────────────────────────────
// 업로드 대상 파일 + 카테고리
// category는 파일 구조가 아니라 여기서 명시적으로 결정한다.
// (2026-2부터 융합전공/교직 파일이 departments 구조로 바뀌어,
//  구조만 보고 판단하면 전부 major로 잘못 분류됨)
// ─────────────────────────────────────────────────────────────
const FILES = [
  // 교양필수
  { file: '교양필수_2026_2학기.json',               category: 'general_required' },

  // 교양선택 (영역별)
  { file: 'general_elective_area1.json',            category: 'general_elective' },
  { file: 'general_elective_area2.json',            category: 'general_elective' },
  { file: 'general_elective_area3.json',            category: 'general_elective' },
  { file: 'general_elective_area4.json',            category: 'general_elective' },
  { file: 'general_elective_area5.json',            category: 'general_elective' },
  { file: 'general_elective_area6.json',            category: 'general_elective' },

  // 전공 (단과대학별) — 융합전공보다 먼저 처리해야 중복 시 학과 과목이 남는다
  { file: '공과대학_강의시간표_2026_2학기.json',     category: 'major' },
  { file: 'ai_convergence_2026_2.json',             category: 'major' },
  { file: 'health_science_college_2026_2.json',     category: 'major' },
  { file: '2026_2_인문예술대학_시간표.json',         category: 'major' },
  { file: 'global_industry_trade_2026_2.json',      category: 'major' },
  { file: '공공인재대학_2026_2학기_시간표.json',     category: 'major' },
  { file: 'international_cooperation_2026_2.json',  category: 'major' },
  { file: 'future_lifelong_education_college.json', category: 'major' },
  { file: 'daesoon_timetable_2026_2.json',          category: 'major' },
  { file: '2026_2_major_sangsaeng.json',            category: 'major' },

  // 융합전공
  { file: '융합전공_2026_2학기.json',                category: 'convergence' },

  // 특수 (교직 / 일반선택·현장실습·ROTC)
  { file: 'teaching_courses_2026_2.json',           category: 'special' },
  { file: 'general_elective_2026_2.json',           category: 'special' },
];

// 프론트엔드 departments.js 와 표기가 다른 학과명 보정
const DEPT_ALIASES = {
  '역사.문화콘텐츠학과': '역사문화콘텐츠학과',
  'K문화콘텐츠융합전공': 'K-문화콘텐츠융합전공',
};

const normalizeDept = (name) => DEPT_ALIASES[name] || name;

// ─────────────────────────────────────────────────────────────
// 변환
// ─────────────────────────────────────────────────────────────

/** 분반 하나를 프론트엔드 스키마의 문서로 변환 */
function buildDoc(course, section, extra, meta) {
  return {
    _docId: `${course.course_code}_${section.section}`,
    course_code: course.course_code,
    course_name: course.course_name,
    section: section.section,
    credits: course.credits,
    hours: course.hours || 0,
    lab_hours: course.lab_hours || 0,
    target_year: course.target_year ?? 0,   // null이면 0 = 전체 학년
    // 분반 정보 (프론트: course.schedule_raw / times / room)
    professor: section.professor,
    schedule_raw: section.schedule?.raw || '',
    times: section.schedule?.times || [],
    room: section.room?.raw || '',
    capacity: section.capacity || 0,
    notes: section.notes || '',
    // 메타
    semester: meta.semester,
    updated_at: meta.updatedAt,
    created_at: meta.updatedAt,
    ...extra,
  };
}

function convert(data, category) {
  const docs = [];
  const meta = {
    semester: data.semester || SEMESTER,
    updatedAt: data.updated_at || new Date().toISOString().split('T')[0],
  };

  // 1) 교양선택 — areas 구조
  if (data.areas) {
    for (const area of data.areas) {
      for (const course of area.courses || []) {
        for (const section of course.sections || []) {
          docs.push(buildDoc(course, section, {
            category,
            area_id: area.area_id,
            area: area.area_name,
            field: area.field || null,
          }, meta));
        }
      }
    }
  }

  // 2) 교양필수 — courses 구조
  else if (data.courses && !data.departments) {
    for (const course of data.courses) {
      for (const section of course.sections || []) {
        docs.push(buildDoc(course, section, {
          category,
          classification: course.classification || data.category || null,
        }, meta));
      }
    }
  }

  // 3) 전공 / 융합전공 / 특수 — departments 구조
  else if (data.departments) {
    for (const dept of data.departments) {
      for (const course of dept.courses || []) {
        for (const section of course.sections || []) {
          docs.push(buildDoc(course, section, {
            category,
            classification: course.classification || null,
            is_micro_major: course.is_micro_major || false,
            college: data.college,
            college_eng: data.college_eng || null,
            department_id: dept.department_id,
            department: normalizeDept(dept.department_name),
          }, meta));
        }
      }
    }
  }

  return docs;
}

// ─────────────────────────────────────────────────────────────
// 수집 + 중복 제거
// ─────────────────────────────────────────────────────────────
function collectDocuments() {
  const byId = new Map();   // _docId → { doc, source }
  const stats = [];
  const skipped = [];
  const missing = [];

  for (const { file, category } of FILES) {
    const filepath = path.join(__dirname, file);
    if (!fs.existsSync(filepath)) {
      missing.push(file);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    if (data.semester && data.semester !== SEMESTER) {
      throw new Error(`${file} 의 semester가 "${data.semester}" 입니다 (기대: "${SEMESTER}")`);
    }

    const docs = convert(data, category);
    let added = 0;

    for (const d of docs) {
      const prev = byId.get(d._docId);
      if (prev) {
        // 먼저 등록된 쪽(= FILES 배열에서 앞선 파일)을 유지한다.
        // 융합전공 과목은 학과 과목과 코드·분반이 같은 경우가 있어,
        // 학과 파일을 앞에 배치해 학과 과목이 살아남게 한다.
        skipped.push({
          id: d._docId,
          name: d.course_name,
          kept: `${prev.source} / ${prev.doc.department || prev.doc.area || ''}`,
          dropped: `${file} / ${d.department || d.area || ''}`,
        });
        continue;
      }
      byId.set(d._docId, { doc: d, source: file });
      added++;
    }

    stats.push({ file, category, count: added, total: docs.length });
  }

  return {
    documents: [...byId.values()].map(v => v.doc),
    stats,
    skipped,
    missing,
  };
}

// ─────────────────────────────────────────────────────────────
// Firebase 작업
// ─────────────────────────────────────────────────────────────
async function backupCollection(db) {
  console.log('\n💾 기존 데이터 백업 중...');
  const snapshot = await db.collection('courses').get();

  if (snapshot.empty) {
    console.log('   (비어있음 - 백업 생략)');
    return null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(__dirname, `backup_courses_${stamp}.json`);
  const payload = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`   ✅ ${payload.length}개 문서 → ${path.basename(backupPath)}`);
  return backupPath;
}

async function deleteAll(db) {
  console.log('\n🗑️  기존 courses 컬렉션 삭제 중...');
  const snapshot = await db.collection('courses').get();

  if (snapshot.empty) {
    console.log('   (비어있음)');
    return 0;
  }

  const total = snapshot.docs.length;
  const batchSize = 450;
  let deleted = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = db.batch();
    snapshot.docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(batchSize, total - i);
    process.stdout.write(`\r   삭제 중... ${Math.round(deleted / total * 100)}% (${deleted}/${total})`);
  }

  console.log(`\n   ✅ ${deleted}개 삭제 완료`);
  return deleted;
}

async function upload(db, documents) {
  console.log('\n🚀 업로드 시작...');
  const batchSize = 450;
  const total = documents.length;
  let uploaded = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = db.batch();

    for (const src of documents.slice(i, i + batchSize)) {
      const { _docId, ...rest } = src;
      const cleaned = {};
      for (const [k, v] of Object.entries(rest)) cleaned[k] = v === undefined ? null : v;
      batch.set(db.collection('courses').doc(_docId), cleaned);
    }

    await batch.commit();
    uploaded += Math.min(batchSize, total - i);
    const pct = Math.round(uploaded / total * 100);
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r   [${bar}] ${pct}% (${uploaded}/${total})`);
  }

  console.log('');
  return uploaded;
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🔥 2026학년도 2학기 시간표 업로드');
  console.log('='.repeat(56));
  if (DRY_RUN) {
    console.log('🧪 드라이런 모드 — Firebase는 변경되지 않습니다.');
    console.log('   실제 반영하려면: node upload_2026_2.cjs --confirm');
  }

  // 1. 로컬 JSON 변환 + 검증
  console.log('\n📁 JSON 변환 중...');
  const { documents, stats, skipped, missing } = collectDocuments();

  stats.forEach(s => {
    const dropped = s.total - s.count;
    const suffix = dropped > 0 ? `  (중복 ${dropped}개 제외)` : '';
    console.log(`   ✅ ${s.file}`);
    console.log(`      ${s.category.padEnd(17)} ${s.count}개 분반${suffix}`);
  });

  if (missing.length) {
    console.log('\n   ⚠️  파일 없음:');
    missing.forEach(f => console.log(`      - ${f}`));
  }

  if (skipped.length) {
    console.log(`\n   ℹ️  중복 문서 ID ${skipped.length}건 — 앞선 파일 우선:`);
    skipped.forEach(s => {
      console.log(`      ${s.id} ${s.name}`);
      console.log(`         유지: ${s.kept}`);
      console.log(`         제외: ${s.dropped}`);
    });
  }

  const byCategory = {};
  documents.forEach(d => { byCategory[d.category] = (byCategory[d.category] || 0) + 1; });

  console.log(`\n   📊 총 ${documents.length}개 분반`);
  Object.entries(byCategory).forEach(([k, v]) => console.log(`      ${k.padEnd(17)} ${v}개`));

  if (documents.length === 0) {
    console.log('\n❌ 업로드할 문서가 없습니다. 중단합니다.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n' + '='.repeat(56));
    console.log('🧪 드라이런 완료 — Firebase는 그대로입니다.');
    console.log('   문제 없으면: node upload_2026_2.cjs --confirm');
    process.exit(0);
  }

  // 2. Firebase 연결 (Admin SDK — 보안 규칙 우회)
  console.log('\n📡 Firebase 연결 중...');

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('\n❌ 서비스 계정 키를 찾을 수 없습니다.');
    console.error(`   찾은 위치: ${SERVICE_ACCOUNT_PATH}`);
    console.error('\n   발급 방법:');
    console.error('   1. Firebase Console → 프로젝트 설정(⚙️) → 서비스 계정 탭');
    console.error('   2. "새 비공개 키 생성" 클릭 → JSON 다운로드');
    console.error('   3. 이 폴더에 serviceAccountKey.json 이름으로 저장');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
  const app = initializeApp({ credential: cert(serviceAccount) });

  const db = getFirestore(app);
  console.log(`   ✅ 연결 성공 (프로젝트: ${serviceAccount.project_id})`);

  // 3. 백업 → 삭제 → 업로드
  await backupCollection(db);
  await deleteAll(db);
  const uploaded = await upload(db, documents);

  console.log('\n' + '='.repeat(56));
  console.log('🎉 업로드 완료!');
  console.log('='.repeat(56));
  console.log(`   학기: ${SEMESTER}`);
  console.log(`   총 분반: ${uploaded}개`);
  Object.entries(byCategory).forEach(([k, v]) => console.log(`   ${k.padEnd(17)} ${v}개`));

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);

  if (String(err.message).includes('PERMISSION_DENIED')) {
    console.error('\n   Firestore가 쓰기를 거부했습니다.');
    console.error('   - 서비스 계정에 Cloud Datastore 사용자 권한이 있는지 확인하세요.');
    console.error('   - 기존 데이터는 삭제되지 않았습니다.');
  } else {
    console.error(err.stack);
  }

  process.exit(1);
});
