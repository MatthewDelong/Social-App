import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

export default function GroupList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAppContext();

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

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header with Create Group button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Groups</h2>
        {user && groups.length > 0 && (
          <Link
            to="/create-group"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
          >
            + Create Group
          </Link>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-gray-50 rounded-lg border">
          <p className="text-lg text-gray-600 mb-4">
            No groups yet — be the first to start one!
          </p>
          {user ? (
            <Link
              to="/create-group"
              className="px-5 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
            >
              + Create Your First Group
            </Link>
          ) : (
            <p className="text-sm text-gray-500">
              Log in to create and join groups.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => (
            <li
              key={group.id}
              className="border rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition bg-white"
            >
              {/* Group Logo */}
              <div className="w-16 h-16 flex-shrink-0 rounded-full overflow-hidden border">
                <img
                  src={group.logoURL || "/default-group-logo.png"}
                  alt={`${group.name} logo`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Group Info */}
              <div className="flex-1">
                <Link
                  to={`/groups/${group.id}`}
                  className="text-lg font-semibold text-blue-600 hover:underline"
                >
                  {group.name}
                </Link>
                <p className="text-gray-600 text-sm">{group.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}