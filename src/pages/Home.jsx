import { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { useAppContext } from "../context/AppContext";
import { formatDistanceToNow } from "date-fns";
import EmojiPicker from "emoji-picker-react";
import { useNavigate, useLocation } from "react-router-dom";
import { ThumbsUp, Image as ImageIcon, X as CloseIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

const MAX_IMAGES_PER_POST = 4;
const TARGET_SIZE = 512;
const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState({});
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});
  const [showReplyBoxMap, setShowReplyBoxMap] = useState({});
  const [uploadingMap, setUploadingMap] = useState({});
  const [uploadProgressMap, setUploadProgressMap] = useState({});
  const [lightbox, setLightbox] = useState({ open: false, postId: null, index: 0 });
  const { user, theme } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const DEFAULT_AVATAR =
    "https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc";

  const safeFormatDate = (dateValue) => {
    if (!dateValue) return "";
    try {
      let date;
      if (typeof dateValue.toDate === "function") {
        date = dateValue.toDate();
      } else if (dateValue?.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return "";
      let result = formatDistanceToNow(date, { addSuffix: true });
      result = result.replace(/about /g, "").replace(/minutes/g, "mins");
      return result;
    } catch {
      return "";
    }
  };

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const map = {};
    snap.forEach((d) => {
      map[d.id] = d.data();
    });
    setUsersMap(map);
  };

  useEffect(() => {
    fetchUsers();
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        likes: [],
        comments: [],
        ...d.data(),
      }));
      setPosts(docs);
    });
    return () => unsub();
  }, []);

  // Scroll to a specific post if coming from UserProfile (via location.state) or using hash
  useEffect(() => {
    const fromState = location.state && location.state.scrollToPostId;
    const fromHash = location.hash && location.hash.startsWith("#post-")
      ? location.hash.slice(6) // remove '#post-'
      : null;
    const targetId = fromState || fromHash;
    if (!targetId) return;

    let tries = 0;
    const iv = setInterval(() => {
      const el = document.getElementById(`post-${targetId}`);
      tries++;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-blue-500");
        setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 2000);
        clearInterval(iv);
        if (fromState) {
          navigate(location.pathname, { replace: true, state: {} });
        }
      } else if (tries > 40) {
        clearInterval(iv);
      }
    }, 50);
    return () => clearInterval(iv);
  }, [location, posts, navigate]);

  const handleEditPost = async (id) => {
    if (!editedContent.trim()) return;
    const postRef = doc(db, "posts", id);
    await updateDoc(postRef, { content: editedContent });
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, content: editedContent } : p))
    );
    setEditingPostId(null);
    setEditedContent("");
  };

  const handleLike = async (id) => {
    const postRef = doc(db, "posts", id);
    const post = posts.find((p) => p.id === id);
    const likes = new Set(post.likes || []);
    if (likes.has(user.uid)) likes.delete(user.uid);
    else likes.add(user.uid);
    await updateDoc(postRef, { likes: Array.from(likes) });
  };

  const handleComment = async (id) => {
    const comment = commentMap[id];
    if (!comment?.trim()) return;
    const post = posts.find((p) => p.id === id);
    const postRef = doc(db, "posts", id);
    const newComment = {
      text: comment,
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      createdAt: new Date().toISOString(),
      replies: [],
      commentLikes: [],
    };
    const updatedComments = [...(post.comments || []), newComment];
    await updateDoc(postRef, { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [id]: "" }));
  };

  const handleReply = async (postId, commentIndex, key) => {
    const replyText = commentMap[key];
    if (!replyText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...(post.comments || [])];
    const newReply = {
      text: replyText,
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      createdAt: new Date().toISOString(),
      replyLikes: [],
    };
    updatedComments[commentIndex].replies = [
      ...(updatedComments[commentIndex].replies || []),
      newReply,
    ];
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p))
    );
    setCommentMap((prev) => ({ ...prev, [key]: "" }));
    setShowReplyBoxMap((prev) => ({ ...prev, [key]: false }));
  };

  const handleDeleteComment = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));
  };

  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));
    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: "" }));
  };

  const handleDeleteReply = async (postId, commentIndex, replyIndex) => {
    const post = posts.find((p) => p.id === postId);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex].replies.splice(replyIndex, 1);
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const updatedComments = [...posts.find((p) => p.id === postId).comments];
    updatedComments[commentIndex].replies[replyIndex].text = editReplyMap[key];
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updatedComments } : p)));
    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: "" }));
  };

  const handleLikeComment = async (postId, commentIndex) => {
    const post = posts.find((p) => p.id === postId);
    const updated = [...(post.comments || [])];
    const current = updated[commentIndex];
    const setLikes = new Set(current.commentLikes || []);
    if (setLikes.has(user.uid)) setLikes.delete(user.uid);
    else setLikes.add(user.uid);
    updated[commentIndex] = { ...current, commentLikes: Array.from(setLikes) };
    await updateDoc(doc(db, "posts", postId), { comments: updated });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updated } : p)));
  };

  const handleLikeReply = async (postId, commentIndex, replyIndex) => {
    const post = posts.find((p) => p.id === postId);
    const updated = [...(post.comments || [])];
    const comment = updated[commentIndex];
    const replies = [...comment.replies];
    const r = replies[replyIndex];
    const setLikes = new Set(r.replyLikes || []);
    if (setLikes.has(user.uid)) setLikes.delete(user.uid);
    else setLikes.add(user.uid);
    replies[replyIndex] = { ...r, replyLikes: Array.from(setLikes) };
    updated[commentIndex] = { ...comment, replies };
    await updateDoc(doc(db, "posts", postId), { comments: updated });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updated } : p)));
  };

  const resolveHandleToUid = (handle) => {
    const lower = (handle || '').toLowerCase();
    for (const [uid, u] of Object.entries(usersMap || {})) {
      const dn = (u?.displayName || '').toLowerCase().trim();
      const un = (u?.username || '').toLowerCase().trim();
      const first = dn.split(' ')[0];
      if (un && un === lower) return uid;
      if (dn && dn === lower) return uid;
      if (first && first === lower) return uid;
    }
    return null;
  };

  const renderWithMentions = (text) => {
    if (!text) return null;
    const parts = [];
    let last = 0;
    const regex = /@([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)?)/g;
    text.replace(regex, (match, handle, index) => {
      if (index > last) parts.push(text.slice(last, index));
      const uid = resolveHandleToUid(handle);
      if (uid) {
        parts.push(
          <span
            key={index}
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => { e.stopPropagation?.(); navigate(`/profile/${uid}`); }}
          >
            {match}
          </span>
        );
      } else {
        parts.push(match);
      }
      last = index + match.length;
      return match;
    });
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  const triggerUpload = (postId) => {
    const el = document.getElementById(`upload-${postId}`);
    el?.click();
  };

  const extractStoragePathFromUrl = (url) => {
    try {
      const u = new URL(url);
      const part = u.pathname.split('/o/')[1];
      if (!part) return null;
      return decodeURIComponent(part);
    } catch {
      return null;
    }
  };

  const resizeToSquare512 = async (file) => {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(TARGET_SIZE / img.width, TARGET_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (TARGET_SIZE - w) / 2;
    const dy = (TARGET_SIZE - h) / 2;
    ctx.drawImage(img, dx, dy, w, h);
    URL.revokeObjectURL(img.src);

    let quality = 0.92;
    let blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      // fallback to jpeg
      quality = 0.9;
      blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
        quality -= 0.08;
        blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      }
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('Image exceeds 1 MB after compression');
    }
    return blob;
  };

  const handleFilesChange = async (postId, fileList) => {
    if (!fileList || fileList.length === 0) return;
    const post = posts.find((p) => p.id === postId) || {};
    const currentCount = Array.isArray(post.images) ? post.images.length : 0;
    const available = Math.max(0, MAX_IMAGES_PER_POST - currentCount);
    if (available <= 0) {
      alert(`You can attach up to ${MAX_IMAGES_PER_POST} images per post.`);
      const input = document.getElementById(`upload-${postId}`);
      if (input) input.value = "";
      return;
    }

    const files = Array.from(fileList).slice(0, available);
    setUploadingMap((prev) => ({ ...prev, [postId]: true }));
    setUploadProgressMap((prev) => ({ ...prev, [postId]: 0 }));

    try {
      const uploaded = [];
      let totalBytes = 0;
      let transferred = 0;

      // Preprocess: resize and create blobs
      const blobs = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const blob = await resizeToSquare512(file);
        blobs.push({ blob, name: file.name });
        totalBytes += blob.size;
      }

      for (let i = 0; i < blobs.length; i++) {
        const { blob, name } = blobs[i];
        const path = `posts/${postId}/${Date.now()}-${i}-${name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
        const sref = storageRef(storage, path);
        const task = uploadBytesResumable(sref, blob, { contentType: blob.type || 'image/webp' });
        await new Promise((resolve, reject) => {
          task.on('state_changed', (snap) => {
            transferred = transferred + (snap.bytesTransferred - (snap._last || 0));
            snap._last = snap.bytesTransferred;
            const percent = Math.min(100, Math.round((transferred / totalBytes) * 100));
            setUploadProgressMap((prev) => ({ ...prev, [postId]: percent }));
          }, reject, async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            uploaded.push({ url, path, w: TARGET_SIZE, h: TARGET_SIZE });
            resolve();
          });
        });
      }

      const updatedImages = [ ...(post.images || []), ...uploaded ];
      await updateDoc(doc(db, "posts", postId), { images: updatedImages });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, images: updatedImages } : p));
    } catch (e) {
      console.error("Image upload failed", e);
      alert(e?.message || 'Failed to upload image(s)');
    } finally {
      setUploadingMap((prev) => ({ ...prev, [postId]: false }));
      setUploadProgressMap((prev) => ({ ...prev, [postId]: 0 }));
      const input = document.getElementById(`upload-${postId}`);
      if (input) input.value = "";
    }
  };

  const removeImage = async (postId, index) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || post.uid !== user.uid) return; // only author can

    const list = Array.isArray(post.images) ? [...post.images] : [];
    const item = list[index];
    if (!item) return;
    const url = typeof item === 'string' ? item : item.url;
    const path = typeof item === 'object' && item.path ? item.path : extractStoragePathFromUrl(url);

    try {
      if (path) {
        await deleteObject(storageRef(storage, path));
      } else {
        console.warn('Could not resolve storage path, removing URL only');
      }
    } catch (e) {
      console.warn('Delete object failed (will still remove from Firestore):', e);
    }

    list.splice(index, 1);
    await updateDoc(doc(db, 'posts', postId), { images: list });
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, images: list } : p));
  };

  const openLightbox = (postId, index) => setLightbox({ open: true, postId, index });
  const closeLightbox = () => setLightbox({ open: false, postId: null, index: 0 });
  const nextLightbox = useCallback(() => {
    setLightbox((lb) => {
      if (!lb.open) return lb;
      const post = posts.find((p) => p.id === lb.postId);
      const imgs = Array.isArray(post?.images) ? post.images : [];
      const len = imgs.length;
      if (len === 0) return lb;
      return { ...lb, index: (lb.index + 1) % len };
    });
  }, [posts]);
  const prevLightbox = useCallback(() => {
    setLightbox((lb) => {
      if (!lb.open) return lb;
      const post = posts.find((p) => p.id === lb.postId);
      const imgs = Array.isArray(post?.images) ? post.images : [];
      const len = imgs.length;
      if (len === 0) return lb;
      return { ...lb, index: (lb.index - 1 + len) % len };
    });
  }, [posts]);

  useEffect(() => {
    if (!lightbox.open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextLightbox();
      if (e.key === 'ArrowLeft') prevLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox.open, nextLightbox, prevLightbox]);

  const renderLightbox = () => {
    if (!lightbox.open) return null;
    const post = posts.find((p) => p.id === lightbox.postId);
    const imgs = Array.isArray(post?.images) ? post.images : [];
    const item = imgs[lightbox.index];
    const url = typeof item === 'string' ? item : item?.url;
    if (!url) return null;
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={closeLightbox}>
        <button onClick={(e) => { e.stopPropagation(); prevLightbox(); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"><ChevronLeft size={32} /></button>
        <img src={url} alt="media" className="max-h-[90vh] max-w-[90vw] object-contain" loading="eager" />
        <button onClick={(e) => { e.stopPropagation(); nextLightbox(); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"><ChevronRight size={32} /></button>
        <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="absolute top-4 right-4 text-white/80 hover:text-white p-2"><CloseIcon size={28} /></button>
      </div>
    );
  };

  const canEditPost = useCallback((post) => post.uid === user.uid, [user.uid]);

  return (
    <div
      className="max-w-xl mx-auto mt-10"
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
    >
      {posts.map((post) => {
        const postUser = usersMap[post.uid];
        const images = Array.isArray(post.images) ? post.images : [];
        return (
          <div key={post.id} id={`post-${post.id}`} className="border-2 border-black-500 p-4 rounded mb-4 shadow-sm ">
            {/* Post header */}
            <div className="flex justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={postUser?.photoURL || DEFAULT_AVATAR}
                  alt="avatar"
                  className="w-10 h-10 border-2 border-white rounded-full object-cover cursor-pointer"
                  onClick={() => navigate(`/profile/${post.uid}`)}
                />
                <div>
                  <div className="flex items-center">
                    <span className="font-bold text-gray-800">{postUser?.displayName || post.author}</span>
                    {postUser?.isAdmin && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded ml-1">Admin</span>
                    )}
                    {postUser?.isModerator && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded ml-1">Mod</span>
                    )}
                    <span className="text-xs text-gray-500 ml-2">{safeFormatDate(post.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Post content */}
            <div className="mt-2">
              {editingPostId === post.id ? (
                <div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="border p-2 w-full rounded"
                  />
                  <button
                    onClick={() => handleEditPost(post.id)}
                    className="mt-1 text-sm bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="text-gray-800">{renderWithMentions(post.content)}</p>
              )}
            </div>

            {/* Post images */}
            {images.length === 1 && (() => {
              const it = images[0];
              const url = typeof it === 'string' ? it : it.url;
              return (
                <div className="mt-2 relative">
                  <img
                    src={url}
                    alt="post media"
                    loading="lazy"
                    className="w-full max-h-[70vh] object-contain rounded cursor-pointer"
                    onClick={() => openLightbox(post.id, 0)}
                  />
                  {canEditPost(post) && (
                    <button
                      onClick={() => removeImage(post.id, 0)}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                      title="Remove image"
                    >
                      <CloseIcon size={16} />
                    </button>
                  )}
                </div>
              );
            })()}

            {images.length > 1 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {images.map((it, idx) => {
                  const url = typeof it === 'string' ? it : it.url;
                  return (
                    <div key={idx} className="relative group">
                      <img
                        src={url}
                        alt="post media"
                        loading="lazy"
                        className="w-full aspect-square object-cover rounded cursor-pointer"
                        onClick={() => openLightbox(post.id, idx)}
                      />
                      {canEditPost(post) && (
                        <button
                          onClick={() => removeImage(post.id, idx)}
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                          title="Remove image"
                        >
                          <CloseIcon size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions: Reply, Like, Add photo */}
            <div className="mt-3 flex items-center flex-wrap gap-4">
              <button
                onClick={() => {
                  const atName = postUser?.displayName || post.author;
                  setCommentMap((prev) => {
                    const prefix = atName ? `@${atName}: ` : "";
                    const prevText = prev[post.id] || "";
                    return { ...prev, [post.id]: prefix && !prevText.startsWith(prefix) ? prefix + prevText : prevText };
                  });
                  setTimeout(() => {
                    const el = document.querySelector('textarea[placeholder="Write a comment..."]');
                    if (el) el.focus();
                  }, 0);
                }}
                className="bg-blue-500 text-white px-3 py-1 text-sm rounded font-semibold hover:bg-blue-600"
              >
                Reply
              </button>

              <button onClick={() => handleLike(post.id)} className="text-sm inline-flex items-center space-x-1">
                <ThumbsUp
                  size={16}
                  className={post.likes?.includes(user.uid) ? "text-blue-500" : "text-gray-600"}
                />
                <span className={post.likes?.includes(user.uid) ? "text-blue-500 font-semibold" : "text-gray-600"}>
                  {post.likes?.includes(user.uid) ? "Liked" : "Like"}
                </span>
                <span className="text-gray-600">{post.likes?.length || 0}</span>
              </button>

              {canEditPost(post) && (
                <>
                  <input
                    id={`upload-${post.id}`}
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFilesChange(post.id, e.target.files)}
                  />
                  <button
                    onClick={() => triggerUpload(post.id)}
                    disabled={!!uploadingMap[post.id] || (Array.isArray(post.images) && post.images.length >= MAX_IMAGES_PER_POST)}
                    className="text-sm inline-flex items-center space-x-1 disabled:opacity-50"
                    title="Add photo"
                  >
                    <ImageIcon size={16} className={uploadingMap[post.id] ? "text-gray-400" : "text-gray-600"} />
                    <span className={uploadingMap[post.id] ? "text-gray-400" : "text-gray-600"}>
                      {uploadingMap[post.id]
                        ? `Uploading ${uploadProgressMap[post.id] || 0}%`
                        : (Array.isArray(post.images) && post.images.length >= MAX_IMAGES_PER_POST)
                          ? `Max ${MAX_IMAGES_PER_POST}`
                          : 'Add photo'}
                    </span>
                  </button>
                </>
              )}

              {(post.uid === user.uid || user.isAdmin || user.isModerator) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingPostId(post.id); setEditedContent(post.content); }}
                    className="bg-yellow-400 text-black px-3 py-1 text-sm rounded font-semibold hover:bg-yellow-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteDoc(doc(db, "posts", post.id))}
                    className="bg-red-500 text-white px-3 py-1 text-sm rounded font-semibold hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {/* Comment box at top */}
            <div className="mt-3">
              <div className="relative">
                <textarea
                  placeholder="Write a comment..."
                  value={commentMap[post.id] || ""}
                  onChange={(e) => setCommentMap((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  className="border p-3 pr-12 w-full rounded resize-none"
                  rows="2"
                />
                <button
                  onClick={() => setShowEmojiPicker((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                  className="absolute right-3 top-3 text-lg hover:bg-gray-100 p-1 rounded"
                >
                  😀
                </button>
                {showEmojiPicker[post.id] && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white shadow-lg rounded-lg p-2 border max-w-sm w-full mx-4 relative">
                      <button
                        onClick={() => setShowEmojiPicker((prev) => ({ ...prev, [post.id]: false }))}
                        className="absolute top-2 right-2 z-10 bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 font-bold"
                      >
                        ×
                      </button>
                      <EmojiPicker onEmojiClick={(emoji) => setCommentMap((prev) => ({ ...prev, [post.id]: (prev[post.id] || "") + emoji.emoji }))} width={280} height={350} />
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleComment(post.id)}
                className="bg-blue-600 text-white px-3 py-1 text-sm rounded font-semibold disabled:opacity-50"
              >
                Post
              </button>
            </div>

            {/* Comments */}
            <div className="mt-4 space-y-4">
              {(post.comments || []).map((comment, i) => {
                const commentUser = usersMap[comment.uid];
                return (
                  <div key={i} className="ml-4">
                    <div className="flex border items-start space-x-2">
                      <img
                        src={commentUser?.photoURL || DEFAULT_AVATAR}
                        className="w-8 h-8 border-2 border-white rounded-full object-cover flex-shrink-0 cursor-pointer"
                        onClick={() => navigate(`/profile/${comment.uid}`)}
                        alt="avatar"
                      />
                      <div className="flex-1 p-2 rounded ">
                        {editCommentMap[`${post.id}-${i}`] !== undefined ? (
                          <div>
                            <textarea
                              value={editCommentMap[`${post.id}-${i}`]}
                              onChange={(e) => setEditCommentMap((prev) => ({ ...prev, [`${post.id}-${i}`]: e.target.value }))}
                              className="border p-1 w-full rounded"
                            />
                            <button onClick={() => handleEditComment(post.id, i)} className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1">Save</button>
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold text-sm">
                              <span className="cursor-pointer" onClick={() => navigate(`/profile/${comment.uid}`)}>
                                {commentUser?.displayName || comment.author}
                              </span>
                              {commentUser?.isAdmin && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded ml-1">Admin</span>
                              )}
                              {commentUser?.isModerator && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded ml-1">Mod</span>
                              )}
                              <span className="text-xs text-gray-400 font-normal ml-2">
                                {safeFormatDate(comment.createdAt)}
                              </span>
                            </p>
                            <p>{renderWithMentions(comment.text)}</p>
                          </>
                        )}

                        <div className="flex items-center space-x-3 mt-1">
                          <button
                            onClick={() => {
                              const key = `reply-${post.id}-${i}`;
                              const atName = commentUser?.displayName || comment.author;
                              setShowReplyBoxMap((prev) => ({ ...prev, [key]: !prev[key] }));
                              if (!showReplyBoxMap[key]) {
                                setCommentMap((prev) => {
                                  const prefix = atName ? `@${atName}: ` : "";
                                  const prevText = prev[key] || "";
                                  return { ...prev, [key]: prefix && !prevText.startsWith(prefix) ? prefix + prevText : prevText };
                                });
                              }
                            }}
                            className="text-xs text-gray-600 hover:underline"
                          >
                            Reply
                          </button>
                          <button onClick={() => handleLikeComment(post.id, i)} className="text-xs text-gray-600 inline-flex items-center space-x-1 hover:underline">
                            <ThumbsUp size={14} className={comment.commentLikes?.includes(user.uid) ? "text-blue-500" : "text-gray-600"} />
                            <span className={comment.commentLikes?.includes(user.uid) ? "text-blue-500 font-semibold" : "text-gray-600"}>
                              {comment.commentLikes?.includes(user.uid) ? "Liked" : "Like"}
                            </span>
                            <span className="text-gray-600">{comment.commentLikes?.length || 0}</span>
                          </button>
                          {(comment.uid === user.uid || user.isAdmin || user.isModerator) && editCommentMap[`${post.id}-${i}`] === undefined && (
                            <>
                              <button onClick={() => setEditCommentMap((prev) => ({ ...prev, [`${post.id}-${i}`]: comment.text }))} className="text-xs text-blue-600 hover:underline">Edit</button>
                              <button onClick={() => handleDeleteComment(post.id, i)} className="text-xs text-red-500 hover:underline">Delete</button>
                            </>
                          )}
                        </div>

                        {/* Replies */}
                        {showReplyBoxMap[`reply-${post.id}-${i}`] && (
                          <div className="mt-2">
                            <div className="relative">
                              <textarea
                                placeholder="Write a reply..."
                                value={commentMap[`reply-${post.id}-${i}`] || ""}
                                onChange={(e) => setCommentMap((prev) => ({ ...prev, [`reply-${post.id}-${i}`]: e.target.value }))}
                                className="border p-3 pr-12 w-full rounded resize-none"
                                rows="2"
                              />
                              <button
                                onClick={() => setShowReplyEmojiPicker((prev) => ({ ...prev, [`reply-${post.id}-${i}`]: !prev[`reply-${post.id}-${i}`] }))}
                                className="absolute right-3 top-3 text-lg hover:bg-gray-100 p-1 rounded"
                              >
                                😀
                              </button>
                              {showReplyEmojiPicker[`reply-${post.id}-${i}`] && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                                  <div className="bg-white shadow-lg rounded-lg p-2 border max-w-sm w-full mx-4 relative">
                                    <button
                                      onClick={() => setShowReplyEmojiPicker((prev) => ({ ...prev, [`reply-${post.id}-${i}`]: false }))}
                                      className="absolute top-2 right-2 z-10 bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 font-bold"
                                    >
                                      ×
                                    </button>
                                    <EmojiPicker
                                      onEmojiClick={(emoji) => setCommentMap((prev) => ({ ...prev, [`reply-${post.id}-${i}`]: (prev[`reply-${post.id}-${i}`] || "") + emoji.emoji }))}
                                      width={280}
                                      height={350}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleReply(post.id, i, `reply-${post.id}-${i}`)}
                              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded font-medium hover:bg-blue-600"
                            >
                              Reply
                            </button>
                          </div>
                        )}

                        <div className="mt-3 space-y-3">
                          {(comment.replies || []).map((reply, ri) => {
                            const replyUser = usersMap[reply.uid];
                            const replyKey = `${post.id}-${i}-${ri}`;
                            return (
                              <div
                                key={ri}
                                className="flex items-start space-x-2 bg-gray-100 p-2 rounded shadow-sm"
                              >
                                <img
                                  src={replyUser?.photoURL || DEFAULT_AVATAR}
                                  className="w-5 h-5 rounded-full cursor-pointer"
                                  onClick={() => navigate(`/profile/${reply.uid}`)}
                                  alt="avatar"
                                />
                                <div className="flex-1">
                                  {editingReplyIndexMap[replyKey] ? (
                                    <div>
                                      <textarea
                                        value={editReplyMap[replyKey]}
                                        onChange={(e) =>
                                          setEditReplyMap((prev) => ({ ...prev, [replyKey]: e.target.value }))
                                        }
                                        className="border p-1 w-full rounded"
                                      />
                                      <button
                                        onClick={() =>
                                          handleEditReply(post.id, i, ri)
                                        }
                                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="font-semibold text-sm">
                                        <span className="cursor-pointer" onClick={() => navigate(`/profile/${reply.uid}`)}>
                                          {replyUser?.displayName ||
                                            reply.author}
                                        </span>
                                        {replyUser?.isAdmin && (
                                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded ml-1">
                                            Admin
                                          </span>
                                        )}
                                        {replyUser?.isModerator && (
                                          <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded ml-1">
                                            Mod
                                          </span>
                                        )}
                                        <span className="text-xs text-gray-400 font-normal ml-2">
                                          {safeFormatDate(reply.createdAt)}
                                        </span>
                                      </p>
                                      <p>{renderWithMentions(reply.text)}</p>
                                    </>
                                  )}
                                  <div className="flex items-center space-x-3 mt-1">
                                    <button
                                      onClick={() => {
                                        const key = `reply-${post.id}-${i}-${ri}`;
                                        const atName = replyUser?.displayName || reply.author;
                                        setShowReplyBoxMap((prev) => ({ ...prev, [key]: !prev[key] }));
                                        if (!showReplyBoxMap[key]) {
                                          setCommentMap((prev) => {
                                            const prefix = atName ? `@${atName}: ` : "";
                                            const prevText = prev[key] || "";
                                            return { ...prev, [key]: prefix && !prevText.startsWith(prefix) ? prefix + prevText : prevText };
                                          });
                                        }
                                      }}
                                      className="text-xs text-gray-600 hover:underline"
                                    >
                                      Reply
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleLikeReply(post.id, i, ri)
                                      }
                                      className="text-xs text-gray-600 inline-flex items-center space-x-1 hover:underline"
                                    >
                                      <ThumbsUp
                                        size={14}
                                        className={
                                          reply.replyLikes?.includes(user.uid)
                                            ? "text-blue-500"
                                            : "text-gray-600"
                                        }
                                      />
                                      <span
                                        className={
                                          reply.replyLikes?.includes(user.uid)
                                            ? "text-blue-500 font-semibold"
                                            : "text-gray-600"
                                        }
                                      >
                                        {reply.replyLikes?.includes(user.uid)
                                          ? "Liked"
                                          : "Like"}
                                      </span>
                                      <span className="text-gray-600">
                                        {reply.replyLikes?.length || 0}
                                      </span>
                                    </button>
                                    {(reply.uid === user.uid ||
                                      user.isAdmin ||
                                      user.isModerator) &&
                                      !editingReplyIndexMap[replyKey] && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingReplyIndexMap(
                                                (prev) => ({
                                                  ...prev,
                                                  [replyKey]: true,
                                                })
                                              );
                                              setEditReplyMap((prev) => ({
                                                ...prev,
                                                [replyKey]: reply.text,
                                              }));
                                            }}
                                            className="text-xs text-blue-600 hover:underline"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleDeleteReply(post.id, i, ri)
                                            }
                                            className="text-xs text-red-500 hover:underline"
                                          >
                                            Delete
                                          </button>
                                        </>
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
              })}
            </div>
          </div>
        );
      })}
      {renderLightbox()}
    </div>
  );
}
