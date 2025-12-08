import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "us-central1" });

if (!admin.apps.length) {
  admin.initializeApp();
}

function ensureAdmin(request: { auth?: { token?: any } }) {
  if (!request.auth || request.auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
}

export const listUsers = onCall(async (request) => {
  ensureAdmin(request);
  const users: any[] = [];
  let nextPageToken: string | undefined;
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    result.users.forEach((u: admin.auth.UserRecord) => {
      users.push({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        disabled: !!u.disabled,
        admin: !!(u.customClaims && (u.customClaims as any).admin === true),
        createdAt: u.metadata.creationTime,
      });
    });
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return { users };
});

export const createUser = onCall(async (request) => {
  ensureAdmin(request);
  const { email, displayName } = (request.data || {}) as {
    email?: string;
    displayName?: string;
  };
  if (!email || typeof email !== "string") {
    throw new HttpsError("invalid-argument", "email required");
  }
  const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
  const user = await admin
    .auth()
    .createUser({ email, displayName, password: tempPassword });
  let resetLink: string | undefined;
  try {
    resetLink = await admin.auth().generatePasswordResetLink(email);
  } catch (_) {}
  return { uid: user.uid, resetLink };
});

export const setUserAdmin = onCall(async (request) => {
  ensureAdmin(request);
  const { uid, admin: isAdmin } = (request.data || {}) as {
    uid?: string;
    admin?: boolean;
  };
  if (!uid) throw new HttpsError("invalid-argument", "uid required");
  await admin.auth().setCustomUserClaims(uid, { admin: !!isAdmin });
  return { ok: true };
});

export const setUserDisabled = onCall(async (request) => {
  ensureAdmin(request);
  const { uid, disabled } = (request.data || {}) as {
    uid?: string;
    disabled?: boolean;
  };
  if (!uid) throw new HttpsError("invalid-argument", "uid required");
  await admin.auth().updateUser(uid, { disabled: !!disabled });
  return { ok: true };
});

export const deleteUser = onCall(async (request) => {
  ensureAdmin(request);
  const { uid } = (request.data || {}) as { uid?: string };
  if (!uid) throw new HttpsError("invalid-argument", "uid required");
  await admin.auth().deleteUser(uid);
  return { ok: true };
});

// One-time bootstrap to grant admin when no admin exists. Protect with env secret.
export const bootstrapSetAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  const expected = process.env.BOOTSTRAP_ADMIN_SECRET;
  const { uid, secret } = (request.data || {}) as {
    uid?: string;
    secret?: string;
  };
  if (!expected || !secret || secret !== expected) {
    throw new HttpsError("permission-denied", "Invalid secret");
  }
  const targetUid = uid || request.auth.uid;
  await admin.auth().setCustomUserClaims(targetUid, { admin: true });
  return { ok: true };
});
