import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

export type ManagedUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  admin: boolean;
  createdAt?: string;
};

export async function listUsers(): Promise<ManagedUser[]> {
  const fn = httpsCallable(functions, "listUsers");
  const res = await fn();
  return (res.data as any).users as ManagedUser[];
}

export async function createUser(email: string, displayName?: string) {
  const fn = httpsCallable(functions, "createUser");
  const res = await fn({ email, displayName });
  return res.data as { uid: string; resetLink?: string };
}

export async function setUserAdmin(uid: string, admin: boolean) {
  const fn = httpsCallable(functions, "setUserAdmin");
  await fn({ uid, admin });
}

export async function setUserDisabled(uid: string, disabled: boolean) {
  const fn = httpsCallable(functions, "setUserDisabled");
  await fn({ uid, disabled });
}

export async function deleteUser(uid: string) {
  const fn = httpsCallable(functions, "deleteUser");
  await fn({ uid });
}

export async function bootstrapSetAdmin(secret: string, uid?: string) {
  const fn = httpsCallable(functions, "bootstrapSetAdmin");
  const res = await fn({ secret, uid });
  return res.data as { ok: boolean };
}
