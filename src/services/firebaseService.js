// Firebase 서비스 레이어
// 모든 Firebase 관련 작업을 여기에 모아서 관리합니다

// 나중에 추가할 함수들:
// - signUp(email, password)
// - signIn(email, password)
// - signOut()
// - getCurrentUser()
// - addDocument(collection, data)
// - updateDocument(collection, docId, data)
// - deleteDocument(collection, docId)
// - getDocuments(collection)
// - uploadFile(file, path)
// - deleteFile(path)

export const firebaseService = {
  // Auth 관련
  auth: {},
  
  // Firestore 관련
  db: {},
  
  // Storage 관련
  storage: {},
};

export default firebaseService;
