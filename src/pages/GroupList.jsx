import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function GroupsList() {
  const [groups, setGroups] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const groupsArr = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(groupsArr);
    });
    return () => unsub();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Groups</h1>
        {currentUser && (
          <button
            onClick={() => navigate("/groups/new")}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Create Group
          </button>
        )}
      </div>

      {/* Groups Grid */}
      {groups.length === 0 && (
        <p className="text-gray-500">No groups available yet.</p>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        {groups.map((group) => (
          <Link
            to={`/groups/${group.id}`}
            key={group.id}
            className="block bg-white rounded-lg shadow hover:shadow-md transition overflow-hidden"
          >
            {group.coverPhotoURL && (
              <img
                src={group.coverPhotoURL}
                alt={group.name}
                className="w-full h-32 object-cover"
              />
            )}
            <div className="p-4">
              <h2 className="text-lg font-semibold">{group.name}</h2>
              <p className="text-gray-600 text-sm line-clamp-2">
                {group.description}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {group.members?.length || 0} members
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
