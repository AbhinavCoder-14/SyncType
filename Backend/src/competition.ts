import { WebSocket } from "ws"



export interface PlayerProgress {
  userId: string;
  charIndex: number;
  wpm: number;             
  accuracy: number;        
  isFinished: boolean;
  finishTime?: number;     
}


export enum RaceState {
  WAITING = "WAITING",     
  STARTING = "STARTING",   
  IN_PROGRESS = "IN_PROGRESS",
  FINISHED = "FINISHED"
}


class competition{
    private compId:string;
    private players:PlayerProgress[];
    private paragraph:string;
    private hasStarted:boolean;
    private status: RaceState;
    private startTime: number | null;
    private countdown: number;

    private totalChars: number;
    private wordCount: number;



    constructor(){
        this.compId = ""
        this.players = []
        this.paragraph = ""
        this.hasStarted = false;
        this.status = RaceState.WAITING;
        this.startTime = new Date().getTime();
        this.countdown = 10
        this.totalChars = this.paragraph.length
        this.wordCount = this.paragraph.split(" ").length
    }




}