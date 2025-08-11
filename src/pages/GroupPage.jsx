import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import GroupNewPost from "../components/groups/GroupNewPost";
import { useAuth } from "../context/AuthContext";

export default function GroupPage() {
  const { groupId } = useParams();
  const { currentUser } = useAuth();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  // Load group data
  useEffect(() => {
    const fetchGroup = async () => {
      const groupRef = doc(db, "groups", groupId);
      const snap = await getDoc(groupRef);
      if (snap.exists()) {
        const groupData = { id: snap.id, ...snap.data() };
        setGroup(groupData);
        setIsMember(groupData.members?.includes(currentUser?.uid) || false);
      }
      setLoading(false);
    };
    fetchGroup();
  }, [groupId, currentUser?.uid]);

  // Real-time posts in this group
  useEffect(() => {
    if (!groupId) return;
    const q = query(
      collection(db, "groupPosts"),
      where("groupId", "==", groupId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const postsArr = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(
        postsArr.sort(
          (a, b) => b.createdAt?.seconds - a.createdAt?.seconds
        )
      );
    });
    return () => unsub();
  }, [groupId]);

  const handleJoinLeave = async () => {
    if (!currentUser) return;
    const groupRef = doc(db, "groups", groupId);
    if (isMember) {
      await updateDoc(groupRef, {
        members: arrayRemove(currentUser.uid),
      });
      setIsMember(false);
    } else {
      await updateDoc(groupRef, {
        members: arrayUnion(currentUser.uid),
      });
      setIsMember(true);
    }
  };

  if (loading) return <p className="text-center mt-10">Loading group...</p>;
  if (!group) return <p className="text-center mt-10">Group not found.</p>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* Cover + Info */}
      {group.coverPhotoURL && (
        <img
          src={group.coverPhotoURL}
          alt={group.name}
          className="w-full h-48 object-cover rounded-lg"
        />
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-gray-600">{group.description}</p>
          <p className="text-sm text-gray-500">
            {group.members?.length || 0} members
          </p>
        </div>
        {currentUser && (
          <button
            onClick={handleJoinLeave}
            className={`px-4 py-2 rounded-lg ${
              isMember ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
            } text-white`}
          >
            {isMember ? "Leave Group" : "Join Group"}
          </button>
        )}
      </div>

      {/* New Post Box for Members */}
      {isMember && (
        <GroupNewPost groupId={groupId} currentUser={currentUser} />
      )}

      {/* Posts List */}
      <div className="space-y-4">
        {posts.length === 0 && (
          <p className="text-gray-500">No posts in this group yet.</p>
        )}
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-white p-4 rounded-lg shadow space-y-2"
          >
            <div className="flex items-center space-x-2">
              <img
                src={post.authorPhotoURL || "/default-avatar.png"}
                alt={post.author}
                className="w-8 h-8 rounded-full"
              />
              <p className="font-semibold">{post.author}</p>
            </div>
            <p>{post.content}</p>
            {post.imageURL && (
              <img
                src={post.imageURL}
                alt="Post"
                className="rounded-lg max-h-64 object-cover"
              />
            )}
            <Link
              to={`/groups/${groupId}/post/${post.id}`}
              className="text-blue-500 text-sm"
            >
              View Comments
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
