import * as admin from 'firebase-admin';

let adminDb: admin.firestore.Firestore | null = null;

if (!admin.apps.length) {
  try {
    const raw = process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const svc = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(svc),
        projectId: svc.project_id,
      });
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          projectId,
        });
      }
    }
    if (admin.apps.length) {
      adminDb = admin.firestore();
    }
  } catch (e: any) {
    console.warn('Firebase Admin init error:', e.message);
  }
}

export { adminDb };
