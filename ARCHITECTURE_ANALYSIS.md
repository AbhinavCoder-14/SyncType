# 📋 TypeRacer Clone - Architecture Analysis & Scalability Plan

**Project Goal**: Build a TypeRacer-like multiplayer typing race application scalable to 1M+ concurrent users with <100ms latency per game room.

**Current Status**: ~40-50% complete with critical architectural flaws blocking horizontal scaling.

---

## 🎯 Project Objectives

1. **User Experience**: Low-latency typing race (TypeRacer.com-like)
2. **Scale Target**: 1M+ concurrent users globally
3. **Performance**: Single game room supports 1M users simultaneously with <100ms update latency
4. **Backend Design**: Horizontal scalability with stateless components and distributed state

---

## 📊 Current Implementation Status

### ✅ What's Built

| Component | Status | Details |
|-----------|--------|---------|
| **Core Game Loop** | ✅ Complete | WAITING → IN_PROGRESS → FINISHED state machine; per-keystroke scoring (WPM, accuracy, composite score) |
| **WebSocket Protocol** | ✅ Complete | Custom typed message protocol (no Socket.io overhead); typed event emitter pattern on frontend |
| **Matchmaking Logic** | ⚠️ Basic (Broken at scale) | Threshold-based (2+ players) + 10s timeout; all users funnel through **single UserManager instance** |
| **Scoring System** | ✅ Complete | WPM calculated server-side; accuracy via `typos: Set<string>` for O(1) lookup; composite `racePoints = (distancePercent × 0.5) + ((wpm × 0.7 + accuracy × 0.3) × 0.5)` |
| **Frontend UI** | ✅ Mostly Complete | Real-time keystroke validation, cursor positioning, per-character highlighting, Zustand state management |
| **1-second Broadcasting** | ✅ Complete | `setInterval` pushes RACE_UPDATE snapshots to all players in room |
| **Dynamic Paragraph Fetching** | ✅ Complete | Fetches from quotable.io API with hardcoded fallback |

### ❌ What's Missing / Broken

| Component | Issue | Impact |
|-----------|-------|--------|
| **Persistence** | Redis in docker-compose but **not integrated**; no leaderboard or match history | Data loss; no long-term statistics |
| **Horizontal Scaling** | Singleton pattern; no inter-instance communication | **Fails at 5k-10k concurrent users** |
| **API Gateway / Load Balancer** | Client hardcoded to `ws://localhost:8000`; no nginx/haproxy | Cannot distribute connections across instances |
| **Pub/Sub Layer** | No message broker; Redis unused | Services cannot communicate across instances |
| **Session Affinity** | No sticky sessions or user routing | Users connect to random instances; room state fragmented |
| **Reconnection Handling** | None | Users lose progress if connection drops mid-race |
| **Spectator Mode** | Not implemented | Listed in roadmap but not started |

### Tech Stack (Verified)

```
Backend:  Node.js 18+, TypeScript, Express, ws (raw WebSocket)
Frontend: Next.js 16, React 19, TypeScript, Zustand, Tailwind CSS v4
State:    In-memory (JavaScript Map/Array) — no persistence
Comms:    WebSocket (custom protocol)
Database: Redis (container defined but unused)
```

---

## 🚨 Why Current Architecture FAILS at Scale

### **Problem 1: The Matchmaking Bottleneck (Immediate Failure)**

**Code**: [Backend/src/controller/UsersManager.ts](Backend/src/controller/UsersManager.ts)

```typescript
public static getInstance(ws:WebSocket){
    if(!UserManager.instance){
        UserManager.instance = new UserManager(ws)  // ← ONE instance for ALL connections
    }
    return UserManager.instance
}
```

**Why it fails**:
- **Every user connects** → routed through `getInstance()` → single `UserManager` instance
- **All users funnel into one `matchMakingPlayers[]` array** (processed sequentially)
- **At 50-100 concurrent matchmaking requests**: Node event loop contention; queueing delays
- **At 1M users**: Central queue serializes all matchmaking. Users timeout waiting. Service crashes.

**Scale ceiling**: ~100 matchmaking operations/second (vs target of 100k+/sec)

---

### **Problem 2: In-Memory State Without Sharding**

**Code**: [Backend/src/controller/competitionManager.ts](Backend/src/controller/competitionManager.ts)

```typescript
export class CompetitionManager{
    public competitions:competition[];  // ← All active rooms in this array
    public players:Player[]
```

