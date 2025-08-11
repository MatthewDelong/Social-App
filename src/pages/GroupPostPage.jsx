import { useParams } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user } = useAppContext();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      const postDoc = await getDoc(doc(db, "groupPosts", postId));
      if (postDoc.exists()) {
        setPost({ id: postDoc.id, ...postDoc.data() });
      }
      setLoading(false);
    };
    fetchPost();
  }, [postId]);

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-2">{post.author}</h2>
      <p className="mb-4">{post.content}</p>
      <GroupComments postId={postId} currentUser={user} />
    </div>
  );
}
