import { competition } from "../competition.js"
import type { matchMakingPlayers } from "./UsersManager.js";



export class CompetitionManager{
    public competitions:competition[];
    

    constructor(){
        this.competitions=[]
    }


    public addNewRoom(AllUsers:matchMakingPlayers[]){
        const room = new competition(AllUsers)
        this.competitions.push(room)
    }



}