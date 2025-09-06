// src/pages/UserProfile.jsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import Card from "../components/ui/card";
import { useAppContext } from "../context/AppContext";
import { useFriendship } from "../hooks/useFriendship";
import FriendList from "../components/FriendList";
import FriendRequestsInbox from "../components/FriendRequestsInbox";
import Toaster from "../components/ui/Toaster";
import { useToasts } from "../hooks/useToasts";
import {
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "../lib/friends";

export default function UserProfile() {
  const { uid } = useParams();
  const { user } = useAppContext();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  const { toasts, pushToast, removeToast } = useToasts();

  const userId = uid || user?.uid;
  const targetUid = userId;
  const currentUid = user?.uid;
  const { state: friendState } = useFriendship(currentUid, targetUid);

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
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) setProfile(snap.data());
        else setProfile(null);

        const postsRef = collection(db, "posts");
        const qPosts = query(postsRef, where("uid", "==", userId));
        const postSnap = await getDocs(qPosts);
        setPosts(postSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        const allGroupsRef = collection(db, "groups");
        const allGroupsSnap = await getDocs(allGroupsRef);
        const userGroups = [];
        for (const groupDoc of allGroupsSnap.docs) {
          const groupData = { id: groupDoc.id, ...groupDoc.data() };
          const memberRef = doc(db, "groups", groupDoc.id, "members", userId);
          const memberSnap = await getDoc(memberRef);
          if (memberSnap.exists()) userGroups.push(groupData);
        }
        setGroups(userGroups);
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
      setLoading(false);
    };
    loadUserProfile();
  }, [userId]);

  const onSend = async () => {
    try {
      await sendFriendRequest(currentUid, targetUid);
      pushToast("Friend request sent");
    } catch (e) {
      pushToast("Failed to send request", "error");
    }
  };
  const onCancel = async () => {
    try {
      await cancelFriendRequest(currentUid, targetUid);
      pushToast("Request canceled", "info");
    } catch (e) {
      pushToast("Failed to cancel request", "error");
    }
  };
  const onAccept = async () => {
    try {
      await acceptFriendRequest(currentUid, targetUid);
      pushToast("Friend added");
    } catch (e) {
      pushToast("Failed to accept request", "error");
    }
  };
  const onDecline = async () => {
    try {
      await declineFriendRequest(currentUid, targetUid);
      pushToast("Request declined", "info");
    } catch (e) {
      pushToast("Failed to decline request", "error");
    }
  };
  const onRemove = async () => {
    try {
      await removeFriend(currentUid, targetUid);
      pushToast("Friend removed", "info");
    } catch (e) {
      pushToast("Failed to remove friend", "error");
    }
  };

  if (loading) return <p>Loading profile...</p>;
  if (!profile) return <p>User not found.</p>;

  return (
    <div className="max-w-2xl mx-auto mt-10 px-4 space-y-8">
      <div className="relative">
        {profile.bannerURL && (
          <div className="w-full h-40  border-4 border-white sm:h-56 md:h-64 overflow-hidden">
            <img src={profile.bannerURL} alt="Profile Banner" className="w-full h-full object-cover" />
          </div>
        )}
        <div className={`${profile.bannerURL ? "absolute -bottom-12 left-4" : "mb-4"}`}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg">
            <img src={profile.photoURL || DEFAULT_AVATAR} alt={profile.displayName} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      <div className={`bg-white border rounded-lg shadow-lg p-6 ${profile.bannerURL ? "mt-20 sm:mt-16" : "mt-0"}`}>
        <h2 className="text-2xl font-bold">{profile.displayName}</h2>
        {profile.bio && <p className="mt-2 text-gray-700">{profile.bio}</p>}
        {profile.location && <p className="mt-1 text-gray-600">{profile.location}</p>}
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noopener noreferrer" className="mt-1 block text-blue-500 hover:underline">
            {profile.website}
          </a>
        )}

        {currentUid && currentUid !== targetUid && (
          <div className="mt-4 flex flex-wrap gap-2">
            {friendState === "none" && (
              <button className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700" onClick={onSend}>
                Add friend
              </button>
            )}
            {friendState === "outgoing" && (
              <button className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200" onClick={onCancel}>
                Cancel request
              </button>
            )}
            {friendState === "incoming" && (
              <>
                <button className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" onClick={onAccept}>
                  Accept
                </button>
                <button className="px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700" onClick={onDecline}>
                  Decline
                </button>
              </>
            )}
            {friendState === "friends" && (
              <button className="px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700" onClick={onRemove}>
                Remove friend
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Friends</h3>
        <FriendList uid={userId} />
      </div>

      <div>
        <h3 className="text-xl w-auto font-bold mb-4">Groups I'm part of</h3>
        {groups.length === 0 && <p className="text-gray-500">Not a member of any groups yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <h4 className="font-bold text-lg">{group.name}</h4>
              {group.description && <p className="text-gray-600 text-sm">{group.description}</p>}
              <Link to={`/groups/${group.id}`} className="text-blue-500 hover:underline mt-2 block">
                View Group
              </Link>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Posts by {profile.displayName}</h3>
        {posts.length === 0 && <p className="text-gray-500">No posts yet.</p>}
        {posts.map((post) => (
          <Card key={post.id}>
            <div className="flex items-center space-x-2">
              <img src={profile.photoURL || DEFAULT_AVATAR} alt="Author" className="w-8 h-8 border-2 border-white rounded-full" />
              <p className="font-bold">{post.author}</p>
            </div>
            <p>{post.content}</p>
          </Card>
        ))}
      </div>

      <Toaster toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
