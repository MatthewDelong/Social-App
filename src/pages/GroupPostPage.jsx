import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useEffect, useState } from "react";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import EmojiPicker from 'emoji-picker-react';

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user, theme } = useAppContext();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [DEFAULT_BANNER, setDEFAULT_BANNER] = useState("");
  const [DEFAULT_LOGO, setDEFAULT_LOGO] = useState("");

  // Post editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  // Comments and replies state
  const [comments, setComments] = useState([]);
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
  const [showReplies, setShowReplies] = useState({});
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showReplyInputs, setShowReplyInputs] = useState({});
  const [usersMap, setUsersMap] = useState({});

  const isAdminOrMod = user?.isAdmin || user?.isModerator;

  // Safe date formatting function
  const safeFormatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      let date;
      if (typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      } else if (dateValue?.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return "";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "";
    }
  };

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

  // Fetch users data
  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data();
    });
    setUsersMap(map);
  };

  // Fetch post, group, and comments data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      // Fetch post
      const postDoc = await getDoc(doc(db, "groupPosts", postId));
      if (postDoc.exists()) {
        let data = { id: postDoc.id, ...postDoc.data() };

        // If no avatar stored, try fetching from users/{uid}
        if (!data.authorPhotoURL && data.uid) {
          const userDoc = await getDoc(doc(db, "users", data.uid));
          if (userDoc.exists()) {
            data.authorPhotoURL = userDoc.data().photoURL || "";
          }
        }

        setPost(data);
      }

      // Fetch group data for banner and logo
      if (groupId) {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          setGroup({ id: groupDoc.id, ...groupDoc.data() });
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [postId, groupId]);

  // Fetch comments
  useEffect(() => {
    fetchUsers();
    const q = query(collection(db, `groupPosts/${postId}/comments`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        replies: [],
        ...d.data()
      }));
      setComments(docs);
    });
    return () => unsub();
  }, [postId]);

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  // Determine permissions
  const isOwner = user && post.uid === user.uid;
  const isAdmin = user?.isAdmin;
  const isModerator = user?.isModerator;
  const canEditOrDelete = isOwner || isAdmin || isModerator;

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

  // Post handlers
  const startEdit = () => {
    setEditContent(post.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupPosts", post.id), {
      content: editContent.trim(),
      editedAt: new Date(),
    });
    setPost((prev) => ({ ...prev, content: editContent.trim() }));
    setIsEditing(false);
    setEditContent("");
  };

  const deletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    await deleteDoc(doc(db, "groupPosts", post.id));
    navigate(-1);
  };

  // Comment handlers
  const handleComment = async () => {
    const comment = commentMap[postId];
    if (!comment?.trim()) return;
    
    const newComment = {
      text: comment,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString(),
      replies: []
    };

    await addDoc(collection(db, `groupPosts/${postId}/comments`), newComment);
    setCommentMap((prev) => ({ ...prev, [postId]: '' }));
    setShowCommentInput(false);
  };

  const handleReply = async (commentId, commentIndex) => {
    const replyKey = `${commentId}-reply`;
    const replyText = commentMap[replyKey];
    if (!replyText?.trim()) return;

    const reply = {
      text: replyText,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString()
    };

    await updateDoc(doc(db, `groupPosts/${postId}/comments`, commentId), {
      replies: [...(comments[commentIndex].replies || []), reply]
    });

    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
    setShowReplyInputs((prev) => ({ ...prev, [commentId]: false }));
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    await deleteDoc(doc(db, `groupPosts/${postId}/comments`, commentId));
  };

  const handleEditComment = async (commentId, index) => {
    const newText = editCommentMap[commentId];
    if (!newText?.trim()) return;
    
    await updateDoc(doc(db, `groupPosts/${postId}/comments`, commentId), {
      text: newText
    });
    setEditCommentMap((prev) => ({ ...prev, [commentId]: '' }));
  };

  const handleDeleteReply = async (commentId, replyIndex) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const updatedReplies = [...comment.replies];
    updatedReplies.splice(replyIndex, 1);

    await updateDoc(doc(db, `groupPosts/${postId}/comments`, commentId), {
      replies: updatedReplies
    });
  };

  const handleEditReply = async (commentId, replyIndex) => {
    const key = `${commentId}-${replyIndex}`;
    const newText = editReplyMap[key];
    if (!newText?.trim()) return;

    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const updatedReplies = [...comment.replies];
    updatedReplies[replyIndex].text = newText;

    await updateDoc(doc(db, `groupPosts/${postId}/comments`, commentId), {
      replies: updatedReplies
    });

    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: "" }));
  };

  const toggleShowReplies = (commentId) => {
    setShowReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const toggleReplyInput = (commentId) => {
    setShowReplyInputs(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const addEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || '') + emoji.emoji
    }));
    setShowEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  const addReplyEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || '') + emoji.emoji
    }));
    setShowReplyEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  const goToProfile = (uid) => {
    if (!uid) return;
    navigate(`/profile/${uid}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Group Banner & Logo */}
      {group && (
        <div className="relative">
          {/* Banner */}
          <div 
            className="w-full h-40 sm:h-56 md:h-64 overflow-hidden cursor-pointer relative group"
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
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
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
            className="absolute -bottom-12 left-4 cursor-pointer group"
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
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
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
      )}

      {/* Content */}
      <div className="mt-20 sm:mt-16 p-4">
        {/* Group name as link back to group */}
        {group && (
          <Link 
            to={`/groups/${groupId}`}
            className="text-2xl font-bold text-gray-800 hover:underline block mb-4"
          >
            {group.name}
          </Link>
        )}

        {/* Post author info */}
        <div className="flex items-center space-x-3 mb-4">
          <img
            src={post.authorPhotoURL || DEFAULT_AVATAR}
            alt={post.author}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            onClick={() => goToProfile(post.uid)}
          />
          <div className="flex-1">
            <h2 
              className="text-xl font-bold break-words cursor-pointer"
              onClick={() => goToProfile(post.uid)}
            >
              {post.author}
              {usersMap[post.uid]?.isAdmin && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
              )}
              {usersMap[post.uid]?.isModerator && (
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>
              )}
            </h2>
            {post.createdAt && (
              <p className="text-sm text-gray-500">
                {safeFormatDate(post.createdAt)}
              </p>
            )}
          </div>
        </div>

        {/* Post content */}
        {isEditing ? (
          <div className="mb-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full p-2 border rounded resize-none break-words"
            />
            <div className="mt-2 space-x-2">
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mb-4 whitespace-pre-wrap break-words">{post.content}</p>
        )}

        {/* Edit/Delete buttons */}
        {canEditOrDelete && !isEditing && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={startEdit}
              className="text-xs bg-yellow-500 text-black-800 px-2 py-0.5 rounded"
            >
              Edit
            </button>
            <button
              onClick={deletePost}
              className="text-xs bg-red-500 text-black-800 px-2 py-0.5 rounded"
            >
              Delete
            </button>
          </div>
        )}

        {/* Comments section */}
        <div className="mt-6">
          <button
            onClick={() => setShowCommentInput(!showCommentInput)}
            className="text-sm text-blue-600 hover:underline mb-4"
          >
            {showCommentInput ? 'Cancel' : 'Add Comment'}
          </button>

          {/* Comment Input */}
          {showCommentInput && (
            <div className="mb-6 flex items-start space-x-2">
              <img
                src={user?.photoURL || DEFAULT_AVATAR}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1 relative">
                <textarea
                  placeholder="Write a comment..."
                  value={commentMap[postId] || ''}
                  onChange={(e) =>
                    setCommentMap((prev) => ({
                      ...prev,
                      [postId]: e.target.value
                    }))
                  }
                  className="border p-2 w-full rounded text-sm"
                  rows="2"
                />
                <div className="flex justify-between mt-1">
                  <button
                    onClick={() => 
                      setShowEmojiPicker(prev => ({
                        ...prev,
                        [postId]: !prev[postId]
                      }))
                    }
                    className="text-xs bg-gray-200 px-2 py-1 rounded"
                  >
                    😀
                  </button>
                  <button
                    onClick={handleComment}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    Post
                  </button>
                </div>
                {showEmojiPicker[postId] && (
                  <div className="absolute bottom-10 left-0 z-10">
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(prev => ({...prev, [postId]: false}))}
                        className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        X
                      </button>
                      <EmojiPicker
                        width={300}
                        height={350}
                        onEmojiClick={(emoji) => addEmoji(postId, emoji)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {comments.map((comment, i) => {
              const commentUser = usersMap[comment.uid];
              const commentAvatar = commentUser?.photoURL || DEFAULT_AVATAR;
              const hasReplies = comment.replies && comment.replies.length > 0;
              const isShowingReplies = showReplies[comment.id];
              const isShowingReplyInput = showReplyInputs[comment.id];
              
              return (
                <div key={comment.id} className="border-t pt-4">
                  <div className="flex items-start space-x-2">
                    <img
                      src={commentAvatar}
                      alt="avatar"
                      className="w-8 h-8 rounded-full object-cover cursor-pointer"
                      onClick={() => goToProfile(comment.uid)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p
                          className="font-semibold text-gray-800 cursor-pointer"
                          onClick={() => goToProfile(comment.uid)}
                        >
                          {commentUser?.displayName || comment.author}
                          {commentUser?.isAdmin && (
                            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">Admin</span>
                          )}
                          {commentUser?.isModerator && (
                            <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">Moderator</span>
                          )}
                        </p>
                        <span className="text-xs text-gray-500">
                          {safeFormatDate(comment.createdAt)}
                        </span>
                      </div>

                      {editCommentMap[comment.id] !== undefined ? (
                        <div className="mt-1">
                          <textarea
                            value={editCommentMap[comment.id]}
                            onChange={(e) =>
                              setEditCommentMap((prev) => ({
                                ...prev,
                                [comment.id]: e.target.value
                              }))
                            }
                            className="border p-1 w-full rounded"
                          />
                          <div className="space-x-2 mt-1">
                            <button
                              onClick={() => handleEditComment(comment.id, i)}
                              className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditCommentMap(prev => {
                                const newMap = {...prev};
                                delete newMap[comment.id];
                                return newMap;
                              })}
                              className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-900 mt-1">{comment.text}</p>
                      )}

                      <div className="flex space-x-3 mt-1 text-xs">
                        {(comment.uid === user?.uid || isAdmin || isModerator) &&
                          editCommentMap[comment.id] === undefined && (
                            <>
                              <button
                                onClick={() =>
                                  setEditCommentMap((prev) => ({
                                    ...prev,
                                    [comment.id]: comment.text
                                  }))
                                }
                                className="text-blue-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-red-500 hover:underline"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        <button
                          onClick={() => toggleReplyInput(comment.id)}
                          className="text-blue-600 hover:underline"
                        >
                          Reply
                        </button>
                        {hasReplies && (
                          <button
                            onClick={() => toggleShowReplies(comment.id)}
                            className="text-blue-600 hover:underline"
                          >
                            {isShowingReplies ? 'Hide replies' : `View replies (${comment.replies.length})`}
                          </button>
                        )}
                      </div>

                      {/* Reply Input */}
                      {isShowingReplyInput && (
                        <div className="mt-3 ml-4 flex items-start space-x-2">
                          <img
                            src={user?.photoURL || DEFAULT_AVATAR}
                            alt="avatar"
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <div className="flex-1 relative">
                            <textarea
                              placeholder="Write a reply..."
                              value={commentMap[`${comment.id}-reply`] || ''}
                              onChange={(e) =>
                                setCommentMap((prev) => ({
                                  ...prev,
                                  [`${comment.id}-reply`]: e.target.value
                                }))
                              }
                              className="border p-1 w-full rounded text-sm"
                            />
                            <div className="flex justify-between mt-1">
                              <button
                                onClick={() => 
                                  setShowReplyEmojiPicker(prev => ({
                                    ...prev,
                                    [`${comment.id}-reply`]: !prev[`${comment.id}-reply`]
                                  }))
                                }
                                className="text-xs bg-gray-200 px-2 py-0.5 rounded"
                              >
                                😀
                              </button>
                              <div className="space-x-2">
                                <button
                                  onClick={() => toggleReplyInput(comment.id)}
                                  className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleReply(comment.id, i)}
                                  className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
                                >
                                  Post
                                </button>
                              </div>
                            </div>
                            {showReplyEmojiPicker[`${comment.id}-reply`] && (
                              <div className="absolute bottom-10 left-0 z-10">
                                <div className="relative">
                                  <button
                                    onClick={() => setShowReplyEmojiPicker(prev => ({
                                      ...prev,
                                      [`${comment.id}-reply`]: false
                                    }))}
                                    className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                                  >
                                    X
                                  </button>
                                  <EmojiPicker
                                    width={300}
                                    height={350}
                                    onEmojiClick={(emoji) => addReplyEmoji(`${comment.id}-reply`, emoji)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Replies Section */}
                      {isShowingReplies && (
                        <div className="mt-3 ml-4 space-y-3">
                          {comment.replies.map((reply, ri) => {
                            const replyUser = usersMap[reply.uid];
                            const replyAvatar = replyUser?.photoURL || DEFAULT_AVATAR;
                            const replyEditKey = `${comment.id}-${ri}`;
                            return (
                              <div key={ri} className="flex items-start space-x-2">
                                <img
                                  src={replyAvatar}
                                  alt="avatar"
                                  className="w-6 h-6 rounded-full object-cover cursor-pointer"
                                  onClick={() => goToProfile(reply.uid)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <p
                                      className="font-semibold text-gray-800 cursor-pointer text-sm"
                                      onClick={() => goToProfile(reply.uid)}
                                    >
                                      {replyUser?.displayName || reply.author}
                                      {replyUser?.isAdmin && (
                                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-1 py-0.5 rounded">Admin</span>
                                      )}
                                      {replyUser?.isModerator && (
                                        <span className="ml-2 bg-green-100 text-green-800 text-xs px-1 py-0.5 rounded">Moderator</span>
                                      )}
                                    </p>
                                    <span className="text-xs text-gray-500">
                                      {safeFormatDate(reply.createdAt)}
                                    </span>
                                  </div>

                                  {editingReplyIndexMap[replyEditKey] ? (
                                    <div className="mt-1">
                                      <textarea
                                        value={editReplyMap[replyEditKey]}
                                        onChange={(e) =>
                                          setEditReplyMap((prev) => ({
                                            ...prev,
                                            [replyEditKey]: e.target.value
                                          }))
                                        }
                                        className="border p-1 w-full rounded text-sm"
                                      />
                                      <div className="space-x-2 mt-1">
                                        <button
                                          onClick={() => handleEditReply(comment.id, ri)}
                                          className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingReplyIndexMap(prev => {
                                            const newMap = {...prev};
                                            delete newMap[replyEditKey];
                                            return newMap;
                                          })}
                                          className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-gray-900 text-sm mt-1">{reply.text}</p>
                                  )}

                                  {(reply.uid === user?.uid || isAdmin || isModerator) &&
                                    !editingReplyIndexMap[replyEditKey] && (
                                      <div className="space-x-2 mt-1 text-xs">
                                        <button
                                          onClick={() => {
                                            setEditingReplyIndexMap((prev) => ({
                                              ...prev,
                                              [replyEditKey]: true
                                            }));
                                            setEditReplyMap((prev) => ({
                                              ...prev,
                                              [replyEditKey]: reply.text
                                            }));
                                          }}
                                          className="text-blue-600 hover:underline"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteReply(comment.id, ri)}
                                          className="text-red-500 hover:underline"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}