#!/bin/bash
set -e

echo "Populating backend files..."

# ============================================================
# src/state/stores.js
# ============================================================
cat > src/state/stores.js << 'EOF'
export const rooms = new Map();
export const roomStates = new Map();
export const idtoSocket = new Map();
export const roomAdmins = new Map();
export const huntCount = new Map();
export const ingameState = new Map();
EOF

# ============================================================
# src/helpers/hunterNum.js
# ============================================================
cat > src/helpers/hunterNum.js << 'EOF'
export function hunterNum(size) {
    if (size > 1 && size < 6) {
        return 1;
    }
    if (size >= 6 && size < 10) {
        return 2;
    }
    return 0;
}
EOF

# ============================================================
# src/helpers/resetPlayerState.js
# ============================================================
cat > src/helpers/resetPlayerState.js << 'EOF'
import { ingameState } from "../state/stores.js";

export function resetPlayerState(userName, keepRoom) {
    const st = ingameState.get(userName);
    if (!st) return;
    if (!keepRoom) st.roomId = null;
    st.role = null;
    st.pose = 'Stand';
    st.position = { x: 0, y: 0, z: 0 };
    st.rotation = 0;
    st.color = null;
    st.caught = false;
}
EOF

# ============================================================
# src/helpers/selectHunters.js
# ============================================================
cat > src/helpers/selectHunters.js << 'EOF'
import { rooms } from "../state/stores.js";
import { hunterNum } from "./hunterNum.js";

export function selectHunters(size, roomId) {
    let hunterCount = hunterNum(size);
    const hunterArray = [];
    const currentPlayers = rooms.get(roomId);
    const currentArray = [...currentPlayers];
    while (hunterCount != 0 && currentArray.length > 0) {
        const randIndex = Math.floor(Math.random() * currentArray.length);
        const element = currentArray[randIndex];
        currentArray.splice(randIndex, 1);
        hunterArray.push(element);
        hunterCount--;
    }
    return { hunters: hunterArray, hiders: currentArray };
}
EOF

# ============================================================
# src/helpers/cron.js
# ============================================================
cat > src/helpers/cron.js << 'EOF'
import { rooms, roomStates, idtoSocket } from "../state/stores.js";
import { resetPlayerState } from "./resetPlayerState.js";

export function cron(roomId, topic, time) {
    const handle = setTimeout(() => {
        const players = rooms.get(roomId);
        let result;
        const roomInfo = roomStates.get(roomId);
        if (topic == 'room-end') {
            if (roomInfo.remainingHiders > 0) {
                result = 'hiders won';
            } else {
                result = 'hunters won';
            }
            roomInfo.phase = 'ended';
        }
        if (topic == 'seek-phase') {
            roomInfo.phase = 'seek';
        }
        for (const i of players) {
            const sock = idtoSocket.get(i);
            sock.send(JSON.stringify({
                event: topic,
                roomId: roomId,
                payload: result ? result : null
            }));
        }
        if (topic == 'room-end') {
            for (const i of players) {
                resetPlayerState(i, true);
            }
            roomInfo.phase = 'lobby';
        }
    }, time);

    const state = roomStates.get(roomId);
    if (state) {
        if (topic == 'seek-phase') state.hideTimer = handle;
        if (topic == 'room-end') state.seekTimer = handle;
    }
}
EOF

# ============================================================
# src/handlers/userSetup.js
# ============================================================
cat > src/handlers/userSetup.js << 'EOF'
import { idtoSocket, ingameState } from "../state/stores.js";

export function handleUserSetup(socket, payload) {
    const userName = payload.data.userName;
    if (idtoSocket.get(userName)) {
        socket.send(JSON.stringify({
            message: 'user setup complete'
        }));
        return;
    }
    idtoSocket.set(userName, socket);
    ingameState.set(userName, {
        userName: userName,
        roomId: null,
        role: null,
        pose: 'Stand',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        color: null,
        caught: false,
        connected: true,
    });
    socket.send(JSON.stringify('user setup is complete'));
}
EOF

# ============================================================
# src/handlers/joinRoom.js
# ============================================================
cat > src/handlers/joinRoom.js << 'EOF'
import { rooms, roomStates, idtoSocket, roomAdmins, ingameState } from "../state/stores.js";

