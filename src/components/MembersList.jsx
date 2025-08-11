import { useEffect, useState } from "react";
import { doc, onSnapshot, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function MembersList({ groupId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to members array in real-time
    const unsub = onSnapshot(doc(db, "groups", groupId), async (docSnap) => {
      if (docSnap.exists()) {
        const { members: memberIds } = docSnap.data();
        if (memberIds.length) {
          // Fetch all member profiles (assuming you store them in "users")
          const q = query(collection(db, "users"), where("uid", "in", memberIds));
          const snap = await getDocs(q);
          setMembers(snap.docs.map(d => d.data()));
        } else {
          setMembers([]);
        }
      }
      setLoading(false);
    });

    return unsub;
  }, [groupId]);

  if (loading) return <div>Loading members...</div>;

  return (
    <div>
      <h3>Members ({members.length})</h3>
      {members.map(user => (
        <div key={user.uid} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
          <span>{user.displayName}</span>
        </div>
      ))}
    </div>
  );
}