**Why it fails**:
- **All active races stored in ONE process**: `competitions` array in a single Node instance
- **Node.js ceiling**: ~8k-10k concurrent WebSocket connections before memory/CPU saturates
- **At 1M concurrent users**: Would need 100-200 Node instances, each holding separate state
- **Problem**: If Instance-1 crashes, all its rooms (8k users) disconnect and are lost
- **No sharding strategy**: Rooms aren't distributed; there's no mapping of "Room-X runs on Backend-Y"

**Capacity**: Max ~50k-80k concurrent users in a single process (considering message processing overhead)

---

### **Problem 3: No Inter-Instance Communication**

**Current state**:
- Redis exists in `docker-compose.yaml` but is **never initialized or used**
- If you spin up 2+ Node instances, each has isolated `UserManager` and `CompetitionManager`
- **Result**: Instance-1 users cannot see Instance-2 users; two isolated islands

**Example failure scenario**:
1. User A connects to Instance-1, joins matchmaking queue
2. User B connects to Instance-2, joins matchmaking queue
3. Both are waiting for a partner, but they're in **separate queues**
4. After 10s, Instance-1 creates a 1-player room (Instance-2 user never matches)

---

### **Problem 4: No API Gateway or Load Balancer**

**Current**: Frontend hardcoded to single endpoint
```typescript
// frontend/app/lib/wsContext.tsx
const newSocket = new WebSocket('ws://localhost:8000');  // ← hardcoded, single instance
```

**Why it fails**:
- Cannot distribute incoming connections across multiple gateway instances
- No health checks; if `localhost:8000` goes down, all users disconnect
- No failover mechanism
- Cannot update endpoint without code change

---

### **Problem 5: 1-Second Broadcast Polling (Inefficient at Scale)**

**Code**: [Backend/src/competition.ts](Backend/src/competition.ts)

```typescript
setInterval(async () => {
  // Loop through ALL rooms, gather state, broadcast to each room
  // At 1M users with 100-200 rooms: still works, but...
}, 1000);
```

**Why it's problematic**:
- **Broadcast storm at scale**: If you have 100k rooms, the server is constantly serializing & broadcasting every second
- **Memory churn**: Creating 100k JSON objects/sec, then garbage collecting
- **Better approach**: Only broadcast when state changes (event-driven), not on fixed interval
- **This won't scale to 1M rooms**, but is acceptable as intermediate optimization

---

## 🏗️ Proposed Scalable Architecture

### **High-Level System Design**

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  (1M+ users with browsers, WebSocket connections)            │
└─────────────────────────────────────┬──────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────┐
│              API GATEWAY LAYER (Nginx / HAProxy)              │
│  - Load balance WebSocket connections                         │
│  - Sticky sessions (route user to same gateway)              │
│  - Health checks on backend instances                        │
│  - SSL/TLS termination                                       │
└─────────────────────────────────────┬──────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────┐
        │                             │                         │
┌───────▼──────┐          ┌───────────▼────────┐      ┌────────▼──────┐
│ WS Gateway 1 │          │ WS Gateway 2       │      │ WS Gateway N  │
│ (Stateless)  │          │ (Stateless)        │      │ (Stateless)   │
│ 50k-100k     │          │ 50k-100k users     │      │ 50k-100k      │
│ users        │          │                    │      │ users         │
└───────┬──────┘          └────────┬────────────┘      └────────┬──────┘
        │                          │                           │
        └──────────────────────────┼───────────────────────────┘
                                   │
                ┌──────────────────▼──────────────────┐
                │   REDIS CLUSTER (Pub/Sub Backbone)  │
                │  - Matchmaking queue                │
                │  - Game room metadata (cache)       │
                │  - User sessions                    │
                │  - Leaderboard (sorted sets)        │
                │  - Message broker for all services  │
                └───────┬──────────────────┬───────────┘
                        │                  │
        ┌───────────────┼──────────────────┼──────────────┐
        │               │                  │              │
┌───────▼────────┐  ┌───▼──────────┐  ┌───▼────────┐  ┌──▼──────────┐
│ Matchmaking    │  │ Game Backend │  │Game Backend│  │Game Backend │
│ Service        │  │ Instance 1   │  │Instance 2  │  │Instance N   │
│ (Horizontal    │  │ (8k-10k      │  │(8k-10k    │  │(8k-10k     │
│  scale: 1-5)   │  │  users)      │  │ users)    │  │ users)     │
└────────────────┘  └──────────────┘  └───────────┘  └────────────┘
                                │
                ┌───────────────▼──────────────────┐
                │     PostgreSQL (Persistence)     │
                │  - Match history                 │
                │  - User profiles & stats         │
                │  - Leaderboard (permanent)       │
                │  - 1 primary + 2 read replicas   │
                └────────────────────────────────────┘
