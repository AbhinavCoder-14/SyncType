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
    finishTime?: number;
  };
  isStarted: boolean;
}

export enum RaceState {
  WAITING = "WAITING",
  STARTING = "STARTING",
  IN_PROGRESS = "IN_PROGRESS",
  FINISHED = "FINISHED",
}

export class competition {
  public compId: string;
  private players: Player[];
  private paragraph: string;
  private hasStarted: boolean;
  private status: RaceState;
  private startTime: number | null;
  private countdown: number;

  private totalChars: number;
  private wordCount: number;

  constructor(compId: string) {
    this.compId = compId;
    this.players = [];
    this.paragraph = "";
    this.hasStarted = false;
    this.status = RaceState.WAITING;
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
  }






}
