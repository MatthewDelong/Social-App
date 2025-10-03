[file name]: Navbar.jsx
[file content begin]
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  orderBy,
  startAt,
  endAt,
  limit,
} from "firebase/firestore";
import FriendRequestsMenu from "./nav/FriendRequestsMenu";
import { Search as SearchIcon } from "lucide-react";

function getContrastYIQ(hexcolor) {
  hexcolor = (hexcolor || "").replace("#", "");
  if (hexcolor.length !== 6) return "text-white";
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "text-gray-900" : "text-white";
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function Navbar() {
  const { user, logout, theme } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const hideContentRoutes = ["/login", "/signup"];
  const shouldHideContent =
    hideContentRoutes.includes(location.pathname) && !user;

  const [menuOpen, setMenuOpen] = useState(false);
  const [incomingCount, setIncomingCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const qReq = query(
      collection(db, "friendRequests"),
      where("toUid", "==", user.uid)
    );
    const unsub = onSnapshot(qReq, (snap) => setIncomingCount(snap.size));
    return () => unsub && unsub();
  }, [user?.uid]);

  const [term, setTerm] = useState("");
  const [focus, setFocus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ users: [], groups: [] });
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!focus) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const t = term.trim();
    const tLower = t.toLowerCase();
    if (t.length < 2) {
      setResults({ users: [], groups: [] });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const variants = Array.from(
          new Set([t, capitalize(t), t.toLowerCase(), t.toUpperCase()])
        );
        const userPromises = variants.map((v) =>
          getDocs(
            query(
              collection(db, "users"),
              orderBy("displayName"),
              startAt(v),
              endAt(v + "\uf8ff"),
              limit(20)
            )
          )
        );
        const groupPromises = variants.map((v) =>
          getDocs(
            query(
              collection(db, "groups"),
              orderBy("name"),
              startAt(v),
              endAt(v + "\uf8ff"),
              limit(20)
            )
          )
        );

        const userSnaps = await Promise.all(userPromises);
        const groupSnaps = await Promise.all(groupPromises);

        const userCandidates = Array.from(
          new Map(
            userSnaps
              .flatMap((s) => s.docs)
              .map((d) => [
                d.id,
                {
                  id: d.id,
                  displayName:
                    d.data().displayName || d.data().username || "Unknown",
                  photoURL: d.data().photoURL,
                },
              ])
          ).values()
        );
        const groupCandidates = Array.from(
          new Map(
            groupSnaps
              .flatMap((s) => s.docs)
              .map((d) => [
                d.id,
                {
                  id: d.id,
                  name: d.data().name || "Group",
                  logoURL: d.data().logoURL,
                },
              ])
          ).values()
        );

        const users = userCandidates
          .filter((u) => (u.displayName || "").toLowerCase().startsWith(tLower))
          .slice(0, 5);
        const groups = groupCandidates
          .filter((g) => (g.name || "").toLowerCase().startsWith(tLower))
          .slice(0, 5);

        if (users.length === 0) {
          const snap = await getDocs(
            query(collection(db, "users"), orderBy("displayName"), limit(50))
          );
          const more = snap.docs
            .map((d) => ({
              id: d.id,
              displayName:
                d.data().displayName || d.data().username || "Unknown",
              photoURL: d.data().photoURL,
            }))
            .filter((u) =>
              (u.displayName || "").toLowerCase().startsWith(tLower)
            )
            .slice(0, 5);
          if (more.length > 0) users.push(...more);
        }
        if (groups.length === 0) {
          const snap = await getDocs(
            query(collection(db, "groups"), orderBy("name"), limit(50))
          );
          const more = snap.docs
            .map((d) => ({
              id: d.id,
              name: d.data().name || "Group",
              logoURL: d.data().logoURL,
            }))
            .filter((g) => (g.name || "").toLowerCase().startsWith(tLower))
            .slice(0, 5);
          if (more.length > 0) groups.push(...more);
        }

        setResults({ users, groups });
      } catch (e) {
        setResults({ users: [], groups: [] });
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term, focus]);

  const textColorClass = getContrastYIQ(theme?.navbarColor || "#111827");

  const goFirstResult = () => {
    if (results.users.length > 0) {
      navigate("/profile/" + results.users[0].id);
      setFocus(false);
      setTerm("");
      return;
    }
    if (results.groups.length > 0) {
      navigate("/groups/" + results.groups[0].id);
      setFocus(false);
      setTerm("");
    }
  };

  return (
    <nav
      className="shadow p-4 mb-6"
      style={{ backgroundColor: theme?.navbarColor || "#ffffff" }}
    >
      <div className="flex justify-between items-center max-w-6xl mx-auto">
        <Link to="/">
          <img src="/images/logo.png" alt="Logo" className="h-16 w-auto" />
        </Link>

        {!shouldHideContent && user && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`sm:hidden focus:outline-none ${textColorClass}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}

        {!shouldHideContent && user && (
          <div
            className={`hidden sm:flex items-center gap-4 ${textColorClass}`}
          >
            {/* Consistent order: Profile, New Post, Groups, Search, FriendRequests, User Profile, Logout */}
            <Link
              to="/profile"
              className="text-sm hover:underline flex items-center gap-1"
            >
              <span>Profile</span>
              {incomingCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] leading-none px-1.5 py-0.5">
                  {incomingCount}
                </span>
              )}
            </Link>
            <Link to="/new" className="text-sm hover:underline">
              New Post
            </Link>
            <Link to="/groups" className="text-sm hover:underline">
              Groups
            </Link>

            <div className="relative">
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onFocus={() => setFocus(true)}
                onBlur={() => setTimeout(() => setFocus(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    goFirstResult();
                  }
                }}
                type="text"
                placeholder="users, groups"
                className="w- bg-white text-gray-900 placeholder-gray-500 rounded pl-8 pr-3 py-1 text-sm shadow outline-none focus:ring-2 focus:ring-blue-500"
              />
              <SearchIcon
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
              {focus && term.trim().length >= 2 && (
                <div className="absolute z-50 mt-1 w-[10rem] bg-white text-gray-900 rounded shadow-lg border border-gray-200">
                  {loading && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Searching…
                    </div>
                  )}
                  {!loading &&
                    results.users.length === 0 &&
                    results.groups.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No results
                      </div>
                    )}
                  {!loading && results.users.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-xs uppercase tracking-wider text-gray-400">
                        Users
                      </div>
                      {results.users.map((u) => (
                        <button
                          key={u.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            navigate("/profile/" + u.id);
                            setTerm("");
                            setFocus(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <img
                            src={u.photoURL || "/images/avatar-placeholder.png"}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="text-sm">{u.displayName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!loading && results.groups.length > 0 && (
                    <div className="py-1 border-t border-gray-100">
                      <div className="px-3 py-1 text-xs uppercase tracking-wider text-gray-400">
                        Groups
                      </div>
                      {results.groups.map((g) => (
                        <button
                          key={g.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            navigate("/groups/" + g.id);
                            setTerm("");
                            setFocus(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <img
                            src={g.logoURL || "/images/group-placeholder.png"}
                            alt=""
                            className="w-6 h-6 rounded object-cover"
                          />
                          <span className="text-sm">{g.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <FriendRequestsMenu />

            {user.isAdmin && (
              <Link
                to="/admin"
                className="text-sm hover:underline"
                onClick={() => setMenuOpen(false)}
              >
                Admin
              </Link>
            )}

            <Link
              to="/user-profile"
              className="text-sm hidden sm:inline hover:underline"
            >
              {user.displayName || user.email}
            </Link>

            <button onClick={logout} className="text-sm hover:underline">
              Logout
            </button>
          </div>
        )}
      </div>

      {menuOpen && !shouldHideContent && user && (
        <div className={`sm:hidden mt-4 flex flex-col gap-2 ${textColorClass}`}>
          {/* Same consistent order: Profile, New Post, Groups, Search, FriendRequests, User Profile, Logout */}
          <Link
            to="/profile"
            className="text-sm hover:underline flex items-center gap-1"
            onClick={() => setMenuOpen(false)}
          >
            <span>Profile</span>
            {incomingCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] leading-none px-1.5 py-0.5">
                {incomingCount}
              </span>
            )}
          </Link>
          <Link
            to="/new"
            className="text-sm hover:underline"
            onClick={() => setMenuOpen(false)}
          >
            New Post
          </Link>
          <Link
            to="/groups"
            className="text-sm hover:underline"
            onClick={() => setMenuOpen(false)}
          >
            Groups
          </Link>

          <div className="relative">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  navigate(
                    results.users[0]
                      ? "/profile/" + results.users[0].id
                      : results.groups[0]
                      ? "/groups/" + results.groups[0].id
                      : "/"
                  );
                  setMenuOpen(false);
                }
              }}
              type="text"
              placeholder="users, groups"
              className="w-1/2 bg-white text-gray-900 placeholder-gray-500 rounded pl-8 pr-3 py-2 text-sm shadow outline-none"
            />
            <SearchIcon
              size={16}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
            {focus && term.trim().length >= 2 && (
              <div className="absolute z-50 mt-1 w-full bg-white text-gray-900 rounded shadow-lg border border-gray-200">
                {loading && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Searching…
                  </div>
                )}
                {!loading &&
                  results.users.length === 0 &&
                  results.groups.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No results
                    </div>
                  )}
                {!loading && results.users.length > 0 && (
                  <div className="py-1">
                    <div className="px-3 py-1 text-xs uppercase tracking-wider text-gray-400">
                      Users
                    </div>
                    {results.users.map((u) => (
                      <button
                        key={u.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          navigate("/profile/" + u.id);
                          setTerm("");
                          setFocus(false);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <img
                          src={u.photoURL || "/images/avatar-placeholder.png"}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-sm">{u.displayName}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!loading && results.groups.length > 0 && (
                  <div className="py-1 border-t border-gray-100">
                    <div className="px-3 py-1 text-xs uppercase tracking-wider text-gray-400">
                      Groups
                    </div>
                    {results.groups.map((g) => (
                      <button
                        key={g.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          navigate("/groups/" + g.id);
                          setTerm("");
                          setFocus(false);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <img
                          src={g.logoURL || "/images/group-placeholder.png"}
                          alt=""
                          className="w-6 h-6 rounded object-cover"
                        />
                        <span className="text-sm">{g.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2">
            <FriendRequestsMenu />
          </div>

          {user.isAdmin && (
            <Link
              to="/admin"
              className="text-sm hover:underline"
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </Link>
          )}

          <Link
            to="/user-profile"
            className="text-sm hover:underline"
            onClick={() => setMenuOpen(false)}
          >
            {user.displayName || user.email}
          </Link>

          <button
            onClick={() => {
              logout();
              setMenuOpen(false);
            }}
            className="text-sm hover:underline"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
[file content end]