import { competition, type Player } from "../competition.js"
import type { matchMakingPlayers } from "./UsersManager.js";
import { v4 as uuidv4 } from 'uuid';


export class CompetitionManager{
    public competitions:competition[];
    public players:Player[]

    constructor(){
        this.competitions=[]
        this.players = []

    }
    

    public addNewRoom(AllUsers:matchMakingPlayers[]){
        const myUuid:string = uuidv4();

        const room = new competition(myUuid)
        this.competitions.push(room)
        
        
        this.players = room.addUser(
            AllUsers
        )
        return {players:this.players,roomId:room.compId}

    }

    public getComp(compId:string){
        return( this.competitions.find((x)=>{
            return x.compId === compId;
        })?? null)
    }

    public onSubmit(compId:string, userId:string, charIndex:number,startTime:number){
        // search and call the fuction of though compId
        if(!this.getComp(compId)) return "Compeition does not exist";

        this.getComp(compId)?.updateProgress(userId, charIndex,startTime)
    }



}