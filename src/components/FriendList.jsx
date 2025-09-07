import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";

export default function FriendList({ uid }) {
  const [friends, setFriends] = useState([]);
  const [expanded, setExpanded] = useState(false);

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

  const sortedFriends = useMemo(() => {
    const n = (s) => (s || "").toString().toLowerCase();
    return [...friends].sort((a, b) => n(a.displayName || a.uid).localeCompare(n(b.displayName || b.uid)));
  }, [friends]);

  const visible = expanded ? sortedFriends : sortedFriends.slice(0, 6);

  if (!uid) return null;

  return (
    <div className="rounded-lg border bg-white pb-0 pt-4">
      {sortedFriends.length === 0 ? (
        <div className="text-gray-500">No friends yet</div>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-4 justify-items-center">
            {visible.map((f) => (
              <Link key={f.uid} to={`/profile/${f.uid}`} className="group inline-flex flex-col items-center text-center min-h-[100px] w-full">
                {f.photoURL ? (
                  <div className="w-16 h-16 border-2 border-black rounded-full overflow-hidden ring-1 ring-gray-200 group-hover:ring-gray-300">
                    <img src={f.photoURL} alt={f.displayName} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200" />
                )}
                <span className="mt-2 text-sm font-medium leading-tight text-gray-900 text-center truncate w-full">
                  {f.displayName || f.uid}
                </span>
              </Link>
            ))}
          </div>
          {sortedFriends.length > 6 && (
            <div className="mt-3 flex justify-center">
              <button
                className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-50"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
