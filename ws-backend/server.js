import { WebSocketServer } from "ws";

const wss=new WebSocketServer({port:8080});
const rooms=new Map();
const roomStates=new Map();
const idtoSocket=new Map();
const roomAdmins=new Map();
const huntCount=new Map();//for least hunt count based role assignment
const ingameState=new Map();




//helper functions 
function hunterNum(size){
    if(size>1 && size<6){
        return 1;
    }
    if(size>=6 && size<10){
        return 2 ;
    }
    return 0;
    //so and so 
    //rules will be defined here , 

}

function resetPlayerState(userName,keepRoom){
    const st=ingameState.get(userName);
    if(!st)return;
    if(!keepRoom)st.roomId=null;
    st.role=null;
    st.pose='Stand';
    st.position={x:0,y:0,z:0};
    st.rotation=0;
    st.color=null;
    st.caught=false;
}

function cron(roomId,topic,time){//a usable cron i can register(look more into this)

    const handle=setTimeout(()=>{
        const players=rooms.get(roomId);
        let result;
        const roomInfo=roomStates.get(roomId)
        if(topic=='room-end'){//calculate the winner 
            if(roomInfo.remainingHiders>0){
                    result='hiders won'
            }
            else{
                result='hunters won'
            }
            roomInfo.phase='ended';
        }
        if(topic=='seek-phase'){
            roomInfo.phase='seek';
        }
        for(const i of players){
            const sock=idtoSocket.get(i);
            sock.send(JSON.stringify({
                event:topic,
                roomId:roomId,
                payload:result?result:null
                
            }))
        }
        if(topic=='room-end'){
            for(const i of players){
                resetPlayerState(i,true);
            }
            roomInfo.phase='lobby';
        }
       
    },time)

    const state=roomStates.get(roomId);
    if(state){
        if(topic=='seek-phase')state.hideTimer=handle;
        if(topic=='room-end')state.seekTimer=handle;
    }

}

function selectHunters(size,roomId){//add the least hunter functioanlity later on 
    //decide the number of hunters based on the number of participants
   let hunterCount=hunterNum(size);
   const hunterArray=[];
   const currentPlayers=rooms.get(roomId)
   const currentArray=[...currentPlayers];//converting into an array for better access
   while(hunterCount!=0 && currentArray.length>0){
        const randIndex=Math.floor(Math.random()*currentArray.length)
        const element=currentArray[randIndex];
        currentArray.splice(randIndex,1);
        hunterArray.push(element);
    hunterCount--;
   }
   return {hunters:hunterArray,hiders:currentArray};


}