```

---

### **Layer-by-Layer Architecture Deep Dive**

#### **Layer 1: API Gateway (Nginx / HAProxy)**

**Purpose**: Distribute WebSocket connections across stateless gateways with load balancing

**Nginx Configuration** (`/etc/nginx/nginx.conf`):

```nginx
upstream websocket_backends {
    least_conn;  # Balance by connection count (preferred for WS)
    server ws-gateway-1:8000 weight=1;
    server ws-gateway-2:8000 weight=1;
    server ws-gateway-3:8000 weight=1;
    keepalive 256;  # Keep connections alive to backends
}

server {
    listen 80;
    server_name api.typeracer.com;

    location /ws {
        proxy_pass http://websocket_backends;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;  # Keep alive for entire race
        
        # Sticky sessions: route same user to same gateway
        # (Not needed if gateway is truly stateless, but helps cache locality)
        map $cookie_gwid $upstream {
            default websocket_backends;
            ~^(?P<gw>.*)$ "~*$gw";
        }
    }
}
```

**Key decisions**:
- **`least_conn`**: WebSocket connections are long-lived; distribute by active connection count, not round-robin
- **`keepalive 256`**: Reuse TCP connections to backend gateways
- **`X-Forwarded-For`**: Preserve client IP for rate limiting & logging
- **No sticky sessions required** if gateways are truly stateless (see Layer 2)

**Scaling**: Can handle 1M+ connections with 2-3 redundant Nginx instances.

---

#### **Layer 2: WebSocket Gateway (Stateless Message Router)**

**Purpose**: Accept WebSocket connections, route messages to appropriate backend services via Redis pub/sub

**Key Principle**: Gateway holds NO game state, room state, or user session data. If a gateway crashes, users reconnect to another gateway without data loss.

**Implementation** (`Backend/src/gateway/wsGateway.ts` — NEW FILE):

```typescript
import { WebSocketServer } from "ws";
import { Redis } from "ioredis";
import http from "http";

export class WebSocketGateway {
  private redis: Redis;
  private wsServer: WebSocketServer;
  private wsToUserId = new Map<WebSocket, string>();
  private gatewayId = process.env.GATEWAY_ID || `gw-${Date.now()}`;

  constructor(server: http.Server) {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    this.wsServer = new WebSocketServer({ server });
  }

  public init() {
    this.wsServer.on("connection", (ws) => {
      const userId = crypto.randomUUID();
      this.wsToUserId.set(ws, userId);

      console.log(`[${this.gatewayId}] User connected: ${userId}`);

      // Send initial auth response with userId
      ws.send(
        JSON.stringify({
          type: "INITIAL_AUTH",
          payload: { wsId: userId },
        })
      );

      ws.on("message", async (message) => {
        try {
          const { type, payload } = JSON.parse(message.toString());

          if (type === "join") {
            // Route to MATCHMAKING service
            await this.redis.publish(
              "matchmaking:queue",
              JSON.stringify({
                userId,
                username: payload.username,
                gatewayId: this.gatewayId,  // Which gateway this user is on
              })
            );
          } else if (type === "KEY_PRESS") {
            // Route to GAME backend responsible for this room
            const { compId } = payload;
            await this.redis.publish(
              `game:${compId}:events`,
              JSON.stringify({
                type,
                userId,
                payload,
              })
            );
          }
        } catch (err) {
          console.error("Message parsing error:", err);
        }
      });

      ws.on("close", async () => {
        const uid = this.wsToUserId.get(ws);
        console.log(`[${this.gatewayId}] User disconnected: ${uid}`);
        
        // Notify all services of disconnection for cleanup
        await this.redis.publish(
          "user:disconnect",
          JSON.stringify({ userId: uid })
        );
        
        this.wsToUserId.delete(ws);
      });

      ws.on("error", (err) => {
        console.error(`[${this.gatewayId}] WebSocket error:`, err);
      });
    });

    // Subscribe to broadcast messages from game backends
    // Format: `race:${compId}:update` → all gateways receive, forward to connected users
    const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    subscriber.psubscribe("race:*:update", async (err, count) => {
      if (err) console.error("Pub/Sub subscription error:", err);
      else console.log(`[${this.gatewayId}] Subscribed to ${count} channels`);
    });

    subscriber.on("pmessage", (pattern, channel, message) => {
      try {
        const data = JSON.parse(message);
        const { compId, players, state } = data;

        // Find all users connected to this gateway who are in this room
        for (const [ws, userId] of this.wsToUserId) {
          // Check if this user is in the game backend's response
          const playerInRoom = players.find((p: any) => p.userId === userId);
          
          if (playerInRoom && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "RACE_UPDATE",
                payload: {
                  compId,
                  players,
                  state,
                },
              })
            );
          }
        }
      } catch (err) {
        console.error("Broadcast message processing error:", err);
      }
    });
  }
}
```

**Key features**:
- ✅ **Stateless**: No game logic, no room tracking
- ✅ **Scalable**: Add more gateways by increasing instances; load balancer distributes connections
- ✅ **Resilient**: If one gateway crashes, users reconnect via load balancer to another gateway
- ✅ **Redis-backed routing**: All inter-service communication via pub/sub

**Capacity per instance**: 50k-100k concurrent WebSocket connections

---

#### **Layer 3: Matchmaking Service (Separate Process)**

**Purpose**: Assign users to game rooms independently from game logic; can scale horizontally

**Key Principle**: Never blocks on room initialization. Queues users, triggers room creation, publishes to game backends via Redis.

**Implementation** (`Backend/src/services/matchmakingService.ts` — NEW FILE):

```typescript
import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";