export function handleJoinRoom(socket, payload) {
    const roomId = payload.data.roomId;
    const userName = payload.data.userName;
    if (!roomId) {
        socket.send(JSON.stringify('roomId not found'));
        return;
    }
    if (!rooms.get(roomId)) {
        rooms.set(roomId, new Set());
        roomStates.set(roomId, { phase: 'created' });
        roomAdmins.set(roomId, userName);
    }
    rooms.get(roomId).add(userName);
    const userState = ingameState.get(userName);
    if (userState) userState.roomId = roomId;
    const roomState = roomStates.get(roomId);
    if (roomState && roomState.phase == 'created' && rooms.get(roomId).size >= 2) {
        roomState.phase = 'lobby';
    }
    const currentMembers = rooms.get(roomId);
    socket.send(JSON.stringify({
        message: 'succesfully joined the room',
        payload: currentMembers
    }));
    for (const c of currentMembers) {
        const sock = idtoSocket.get(c);
        sock.send(JSON.stringify({
            message: 'a user joined',
            payload: userName
        }));
    }
}
EOF

# ============================================================
# src/handlers/movement.js
# ============================================================
cat > src/handlers/movement.js << 'EOF'
import { rooms, idtoSocket, ingameState } from "../state/stores.js";

export function handleMovement(socket, payload) {
    const roomId = payload.data.roomId;
    const players = rooms.get(roomId);
    if (!players) return;
    const userName = payload.data.userName;
    const userState = ingameState.get(userName);
    if (userState && payload.data.coordinates) {
        userState.position = {
            x: payload.data.coordinates.x,
            y: payload.data.coordinates.y,
            z: payload.data.coordinates.z
        };
        userState.rotation = payload.data.coordinates.ry || 0;
        if (payload.data.coordinates.col) userState.color = payload.data.coordinates.col;
    }
    for (const p of players) {
        const sock = idtoSocket.get(p);
        sock.send(JSON.stringify({
            message: 'a player moved',
            payload: payload.data.coordinates
        }));
    }
}
EOF

# ============================================================
# src/handlers/startGame.js
# ============================================================
cat > src/handlers/startGame.js << 'EOF'
import { rooms, roomStates, idtoSocket, roomAdmins, ingameState } from "../state/stores.js";
import { selectHunters } from "../helpers/selectHunters.js";
import { cron } from "../helpers/cron.js";
import { HIDE_DURATION, ROUND_DURATION, MIN_PLAYERS } from "../config/constants.js";

export function handleStartGame(socket, payload) {
    const senderuserName = payload.data.userName;
    const roomId = payload.data.roomId;
    const hostName = roomAdmins.get(roomId);
    const rsCheck = roomStates.get(roomId);
    if (rsCheck && rsCheck.phase != 'lobby' && rsCheck.phase != 'created') {
        socket.send(JSON.stringify({ event: 'error', message: 'round already running' }));
        return;
    }
    if (hostName == senderuserName) {
        const roomLength = rooms.get(roomId).size;
        if (roomLength < MIN_PLAYERS) {
            socket.send(JSON.stringify({
                event: 'player limit',
                message: 'not enough participants'
            }));
            return;
        }
        const { hunters, hiders } = selectHunters(roomLength, roomId);
        for (const a of hunters) {
            const sock = idtoSocket.get(a);
            const st = ingameState.get(a);
            if (st) { st.role = 'hunter'; st.caught = false; st.pose = 'Stand'; st.color = null; st.position = { x: 0, y: 0, z: 0 }; st.rotation = 0; }
            sock.send(JSON.stringify({
                event: 'game-started',
                role: 'hunter'
            }));
        }

        for (const b of hiders) {
            const sock = idtoSocket.get(b);
            const st = ingameState.get(b);
            if (st) { st.role = 'hider'; st.caught = false; st.pose = 'Stand'; st.color = null; st.position = { x: 0, y: 0, z: 0 }; st.rotation = 0; }
            sock.send(JSON.stringify({
                event: 'game-started',
                role: 'hider'
            }));
        }

        roomStates.set(roomId, {
            phase: 'hide',
            startedAt: Date.now(),

            hunters: [...hunters],
            hiders: [...hiders],
            hunterSet: new Set(hunters),
            hiderSet: new Set(hiders),

            remainingHiders: hiders.length,
            caught: new Set(),

            positions: {},
            poses: {},

            hideTimer: null,
            seekTimer: null,
        });

        cron(roomId, 'seek-phase', HIDE_DURATION);
        cron(roomId, 'round-end', ROUND_DURATION);
    } else {
        socket.send(JSON.stringify('only host can perform this action'));
        return;
    }
}
EOF

