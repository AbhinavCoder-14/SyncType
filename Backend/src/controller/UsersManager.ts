import { WebSocket } from "ws";
import { competition, type Player } from "../competition.js";
import { CompetitionManager } from "./competitionManager.js";


interface User {
  name: string;
  ws: WebSocket;
}

export interface matchMakingPlayers{
    name:string;
    ws:WebSocket;
    userId:string;
    isStarted:boolean;
}

export class UserManager{
    public users = new Map<string,{roomId:string,userId:string}>();
    public matchMakingPlayers:matchMakingPlayers[]
    private competitionManager;
    private lobbyTimer: NodeJS.Timeout | null = null;
    private roomPlayers:matchMakingPlayers[]
    // public player : Player[]
    // public roomId:string;



    public constructor(ws:WebSocket){
        this.matchMakingPlayers = []
        this.competitionManager = new CompetitionManager()
        this.roomPlayers = []
        // this.player = []
        // this.roomId = ""

        

    }
    private randomUUId() {
      let userId = crypto.randomUUID();
    // console.log(userId);
      return userId;
    }

    public addUser(ws:WebSocket){
        
        ws.on("join",(data)=>{
            const userId = this.randomUUId() 
            this.matchMakingPlayers.push({...data,isStarted:false,userId:userId})
            
            if (this.matchMakingPlayers.length==5){
                const credentials = this.triggerRoom()
                console.log("users - ", credentials.players," is added in room - ",credentials.roomId)
                
            }

            if(this.matchMakingPlayers.length==1){
                this.startLobbytime()
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
        if(this.lobbyTimer) clearTimeout(this.lobbyTimer)
        
        this.roomPlayers = [...this.matchMakingPlayers]
        this.matchMakingPlayers = []
        
        const x = this.competitionManager.addNewRoom(this.roomPlayers)

        // this.users.set(x.players.ws,{roomId:x.roomId,userId:x.players.userId})
        
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

    public findUsers(){
        
    }


    public removeUser(ws:WebSocket){
        // const user =
        
        // remove the user form the game or matchmaking
    }





}