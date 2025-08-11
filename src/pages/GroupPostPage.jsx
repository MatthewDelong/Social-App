import { useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user } = useAppContext();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  // Load default avatar
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

  // Live fetch post + ensure avatar fallback
  useEffect(() => {
    if (!DEFAULT_AVATAR) return;

    const postRef = doc(db, "groupPosts", postId);
    const unsubscribe = onSnapshot(postRef, async (postSnap) => {
      if (postSnap.exists()) {
        let data = { id: postSnap.id, ...postSnap.data() };

        // If missing avatar, try from users/{uid}
        if ((!data.authorPhotoURL || data.authorPhotoURL.trim() === "") && data.uid) {
          const userDoc = await getDoc(doc(db, "users", data.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.photoURL && userData.photoURL.trim() !== "") {
              data.authorPhotoURL = userData.photoURL;
            }
          }
        }

        // Final fallback to default
        if (!data.authorPhotoURL || data.authorPhotoURL.trim() === "") {
          data.authorPhotoURL = DEFAULT_AVATAR;
        }

        setPost(data);
      } else {
        setPost(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [postId, DEFAULT_AVATAR]);

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center space-x-3 mb-4">
        <img
          src={post.authorPhotoURL}
          alt={post.author}
          className="w-10 h-10 rounded-full object-cover"
        />
        <h2 className="text-xl font-bold">{post.author}</h2>
      </div>
      <p className="mb-4">{post.content}</p>
      <GroupComments postId={postId} currentUser={user} />
    </div>
  );
}