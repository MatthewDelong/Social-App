// src/pages/UserProfile.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import Card from "../components/ui/card";

export default function UserProfile() {
  const { uid } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

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
    const loadUserProfile = async () => {
      try {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setProfile(null);
        }

        const postsRef = collection(db, "posts");
        const q = query(postsRef, where("uid", "==", uid));
        const postSnap = await getDocs(q);
        setPosts(postSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
      setLoading(false);
    };

    if (uid) loadUserProfile();
  }, [uid]);

  if (loading) return <p>Loading profile...</p>;
  if (!profile) return <p>User not found.</p>;

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4 space-y-8">
      <div className="flex items-center space-x-4">
        <img
          src={profile.photoURL || DEFAULT_AVATAR}
          alt={profile.displayName}
          className="w-20 h-20 rounded-full object-cover"
        />
        <div>
          <h2 className="text-2xl font-bold">{profile.displayName}</h2>
          {profile.bio && <p>{profile.bio}</p>}
          {profile.location && <p className="text-gray-600">{profile.location}</p>}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {profile.website}
            </a>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Posts by {profile.displayName}</h3>
        {posts.length === 0 && <p className="text-gray-500">No posts yet.</p>}
        {posts.map((post) => (
          <Card key={post.id}>
            <div className="flex items-center space-x-2">
              <img
                src={post.authorPhotoURL || DEFAULT_AVATAR}
                alt="Author"
                className="w-8 h-8 rounded-full"
              />
              <p className="font-bold">{post.author}</p>
            </div>
            <p>{post.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}