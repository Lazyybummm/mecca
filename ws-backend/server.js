import { WebSocketServer } from "ws";

const wss=new WebSocketServer({port:8080});
const rooms=new Map();
const roomStates=new Map();
const idtoSocket=new Map();
const roomAdmins=new Map();
const huntCount=new Map();



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

function cron(roomId){

    setTimeout(()=>{
        const players=rooms.get(roomId);
        for(const i of players){
            const sock=idtoSocket.get(i);
            sock.send(JSON.stringify({
                event:'game starts',
                roomId:roomId
            }))
        }
        roomStates.set(roomId,'seek-started');
    },120000)

}

function selectHunters(size,roomId){//add the least hunter functioanlity later on 
    //decide the number of hunters based on the number of participants
   const hunterCount=hunterNum(size);
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
                roomStates.set(roomId,'created')
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
            const senderuserName=payload.data.userName;
            const roomId=payload.data.roomId;
            const hostName=roomAdmins.get(roomId);
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
                for(a of hunters){
                    const sock=idtoSocket.get(a);
                    sock.send(JSON.stringify({
                        event:'game-started',
                        role:'hunter'
                    }))
                }

                for(b of hiders){
                    const sock=idtoSocket.get(b)
                    sock.send(JSON.stringify({
                         event:'game-started',
                        role:'hider'
                    }))
                }

                roomStates.set(roomId,'hide-phase')

                cron(roomId)
                
                //now i need to run a callback which sends the time starts event after 60 seconds , 


            }
            else{
                socket.send(JSON.stringify('only host can perform this action'));
                return;
            }


            //check if the user initiating is a host or not 
        }

    })
})