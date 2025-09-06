import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAppContext } from "../../context/AppContext";
import { acceptFriendRequest, declineFriendRequest, cancelFriendRequest } from "../../lib/friends";
import { useToasts } from "../../hooks/useToasts";
import Toaster from "../ui/Toaster";
import { FiBell } from "react-icons/fi";

export default function FriendRequestsMenu() {
  const { user } = useAppContext();
  const currentUid = user?.uid;
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { toasts, pushToast, removeToast } = useToasts();

  useEffect(() => {
    if (!currentUid) return;
    const incQ = query(collection(db, "friendRequests"), where("toUid", "==", currentUid));
    const outQ = query(collection(db, "friendRequests"), where("fromUid", "==", currentUid));

    const unsubInc = onSnapshot(incQ, async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          try {
            const uSnap = await getDoc(doc(db, "users", data.fromUid));
            const u = uSnap.exists() ? uSnap.data() : {};
            return { id: d.id, fromUid: data.fromUid, toUid: data.toUid, displayName: u.displayName || data.fromUid, photoURL: u.photoURL || null };
          } catch (_) {
            return { id: d.id, fromUid: data.fromUid, toUid: data.toUid, displayName: data.fromUid };
          }
        })
      );
      setIncoming(rows);
    });

    const unsubOut = onSnapshot(outQ, async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          try {
            const uSnap = await getDoc(doc(db, "users", data.toUid));
            const u = uSnap.exists() ? uSnap.data() : {};
            return { id: d.id, fromUid: data.fromUid, toUid: data.toUid, displayName: u.displayName || data.toUid, photoURL: u.photoURL || null };
          } catch (_) {
            return { id: d.id, fromUid: data.fromUid, toUid: data.toUid, displayName: data.toUid };
          }
        })
      );
      setOutgoing(rows);
    });

    return () => {
      unsubInc && unsubInc();
      unsubOut && unsubOut();
    };
  }, [currentUid]);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const badgeCount = useMemo(() => incoming.length, [incoming.length]);

  if (!currentUid) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="relative inline-flex items-center gap-2 rounded-full border border-white/30 bg-transparent px-3.5 py-1.5 text-sm hover:bg-white/10 transition"
        onClick={() => setOpen((v) => !v)}
        aria-label="Friend requests"
      >
        <FiBell className="w-5 h-5" />
        <span className="hidden md:inline">Requests</span>
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-xl border border-white/10 bg-white/90 backdrop-blur-md shadow-2xl text-gray-900">
          <div className="p-3 border-b border-gray-100">
            <div className="text-sm font-semibold">Incoming</div>
          </div>
          <ul className="max-h-60 overflow-auto divide-y divide-gray-100">
            {incoming.length === 0 && (
              <li className="p-3 text-sm text-gray-600">No incoming requests</li>
            )}
            {incoming.map((r) => (
              <li key={r.id} className="p-3 flex items-center gap-3">
                {r.photoURL ? (
                  <img src={r.photoURL} alt={r.displayName} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.displayName}</div>
                </div>
                <button
                  className="px-2 py-1 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                  onClick={async () => {
                    try {
                      await acceptFriendRequest(currentUid, r.fromUid);
                      pushToast("Friend request accepted");
                    } catch (e) {
                      pushToast("Failed to accept request", "error");
                    }
                  }}
                >
                  Accept
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-rose-600 text-white text-xs hover:bg-rose-700"
                  onClick={async () => {
                    try {
                      await declineFriendRequest(currentUid, r.fromUid);
                      pushToast("Request declined", "info");
                    } catch (e) {
                      pushToast("Failed to decline request", "error");
                    }
                  }}
                >
                  Decline
                </button>
              </li>
            ))}
          </ul>
          <div className="p-3 border-t border-gray-100">
            <div className="text-sm font-semibold mb-2">Sent</div>
            <ul className="max-h-48 overflow-auto divide-y divide-gray-100">
              {outgoing.length === 0 && (
                <li className="p-3 text-sm text-gray-600">No sent requests</li>
              )}
              {outgoing.map((r) => (
                <li key={r.id} className="p-3 flex items-center gap-3">
                  {r.photoURL ? (
                    <img src={r.photoURL} alt={r.displayName} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.displayName}</div>
                  </div>
                  <button
                    className="px-2 py-1 rounded-md bg-gray-100 text-gray-900 text-xs hover:bg-gray-200"
                    onClick={async () => {
                      try {
                        await cancelFriendRequest(currentUid, r.toUid);
                        pushToast("Request canceled", "info");
                      } catch (e) {
                        pushToast("Failed to cancel request", "error");
                      }
                    }}
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Toaster toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
