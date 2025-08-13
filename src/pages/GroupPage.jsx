import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAppContext } from "../context/AppContext";
import GroupNewPost from "../components/groups/GroupNewPost";

export default function GroupPage() {
  const { groupId } = useParams();
  const { user } = useAppContext();

  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [DEFAULT_BANNER, setDEFAULT_BANNER] = useState("");
  const [DEFAULT_LOGO, setDEFAULT_LOGO] = useState("");

  const [isMember, setIsMember] = useState(false);
  const [members, setMembers] = useState([]);

  const isAdminOrMod = user?.isAdmin || user?.isModerator;

  // Load default images from storage
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const avatarRef = ref(storage, "default-avatar.png");
        const bannerRef = ref(storage, "default-banner.jpg");
        const logoRef = ref(storage, "default-group-logo.png");

        setDEFAULT_AVATAR(await getDownloadURL(avatarRef));
        setDEFAULT_BANNER(await getDownloadURL(bannerRef));
        setDEFAULT_LOGO(await getDownloadURL(logoRef));
      } catch (err) {
        console.error("Error loading default images:", err);
      }
    };
    loadDefaults();
  }, []);

  // Fetch group data, posts, and members
  useEffect(() => {
    const fetchGroup = async () => {
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        setGroup({ id: groupDoc.id, ...groupDoc.data() });
      }
    };
    fetchGroup();

    // Posts listener
    const postsQuery = query(
      collection(db, "groupPosts"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "desc")
    );

    const unsubPosts = onSnapshot(postsQuery, async (snapshot) => {
      const rawPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const enrichedPosts = await Promise.all(
        rawPosts.map(async (post) => {
          if (!post.authorPhotoURL && post.uid) {
            try {
              const userDoc = await getDoc(doc(db, "users", post.uid));
              if (userDoc.exists()) {
                return {
                  ...post,
                  authorPhotoURL: userDoc.data().photoURL || DEFAULT_AVATAR,
                };
              }
            } catch (err) {
              console.error("Error fetching user photoURL:", err);
            }
          }
          return post;
        })
      );

      setPosts(enrichedPosts);
      setLoading(false);
    });

    // Members fetch
    const fetchMembers = async () => {
      const membersCol = collection(db, "groups", groupId, "members");
      const snapshot = await getDocs(membersCol);
      setMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));

      if (user) {
        const memberRef = doc(db, "groups", groupId, "members", user.uid);
        const memberSnap = await getDoc(memberRef);
        setIsMember(memberSnap.exists());
      }
    };
    fetchMembers();

    return () => unsubPosts();
  }, [groupId, user, DEFAULT_AVATAR]);

  // Join group
  const joinGroup = async () => {
    if (!user) return;
    await setDoc(doc(db, "groups", groupId, "members", user.uid), {
      displayName: user.displayName || "Anonymous",
      photoURL: user.photoURL || DEFAULT_AVATAR,
      joinedAt: new Date(),
    });
    setIsMember(true);
    setMembers((prev) => [
      ...prev,
      {
        id: user.uid,
        displayName: user.displayName || "Anonymous",
        photoURL: user.photoURL || DEFAULT_AVATAR,
      },
    ]);
  };

  // Leave group
  const leaveGroup = async () => {
    if (!user) return;
    await deleteDoc(doc(db, "groups", groupId, "members", user.uid));
    setIsMember(false);
    setMembers((prev) => prev.filter((m) => m.id !== user.uid));
  };

  // Banner / logo uploader
  const handleImageUpload = async (type) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const storagePath = `groups/${groupId}/${type}-${Date.now()}.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "groups", groupId), { [type]: url });
        setGroup((prev) => ({ ...prev, [type]: url }));
      } catch (err) {
        console.error(`Error uploading ${type}:`, err);
      }
    };
    fileInput.click();
  };

  // Debug function for View Comments
  const handleViewComments = (post) => {
    const linkPath = `/groups/${groupId}/post/${post.id}`;
    console.log("Debug - View Comments clicked:");
    console.log("groupId:", groupId);
    console.log("post.id:", post.id);
    console.log("Full path:", linkPath);
    console.log("Post data:", post);
    
    // Try manual navigation
    window.location.href = linkPath;
  };

  if (!group) return <p className="p-4">Group not found</p>;
  if (loading) return <p className="p-4">Loading posts...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Banner & Logo */}
      <div className="relative">
        {/* Banner */}
        <div 
          className={`w-full h-40 sm:h-56 md:h-64 overflow-hidden relative ${
            isAdminOrMod ? 'cursor-pointer group' : ''
          }`}
          onClick={() => isAdminOrMod && handleImageUpload("bannerURL")}
        >
          <img
            src={group.bannerURL || DEFAULT_BANNER}
            alt={`${group.name} banner`}
            className="w-full h-full object-cover"
          />
          {/* Camera icon for banner - only show for admins/mods */}
          {isAdminOrMod && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20">
              <div className="w-12 h-12 rounded-full bg-gray-600 bg-opacity-70 flex items-center justify-center">
                <svg 
                  className="w-6 h-6 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2-2V9z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Logo overhang */}
        <div
          className={`absolute -bottom-12 left-4 ${
            isAdminOrMod ? 'cursor-pointer group' : ''
          }`}
          onClick={() => isAdminOrMod && handleImageUpload("logoURL")}
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg relative">
            <img
              src={group.logoURL || DEFAULT_LOGO}
              alt={`${group.name} logo`}
              className="w-full h-full object-cover"
            />
            {/* Camera icon for logo - only show for admins/mods */}
            {isAdminOrMod && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded-full">
                <div className="w-8 h-8 rounded-full bg-gray-600 bg-opacity-70 flex items-center justify-center">
                  <svg 
                    className="w-4 h-4 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2-2V9z" 
                    />
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name, Description, Join/Leave */}
      <div className="mt-20 sm:mt-16 p-4">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="mb-4">{group.description}</p>
        <div className="flex items-center gap-4 mb-4">
          {isMember ? (
            <button
              onClick={leaveGroup}
              className="px-4 py-2 bg-red-500 text-white rounded"
            >
              Leave Group
            </button>
          ) : (
            <button
              onClick={joinGroup}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Join Group
            </button>
          )}
          <span className="text-sm text-gray-600">
            {members.length} members
          </span>
        </div>
      </div>

      {/* New Post */}
      <GroupNewPost groupId={groupId} currentUser={user} />

      {/* Posts list - WITH DEBUGGING */}
      <div className="space-y-4 mt-4 p-4">
        {posts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="border p-3 rounded bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <img
                  src={post.authorPhotoURL || DEFAULT_AVATAR}
                  alt={post.author}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{post.author}</p>
                  <p className="mt-1 text-gray-800 break-words">{post.content}</p>
                  <div className="mt-2">
                    {/* Try both Link and button approaches */}
                    <div className="flex gap-2">
                      <Link
                        to={`/groups/${groupId}/post/${post.id}`}
                        className="text-blue-500 hover:text-blue-700 text-sm font-medium hover:underline"
                      >
                        View Comments (Link)
                      </Link>
                      <button
                        onClick={() => handleViewComments(post)}
                        className="text-green-500 hover:text-green-700 text-sm font-medium hover:underline"
                      >
                        View Comments (Button)
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Debug: groupId={groupId}, postId={post.id}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Members list */}
      <div className="mt-8 p-4 border rounded bg-white">
        <h2 className="text-lg font-semibold mb-3">Members</h2>
        <div className="flex flex-wrap gap-4">
          {members.map((m) => (
            <Link
              key={m.id}
              to={`/profile/${m.id}`}
              className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded transition-colors"
            >
              <img
                src={m.photoURL || DEFAULT_AVATAR}
                alt={m.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
              <span className="text-sm">{m.displayName}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}