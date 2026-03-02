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
    private randomUUId() {
      let id = crypto.randomUUID();
    // console.log(userId);
      return id;
    }

    public addUser(ws:WebSocket){
        
        ws.on("join",(data)=>{
            const userId = this.randomUUId()
            const compId = this.randomUUId()
            this.users.set(ws,{compId:compId,userId:userId})
            this.matchMakingPlayers.push({...data,isStarted:false,userId:userId})
            
            if (this.matchMakingPlayers.length==5){
                const credentials = this.triggerRoom(compId)
                console.log("users - ", credentials.players," is added in room - ",credentials.compId)
                
            }

            if(this.matchMakingPlayers.length==1){
                this.startLobbytime(compId)
            }   

        })
        
    }

    private startLobbytime(compId:string){

        this.lobbyTimer = setTimeout(() => {
            if(this.matchMakingPlayers.length >= 3){
                this.triggerRoom(compId)
            }

        }, 10000);

    }


    private triggerRoom(compId:string){
        if(this.lobbyTimer) clearTimeout(this.lobbyTimer)
        
        this.roomPlayers = [...this.matchMakingPlayers]
        this.matchMakingPlayers = []
        
        const x = this.competitionManager.addNewRoom(this.roomPlayers,compId)

        // this.users.set(x.players.ws,{compId:x.compId,userId:x.players.userId})
        return x
        


    }

    public currentDataFromWs(ws:WebSocket){

        // Individual socket data of users to add in the memory so that we can broadcast to all the users
        ws.on("message",(data)=>{

            const message = JSON.parse(data.toString())

            if (message.type === "submit"){
                if (!message.payload.userId || !message.payload.compId){
                    return "Insufficent data"
                }

                this.competitionManager.onSubmit(message.payload.compId, message.payload.userId,message.payload.charIndex,message.payload.startTime)




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