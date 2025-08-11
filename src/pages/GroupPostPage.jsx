import { useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user } = useAppContext();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  // Load the default avatar once
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

  // Fetch the post and ensure avatar fallback
  useEffect(() => {
    if (!DEFAULT_AVATAR) return; // wait until default avatar is ready

    const fetchPost = async () => {
      const postDoc = await getDoc(doc(db, "groupPosts", postId));
      if (postDoc.exists()) {
        let data = { id: postDoc.id, ...postDoc.data() };

        // If no avatar stored, try fetching from users/{uid}
        if ((!data.authorPhotoURL || data.authorPhotoURL.trim() === "") && data.uid) {
          const userDoc = await getDoc(doc(db, "users", data.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.photoURL && userData.photoURL.trim() !== "") {
              data.authorPhotoURL = userData.photoURL;
            }
          }
        }

        // Final fallback to default avatar
        if (!data.authorPhotoURL || data.authorPhotoURL.trim() === "") {
          data.authorPhotoURL = DEFAULT_AVATAR;
        }

        setPost(data);
      }
      setLoading(false);
    };

    fetchPost();
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