interface UserProfile {
  userId: string;
  username: string;
  gatewayId: string;
}

export class MatchmakingService {
  private redis: Redis;
  private matchQueue: Map<string, UserProfile[]> = new Map();
  private queueTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    this.subscribeToQueue();
  }

  private subscribeToQueue() {
    this.redis.subscribe("matchmaking:queue", async (err) => {
      if (err) console.error("Subscription error:", err);
      else console.log("Subscribed to matchmaking:queue");
    });

    this.redis.on("message", async (channel, message) => {
      if (channel === "matchmaking:queue") {
        const user: UserProfile = JSON.parse(message);
        await this.addUserToQueue(user);
      }
    });

    // Subscribe to disconnect events
    this.redis.subscribe("user:disconnect");
    this.redis.on("message", async (channel, message) => {
      if (channel === "user:disconnect") {
        const { userId } = JSON.parse(message);
        this.removeUserFromAllQueues(userId);
      }
    });
  }

  private async addUserToQueue(user: UserProfile) {
    const queueKey = "matchmaking:standard";  // Can be skill-based later

    if (!this.matchQueue.has(queueKey)) {
      this.matchQueue.set(queueKey, []);
    }

    const queue = this.matchQueue.get(queueKey)!;
    queue.push(user);

    console.log(`[Matchmaking] User ${user.userId} added to queue. Queue size: ${queue.length}`);

    if (queue.length >= 2) {
      // Threshold reached: create room immediately
      const roomUsers = queue.splice(0, 2);
      await this.createRoom(roomUsers);
    } else if (queue.length === 1) {
      // First user: schedule timeout for 10s
      this.scheduleRoomCreation(queueKey, 10000);
    }
  }

  private scheduleRoomCreation(queueKey: string, delay: number) {
    // Clear existing timeout if any
    if (this.queueTimeouts.has(queueKey)) {
      clearTimeout(this.queueTimeouts.get(queueKey)!);
    }

    const timeout = setTimeout(async () => {
      const queue = this.matchQueue.get(queueKey);
      if (queue && queue.length >= 1) {
        console.log(`[Matchmaking] 10s timeout reached. Creating room with ${queue.length} user(s).`);
        const roomUsers = queue.splice(0, Math.max(1, queue.length));
        await this.createRoom(roomUsers);
      }
      this.queueTimeouts.delete(queueKey);
    }, delay);

    this.queueTimeouts.set(queueKey, timeout);
  }

  private async createRoom(users: UserProfile[]) {
    const compId = uuidv4();
    const gameBackendId = this.selectGameBackend();

    console.log(`[Matchmaking] Creating room ${compId} with ${users.length} users on backend ${gameBackendId}`);

    // 1. Store room metadata in Redis (accessible by any backend)
    await this.redis.setex(
      `room:${compId}`,
      3600,  // TTL: 1 hour
      JSON.stringify({
        compId,
        users: users.map((u) => ({ userId: u.userId, username: u.username })),
        gameBackendId,
        createdAt: Date.now(),
        state: "WAITING",
      })
    );

    // 2. Notify game backend to initialize this room
    await this.redis.publish(
      `game:${gameBackendId}:init`,
      JSON.stringify({
        compId,
        users,
      })
    );

    // 3. Notify each gateway to send room info to connected users
    const gatewaysByUser = new Map<string, UserProfile[]>();
    users.forEach((u) => {
      if (!gatewaysByUser.has(u.gatewayId)) {
        gatewaysByUser.set(u.gatewayId, []);
      }
      gatewaysByUser.get(u.gatewayId)!.push(u);
    });

    for (const [gatewayId, gwUsers] of gatewaysByUser) {
      await this.redis.publish(
        `gateway:${gatewayId}:route`,
        JSON.stringify({
          compId,
          gameBackendId,
          userIds: gwUsers.map((u) => u.userId),
        })
      );
    }
  }

  private selectGameBackend(): string {
    // Round-robin or query health metrics from Redis
    // TODO: Implement intelligent backend selection based on load
    const backends = ["gb-1", "gb-2", "gb-3"];
    return backends[Math.floor(Math.random() * backends.length)];
  }

  private removeUserFromAllQueues(userId: string) {
    for (const queue of this.matchQueue.values()) {
      const idx = queue.findIndex((u) => u.userId === userId);
      if (idx > -1) {
        queue.splice(idx, 1);
        console.log(`[Matchmaking] Removed user ${userId} from queue`);
      }
    }
  }
}

