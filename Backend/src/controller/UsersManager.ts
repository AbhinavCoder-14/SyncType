import { WebSocket } from "ws";


interface User {
  name: string;
  ws: WebSocket;
}

interface matchMakingPlayers{
    name:string;
    ws:WebSocket;
    isStarted:boolean
}

export class UserManager{
    public users:User[]
    public matchMakingPlayers:matchMakingPlayers[]



    public constructor(ws:WebSocket){
        this.users = []
        this.matchMakingPlayers = []



    }

    public addUser(){
        
    }




}