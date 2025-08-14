import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import EmojiPicker from "emoji-picker-react";

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [DEFAULT_BANNER, setDEFAULT_BANNER] = useState("");
  const [DEFAULT_LOGO, setDEFAULT_LOGO] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  // Comment/reply states
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
  const [showReplies, setShowReplies] = useState({});
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showReplyInputs, setShowReplyInputs] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});

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

  // Fetch post and group data from Firestore
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

  if (loading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  // Determine permissions
  const isOwner = user && post.uid === user.uid;
  const isAdmin = user?.isAdmin;
  const isModerator = user?.isModerator;
  const canEditOrDelete = isOwner || isAdmin || isModerator;

  // Format post date
  const formatPostDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
    } catch (err) {
      console.error("Error formatting date:", err);
      return "";
    }
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
    navigate(-1); // Go back after deleting
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
    
    const updatedComments = [...(post.comments || []), newComment];
    await updateDoc(doc(db, "groupPosts", postId), { comments: updatedComments });
    setPost((prev) => ({ ...prev, comments: updatedComments }));
    setCommentMap((prev) => ({ ...prev, [postId]: '' }));
    setShowCommentInput(false);
  };

  const handleReply = async (commentIndex) => {
    const replyKey = `${postId}-reply-${commentIndex}`;
    const replyText = commentMap[replyKey];
    if (!replyText?.trim()) return;
    
    const reply = {
      text: replyText,
      author: user.displayName || user.email || 'Unknown User',
      uid: user.uid,
      role: user.role || 'user',
      createdAt: new Date().toISOString()
    };
    
    const updatedComments = [...(post.comments || [])];
    if (!updatedComments[commentIndex].replies) {
      updatedComments[commentIndex].replies = [];
    }
    
    updatedComments[commentIndex].replies = [
      ...updatedComments[commentIndex].replies,
      reply
    ];
    
    await updateDoc(doc(db, "groupPosts", postId), { comments: updatedComments });
    setPost((prev) => ({ ...prev, comments: updatedComments }));
    setCommentMap((prev) => ({ ...prev, [replyKey]: '' }));
    setShowReplyInputs((prev) => ({ ...prev, [`${postId}-${commentIndex}`]: false }));
  };

  const handleDeleteComment = async (index) => {
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, "groupPosts", postId), { comments: updatedComments });
    setPost((prev) => ({ ...prev, comments: updatedComments }));
  };

  const handleEditComment = async (index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, "groupPosts", postId), { comments: updatedComments });
    setPost((prev) => ({ ...prev, comments: updatedComments }));
    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: '' }));
  };

  const handleDeleteReply = async (commentIndex, replyIndex) => {
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies.splice(replyIndex, 1);
    await updateDoc(doc(db, "groupPosts", postId), { comments: updatedComments });
    setPost((prev) => ({ ...prev, comments: updatedComments }));
  };

  const handleEditReply = async (commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const newText = editReplyMap[key];
    if (!newText?.trim()) return;
    
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies[replyIndex].text = newText;
    await updateDoc(doc(db, "groupPosts", postId), { comments: updatedComments });
    setPost((prev) => ({ ...prev, comments: updatedComments }));
    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: "" }));
  };

  const toggleShowReplies = (commentIndex) => {
    const key = `${postId}-${commentIndex}`;
    setShowReplies(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleReplyInput = (commentIndex) => {
    const key = `${postId}-${commentIndex}`;
    setShowReplyInputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const addEmoji = (emoji) => {
    setCommentMap(prev => ({
      ...prev,
      [postId]: (prev[postId] || '') + emoji.emoji
    }));
    setShowEmojiPicker(false);
  };

  const addReplyEmoji = (key, emoji) => {
    setCommentMap(prev => ({
      ...prev,
      [key]: (prev[key] || '') + emoji.emoji
    }));
    setShowReplyEmojiPicker(prev => ({ ...prev, [key]: false }));
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
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold break-words">{post.author}</h2>
            {post.createdAt && (
              <p className="text-sm text-gray-500">
                {formatPostDate(post.createdAt)}
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

        {/* Comment button */}
        <button
          onClick={() => setShowCommentInput(!showCommentInput)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          {showCommentInput ? 'Cancel' : 'Add Comment'}
        </button>

        {/* Comment input */}
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
                onChange={(e) => setCommentMap(prev => ({ ...prev, [postId]: e.target.value }))}
                className="w-full p-2 border rounded"
                rows="3"
              />
              <div className="flex justify-between mt-2">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-xs bg-gray-200 px-2 py-1 rounded"
                >
                  😀
                </button>
                <button
                  onClick={handleComment}
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                  Post Comment
                </button>
              </div>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-10">
                  <EmojiPicker
                    width={300}
                    height={350}
                    onEmojiClick={addEmoji}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments list */}
        <div className="space-y-4">
          {(post.comments || []).map((comment, i) => {
            const replyKey = `${postId}-${i}`;
            const hasReplies = comment.replies && comment.replies.length > 0;
            const isShowingReplies = showReplies[replyKey];
            const isShowingReplyInput = showReplyInputs[replyKey];
            const isEditingComment = editCommentMap[`${postId}-${i}`] !== undefined;
            const commentUser = { uid: comment.uid, displayName: comment.author, photoURL: comment.authorPhotoURL };

            return (
              <div key={i} className="border-t pt-4">
                <div className="flex items-start space-x-2">
                  <img
                    src={comment.authorPhotoURL || DEFAULT_AVATAR}
                    alt={comment.author}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold">{comment.author}</h3>
                      <span className="text-xs text-gray-500">
                        {formatPostDate(comment.createdAt)}
                      </span>
                    </div>

                    {isEditingComment ? (
                      <div className="mt-2">
                        <textarea
                          value={editCommentMap[`${postId}-${i}`]}
                          onChange={(e) => setEditCommentMap(prev => ({
                            ...prev,
                            [`${postId}-${i}`]: e.target.value
                          }))}
                          className="w-full p-2 border rounded"
                        />
                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={() => handleEditComment(i)}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditCommentMap(prev => {
                              const newMap = {...prev};
                              delete newMap[`${postId}-${i}`];
                              return newMap;
                            })}
                            className="px-3 py-1 bg-gray-400 text-white rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap">{comment.text}</p>
                    )}

                    <div className="flex space-x-3 mt-2 text-sm">
                      {(comment.uid === user?.uid || isAdmin || isModerator) && !isEditingComment && (
                        <>
                          <button
                            onClick={() => setEditCommentMap(prev => ({
                              ...prev,
                              [`${postId}-${i}`]: comment.text
                            }))}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteComment(i)}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleReplyInput(i)}
                        className="text-blue-600 hover:underline"
                      >
                        Reply
                      </button>
                      {hasReplies && (
                        <button
                          onClick={() => toggleShowReplies(i)}
                          className="text-blue-600 hover:underline"
                        >
                          {isShowingReplies ? 'Hide replies' : `View replies (${comment.replies.length})`}
                        </button>
                      )}
                    </div>

                    {/* Reply input */}
                    {isShowingReplyInput && (
                      <div className="mt-3 ml-6 flex items-start space-x-2">
                        <img
                          src={user?.photoURL || DEFAULT_AVATAR}
                          alt="avatar"
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <div className="flex-1 relative">
                          <textarea
                            placeholder="Write a reply..."
                            value={commentMap[`${postId}-reply-${i}`] || ''}
                            onChange={(e) => setCommentMap(prev => ({
                              ...prev,
                              [`${postId}-reply-${i}`]: e.target.value
                            }))}
                            className="w-full p-2 border rounded text-sm"
                            rows="2"
                          />
                          <div className="flex justify-between mt-2">
                            <button
                              onClick={() => setShowReplyEmojiPicker(prev => ({
                                ...prev,
                                [`${postId}-reply-${i}`]: !prev[`${postId}-reply-${i}`]
                              }))}
                              className="text-xs bg-gray-200 px-2 py-1 rounded"
                            >
                              😀
                            </button>
                            <div className="space-x-2">
                              <button
                                onClick={() => toggleReplyInput(i)}
                                className="px-2 py-1 bg-gray-400 text-white rounded text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleReply(i)}
                                className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                              >
                                Post Reply
                              </button>
                            </div>
                          </div>
                          {showReplyEmojiPicker[`${postId}-reply-${i}`] && (
                            <div className="absolute bottom-12 left-0 z-10">
                              <EmojiPicker
                                width={300}
                                height={350}
                                onEmojiClick={(emoji) => addReplyEmoji(`${postId}-reply-${i}`, emoji)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Replies section */}
                    {isShowingReplies && (
                      <div className="ml-6 mt-3 space-y-3">
                        {(comment.replies || []).map((reply, ri) => {
                          const replyEditKey = `${postId}-${i}-${ri}`;
                          const isEditingReply = editingReplyIndexMap[replyEditKey];
                          const replyUser = { uid: reply.uid, displayName: reply.author };

                          return (
                            <div key={ri} className="border-l-2 pl-3">
                              <div className="flex items-start space-x-2">
                                <img
                                  src={reply.authorPhotoURL || DEFAULT_AVATAR}
                                  alt={reply.author}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-semibold text-sm">{reply.author}</h4>
                                    <span className="text-xs text-gray-500">
                                      {formatPostDate(reply.createdAt)}
                                    </span>
                                  </div>

                                  {isEditingReply ? (
                                    <div className="mt-1">
                                      <textarea
                                        value={editReplyMap[replyEditKey]}
                                        onChange={(e) => setEditReplyMap(prev => ({
                                          ...prev,
                                          [replyEditKey]: e.target.value
                                        }))}
                                        className="w-full p-1 border rounded text-sm"
                                      />
                                      <div className="flex space-x-2 mt-1">
                                        <button
                                          onClick={() => handleEditReply(i, ri)}
                                          className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingReplyIndexMap(prev => {
                                            const newMap = {...prev};
                                            delete newMap[replyEditKey];
                                            return newMap;
                                          })}
                                          className="px-2 py-0.5 bg-gray-400 text-white rounded text-xs"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-sm whitespace-pre-wrap">{reply.text}</p>
                                  )}

                                  {(reply.uid === user?.uid || isAdmin || isModerator) && !isEditingReply && (
                                    <div className="flex space-x-3 mt-1 text-xs">
                                      <button
                                        onClick={() => {
                                          setEditingReplyIndexMap(prev => ({
                                            ...prev,
                                            [replyEditKey]: true
                                          }));
                                          setEditReplyMap(prev => ({
                                            ...prev,
                                            [replyEditKey]: reply.text
                                          }));
                                        }}
                                        className="text-blue-600 hover:underline"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteReply(i, ri)}
                                        className="text-red-600 hover:underline"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
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
  );
}