# ============================================================
# src/handlers/markCaught.js
# ============================================================
cat > src/handlers/markCaught.js << 'EOF'
import { rooms, roomStates, idtoSocket, ingameState } from "../state/stores.js";
import { resetPlayerState } from "../helpers/resetPlayerState.js";

export function handleMarkCaught(socket, payload) {
    const roomId = payload.data.roomId;
    const senderUsername = payload.data.senderUsername;
    const targetUsername = payload.data.targetUsername;
    const roomInfo = roomStates.get(roomId);
    if (!roomInfo.hunterSet.has(senderUsername) || !roomInfo.hiderSet.has(targetUsername)) {
        socket.send(JSON.stringify({
            event: 'not authorized',
            message: 'not authorized to perform this action'
        }));
        return;
    }
    roomInfo.caught.add(targetUsername);
    roomInfo.remainingHiders = roomInfo.remainingHiders - 1;
    const targetState = ingameState.get(targetUsername);
    if (targetState) targetState.caught = true;
    const players = rooms.get(roomId);
    for (const p of players) {
        const sock = idtoSocket.get(p);
        sock.send(JSON.stringify({
            event: 'player caught',
            hunter: senderUsername,
            hider: targetUsername
        }));
    }

    if (roomInfo.remainingHiders === 0) {
        if (roomInfo.seekTimer) {
            clearTimeout(roomInfo.seekTimer);
            roomInfo.seekTimer = null;
        }
        roomInfo.phase = 'ended';
        for (const p of players) {
            const sock = idtoSocket.get(p);
            sock.send(JSON.stringify({
                event: 'room-end',
                roomId: roomId,
                payload: 'hunters won'
            }));
        }
        for (const p of players) {
            resetPlayerState(p, true);
        }
        roomInfo.phase = 'lobby';
    }
}
EOF

# ============================================================
# src/handlers/changedPose.js
# ============================================================
cat > src/handlers/changedPose.js << 'EOF'
import { rooms, idtoSocket, ingameState } from "../state/stores.js";

export function handleChangedPose(socket, payload) {
    const userName = payload.data.userName;
    const pose = payload.data.pose;
    const currentState = ingameState.get(userName);
    if (!currentState) {
        socket.send("user not found with this username ");
        return;
    }
    currentState.pose = pose;
    const roomId = currentState.roomId;
    const players = rooms.get(roomId);
    for (const p of players) {
        const sock = idtoSocket.get(p);
        sock.send(JSON.stringify({
            event: 'pose changed ',
            userName: userName,
            pose: pose
        }));
    }
}
EOF

# ============================================================
# src/handlers/requestState.js
# ============================================================
cat > src/handlers/requestState.js << 'EOF'
import { ingameState } from "../state/stores.js";

export function handleRequestState(socket, payload) {
    const roomId = payload.data.roomId;
    const filteredData = [];
    for (const p of ingameState.values()) {
        if (p.roomId == roomId) {
            filteredData.push(p);
        }
    }
    socket.send(JSON.stringify({
        event: 'requested data',
        payload: filteredData
    }));
}
EOF

# ============================================================
# src/handlers/leaveRoom.js
# ============================================================
cat > src/handlers/leaveRoom.js << 'EOF'
import { rooms, roomStates, idtoSocket, ingameState } from "../state/stores.js";
import { resetPlayerState } from "../helpers/resetPlayerState.js";

