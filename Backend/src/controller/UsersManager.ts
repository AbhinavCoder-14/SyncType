import { WebSocket } from "ws";
import { competition } from "../competition.js";
import { CompetitionManager } from "./competitionManager.js";


interface User {
  name: string;
  ws: WebSocket;
}

export interface matchMakingPlayers{
    name:string;
    ws:WebSocket;
    isStarted:boolean
}

export class UserManager{
    public users:User[]
    public matchMakingPlayers:matchMakingPlayers[]
    private competitionManager;
    private lobbyTimer: NodeJS.Timeout | null = null;
    private roomPlayers:matchMakingPlayers[]



    public constructor(ws:WebSocket){
        this.users = []
        this.matchMakingPlayers = []
        this.competitionManager = new CompetitionManager()
        this.roomPlayers = []


    }

    public addUser(ws:WebSocket){
        
        ws.on("join",(data)=>{
            this.matchMakingPlayers.push({name:data.name,ws:data.ws,isStarted:false
            })
            if (this.matchMakingPlayers.length==5){
                this.triggerRoom()
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
        this.competitionManager.addNewRoom(this.roomPlayers)
        
    }



}