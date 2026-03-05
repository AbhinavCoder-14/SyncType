import { WebSocket } from "ws";
import type { matchMakingPlayers } from "./controller/UsersManager.js";


export interface Player {
  userId: string;
  ws: WebSocket;
  name: string;
  PlayerProgress: {
    wpm: number;
    accuracy: number;
    isFinished: boolean;
    finishTime: number | undefined;
    typedCharCount: number;

    typos: Set<string>;
    totalKeystrokes: number; // Needed for accurate Accuracy math
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
  public players: Player[];
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
        typedCharCount: 0,
        wpm: 0,
        accuracy: 100,
        isFinished: false,
        finishTime:undefined,
        typos: new Set<string>(),
        totalKeystrokes:0,
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



  public async startGame(){
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
    this.paragraph = await this.fetchPara()
    this.totalChars = this.paragraph.length
    this.wordCount = this.paragraph.split(" ").length


  }

  findPlayer(userId:string){
    return this.players.filter((player)=>{
      player.userId !== userId
    })
  }

  removeUser(userId:string){
    this.players = this.findPlayer(userId)

  }

  // public getTyposofUser(userId:string){
  //   return this.typos.get(userId)

  // }

  // this function is only for validation and collecting stats of all the users
  public userEventValidation(userId:string,typedKey:any,wordIdx:number, letterIdx:number){

    // const typos = new Map<typeof userId,{typeWordIndex:number,typoLetterIndex:number}>()

    const player = this.players.find(p=>p.userId === userId)

    if (!player || player.PlayerProgress.isFinished) return
    
    player.PlayerProgress.totalKeystrokes +=1;
    if (typedKey.key = "Backspace"){
      const typoKey = `${wordIdx},${letterIdx - 1}`;
      if(player.PlayerProgress.typos.has(typoKey)){
        player.PlayerProgress.typos.delete(typoKey);
      }
      if (player.PlayerProgress.typedCharCount > 0) {
            player.PlayerProgress.typedCharCount -= 1;
        }

    }

    if(typedKey.key.length !== 1) return;

    // if(wordIdx === 0 && letterIdx === 0 ){
    //   player.PlayerProgress.startTime = Date.now()
    // }
    
    // isFinished also be there from the frontend side
    // if(letterIdx === this.paragraph.length - 1 && wordIdx ) 


    const words = this.paragraph.split(" ")
    const word = words[wordIdx]

    if(word && word[letterIdx] !== typedKey.key){
      player.PlayerProgress.typos.add(`${wordIdx},${letterIdx}`)
      // also increment the typo index also after updating the interface -  no need - use length
    }

    if (letterIdx == word?.length){
      if (typedKey.key === " "){
        player.PlayerProgress.typedCharCount +=1
      }
      else{
        player.PlayerProgress.typos.add(`${wordIdx},${letterIdx}`);
      }
      return
    }

    if (player.PlayerProgress.typedCharCount >= this.totalChars) {
        player.PlayerProgress.isFinished = true;
        player.PlayerProgress.finishTime = Date.now(); // vese, there is no use of this ;)
    }





    player.PlayerProgress.typedCharCount +=1






    


    this.recalculateStats(userId);


  }

  public recalculateStats(userId:string){

  }





  public updateProgress(userId: string, typedCharCount: number) {
    const player = this.players.find(p => p.userId === userId);
    
    const startTime = Date.now()
    // Only update if the player exists, the race is running, and they aren't finished
    if (!player || this.state !== RaceState.IN_PROGRESS || player.PlayerProgress.isFinished) return;
    this.startTime = startTime
    const now = Date.now();
    // Use the server's recorded startTime for WPM calculation
    const timeElapsedMinutes = (now - (this.startTime || now)) / 60000;

    // Standard WPM: (characters / 5) / minutes
    const wordsTyped = typedCharCount / 5;
    const currentWpm = timeElapsedMinutes > 0 
      ? Math.round(wordsTyped / timeElapsedMinutes) 
      : 0;

    this.players = this.players.map((p) => {
      if (p.userId === userId) {
        const isDone = typedCharCount >= this.totalChars;
        return {
          ...p,
          PlayerProgress: {
            ...p.PlayerProgress,
            typedCharCount: typedCharCount,
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
          typedCharCount: p.PlayerProgress.typedCharCount,
          wpm: p.PlayerProgress.wpm,
          isFinished: p.PlayerProgress.isFinished,
          progress: (p.PlayerProgress.typedCharCount / this.totalChars) * 100
        }))
      }
    
    });
    
    


    // Check if everyone is finished to move state to FINISHED
    if (this.players.every(p => p.PlayerProgress.isFinished)) {
      this.state = RaceState.FINISHED;
    }
  }


  public async fetchPara(): Promise<string>{
    try{
      const response = await fetch("https://api.quotable.io/random")
      const data = await response.json()
      return data
    }catch (error) {
        // Fallback paragraph if the API is down
        return "The quick brown fox jumps over the lazy dog.";
    }


  }


}
