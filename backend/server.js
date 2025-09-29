import express from "express";
import { WebSocketServer } from "ws";
import { TikTokLiveConnection } from "tiktok-live-connector";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: "https://tiktok-live-connector.vercel.app",
    methods: ["GET", "POST"],
  })
);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const connections = {};
let giftCatalog = {};

// Load gifts
const loader = new TikTokLiveConnection("anyuser");
loader
  .fetchAvailableGifts()
  .then((gifts) => {
    gifts.forEach((gift) => {
      giftCatalog[gift.id] = {
        name: gift.name,
        diamonds: gift.diamondCost || gift.diamondCount || 0,
        image: gift.image?.urlList?.[0] || gift.image?.url?.[0] || null,
      };
    });
    console.log(`✅ Gift catalog loaded: ${Object.keys(giftCatalog).length} items`);
  })
  .catch((err) => {
    console.error("❌ Failed to fetch gift list:", err);
  });

// ======================= API =======================
app.get("/connect", async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ status: "error", message: "Username required" });
  }

  if (!connections[username]) {
    const tiktok = new TikTokLiveConnection(username, {
      signApiKey: process.env.EULER_API_KEY,
    });
    connections[username] = tiktok;

    function getImageUrl(obj) {
      return obj?.urlList?.[0] || obj?.url?.[0] || obj?.url || null;
    }

    // Event Handlers ================================
    tiktok.on("chat", (data) => {
      broadcast({
        type: "chat",
        username,
        nickname: data.user?.nickname || data.user?.uniqueId,
        uniqueId: data.user?.uniqueId,
        comment: data.comment,
        profilePictureUrl: getImageUrl(data.user?.profilePicture),
      });
    });

    tiktok.on("gift", (data) => {
      const catalogGift = giftCatalog[data.giftId] || {};
      const details = data.giftDetails || {};
      if (data.giftType === 1 && !data.repeatEnd) return;

      const diamonds =
        (catalogGift.diamonds || details.diamondCount || 0) *
        (data.repeatCount || 1);

      broadcast({
        type: "gift",
        username,
        nickname: data.user?.nickname || data.user?.uniqueId,
        uniqueId: data.user?.uniqueId,
        giftId: data.giftId,
        giftName: catalogGift.name || data.giftDetails?.giftName || "Unknown",
        repeatCount: data.repeatCount,
        diamondCount: diamonds,
        profilePictureUrl: getImageUrl(data.user?.profilePicture),
        giftImage:
          catalogGift.image || data.giftDetails?.giftImage?.urlList?.[0] || null,
      });
    });

    tiktok.on("like", (data) => {
      broadcast({
        type: "like",
        username,
        nickname: data.user?.nickname || data.user?.uniqueId,
        uniqueId: data.user?.uniqueId,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount,
        profilePictureUrl: getImageUrl(data.user?.profilePicture),
      });
    });

    tiktok.on("member", (data) => {
      broadcast({
        type: "join",
        username,
        nickname: data.user?.nickname || data.user?.uniqueId,
        uniqueId: data.user?.uniqueId,
        profilePictureUrl: getImageUrl(data.user?.profilePicture),
        viewerCount: data.viewerCount || data.roomUserCount || 0,
      });
    });

    tiktok.on("follow", (data) => {
      broadcast({
        type: "follow",
        username,
        nickname: data.user?.nickname || data.user?.uniqueId,
        uniqueId: data.user?.uniqueId,
        profilePictureUrl: getImageUrl(data.user?.profilePicture),
      });
    });

    tiktok.on("share", (data) => {
      broadcast({
        type: "share",
        username,
        nickname: data.user?.nickname || data.user?.uniqueId,
        uniqueId: data.user?.uniqueId,
        profilePictureUrl: getImageUrl(data.user?.profilePicture),
      });
    });

    tiktok.on("roomUser", (data) => {
      broadcast({
        type: "viewer",
        username,
        viewerCount: data.viewerCount,
      });
    });

    tiktok.on("disconnected", () => {
      console.log(`⚠️ Live stream ${username} ended`);
      broadcast({
        type: "end",
        username,
        message: `Live stream for ${username} has ended.`,
      });
      delete connections[username];
    });

    tiktok.on("error", (err) => {
      if (err?.exception?.message?.includes("WebcastInRoomBannerMessage")) {
        console.log(
          `ℹ️ [${username}] Skipped decode error for WebcastInRoomBannerMessage`
        );
        return;
      }
      if (err?.info?.includes("Failed to retrieve Room ID")) {
        console.log(`ℹ️ [${username}] Fallback to API source for Room ID`);
      } else {
        console.warn(`⚠️ [${username}] TikTok error:`, err?.message || err);
        if (err?.exception) console.debug(err.exception);
      }
    });

    try {
      await tiktok.connect();
      console.log(`✅ Connected to ${username}`);
    } catch (err) {
      console.error("❌ Failed to connect:", err);

      if (err.message.includes("UserOfflineError")) {
        return res.status(400).json({
          status: "error",
          message: `User ${username} is offline or not currently live.`,
        });
      }

      return res.status(500).json({ status: "error", message: err.message });
    }
  }

  res.json({ status: "ok", message: `Connected to ${username}` });
});

// ======================= Helper =======================
function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(str);
  });
}

// ======================= START =======================
server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${port}`);
  console.log(`📡 WebSocket running on ws://0.0.0.0:${port}`);
});
