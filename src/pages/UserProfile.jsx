// src/pages/UserProfile.jsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import Card from "../components/ui/card";
import { useAppContext } from "../context/AppContext"; // ✅ import context to get current user

export default function UserProfile() {
  const { uid } = useParams();
  const { user } = useAppContext(); // ✅ logged-in user
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  // ✅ choose which uid to load: param OR logged-in user
  const userId = uid || user?.uid;

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
      if (!userId) return;

      try {
        // Load user profile
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setProfile(null);
        }

        // Load user posts
        const postsRef = collection(db, "posts");
        const qPosts = query(postsRef, where("uid", "==", userId));
        const postSnap = await getDocs(qPosts);
        setPosts(postSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        // Load groups the user belongs to
        const allGroupsRef = collection(db, "groups");
        const allGroupsSnap = await getDocs(allGroupsRef);

        const userGroups = [];

        for (const groupDoc of allGroupsSnap.docs) {
          const groupData = { id: groupDoc.id, ...groupDoc.data() };

          const memberRef = doc(db, "groups", groupDoc.id, "members", userId);
          const memberSnap = await getDoc(memberRef);

          if (memberSnap.exists()) {
            userGroups.push(groupData);
          }
        }

        setGroups(userGroups);
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
      setLoading(false);
    };

    loadUserProfile();
  }, [userId]);

  if (loading) return <p>Loading profile...</p>;
  if (!profile) return <p>User not found.</p>;

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4 space-y-8">
      {/* Profile Header with Banner */}
      <div className="relative">
        {/* Banner */}
        {profile.bannerURL && (
          <div className="w-full h-40  border-4 border-white sm:h-56 md:h-64 overflow-hidden">
            <img
              src={profile.bannerURL}
              alt="Profile Banner"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Avatar overhang */}
        <div className={`${profile.bannerURL ? 'absolute -bottom-12 left-4' : 'mb-4'}`}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg">
            <img
              src={profile.photoURL || DEFAULT_AVATAR}
              alt={profile.displayName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className={`bg-white border rounded-lg shadow-lg p-6 ${profile.bannerURL ? 'mt-20 sm:mt-16' : 'mt-0'}`}>
        <h2 className="text-2xl font-bold">{profile.displayName}</h2>
        {profile.bio && <p className="mt-2 text-gray-700">{profile.bio}</p>}
        {profile.location && <p className="mt-1 text-gray-600">{profile.location}</p>}
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-blue-500 hover:underline"
          >
            {profile.website}
          </a>
        )}
      </div>

      {/* Groups Section */}
      <div>
        <h3 className="text-xl w-auto font-bold mb-4">Groups I'm part of</h3>
        {groups.length === 0 && <p className="text-gray-500">Not a member of any groups yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <h4 className="font-bold text-lg">{group.name}</h4>
              {group.description && (
                <p className="text-gray-600 text-sm">{group.description}</p>
              )}
              <Link
                to={`/groups/${group.id}`}
                className="text-blue-500 hover:underline mt-2 block"
              >
                View Group
              </Link>
            </Card>
          ))}
        </div>
      </div>

      {/* Posts Section */}
      <div>
        <h3 className="text-xl font-bold mb-4">Posts by {profile.displayName}</h3>
        {posts.length === 0 && <p className="text-gray-500">No posts yet.</p>}
        {posts.map((post) => (
          <Card key={post.id}>
            <div className="flex items-center space-x-2">
              <img
                src={profile.photoURL || DEFAULT_AVATAR}
                alt="Author"
                className="w-8 h-8 border-2 border-white rounded-full"
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