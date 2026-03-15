import { WebSocket } from "ws";
import { competition, type Player } from "../competition.js";
import { CompetitionManager } from "./competitionManager.js";



// interface User {
//   name: string;
//   ws: WebSocket;
// } -- userless

export interface matchMakingPlayers{
    name:string;
    ws:WebSocket;
    userId:string;
    isStarted:boolean;

}

export class UserManager{
    public users = new Map<WebSocket,{compId:string,userId:string}>();
    public matchMakingPlayers:matchMakingPlayers[]
    private competitionManager;
    private lobbyTimer: NodeJS.Timeout | null = null;
    private roomPlayers:matchMakingPlayers[]
    public static instance:UserManager;
    // public player : Player[]
    // public compId:string;



    public constructor(ws:WebSocket){
        this.matchMakingPlayers = []
        this.competitionManager = new CompetitionManager()
        this.roomPlayers = []
        // this.player = []
        // this.compId = ""
        this.currentDataFromWs(ws)

        

    }
    
    // Singleton pattern to solve the problem of mutiple instance
    public static getInstance(ws:WebSocket){
        if(!UserManager.instance){
            UserManager.instance = new UserManager(ws)
        }

        return UserManager.instance


    }


    private randomUUId() {
      let id = crypto.randomUUID();
    // console.log(userId);
      return id;
    }

    public addUser(ws:WebSocket){
        
        ws.on("message",(messages)=>{
            const data = JSON.parse(messages.toString())
            if(data.type === "join"){

                const userId = this.randomUUId()
                // const compId = this.randomUUId() // this is a bug, it will create diff compId for each user
                this.users.set(ws,{compId:"",userId:userId})
                this.matchMakingPlayers.push({...data.payload,isStarted:false,userId:userId,ws:ws})
                console.log("user request to match make", this.matchMakingPlayers)
                

                if (this.matchMakingPlayers.length<2){
                    ws.send(JSON.stringify({
                            type:"MATCH_MAKING",
                            payload:{
                                userId:userId,
                                matchMake:false,
                            }
                        }))
                }
                
                if (this.matchMakingPlayers.length==2){
                    console.log("threshold acheived")
                    const credentials = this.triggerRoom()
                    console.log("users - ", credentials.players," is added in room - ",credentials.compId)
                    // this will only send the only 5th player that matchMake is true
                    ws.send(JSON.stringify({
                        type:"MATCH_MAKING",
                        payload:{
                            userId:userId,
                            matchMake:true
                        }
                    }))
                    
                }
    
                if(this.matchMakingPlayers.length==1){
                    
                    this.startLobbytime()
                }   
            }

        })
        
    }

    private startLobbytime(){

        this.lobbyTimer = setTimeout(() => {
            if(this.matchMakingPlayers.length >= 3){
                this.triggerRoom()
            }

        }, 10000);

    }


    private triggerRoom(){
        console.log("enterd in triggerRoom")
        if(this.lobbyTimer) clearTimeout(this.lobbyTimer)
        
        
        this.roomPlayers = [...this.matchMakingPlayers]
        this.matchMakingPlayers = []
        const compId = this.randomUUId()

        this.roomPlayers.forEach((player)=>{
            const userData = this.users.get(player.ws)
            if(userData) userData.compId = compId

            player.ws.send(JSON.stringify({
                    type:"MATCH_MAKING",
                    payload:{
                        userId:player.userId,
                        matchMake:true
                    }
                }))

        })
        
        const x = this.competitionManager.addNewRoom(this.roomPlayers,compId)

        // this.users.set(x.players.ws,{compId:x.compId,userId:x.players.userId})
        return x
        


    }

    public currentDataFromWs(ws:WebSocket){

        // Individual socket data of users to add in the memory so that we can broadcast to all the users
        ws.on("message",(data)=>{

            const message = JSON.parse(data.toString())

            if (message.type === "KEY_PRESS"){
                if (!message.payload.userId || !message.payload.compId){
                    return "Insufficent data"
                }

                const {typedKey,compId,userId,wordInx,letterIdx} = message.payload

                this.competitionManager.onSubmit(compId, userId,typedKey,wordInx,letterIdx)




            }





        })



    }

    // public findUsers(){

    // }


    public removeUser(ws:WebSocket){
        const user = this.users.get(ws)

        if(user) {
            this.competitionManager.removeUser(user.compId,user.userId)
            
        }
        this.users.delete(ws)

        
        // remove the user form the game or matchmaking
    }





}