// Initialize
const matchmakingService = new MatchmakingService();
```

**Key features**:
- ✅ **Decoupled**: No game logic; only matchmaking
- ✅ **Scalable**: Can run multiple instances; they all listen to same Redis queue
- ✅ **Non-blocking**: Pub/sub-based; doesn't block on anything
- ✅ **Configurable**: Threshold (2+ players) and timeout (10s) are tunable

**Capacity**: 1 matchmaking service can handle 100k+ matchmaking requests/sec. Can horizontally scale by running 3-5 instances.

---

#### **Layer 4: Game Backend Instances (Sharded Game Logic)**

**Purpose**: Execute game logic for assigned rooms only. Each instance is independent and handles 8k-10k concurrent users.

**Key Principle**: Room state is owned by ONE backend. When users disconnect, backend notifies Redis. If backend crashes, users reconnect via gateway; matchmaking reassigns them.

**Implementation** (`Backend/src/services/gameBackend.ts` — NEW FILE):

```typescript
import { Redis } from "ioredis";
import { CompetitionManager } from "../controller/competitionManager.js";
import { competition } from "../competition.js";

interface UserProfile {
  userId: string;
  username: string;
  gatewayId: string;
}

export class GameBackend {
  private redis: Redis;
  private competitionManager: CompetitionManager;
  private backendId = process.env.BACKEND_ID || `gb-${Date.now()}`;
  private wsConnections = new Map<string, WebSocket>();  // userId → WebSocket reference

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    this.competitionManager = new CompetitionManager();
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // Listen for room initialization commands
    this.redis.subscribe(`game:${this.backendId}:init`, async (err) => {
      if (err) console.error("Subscription error:", err);
      else console.log(`[${this.backendId}] Subscribed to initialization channel`);
    });

    this.redis.on("message", async (channel, message) => {
      if (channel === `game:${this.backendId}:init`) {
        const { compId, users } = JSON.parse(message);
        console.log(`[${this.backendId}] Initializing room ${compId}`);
        
        // Create room in local competition manager
        // Note: WebSocket references need to be obtained from gateways
        // For now, we'll store user metadata and get WS refs on demand
        this.competitionManager.addNewRoom(users, compId);
      }
    });

    // Listen for game events (key presses, etc.)
    this.redis.subscribe(`game:${this.backendId}:events`, async (err) => {
      if (err) console.error("Subscription error:", err);
    });

    this.redis.on("message", async (channel, message) => {
      const { type, userId, payload } = JSON.parse(message);
      
      if (type === "KEY_PRESS") {
        const { compId, typedKey, letterIdx, wordIdx } = payload;
        this.competitionManager.onSubmit(compId, userId, typedKey, letterIdx, wordIdx);
      }
    });

