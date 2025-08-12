import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, storage } from "../firebase";  // add storage import
import { getDownloadURL, ref } from "firebase/storage"; // add storage methods
import { useAppContext } from "../context/AppContext";
import GroupNewPost from "../components/groups/GroupNewPost";

export default function GroupPage() {
  const { groupId } = useParams();
  const { user } = useAppContext();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  // Load default avatar from storage once
  useEffect(() => {
    const loadDefaultAvatar = async () => {
      try {
        const defaultRef = ref(storage, "default-avatar.png");
        const url = await getDownloadURL(defaultRef);
        setDEFAULT_AVATAR(url);
      } catch (err) {
        console.error("Error loading default avatar:", err);
      }
    };
    loadDefaultAvatar();
  }, []);

  useEffect(() => {
    const fetchGroup = async () => {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        setGroup({ id: groupDoc.id, ...groupDoc.data() });
      }
    };
    fetchGroup();

    const q = query(
      collection(db, "groupPosts"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Fetch missing authorPhotoURL for posts if not present
      const updatedList = await Promise.all(
        list.map(async (post) => {
          if (!post.authorPhotoURL && post.uid) {
            try {
              const userDoc = await getDoc(doc(db, "users", post.uid));
              if (userDoc.exists()) {
                return { ...post, authorPhotoURL: userDoc.data().photoURL || "" };
              }
            } catch (err) {
              console.error("Error fetching user photoURL:", err);
            }
          }
          return post;
        })
      );

      setPosts(updatedList);
      setLoading(false);
    });

    return () => unsub();
  }, [groupId]);

  if (!group) return <p className="p-4">Group not found</p>;
  if (loading) return <p className="p-4">Loading posts...</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">{group.name}</h1>
      <p className="mb-4">{group.description}</p>

      <GroupNewPost groupId={groupId} currentUser={user} />

      <div className="space-y-4 mt-4">
        {posts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="border p-3 rounded flex items-center gap-3">
              <img
                src={post.authorPhotoURL || DEFAULT_AVATAR}
                alt={post.author}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="font-semibold">{post.author}</p>
                <p>{post.content}</p>
                <Link to={`/groups/${groupId}/post/${post.id}`} className="text-blue-500">
                  View Comments
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}