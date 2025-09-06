import { db } from "../firebase";
import { doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";

const rid = (a, b) => `${a}_${b}`;

export async function sendFriendRequest(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) return;
  await setDoc(doc(db, "friendRequests", rid(fromUid, toUid)), {
    fromUid,
    toUid,
    createdAt: serverTimestamp(),
  });
}

export async function cancelFriendRequest(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) return;
  await deleteDoc(doc(db, "friendRequests", rid(fromUid, toUid)));
}

export async function acceptFriendRequest(currentUid, fromUid) {
  if (!currentUid || !fromUid || currentUid === fromUid) return;
  const batch = writeBatch(db);
  const requestId = rid(fromUid, currentUid);
  batch.set(doc(db, "users", currentUid, "friends", fromUid), {
    friendUid: fromUid,
    rid: requestId,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "users", fromUid, "friends", currentUid), {
    friendUid: currentUid,
    rid: requestId,
    createdAt: serverTimestamp(),
  });
  batch.delete(doc(db, "friendRequests", requestId));
  await batch.commit();
}

export async function declineFriendRequest(currentUid, fromUid) {
  if (!currentUid || !fromUid || currentUid === fromUid) return;
  await deleteDoc(doc(db, "friendRequests", rid(fromUid, currentUid)));
}

export async function removeFriend(a, b) {
  if (!a || !b || a === b) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", a, "friends", b));
  batch.delete(doc(db, "users", b, "friends", a));
  await batch.commit();
}