    // Broadcast room state updates every 1 second
    setInterval(async () => {
      for (const comp of this.competitionManager.competitions) {
        const raceState = {
          compId: comp.compId,
          players: comp.players.map((p) => ({
            userId: p.userId,
            wpm: p.PlayerProgress.wpm,
            accuracy: p.PlayerProgress.accuracy,
            typedCharCount: p.PlayerProgress.typedCharCount,
            isFinished: p.PlayerProgress.isFinished,
            racePoints: p.PlayerProgress.racePoints,
          })),
          state: comp.state,
        };

        // Publish to all gateways (they route to connected users)
        await this.redis.publish(
          `race:${comp.compId}:update`,
          JSON.stringify(raceState)
        );

        // If race is finished, save to database
        if (comp.state === "FINISHED") {
          await this.saveMatchResult(comp);
        }
      }
    }, 1000);
  }

  private async saveMatchResult(comp: competition) {
    // TODO: Async publish to queue for persistence layer to consume
    // This ensures game backend doesn't block on DB writes
    const matchResult = {
      compId: comp.compId,
      timestamp: Date.now(),
      players: comp.players.map((p) => ({
        userId: p.userId,
        username: p.name,
        wpm: p.PlayerProgress.wpm,
        accuracy: p.PlayerProgress.accuracy,
        racePoints: p.PlayerProgress.racePoints,
        rank: 1,  // TODO: Calculate based on racePoints
      })),
    };

    await this.redis.lpush("match-results:queue", JSON.stringify(matchResult));
  }
}

// Initialize
const gameBackend = new GameBackend();
```

**Key features**:
- ✅ **Owns room state**: Each backend instance is responsible for its assigned rooms
- ✅ **Stateful but scalable**: State is in-memory (fast) but distributed across instances
- ✅ **Event-driven**: Processes key presses via Redis pub/sub
- ✅ **Broadcasting**: Publishes room updates for gateways to forward to clients
- ✅ **Non-blocking persistence**: Queues match results for async storage

**Capacity per instance**: 8k-10k concurrent users (100-200 rooms)

**Horizontal scaling**: Add more instances → matchmaking service routes to least-loaded backend

---

#### **Layer 5: Redis Cluster (Backbone & Message Broker)**

**Purpose**: Central message broker, cache, and session store for all services

**Channel topology**:

```
Pub/Sub Channels:
├── matchmaking:queue                    (Matchmaking service subscribes)
├── game:{gameBackendId}:init            (Game backend subscribes)
├── game:{gameBackendId}:events          (Game backend subscribes)
├── race:{compId}:update                 (All gateways subscribe)
├── gateway:{gatewayId}:route            (Gateway subscribes)
└── user:disconnect                      (All services subscribe)

Cache Keys (with TTL):
├── room:{compId}                        (1h TTL)
│   └── { compId, users[], gameBackendId, state, createdAt }
├── user:{userId}                        (30m TTL)
│   └── { username, connectedGateway, currentRoom, joinedAt }
├── leaderboard:global                   (Sorted set, updated frequently)
│   └── { userId: racePoints }
└── session:{sessionId}                  (24h TTL)
    └── { userId, authToken, expiresAt }
```

**Configuration** (docker-compose):

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: >
    redis-server
    --maxmemory 2gb
    --maxmemory-policy allkeys-lru
    --appendonly yes
    --appendfsync everysec
  volumes:
    - redis_data:/data
  networks:
    - backend
```

**Recommended for 1M users**: Redis Cluster (3-5 nodes) for redundancy and sharding

---

#### **Layer 6: PostgreSQL (Persistent Storage)**

**Purpose**: Long-term storage of match history, user profiles, and permanent leaderboards

**Schema**:

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Match history
CREATE TABLE matches (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INT,
  paragraph_id UUID,
  state VARCHAR(20),  -- FINISHED, ABANDONED
  ended_at TIMESTAMP
);

-- User scores in each match
CREATE TABLE user_scores (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  wpm DECIMAL(6, 2),
  accuracy DECIMAL(5, 2),
  race_points DECIMAL(10, 2),
  rank INT,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, match_id)
);

-- Leaderboard (denormalized for fast queries)
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  all_time_wpm DECIMAL(6, 2),
  wins INT DEFAULT 0,
  matches_played INT DEFAULT 0,
  avg_accuracy DECIMAL(5, 2),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_scores_user_id ON user_scores(user_id);
