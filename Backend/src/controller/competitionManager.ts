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
    

    public addNewRoom(AllUsers:matchMakingPlayers[],compId:string){
        if(this.getComp(compId)) return {message:"Room already exists",players:null,compId:null}

        const room = new competition(compId)
        this.competitions.push(room)
        
        
        this.players = room.addUser(
            AllUsers
        )
        return {players:this.players,compId:room.compId,message:"Room created successfully"}

    }

    public getComp(compId:string){
        return( this.competitions.find((x)=>{
            return x.compId === compId;
        })?? null)
    }

    public onSubmit(compId:string, userId:string,typedKey:string,letterIdx:number,wordIdx:number){
        // search and call the fuction of though compId
        if(!this.getComp(compId)) return "Compeition does not exist";

        // this.getComp(compId)?.updateProgress(userId, charIndex) // no use of it here

        this.getComp(compId)?.userEventValidation(userId,typedKey,letterIdx,wordIdx)
    }
    public removeUser(compId:string,userId:string){

        if (this.getComp(compId)){
            this.getComp(compId)?.removeUser(userId)
        }

    }



}