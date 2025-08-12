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

  const isAdminOrMod = user?.isAdmin || user?.isModerator;

  // Load defaults once
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

  // Fetch group & posts
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

      const updatedList = await Promise.all(
        list.map(async (post) => {
          if (!post.authorPhotoURL && post.uid) {
            try {
              const userDoc = await getDoc(doc(db, "users", post.uid));
              if (userDoc.exists()) {
                return {
                  ...post,
                  authorPhotoURL: userDoc.data().photoURL || "",
                };
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

  // Image uploader for banner/logo
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

  if (!group) return <p className="p-4">Group not found</p>;
  if (loading) return <p className="p-4">Loading posts...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Banner & Logo Section */}
      <div className="relative">
        {/* Banner */}
        <div className="w-full h-40 sm:h-56 md:h-64 overflow-hidden cursor-pointer">
          <img
            src={group.bannerURL || DEFAULT_BANNER}
            alt={`${group.name} banner`}
            className="w-full h-full object-cover"
            onClick={() => isAdminOrMod && handleImageUpload("bannerURL")}
          />
        </div>

        {/* Logo Overhang */}
        <div
          className="absolute -bottom-12 left-4 cursor-pointer"
          onClick={() => isAdminOrMod && handleImageUpload("logoURL")}
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg">
            <img
              src={group.logoURL || DEFAULT_LOGO}
              alt={`${group.name} logo`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Group Name and Description */}
      <div className="mt-16 p-4">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="mb-4">{group.description}</p>
      </div>

      {/* New Post */}
      <GroupNewPost groupId={groupId} currentUser={user} />

      {/* Posts List */}
      <div className="space-y-4 mt-4 p-4">
        {posts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="border p-3 rounded flex items-center gap-3"
            >
              <img
                src={post.authorPhotoURL || DEFAULT_AVATAR}
                alt={post.author}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="font-semibold">{post.author}</p>
                <p>{post.content}</p>
                <Link
                  to={`/groups/${groupId}/post/${post.id}`}
                  className="text-blue-500"
                >
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