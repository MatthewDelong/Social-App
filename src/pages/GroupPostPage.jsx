import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import GroupComments from "../components/groups/GroupComments";
import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref as storageRef, uploadBytes, uploadBytesResumable, deleteObject } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import { useGroupPermissions } from "../hooks/useGroupPermissions";
import RoleBadge from "../components/groups/RoleBadge";
import { Image as ImageIcon, X as CloseIcon, ChevronLeft, ChevronRight } from "lucide-react";

const MAX_IMAGES_PER_POST = 4;
const TARGET_SIZE = 512;
const MAX_UPLOAD_BYTES = 1024 * 1024;

export default function GroupPostPage() {
  const { groupId, postId } = useParams();
  const { user } = useAppContext();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [group, setGroup] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [DEFAULT_BANNER, setDEFAULT_BANNER] = useState("");
  const [DEFAULT_LOGO, setDEFAULT_LOGO] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightbox, setLightbox] = useState({ open: false, index: 0 });

  const {
    canManageGroup,
    canEditContent,
    canDeleteContent,
    getUserRole,
    isMember,
    loading: permissionsLoading,
  } = useGroupPermissions(groupId, user?.uid || "anonymous");

  const isAdminOrMod = user?.isAdmin || user?.isModerator || canManageGroup;

  const openLightbox = (index) => setLightbox({ open: true, index });
  const closeLightbox = () => setLightbox({ open: false, index: 0 });

  const nextLightbox = useCallback(() => {
    setLightbox((lb) => {
      if (!lb.open) return lb;
      const imgs = Array.isArray(post?.images) ? post.images : [];
      const len = imgs.length;
      if (len === 0) return lb;
      return { ...lb, index: (lb.index + 1) % len };
    });
  }, [post]);

  const prevLightbox = useCallback(() => {
    setLightbox((lb) => {
      if (!lb.open) return lb;
      const imgs = Array.isArray(post?.images) ? post.images : [];
      const len = imgs.length;
      if (len === 0) return lb;
      return { ...lb, index: (lb.index - 1 + len) % len };
    });
  }, [post]);

  useEffect(() => {
    if (!lightbox.open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextLightbox();
      if (e.key === "ArrowLeft") prevLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox.open, nextLightbox, prevLightbox]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map = {};
        snap.forEach((d) => { map[d.id] = d.data(); });
        setUsersMap(map);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const avatarRef = storageRef(storage, "default-avatar.png");
        const bannerRef = storageRef(storage, "default-banner.jpg");
        const logoRef = storageRef(storage, "default-group-logo.png");
        setDEFAULT_AVATAR(await getDownloadURL(avatarRef));
        setDEFAULT_BANNER(await getDownloadURL(bannerRef));
        setDEFAULT_LOGO(await getDownloadURL(logoRef));
      } catch {}
    };
    loadDefaults();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const postDoc = await getDoc(doc(db, "groupPosts", postId));
      if (postDoc.exists()) {
        let data = { id: postDoc.id, ...postDoc.data() };
        if (!data.authorPhotoURL && data.uid) {
          const userDoc = await getDoc(doc(db, "users", data.uid));
          if (userDoc.exists()) data.authorPhotoURL = userDoc.data().photoURL || "";
        }
        setPost(data);
      }
      if (groupId) {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) setGroup({ id: groupDoc.id, ...groupDoc.data() });
      }
      setLoading(false);
    };
    fetchData();
  }, [postId, groupId]);

  if (loading || permissionsLoading) return <p className="p-4">Loading post...</p>;
  if (!post) return <p className="p-4">Post not found</p>;

  const canEditThisPost = canEditContent(post.uid);
  const canDeleteThisPost = canDeleteContent(post.uid);
  const authorRole = getUserRole ? getUserRole(post?.uid) : null;

  const resolveHandleToUid = (handle) => {
    const lower = (handle || "").toLowerCase();
    for (const [uid, u] of Object.entries(usersMap || {})) {
      const dn = (u?.displayName || "").toLowerCase().trim();
      const un = (u?.username || "").toLowerCase().trim();
      const first = dn.split(" ")[0];
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

  const formatPostDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
    } catch {
      return "";
    }
  };

  const handleImageUpload = async (type) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const storagePath = `groups/${groupId}/${type}-${Date.now()}.jpg`;
        const sref = storageRef(storage, storagePath);
        await uploadBytes(sref, file);
        const url = await getDownloadURL(sref);
        await updateDoc(doc(db, "groups", groupId), { [type]: url });
        setGroup((prev) => ({ ...prev, [type]: url }));
      } catch {}
    };
    fileInput.click();
  };

  const extractStoragePathFromUrl = (url) => {
    try {
      const u = new URL(url);
      const part = u.pathname.split("/o/")[1];
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
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(TARGET_SIZE / img.width, TARGET_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (TARGET_SIZE - w) / 2;
    const dy = (TARGET_SIZE - h) / 2;
    ctx.drawImage(img, dx, dy, w, h);
    URL.revokeObjectURL(img.src);

    let quality = 0.92;
    let blob = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      quality = 0.9;
      blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
      while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
        quality -= 0.08;
        blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
      }
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      throw new Error("Image exceeds 1 MB after compression");
    }
    return blob;
  };

  const handleFilesChange = async (fileList) => {
    if (!fileList || fileList.length === 0 || !post) return;
    const currentCount = Array.isArray(post.images) ? post.images.length : 0;
    const available = Math.max(0, MAX_IMAGES_PER_POST - currentCount);
    if (available <= 0) {
      alert(`You can attach up to ${MAX_IMAGES_PER_POST} images per post.`);
      const input = document.getElementById("upload-group-post");
      if (input) input.value = "";
      return;
    }

    const files = Array.from(fileList).slice(0, available);
    setUploading(true);
    setUploadProgress(0);

    try {
      const uploaded = [];
      let totalBytes = 0;
      let transferred = 0;

      const blobs = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const blob = await resizeToSquare512(file);
        blobs.push({ blob, name: file.name });
        totalBytes += blob.size;
      }

      for (let i = 0; i < blobs.length; i++) {
        const { blob, name } = blobs[i];
        const path = `groupPosts/${post.id}/${Date.now()}-${i}-${name.replace(/[^a-zA-Z0-9_.-]/g, "_")}.webp`;
        const sref = storageRef(storage, path);
        const task = uploadBytesResumable(sref, blob, { contentType: blob.type || "image/webp" });
        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              transferred = transferred + (snap.bytesTransferred - (snap._last || 0));
              snap._last = snap.bytesTransferred;
              const percent = Math.min(100, Math.round((transferred / totalBytes) * 100));
              setUploadProgress(percent);
            },
            reject,
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              uploaded.push({ url, path, w: TARGET_SIZE, h: TARGET_SIZE });
              resolve();
            }
          );
        });
      }

      const updatedImages = [...(post.images || []), ...uploaded];
      await updateDoc(doc(db, "groupPosts", post.id), { images: updatedImages });
      setPost((prev) => ({ ...prev, images: updatedImages }));
    } catch (e) {
      console.error("Image upload failed", e);
      alert(e?.message || "Failed to upload image(s)");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      const input = document.getElementById("upload-group-post");
      if (input) input.value = "";
    }
  };

  const triggerUpload = () => {
    const el = document.getElementById("upload-group-post");
    el?.click();
  };

  const removeImage = async (index) => {
    if (!post || !canEditThisPost) return;
    const list = Array.isArray(post.images) ? [...post.images] : [];
    const item = list[index];
    if (!item) return;
    const url = typeof item === "string" ? item : item.url;
    const path = typeof item === "object" && item.path ? item.path : extractStoragePathFromUrl(url);
    try {
      if (path) await deleteObject(storageRef(storage, path));
    } catch {}
    list.splice(index, 1);
    await updateDoc(doc(db, "groupPosts", post.id), { images: list });
    setPost((prev) => ({ ...prev, images: list }));
  };

  const startEdit = () => {
    setEditContent(post.content || "");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const saveEdit = async () => {
    if (!editContent.trim() || !canEditThisPost) return;
    try {
      await updateDoc(doc(db, "groupPosts", post.id), {
        content: editContent.trim(),
        editedAt: new Date(),
      });
      setPost((prev) => ({ ...prev, content: editContent.trim(), editedAt: new Date() }));
      setIsEditing(false);
      setEditContent("");
    } catch {
      alert("Failed to update post. Please try again.");
    }
  };

  const deletePost = async () => {
    if (!canDeleteThisPost) return;
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "groupPosts", post.id));
      navigate(`/groups/${groupId}`);
    } catch {
      alert("Failed to delete post. Please try again.");
    }
  };

  const images = Array.isArray(post.images) ? post.images : [];

  return (
    <div className="max-w-2xl mx-auto">
      {group && (
        <div className="relative">
          <div
            className="w-full border-4 border-white  h-40 sm:h-56 md:h-64 overflow-hidden cursor-pointer relative group"
            onClick={() => isAdminOrMod && handleImageUpload("bannerURL")}
          >
            <img src={group.bannerURL || DEFAULT_BANNER} alt={`${group.name} banner`} className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-12 left-4 cursor-pointer group" onClick={() => isAdminOrMod && handleImageUpload("logoURL")}>
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white overflow-hidden shadow-lg relative">
              <img src={group.logoURL || DEFAULT_LOGO} alt={`${group.name} logo`} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      )}

      <div className="mt-20 sm:mt-16 p-4">
        {group && (
          <Link to={`/groups/${groupId}`} className="text-2xl font-bold text-gray-800 hover:underline block mb-4">
            {group.name}
          </Link>
        )}

        <div className="flex items-center space-x-3 mb-4">
          <img
            src={post.authorPhotoURL || DEFAULT_AVATAR}
            alt={post.author}
            className="w-10 h-10 border-2 border-white rounded-full object-cover flex-shrink-0 cursor-pointer"
            onClick={() => navigate(`/profile/${post.uid}`)}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold break-words cursor-pointer" onClick={() => navigate(`/profile/${post.uid}`)}>
                {post.author}
              </h2>
              {authorRole && <RoleBadge role={authorRole} size="xs" />}
            </div>
            {post.createdAt && (
              <p className="text-sm text-gray-500">
                {formatPostDate(post.createdAt)}
                {post.editedAt && <span className="ml-2 text-xs text-gray-400">(edited)</span>}
              </p>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="mb-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full p-2 border rounded resize-none break-words"
            />
            <div className="mt-2 space-x-2">
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
              <button onClick={cancelEdit} className="px-4 py-2 bg-gray-400 text-white rounded">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="mb-4 whitespace-pre-wrap break-words">{renderWithMentions(post.content)}</p>
        )}

        {images.length === 1 && (() => {
          const it = images[0];
          const url = typeof it === "string" ? it : it.url;
          return (
            <div className="mt-2 relative">
              <img
                src={url}
                alt="post media"
                loading="lazy"
                className="w-full max-h-[70vh] object-contain rounded cursor-pointer"
                onClick={() => openLightbox(0)}
              />
              {canEditThisPost && (
                <button onClick={() => removeImage(0)} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1" title="Remove image">
                  <CloseIcon size={16} />
                </button>
              )}
            </div>
          );
        })()}

        {images.length > 1 && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {images.map((it, idx) => {
              const url = typeof it === "string" ? it : it.url;
              return (
                <div key={idx} className="relative group">
                  <img
                    src={url}
                    alt="post media"
                    loading="lazy"
                    className="w-full aspect-square object-cover rounded cursor-pointer"
                    onClick={() => openLightbox(idx)}
                  />
                  {canEditThisPost && (
                    <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1" title="Remove image">
                      <CloseIcon size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-4 mt-3">
          <button
            onClick={() => {
              const atName = post.author;
              const el = document.querySelector('textarea[placeholder="Write a comment..."]');
              if (el) {
                const prefix = atName ? `@${atName}: ` : "";
                const current = el.value || "";
                const next = prefix && !current.startsWith(prefix) ? prefix + current : current;
                try { el.value = next; el.dispatchEvent(new Event("input", { bubbles: true })); } catch {}
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.focus();
              }
            }}
            className="bg-blue-500 text-white px-3 py-1 text-sm rounded font-semibold hover:bg-blue-600"
          >
            Reply
          </button>
        </div>

        {(canEditThisPost || canDeleteThisPost) && !isEditing && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {canEditThisPost && (
              <button onClick={startEdit} className="bg-yellow-400 text-black px-3 py-1 text-sm rounded font-semibold hover:bg-yellow-500">
                Edit
              </button>
            )}
            {canDeleteThisPost && (
              <button onClick={deletePost} className="bg-red-500 text-white px-3 py-1 text-sm rounded font-semibold hover:bg-red-600">
                Delete
              </button>
            )}
            {canEditThisPost && (
              <>
                <input id="upload-group-post" type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleFilesChange(e.target.files)} />
                <button
                  onClick={() => { const el = document.getElementById("upload-group-post"); el?.click(); }}
                  disabled={uploading || (Array.isArray(post.images) && post.images.length >= MAX_IMAGES_PER_POST)}
                  className="text-sm inline-flex items-center space-x-1 disabled:opacity-50"
                  title="Add photo"
                >
                  <ImageIcon size={16} className={uploading ? "text-gray-400" : "text-gray-600"} />
                  <span className={uploading ? "text-gray-400" : "text-gray-600"}>
                    {uploading
                      ? `Uploading ${uploadProgress || 0}%`
                      : Array.isArray(post.images) && post.images.length >= MAX_IMAGES_PER_POST
                        ? `Max ${MAX_IMAGES_PER_POST}`
                        : "Add photo"}
                  </span>
                </button>
              </>
            )}
          </div>
        )}

        <GroupComments
          postId={postId}
          groupId={groupId}
          currentUser={user}
          isAdmin={user?.isAdmin}
          isModerator={user?.isModerator}
          canModerateContent={canDeleteContent}
          canEditContent={canEditContent}
          canDeleteContent={canDeleteContent}
          isMember={isMember}
        />
      </div>

      {lightbox.open && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={closeLightbox}>
          <button onClick={(e) => { e.stopPropagation(); prevLightbox(); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"><ChevronLeft size={32} /></button>
          <img src={(Array.isArray(post?.images) ? post.images : []).map((it) => (typeof it === "string" ? it : it.url))[lightbox.index]} alt="media" className="max-h-[90vh] max-w-[90vw] object-contain" loading="eager" />
          <button onClick={(e) => { e.stopPropagation(); nextLightbox(); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"><ChevronRight size={32} /></button>
          <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="absolute top-4 right-4 text-white/80 hover:text-white p-2"><CloseIcon size={28} /></button>
        </div>
      )}
    </div>
  );
}