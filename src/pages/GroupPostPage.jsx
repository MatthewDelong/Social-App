import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import Comments from "../components/Comments";

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const [post, setPost] = useState(null);

  useEffect(() => {
    getDoc(doc(db, "groupPosts", postId)).then(docSnap => {
      if (docSnap.exists()) setPost(docSnap.data());
    });
  }, [postId]);

  if (!post) return <div>Loading...</div>;

  return (
    <div>
      <h2>{post.content}</h2>
      {post.imageURL && <img src={post.imageURL} alt="" />}
      <Comments groupPostId={postId} />
    </div>
  );
}