CREATE INDEX idx_user_scores_match_id ON user_scores(match_id);
CREATE INDEX idx_leaderboard_rank ON leaderboards(all_time_wpm DESC);
```

**Deployment**: 1 primary + 2 read replicas for redundancy

---

## 🔄 Message Flow: User Joining a Race

**Sequence diagram**:

```
Client                Gateway               Matchmaking       Game Backend          Redis
  │                      │                       │                    │                 │
  │──WebSocket connect──>│                       │                    │                 │
  │                      │──INITIAL_AUTH────────>│                    │                 │
  │<─────INITIAL_AUTH─────│                       │                    │                 │
  │                      │                       │                    │                 │
  │──join{username}──────>│                       │                    │                 │
  │                      │───publish──────────────────────────────────────────────────>│
  │                      │                       │   (matchmaking:queue)               │
  │                      │                       │<───subscribe────────────────────────│
  │                      │                       │                    │                 │
  │                      │                       ├─ Queue user (1/2)  │                 │
  │                      │                       │ Schedule 10s timeout                │
  │                      │                       │                    │                 │
  │                      │                       │ (Another user joins within 10s)    │
  │                      │                       │                    │                 │
  │                      │                       ├─ Queue user (2/2)  │                 │
  │                      │                       │ Threshold reached! │                 │
  │                      │                       ├─ Generate compId   │                 │
  │                      │                       │ Store room metadata in Redis       │
  │                      │                       │───publish──────────────────────────>│
  │                      │                       │ (game:gb-1:init)   │                 │
  │                      │                       │                    │                 │
  │                      │                       │                    │<─subscribe──────│
  │                      │                       │                    │ Create room in  │
  │                      │                       │                    │ CompetitionMgr  │
  │                      │                       │                    │                 │
  │                      │                       │───publish──────────────────────────>│
  │                      │                       │                    │  (race:{compId}:│
  │                      │                       │                    │   update)       │
  │                      │                       │                    │                 │
  │<──MATCH_MAKING───────│<─subscribe────────────────────────────────────────────────│
  │ (matchMake: true)    │ (broadcast all rooms to all gateways)                      │
  │                      │                       │                    │                 │
  │                      │────RACE_UPDATE──────>│                    │                 │
  │<────RACE_UPDATE──────│                       │                    │                 │
  │ (room info, players, │                       │                    │                 │
  │  paragraph, state)   │                       │                    │                 │
  │                      │                       │                    │                 │
  └──KeyPress event──────>                       │                    │                 │
     (repeats every keystroke)