wss.on('connection',(socket)=>{
    socket.send(JSON.stringify('connected'));

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
            ingameState.set(userName,{
                userName:userName,
                roomId:null,
                role:null,
                pose:'Stand',
                position:{x:0,y:0,z:0},
                rotation:0,
                color:null,
                caught:false,
                connected:true,
            });
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
                roomStates.set(roomId,{phase:'created'})
                roomAdmins.set(roomId,userName);//setting the room admin
            }
            rooms.get(roomId).add(userName);
            const userState=ingameState.get(userName);
            if(userState)userState.roomId=roomId;
            const roomState=roomStates.get(roomId);
            if(roomState&&roomState.phase=='created'&&rooms.get(roomId).size>=2){
                roomState.phase='lobby';
            }
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
            if(!players)return;
            const userName=payload.data.userName;
            const userState=ingameState.get(userName);
            if(userState&&payload.data.coordinates){
                userState.position={x:payload.data.coordinates.x,y:payload.data.coordinates.y,z:payload.data.coordinates.z};
                userState.rotation=payload.data.coordinates.ry||0;
                if(payload.data.coordinates.col)userState.color=payload.data.coordinates.col;
            }
            for (const p of players){
                const sock=idtoSocket.get(p);
               sock.send(JSON.stringify({
                message:'a player moved',
                payload:payload.data.coordinates//this will the current cooridnates of that particular playef
               }))
            }
        }
        if(payload.type=='start-game'){
            const senderuserName=payload.data.userName;
            const roomId=payload.data.roomId;
            const hostName=roomAdmins.get(roomId);
            const rsCheck=roomStates.get(roomId);
            if(rsCheck&&rsCheck.phase!='lobby'&&rsCheck.phase!='created'){
                socket.send(JSON.stringify({event:'error',message:'round already running'}));
                return;
            }
            if(hostName==senderuserName){
                //calculate the length of the room
                const roomLength=rooms.get(roomId).size;
                if(roomLength<3){
                    socket.send(JSON.stringify({
                        event:'player limit',
                        message:'not enough participants'
                    }))
                    return;
                }
                const {hunters,hiders}=selectHunters(roomLength,roomId);//when destructuring , the name of the variable should be same as the return variables
                for(const a of hunters){
                    const sock=idtoSocket.get(a);
                    const st=ingameState.get(a);
                    if(st){st.role='hunter';st.caught=false;st.pose='Stand';st.color=null;st.position={x:0,y:0,z:0};st.rotation=0;}
                    sock.send(JSON.stringify({
                        event:'game-started',
                        role:'hunter'
                    }))
                }

                for(const b of hiders){
                    const sock=idtoSocket.get(b)
                    const st=ingameState.get(b);
                    if(st){st.role='hider';st.caught=false;st.pose='Stand';st.color=null;st.position={x:0,y:0,z:0};st.rotation=0;}
                    sock.send(JSON.stringify({
                         event:'game-started',
                        role:'hider'
                    }))
                }

                roomStates.set(roomId,{
                    phase:'hide',
                    startedAt:Date.now(),

                    hunters:[...hunters],
                    hiders:[...hiders],
                    hunterSet:new Set(hunters),
                    hiderSet:new Set(hiders),

                    remainingHiders:hiders.length,
                    caught:new Set(),//this will handle that duplicate event sending 

                    positions:{},
                    poses:{},

                    hideTimer:null,
                    seekTimer:null,
                })

                cron(roomId,'seek-phase',120000)
                cron(roomId,'round-end',600000)//providing them ten minutes for seek
                
                //now i need to run a callback which sends the time starts event after 60 seconds , 


            }
            else{
                socket.send(JSON.stringify('only host can perform this action'));
                return;
            }


            //check if the user initiating is a host or not 
        }
        if(payload.type=='mark-caught'){
            const roomId=payload.data.roomId;
            const senderUsername=payload.data.senderUsername;
            const targetUsername=payload.data.targetUsername;
            const roomInfo=roomStates.get(roomId);
            if(!roomInfo.hunterSet.has(senderUsername)|| !roomInfo.hiderSet.has(targetUsername)){
                socket.send(JSON.stringify({
                    event:'not authorized',
                    message:'not authorized to perform this action'
                }))
                return;
            }
            roomInfo.caught.add(targetUsername);
            roomInfo.remainingHiders=roomInfo.remainingHiders-1;
            const targetState=ingameState.get(targetUsername);
            if(targetState)targetState.caught=true;
            //we can notify everyone also that this oaricular person is caught 
            const players=rooms.get(roomId);
            for(const p of players){//boradcasting to eveyrone that this particular user has been caught and to update thie rlocal states 
                const sock=idtoSocket.get(p);
                sock.send(JSON.stringify({
                    event:'player caught',
                    hunter:senderUsername,
                    hider:targetUsername
                }))
            }

            // all hiders caught ,end the round now, cancel the pending timer
            if(roomInfo.remainingHiders===0){
                if(roomInfo.seekTimer){
                    clearTimeout(roomInfo.seekTimer);
                    roomInfo.seekTimer=null;
                }
                roomInfo.phase='ended';
                for(const p of players){
                    const sock=idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event:'room-end',
                        roomId:roomId,
                        payload:'hunters won'
                    }))
                }
                for(const p of players){
                    resetPlayerState(p,true);
                }
                roomInfo.phase='lobby';
            }

        }
        else if(payload.type=='changed-pose'){
            const userName=payload.data.userName;
            const pose=payload.data.pose
            let currentState=ingameState.get(userName);
            //set the pose in the local state and notify everyone 
            if(!currentState){
                socket.send("user not found with this username ")
                return;

            }
            currentState.pose=pose
            const roomId=currentState.roomId;
            const players=rooms.get(roomId);
            for(const p of players){
                const sock=idtoSocket.get(p);
                sock.send(JSON.stringify({
                    event:'pose changed ',
                    userName:userName,
                    pose:pose
                }))
            }
            return;

            
        }
        else if(payload.type=='request-state'){
            const roomId=payload.data.roomId;
            let filteredData=[];
            //need to filter out all the object values with the given key 
             for(const p of ingameState.values()){//returns an iterator for the map
                if(p.roomId==roomId){
                    filteredData.push(p);
                }
             }
             socket.send(JSON.stringify({
                event:'requested data',
                payload:filteredData
             }))
        }
        else if(payload.type=='leave-room'){
            //reset the player's state if they are the last hider/hunter ->the round is gonna end 
            //else just roomid as null ,notify everyone , make decerments here and there and continue 
            
            const roomId=payload.data.roomId;
            const userName=payload.data.userName;
            const roomState=roomStates.get(roomId);
            const userState=ingameState.get(userName);
            if(!userState)return;
            if(roomState.phase=='lobby'){
                rooms.get(roomId).delete(userName);
                resetPlayerState(userName,false);
                const currentMembers=rooms.get(roomId);
                for (const p of currentMembers){
                    const sock=idtoSocket.get(p);
                    sock.send(JSON.stringify({
                        event:'user left',
                        userName:userName
                    }))
                }
                return;
            }
            if(roomState.phase=='seek'|| roomState.phase=='hide'){
                rooms.get(roomId).delete(userName);
                if(userState.role=='hider'){
                    roomState.remainingHiders=roomState.remainingHiders-1;
                    roomState.hiders=roomState.hiders.filter(c=>c!=userName)
                    roomState.hiderSet.delete(userName);
                    if(roomState.remainingHiders==0){
                        roomState.phase='ended'
                        resetPlayerState(userName,false);
                        const currentMembers=rooms.get(roomId);
                        for (const p of currentMembers){
                            const sock=idtoSocket.get(p);
                            sock.send(JSON.stringify({
                                event:'room ended as the last hider left',
                                userName:userName
                            }))
                    }

            
                    //what if the last hider leaves , 
                }
                else{
                    resetPlayerState(userName,false);
                    const currentMembers=rooms.get(roomId);
                    for (const p of currentMembers){
                        const sock=idtoSocket.get(p);
                        sock.send(JSON.stringify({
                            event:'user left',
                            userName:userName
                        }))
                    }

                }}//there can be a case where it is not set , should use if?
                else{
                    roomState.hunterSet.delete(userName)
                    roomState.hunters=roomState.hunters.filter(c=>c!=userName)
                    if(roomState.hunterSet.size==0){
                        //now round should be ended
                        roomState.phase='ended'
                        resetPlayerState(userName,false);
                        const currentMembers=rooms.get(roomId);
                        for (const p of currentMembers){
                            const sock=idtoSocket.get(p);
                            sock.send(JSON.stringify({
                                event:'room ended as the hunter left',
                                userName:userName
                            }))
                        }

                    }
                    else{
                        resetPlayerState(userName,false);
                        const currentMembers=rooms.get(roomId);
                        for (const p of currentMembers){
                            const sock=idtoSocket.get(p);
                            sock.send(JSON.stringify({
                                event:'user left',
                                userName:userName
                            }))
                        }
                    }
                }
            }
            
        }



    })

    socket.on('close',()=>{
        //find the user owning this socket
        let foundUser=null;
        for(const [name,sock] of idtoSocket){
            if(sock===socket){foundUser=name;break;}
        }
        if(!foundUser)return;
        const state=ingameState.get(foundUser);
        if(state)state.connected=false;
        idtoSocket.delete(foundUser);
        if(state&&state.roomId){
            const room=rooms.get(state.roomId);
            if(room){
                room.delete(foundUser);
                for(const p of room){
                    const sock=idtoSocket.get(p);
                    if(sock)sock.send(JSON.stringify({
                        event:'player-left',
                        userName:foundUser
                    }));
                }
            }
        }
    });
})