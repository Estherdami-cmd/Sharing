import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Firestore, getFirestore } from "firebase/firestore";

/**
 * Firebase 웹 설정값은 원래 공개돼도 되는 값이다(진짜 보안은 Firestore 규칙이 한다).
 * 그래서 비밀 환경변수 없이 그냥 코드에 둔다 — 팀원의 Vercel 계정 없이도 배포가 된다.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBbpbjoRd_AZRYtai9DxKnF9Ynms-H1_mY",
  authDomain: "yeoresi-project.firebaseapp.com",
  projectId: "yeoresi-project",
  storageBucket: "yeoresi-project.firebasestorage.app",
  messagingSenderId: "881925138086",
  appId: "1:881925138086:web:8b072c637ee7d00b0a3667",
};

// Next.js dev 서버의 hot reload가 이 모듈을 다시 실행할 때마다 initializeApp을 또
// 부르면 "already exists"로 죽는다. 이미 떠 있으면 그 인스턴스를 그대로 쓴다.
const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);
