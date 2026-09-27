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
