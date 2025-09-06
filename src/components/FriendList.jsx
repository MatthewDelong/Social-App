import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";

export default function FriendList({ uid }) {
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, "users", uid, "friends"), async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const friendUid = d.id;
          try {
            const userSnap = await getDoc(doc(db, "users", friendUid));
            const u = userSnap.exists() ? userSnap.data() : {};
            return { uid: friendUid, displayName: u.displayName || friendUid, photoURL: u.photoURL || null };
          } catch (e) {
            return { uid: friendUid };
          }
        })
      );
      setFriends(rows);
    });
    return () => unsub && unsub();
  }, [uid]);

  if (!uid) return null;

  return (
    <ul className="divide-y rounded-lg border bg-white">
      {friends.map((f) => (
        <li key={f.uid} className="p-0">
          <Link to={`/profile/${f.uid}`} className="flex items-center gap-3 p-3 hover:bg-gray-50">
            {f.photoURL ? (
              <img src={f.photoURL} alt={f.displayName} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200" />
            )}
            <span className="font-medium truncate">{f.displayName}</span>
          </Link>
        </li>
      ))}
      {friends.length === 0 && <li className="p-3 text-gray-500">No friends yet</li>}
    </ul>
  );
}
