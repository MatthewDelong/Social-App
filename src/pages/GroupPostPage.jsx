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
  const [avatarUrl, setAvatarUrl] = useState("");

  // Load default avatar
  useEffect(() => {
    const loadDefaultAvatar = async () => {
      try {
        const defaultRef = ref(storage, "default-avatar.png");
        const url = await getDownloadURL(defaultRef);
        setDEFAULT_AVATAR(url);
        setAvatarUrl(url); // Initialize avatarUrl with default
      } catch (err) {
        console.error("Error loading default avatar:", err);
      }
    };
    loadDefaultAvatar();
  }, []);

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postDoc = await getDoc(doc(db, "groupPosts", postId));
        if (postDoc.exists()) {
          let data = { id: postDoc.id, ...postDoc.data() };
          console.log("Original post data:", data); // Debug log

          // If no avatar in post, try to get from user profile
          if (!data.authorPhotoURL && data.uid) {
            const userDoc = await getDoc(doc(db, "users", data.uid));
            console.log("User doc exists?", userDoc.exists()); // Debug log
            if (userDoc.exists()) {
              console.log("User photoURL:", userDoc.data().photoURL); // Debug log
              data.authorPhotoURL = userDoc.data().photoURL || "";
            }
          }

          console.log("Final data with photo:", data); // Debug log
          setPost(data);
        } else {
          setPost(null);
        }
      } catch (err) {
        console.error("Error fetching post:", err);
        setPost(null);
      }
      setLoading(false);
    };
    fetchPost();
  }, [postId]);

  // Handle avatar loading
  useEffect(() => {
    const loadAvatar = async () => {
      if (!post || !DEFAULT_AVATAR) return;
      
      try {
        let urlToUse = DEFAULT_AVATAR;
        
        // If there's an authorPhotoURL
        if (post.authorPhotoURL) {
          // Check if it's a storage path (starts with 'gs://')
          if (post.authorPhotoURL.startsWith('gs://')) {
            urlToUse = await getDownloadURL(ref(storage, post.authorPhotoURL));
          } 
          // Check if it's already a URL
          else if (post.authorPhotoURL.startsWith('http')) {
            urlToUse = post.authorPhotoURL;
          }
          // Check if it's a storage path without gs:// prefix
          else if (post.authorPhotoURL.startsWith('images/')) {
            urlToUse = await getDownloadURL(ref(storage, post.authorPhotoURL));
          }
        }
        
        setAvatarUrl(urlToUse);
      } catch (err) {
        console.error("Error loading avatar:", err);
        setAvatarUrl(DEFAULT_AVATAR);
      }
    };

    loadAvatar();
  }, [post, DEFAULT_AVATAR]);

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center space-x-3 mb-4">
        <img
          src={avatarUrl}
          alt={post.author}
          className="w-10 h-10 rounded-full object-cover"
          onError={() => setAvatarUrl(DEFAULT_AVATAR)}
        />
        <h2 className="text-xl font-bold">{post.author}</h2>
      </div>
      <p className="mb-4">{post.content}</p>
      <GroupComments postId={postId} currentUser={user} />
    </div>
  );
}

// Optional: SafeImage component alternative
function SafeImage({ src, alt, className, fallback }) {
  const [imgSrc, setImgSrc] = useState(src);
  
  const handleError = () => {
    setImgSrc(fallback);
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}