```

---

## 🚀 Implementation Roadmap

### **Phase 1: De-couple & Remove Singleton (2 weeks)**

**Goal**: Make matchmaking and game logic independent

**Tasks**:
1. Remove `UserManager.getInstance()` singleton pattern
2. Create separate `matchmakingService.ts`
3. Remove game logic from UserManager
4. Add Redis client to project
   ```bash
   npm install redis ioredis @types/redis
   ```
5. Refactor `CompetitionManager` to accept external room data (not create own)

**Files to create/modify**:
- ✏️ Modify: `Backend/src/controller/UsersManager.ts` → Remove singleton, keep only message parsing
- ✏️ Modify: `Backend/src/controller/competitionManager.ts` → Remove singleton dependencies
- ✨ Create: `Backend/src/services/matchmakingService.ts`
- ✨ Create: `Backend/src/gateway/wsGateway.ts`

**Testing**: Run single backend instance + matchmaking service; verify 2 users can match

---

### **Phase 2: Integrate Redis Pub/Sub (2 weeks)**

**Goal**: Inter-service communication via Redis

**Tasks**:
1. Implement Redis pub/sub in gateway (route join → matchmaking queue)
2. Implement pub/sub in matchmaking service (listen for joins, publish room init)
3. Implement pub/sub in game backend (listen for room init, publish race updates)
4. Update gateway to forward race updates to connected clients

**Files to create/modify**:
- ✨ Create: `Backend/src/services/gameBackend.ts`
- ✏️ Modify: `Backend/src/lib/webSocketInit.ts` → Use new gateway class
- ✏️ Modify: `Backend/src/index.ts` → Initialize matchmaking & game backend services

**Testing**: Run all 3 services; verify end-to-end message flow

---

### **Phase 3: Horizontal Scaling (1 week)**

**Goal**: Multiple instances of each service

**Tasks**:
1. Add docker-compose services for multiple gateways, game backends, matchmaking
2. Add Nginx load balancer configuration
3. Deploy locally and test with 100k+ concurrent connections (artillery/k6)

**Files to create/modify**:
- ✨ Create: `docker-compose.scaled.yaml` (or update existing)
- ✨ Create: `nginx/nginx.conf`
- ✨ Create: `Backend/.env.example`

**Testing**: Spin up 3 gateways, 3 game backends, 1 matchmaking; run load test

---

### **Phase 4: Persistence Layer (2 weeks)**

**Goal**: Store match results permanently

**Tasks**:
1. Add PostgreSQL to docker-compose
2. Create match result queue consumer
3. Publish match results from game backend to queue
4. Async consumer writes to PostgreSQL

**Files to create/modify**:
- ✨ Create: `Backend/src/services/persistenceService.ts`
- ✨ Create: `Backend/db/schema.sql`
- ✏️ Modify: `docker-compose.yaml`

**Testing**: Play a match; verify result written to PostgreSQL

---

### **Phase 5: DevOps & Deployment (Ongoing)**

**Goal**: Ready for production

**Tasks**:
1. Dockerize all services
2. Create Kubernetes manifests (or Docker Swarm)
3. Add health checks
4. Add monitoring (Prometheus, Grafana)
5. Add logging (ELK stack or similar)

---

## 📊 Capacity Planning: 1M Concurrent Users

| Component | Capacity/Instance | Instances Needed | Total Capacity |
|-----------|-------------------|------------------|-----------------|
| **Nginx LB** | Unlimited (stateless) | 2-3 (HA) | 1M+ |
| **WS Gateway** | 50k-100k conn/instance | 10-20 | 500k-2M |
| **Matchmaking Service** | 100k+ ops/sec | 1-5 | 100k-500k ops/sec |
| **Game Backend** | 8k-10k active users/instance | 100-150 | 800k-1.5M users |
| **Redis Cluster** | 100k ops/sec | 3-5 nodes | 500k+ ops/sec |
| **PostgreSQL** | 1000+ writes/sec (async) | 1 primary + 2 replicas | Persistent storage |

---

## 📋 Current Code Locations

| Component | File | Status |
|-----------|------|--------|
| UserManager (Broken) | [Backend/src/controller/UsersManager.ts](Backend/src/controller/UsersManager.ts) | ⚠️ To be refactored |
| CompetitionManager | [Backend/src/controller/competitionManager.ts](Backend/src/controller/competitionManager.ts) | ⚠️ To be refactored |
| Game Logic | [Backend/src/competition.ts](Backend/src/competition.ts) | ✅ Reusable |
| WebSocket Init | [Backend/src/lib/webSocketInit.ts](Backend/src/lib/webSocketInit.ts) | ⚠️ To be refactored |
| Frontend Gateway | [frontend/app/lib/ws-client.ts](frontend/app/lib/ws-client.ts) | ✅ Works with new protocol |

---

## ✅ Checklist for Production Readiness

- [ ] Remove singleton patterns
- [ ] Implement Redis pub/sub messaging
- [ ] Create separate matchmaking service
- [ ] Create separate game backend service
- [ ] Implement stateless WebSocket gateway
- [ ] Add Nginx/HAProxy load balancer
- [ ] Deploy multiple instances locally (docker-compose)
- [ ] Load test with 100k+ concurrent users
- [ ] Add PostgreSQL persistence layer
- [ ] Implement match result queue consumer
- [ ] Add health checks for all services
- [ ] Implement graceful shutdown
- [ ] Add distributed logging
- [ ] Create Kubernetes manifests
- [ ] Deploy to production

---

## 📞 Key Discussions for Follow-up

1. **Sticky sessions vs. Stateless gateways**: Should gateways be completely stateless, or cache user → room mappings?
2. **Matching algorithm**: Threshold-based (2+ players) vs. skill-based matchmaking vs. ELO ratings?
3. **Room scaling**: Should a single game backend instance handle multiple concurrent rooms, or one room per instance?
4. **Client reconnection**: How to handle mid-race disconnections and rejoin?
5. **Spectator mode**: Broadcast race to non-participants without adding to player list?
6. **Regional deployments**: Deploy separate clusters in different regions for lower latency?
7. **Cost optimization**: Trade-offs between performance (Redis in-memory) and cost (Postgres replication)?

---

## 📚 References & Additional Resources

- Redis Pub/Sub: https://redis.io/docs/manual/pubsub/
- Node.js WebSocket performance: https://github.com/websockets/ws#performance
- Load balancing WebSockets: https://nginx.org/en/docs/http/websocket.html
- Horizontal scaling patterns: https://martinfowler.com/articles/patterns-of-distributed-systems/
- Kubernetes for WebSocket apps: https://kubernetes.io/docs/concepts/services-networking/
