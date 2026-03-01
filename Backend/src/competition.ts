import { WebSocket } from "ws";
import type { matchMakingPlayers } from "./controller/UsersManager.js";

export interface Player {
  userId: string;
  ws: WebSocket;
  name: string;
  PlayerProgress: {
    charIndex: number;
    wpm: number;
    accuracy: number;
    isFinished: boolean;
    finishTime: number;
  };
  isStarted: boolean;
}

export enum RaceState {
  WAITING = "WAITING",
  IN_PROGRESS = "IN_PROGRESS",
  FINISHED = "FINISHED",
}

export class competition {
  public compId: string;
  private players: Player[];
  private paragraph: string;
  private hasStarted: boolean;
  private state: RaceState;
  private startTime: number | null;
  private countdown: number;

  private totalChars: number;
  private wordCount: number;

  constructor(compId: string) {
    this.compId = compId;
    this.players = [];
    this.paragraph = "";
    this.hasStarted = false;
    this.state = RaceState.WAITING;
    this.startTime = new Date().getTime();
    this.countdown = 10;
    this.totalChars = this.paragraph.length;
    this.wordCount = this.paragraph.split(" ").length;
  }
  // private randomUUId() {
  //   let userId = crypto.randomUUID();
  // // console.log(userId);
  //   return userId;
  // }

  public addUser(AllUsers: matchMakingPlayers[]) {
    this.players = AllUsers.map((user) => ({
      ...user,
      PlayerProgress: {
        charIndex: 0,
        wpm: 0,
        accuracy: 100,
        isFinished: false,
      },
    }));
    this.Init(AllUsers);

    return this.players;
  }


  private BroadCastInfo(message:object){
    const data = JSON.stringify(message)

    this.players.forEach((player)=>{
      if(player.ws.readyState == WebSocket.OPEN){
        player.ws.send(data);
      }


    }
  )

  }






  public Init(AllUsers: matchMakingPlayers[]) {
    AllUsers.forEach((user) => {
      user.ws.send(
        JSON.stringify({
          type: "INIT",
          payload: {
            myId: user.userId,
            compId: this.compId,
            allPlayers: this.players, 
            paragraph: this.paragraph,
          },
        }),
      );
    });
    this.state = RaceState.WAITING
    
  }

  public startingTimeout(){
    // this.BroadCastInfo()

    const aSecIntervel = setInterval(()=>{
      if(this.countdown>=0){
        console.log("countdown started")
        this.BroadCastInfo({
          type:"count_down",
          payload:{
            counter:this.countdown,
            hasStarted:this.hasStarted
          }
        })
        this.countdown--
        this.state = RaceState.WAITING

      }
      else{
        clearInterval(aSecIntervel)
        console.log("GAME STARTED")
        this.startGame()
        



      }

    },1000)
    
  }

    public currentStateGame() {
    if (this.state === RaceState.WAITING) {
      return {
        type: "WAITING",
      };
    }

    if (this.state === RaceState.IN_PROGRESS) {
      return { type: "IN_PROGRESS"};
    }

    if (this.state === RaceState.FINISHED) {
      return { type: "FINISHED"};
    }
  }



  public startGame(){
    this.hasStarted = true
    this.state = RaceState.IN_PROGRESS
    this.BroadCastInfo({
      type:"GameInfo",
      payload:{
        
        compId:this.compId,
        hasStarted:this.hasStarted,
        paragraph:this.paragraph,
        players:this.players,
        state:this.currentStateGame()

      }



    })


  }


  public updateProgress(userId: string, charIndex: number,startTime:number) {
    const player = this.players.find(p => p.userId === userId);
    
    // Only update if the player exists, the race is running, and they aren't finished
    if (!player || this.state !== RaceState.IN_PROGRESS || player.PlayerProgress.isFinished) return;
    this.startTime = startTime
    const now = Date.now();
    // Use the server's recorded startTime for WPM calculation
    const timeElapsedMinutes = (now - (this.startTime || now)) / 60000;

    // Standard WPM: (characters / 5) / minutes
    const wordsTyped = charIndex / 5;
    const currentWpm = timeElapsedMinutes > 0 
      ? Math.round(wordsTyped / timeElapsedMinutes) 
      : 0;

    this.players = this.players.map((p) => {
      if (p.userId === userId) {
        const isDone = charIndex >= this.totalChars;
        return {
          ...p,
          PlayerProgress: {
            ...p.PlayerProgress,
            charIndex: charIndex,
            wpm: currentWpm,
            isFinished: isDone,
            finishTime: isDone ? now : p.PlayerProgress.finishTime,
          },
        };
      }
      return p;
    });

    // Broadcast the "Snapshot" for the Race Simulation
    this.BroadCastInfo({
      type: "RACE_UPDATE",
      payload: {
        players: this.players.map(p => ({
          userId: p.userId,
          charIndex: p.PlayerProgress.charIndex,
          wpm: p.PlayerProgress.wpm,
          isFinished: p.PlayerProgress.isFinished,
          progress: (p.PlayerProgress.charIndex / this.totalChars) * 100
        }))
      }
    });

    // Check if everyone is finished to move state to FINISHED
    if (this.players.every(p => p.PlayerProgress.isFinished)) {
      this.state = RaceState.FINISHED;
    }
  }


}
