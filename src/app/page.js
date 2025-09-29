"use client";
import { useEffect, useState, useMemo , useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    viewerCount: 0,
    totalLikes: 0,
    totalDiamonds: 0,
  });
  const [leaderboard, setLeaderboard] = useState({});
  const [viewers, setViewers] = useState([]);
  const [giftPopup, setGiftPopup] = useState(null);
  const positions = useRef({});

  
  useEffect(() => {
    if (!connected) return;

    const socket = new WebSocket("ws://localhost:8080");

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.username !== username) return;
    
      setEvents((prev) => [data, ...prev].slice(0, 50));
    
      if (data.type === "join" && data.viewerCount) {
        setStats((s) => ({ ...s, viewerCount: data.viewerCount }));
      }
    
      if (data.type === "viewer")
        setStats((s) => ({ ...s, viewerCount: data.viewerCount }));
    
      if (data.type === "like")
        setStats((s) => ({ ...s, totalLikes: data.totalLikeCount }));
    
      if (data.type === "gift") {
        setStats((s) => ({
          ...s,
          totalDiamonds: s.totalDiamonds + (data.diamondCount || 0),
        }));
    
        setGiftPopup({
          id: Date.now(),
          nickname: data.nickname,
          avatar: data.profilePictureUrl,
          giftName: data.giftName,
          count: data.repeatCount,
          diamonds: data.diamondCount,
        });
        
    
        setTimeout(() => setGiftPopup(null), 5000);
      }
    
      setLeaderboard((lb) => {
        const current = lb[data.uniqueId] || {
          nickname: data.nickname,
          avatar: data.profilePictureUrl,
          diamonds: 0,
        };
        return {
          ...lb,
          [data.uniqueId]: {
            ...current,
            diamonds: current.diamonds + (data.diamondCount || 0),
          },
        };
      });
      if (data.type === "join" && data.profilePictureUrl) {
        setViewers((prev) => {
          if (prev.some((v) => v.id === data.uniqueId)) return prev;
          return [
            ...prev,
            { id: data.uniqueId, avatar: data.profilePictureUrl },
          ].slice(-100);
        });
      }
    
      if (["join", "like", "follow", "share", "gift"].includes(data.type)) {
        const id = Date.now() + Math.random();
        setNotifications((prev) => [...prev, { ...data, id }]);
        setTimeout(
          () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
          2000
        );
      }
    };
    
    return () => socket.close();
  }, [connected, username]);

  const handleConnect = async () => {
    if (!username) return alert("Masukkan username TikTok");
    const res = await fetch(
      `/api/connect?username=${username.replace("@", "")}`
    );
    const json = await res.json();
    if (json.status === "ok") setConnected(true);
    else alert(json.message || "Gagal connect");
  };

  const leaderboardSorted = Object.entries(leaderboard)
    .sort((a, b) => b[1].diamonds - a[1].diamonds)
    .slice(0, 5);

  return (
    <main className="relative h-screen bg-black text-white overflow-hidden">
      {/* Header Stats */}
      <div className="absolute top-2 left-2 flex gap-4 bg-black/50 px-4 py-2 rounded text-sm font-bold shadow-lg">
        <span>👀 {stats.viewerCount}</span>
        <span>❤️ {stats.totalLikes}</span>
        <span>💎 {stats.totalDiamonds}</span>
      </div>

      {/* Leaderboard */}
      <div className="absolute top-2 right-2 w-64 bg-black/50 px-4 py-2 rounded text-sm shadow-lg">
        <h2 className="font-bold mb-2 text-center">🏆 Top Gifter</h2>
        <ul className="space-y-1">
          {leaderboardSorted.map(([id, user], i) => (
            <li key={id} className="flex items-center gap-2">
              <span className="w-4 text-gray-300">{i + 1}.</span>
              <img
                src={user.avatar}
                alt={user.nickname}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="truncate">{user.nickname}</span>
              <strong className="ml-auto">{user.diamonds}💎</strong>
            </li>
          ))}
        </ul>
      </div>
<div className="absolute inset-0 pointer-events-none overflow-hidden">
  {viewers.map((v) => {
    if (!positions.current[v.id]) {
      positions.current[v.id] = {
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
        duration: 6 + Math.random() * 8,
        delay: Math.random() * 3,
      };
    }
    const { x, y, duration, delay } = positions.current[v.id];

    return (
      <img
        key={v.id}
        src={v.avatar}
        className="w-10 h-10 rounded-full object-cover absolute animate-floating"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
          willChange: "transform",
        }}
      />
    );
  })}
</div>

{giftPopup && (
  <AnimatePresence>
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      <div className="flex flex-col items-center">
        {/* Ganti giftImage dengan avatar pengirim */}
        <img
          src={giftPopup.avatar} 
          alt={giftPopup.nickname}
          className="w-40 h-40 rounded-full object-cover drop-shadow-lg"
        />
        <p className="mt-2 text-xl font-bold text-yellow-400 text-center">
          {giftPopup.nickname} 🎁 {giftPopup.giftName} x{giftPopup.count}
        </p>
      </div>
    </motion.div>
  </AnimatePresence>
)}


      {/* Connect Overlay */}
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="flex flex-col gap-4 items-center bg-gray-900 px-6 py-4 rounded shadow-md">
            <div className="flex gap-2 w-full">
              <input
                type="text"
                placeholder="Masukkan username TikTok"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="p-2 rounded text-white outline-none font-bold flex-1 bg-gray-800"
              />
              <button
                onClick={handleConnect}
                className="bg-pink-500 hover:bg-blue-600 px-4 py-2 rounded font-bold text-white"
              >
                Connect
              </button>
            </div>
            <h1 className="text-lg font-bold text-pink-400">
              TikTok Live by Chesko
            </h1>
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="absolute top-1/5 left-2 flex flex-col gap-1 z-50">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-bold
              ${
                n.type === "like"
                  ? "bg-pink-600/70"
                  : n.type === "gift"
                  ? "bg-yellow-600/70"
                  : n.type === "join"
                  ? "bg-blue-500/70"
                  : n.type === "follow"
                  ? "bg-green-500/70"
                  : "bg-orange-500/70"
              }
              transition-transform transform duration-700 ease-out animate-slideIn animate-fadeOut
            `}
          >
            {n.profilePictureUrl && (
              <img
                src={n.profilePictureUrl}
                alt={n.nickname}
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span className="truncate max-w-xs">
              {n.nickname} {n.type === "join" && "👋 bergabung"}
              {n.type === "like" && `❤️ +${n.likeCount}`}
              {n.type === "follow" && "⭐ mulai mengikuti"}
              {n.type === "share" && "📤 membagikan live"}
              {n.type === "gift" &&
                `🎁 ${n.giftName} x${n.repeatCount} (${n.diamondCount}💎)`}
            </span>
          </div>
        ))}
      </div>

      {/* Chat Box */}
      <div className="absolute bottom-32 left-2 right-2 max-h-1/3 overflow-y-auto flex flex-col gap-1">
        {events
          .filter((e) => e.type === "chat")
          .map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm bg-black/40 px-2 py-1 rounded hover:bg-black/60 transition"
            >
              {e.profilePictureUrl && (
                <img
                  src={e.profilePictureUrl}
                  alt={e.nickname}
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span>
                <strong className="text-pink-400">{e.nickname}</strong>:{" "}
                {e.comment}
              </span>
            </div>
          ))}
      </div>
    </main>
  );
}
