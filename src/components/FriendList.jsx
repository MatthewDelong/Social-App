// src/components/FriendList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, onSnapshot, doc } from "firebase/firestore";

const TTL_MS = 60000;   // user considered online if lastSeen < 60s
const TICK_MS = 15000;  // re-check every 15s

export default function FriendList({ uid }) {
  const [friends, setFriends] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let friendUnsubs = [];
    const unsub = onSnapshot(collection(db, "users", uid, "friends"), (snap) => {
      friendUnsubs.forEach((u) => u());
      friendUnsubs = [];
      const ids = snap.docs.map((d) => d.id);
      setFriends([]); // reset before re-adding subscriptions
      ids.forEach((friendUid) => {
        const u = onSnapshot(doc(db, "users", friendUid), (userSnap) => {
          const d = userSnap.data() || {};
          const lastSeenMs =
            d?.lastSeen?.toMillis?.() ??
            (d?.lastSeen?.seconds ? d.lastSeen.seconds * 1000 : 0);
          setFriends((prev) => {
            const others = prev.filter((p) => p.uid !== friendUid);
            return [
              ...others,
              {
                uid: friendUid,
                displayName: d.displayName || friendUid,
                photoURL: d.photoURL || null,
                lastSeenMs,
              },
            ];
          });
        });
        friendUnsubs.push(u);
      });
    });
    return () => {
      unsub && unsub();
      friendUnsubs.forEach((u) => u());
    };
  }, [uid]);

  const sortedFriends = useMemo(() => {
    const withOnline = friends.map((f) => ({
      ...f,
      online: f.lastSeenMs ? now - f.lastSeenMs < TTL_MS : false,
    }));
    const n = (s) => (s || "").toString().toLowerCase();
    return withOnline.sort((a, b) =>
      n(a.displayName || a.uid).localeCompare(n(b.displayName || b.uid))
    );
  }, [friends, now]);

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
              <Link
                key={f.uid}
                to={`/profile/${f.uid}`}
                className="group inline-flex flex-col items-center text-center min-h-[100px] w-full"
              >
                <div className="relative">
                  {f.photoURL ? (
                    <div className="w-16 h-16 border-2 border-black rounded-full overflow-hidden ring-1 ring-gray-200 group-hover:ring-gray-300">
                      <img
                        src={f.photoURL}
                        alt={f.displayName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200" />
                  )}
                  <span
                    title={f.online ? "Online" : "Offline"}
                    className={`absolute -bottom-0 -right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                      f.online ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  />
                </div>
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