import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";

export default function GroupList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setGroups(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <p className="p-4">Loading groups...</p>;
  if (!groups.length) return <p className="p-4">No groups found.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Groups</h2>
      <ul className="space-y-2">
        {groups.map((group) => (
          <li key={group.id} className="border p-2 rounded">
            <Link to={`/groups/${group.id}`} className="text-blue-600">
              <strong>{group.name}</strong> - {group.description}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
