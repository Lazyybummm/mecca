import { WebSocketServer } from "ws";

const wss=new WebSocketServer({port:8080});
const rooms=new Map();
const idtoSocket=new Map();
const roomAdmins=new Map();

wss.on('connection',(socket)=>{
    socket.on('open',()=>{
        socket.send(JSON.stringify('connected'));
    })


    socket.on('message',(msg)=>{
        const payload=JSON.parse(msg);//the msg comes as a binary , json parse converts that into a string for us (otherwsi i had to handle the conversion)


        if(payload.type=='user-setup'){
            const userName=payload.data.userName;
            if( idtoSocket.get(userName)){
                socket.send(JSON.stringify({
                    message:'user setup complete'
                }))
                return;
            }
            idtoSocket.set(userName,socket);
            socket.send(JSON.stringify('user setup is complete'));
        }

        if(payload.type=='join-room'){
            const roomId=payload.data.roomId;
            const userName=payload.data.userName;
            if(!roomId){
                socket.send(JSON.stringify('roomId not found'));
                return
            }
            if(!rooms.get(roomId)){
                rooms.set(roomId,new Set());
                roomAdmins.set(roomId,userName);//setting the room admin
            }
            rooms.get(roomId).add(userName);
            const currentMembers=rooms.get(roomId);
            socket.send(JSON.stringify({
                message:'succesfully joined the room',
                payload:currentMembers
            }))
            //first i am gonna send the current player's info to the the user who just joined
            //notify the other plkayes that the user joined
            for (const c of currentMembers){
                const sock=idtoSocket.get(c);
                sock.send(JSON.stringify({
                    message:'a user joined',
                    payload:userName
                }))
            }
            return;
    

            //check if the room id already exists , if not create the room 
        }
        if(payload.type=='movement'){
            const roomId=payload.data.roomId;
            const players=rooms.get(roomId);//this would provide me a set of all the players 
            for (const p of players){
                const sock=idtoSocket.get(p);
               sock.send(JSON.stringify({
                message:'a player moved',
                payload:payload.data//this will the current cooridnates of that particular playef
               }))
            }
        }
        if(payload.type=='start-game'){
            //check if the user initiating is a host or not 
        }

    })
})