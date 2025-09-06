import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { useAppContext } from "../context/AppContext";
import { acceptFriendRequest, declineFriendRequest, cancelFriendRequest } from "../lib/friends";

export default function FriendRequestsInbox({ currentUid: propUid, onToast }) {
  const { user } = useAppContext();
  const currentUid = propUid || user?.uid;
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const notify = (msg, type) => {
    if (onToast) onToast(msg, type);
  };

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

  if (!currentUid) return null;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Friend requests</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold mb-2">Incoming</h4>
          <ul className="divide-y rounded-md border">
            {incoming.map((r) => (
              <li key={r.id} className="p-3 flex items-center gap-3">
                {r.photoURL ? (
                  <img src={r.photoURL} alt={r.displayName} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                )}
                <span className="font-medium flex-1">{r.displayName}</span>
                <button
                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={async () => {
                    try {
                      await acceptFriendRequest(currentUid, r.fromUid);
                      notify("Friend request accepted", "success");
                    } catch (e) {
                      notify("Failed to accept request", "error");
                    }
                  }}
                >
                  Accept
                </button>
                <button
                  className="px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700"
                  onClick={async () => {
                    try {
                      await declineFriendRequest(currentUid, r.fromUid);
                      notify("Request declined", "info");
                    } catch (e) {
                      notify("Failed to decline request", "error");
                    }
                  }}
                >
                  Decline
                </button>
              </li>
            ))}
            {incoming.length === 0 && (
              <li className="p-3 text-gray-500">No incoming requests</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Sent</h4>
          <ul className="divide-y rounded-md border">
            {outgoing.map((r) => (
              <li key={r.id} className="p-3 flex items-center gap-3">
                {r.photoURL ? (
                  <img src={r.photoURL} alt={r.displayName} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                )}
                <span className="font-medium flex-1">{r.displayName}</span>
                <button
                  className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200"
                  onClick={async () => {
                    try {
                      await cancelFriendRequest(currentUid, r.toUid);
                      notify("Request canceled", "info");
                    } catch (e) {
                      notify("Failed to cancel request", "error");
                    }
                  }}
                >
                  Cancel
                </button>
              </li>
            ))}
            {outgoing.length === 0 && (
              <li className="p-3 text-gray-500">No sent requests</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
