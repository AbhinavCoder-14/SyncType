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



}