export function handleLeaveRoom(socket, payload) {
    const roomId = payload.data.roomId;
    const userName = payload.data.userName;
    const roomState = roomStates.get(roomId);
    const userState = ingameState.get(userName);
    if (!userState) return;

    if (roomState.phase == 'lobby') {
        rooms.get(roomId).delete(userName);
        resetPlayerState(userName, false);
        const currentMembers = rooms.get(roomId);
        for (const p of currentMembers) {
            const sock = idtoSocket.get(p);
            sock.send(JSON.stringify({
                event: 'user left',
                userName: userName
            }));
        }
        return;
    }

    if (roomState.phase == 'seek' || roomState.phase == 'hide') {
        rooms.get(roomId).delete(userName);
        if (userState.role == 'hider') {
            roomState.remainingHiders = roomState.remainingHiders - 1;
            roomState.hiders = roomState.hiders.filter(c => c != userName);
            roomState.hiderSet.delete(userName);
            if (roomState.remainingHiders == 0) {
                roomState.phase = 'ended';
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'room ended as the last hider left',
                        userName: userName
                    }));
                }
            } else {
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'user left',
                        userName: userName
                    }));
                }
            }
        } else {
            roomState.hunterSet.delete(userName);
            roomState.hunters = roomState.hunters.filter(c => c != userName);
            if (roomState.hunterSet.size == 0) {
                roomState.phase = 'ended';
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'room ended as the hunter left',
                        userName: userName
                    }));
                }
            } else {
                resetPlayerState(userName, false);
                const currentMembers = rooms.get(roomId);
                for (const p of currentMembers) {
                    const sock = idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event: 'user left',
                        userName: userName
                    }));
                }
            }
        }
    }
}
EOF

# ============================================================
# src/lifecycle/onClose.js
# ============================================================
cat > src/lifecycle/onClose.js << 'EOF'
import { rooms, idtoSocket, ingameState } from "../state/stores.js";

export function onClose(socket) {
    let foundUser = null;
    for (const [name, sock] of idtoSocket) {
        if (sock === socket) { foundUser = name; break; }
    }
    if (!foundUser) return;
    const state = ingameState.get(foundUser);
    if (state) state.connected = false;
    idtoSocket.delete(foundUser);
    if (state && state.roomId) {
        const room = rooms.get(state.roomId);
        if (room) {
            room.delete(foundUser);
            for (const p of room) {
                const sock = idtoSocket.get(p);
                if (sock) sock.send(JSON.stringify({
                    event: 'player-left',
                    userName: foundUser
                }));
            }
        }
    }
}
EOF

# ============================================================
# src/router/messageRouter.js
# ============================================================
cat > src/router/messageRouter.js << 'EOF'
import { handleUserSetup } from "../handlers/userSetup.js";
import { handleJoinRoom } from "../handlers/joinRoom.js";
import { handleMovement } from "../handlers/movement.js";
import { handleStartGame } from "../handlers/startGame.js";
import { handleMarkCaught } from "../handlers/markCaught.js";
import { handleChangedPose } from "../handlers/changedPose.js";
import { handleRequestState } from "../handlers/requestState.js";
import { handleLeaveRoom } from "../handlers/leaveRoom.js";

const handlers = {
    "user-setup": handleUserSetup,
    "join-room": handleJoinRoom,
    "movement": handleMovement,
    "start-game": handleStartGame,
    "mark-caught": handleMarkCaught,
    "changed-pose": handleChangedPose,
    "request-state": handleRequestState,
    "leave-room": handleLeaveRoom,
};

export function messageRouter(socket, msg) {
    const payload = JSON.parse(msg);
    const handler = handlers[payload.type];
    if (handler) handler(socket, payload);
}
EOF

# ============================================================
# server.js
# ============================================================
cat > server.js << 'EOF'
import { WebSocketServer } from "ws";
import { PORT } from "./src/config/constants.js";
import { messageRouter } from "./src/router/messageRouter.js";
import { onClose } from "./src/lifecycle/onClose.js";

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
    socket.send(JSON.stringify("connected"));
    socket.on("message", (msg) => messageRouter(socket, msg));
    socket.on("close", () => onClose(socket));
});
EOF

echo "All files populated."
echo ""
echo "Verifying syntax..."
for f in server.js \
         src/config/constants.js \
         src/state/stores.js \
         src/helpers/hunterNum.js \
         src/helpers/resetPlayerState.js \
         src/helpers/selectHunters.js \
         src/helpers/cron.js \
         src/handlers/userSetup.js \
         src/handlers/joinRoom.js \
         src/handlers/movement.js \
         src/handlers/startGame.js \
         src/handlers/markCaught.js \
         src/handlers/changedPose.js \
         src/handlers/requestState.js \
         src/handlers/leaveRoom.js \
         src/lifecycle/onClose.js \
         src/router/messageRouter.js; do
    node --check "$f" && echo "  OK  $f" || echo "  FAIL $f"
done
echo ""
echo "Done. Run: node server.js"
