import { WebSocket } from "ws";
import { competition, type Player } from "../competition.js";
import { CompetitionManager } from "./competitionManager.js";
import { Redis } from "ioredis"

// export interface matchMakingPlayers{
//     name:string;
//     ws:WebSocket;
//     userId:string;
//     isStarted:boolean;

// }

export class UserManager{
    // public users = new Map<WebSocket,{compId:string,userId:string}>();
    // public matchMakingPlayers:matchMakingPlayers[]
    // private competitionManager;
    // private lobbyTimer: NodeJS.Timeout | null = null;
    // private roomPlayers:matchMakingPlayers[]
    // public static instance:UserManager;
    // // public player : Player[]
    // // public compId:string;

    private redis:Redis;







    public constructor(redis:Redis){
        // this.matchMakingPlayers = []
        // this.competitionManager = new CompetitionManager()
        // this.roomPlayers = []
        // this.player = []
        // this.compId = ""
        // this.currentDataFromWs(ws)
        this.redis = redis




        

    }
    
    // Singleton pattern to solve the problem of mutiple instance
    // public static getInstance(ws:WebSocket){
    //     if(!UserManager.instance){
    //         UserManager.instance = new UserManager(ws)
    //     }

    //     return UserManager.instance


    // }


    // private randomUUId() {
    //   let id = crypto.randomUUID();
    // // console.log(userId);
    //   return id;
    // }

    public addUser(ws:WebSocket,userId:string,gatewayId:string){
        
        ws.on("message",async (messages)=>{
            const data = JSON.parse(messages.toString())
            if(data.type === "join"){


                await this.redis.publish("matchmaking:queue",
                    JSON.stringify({
                        userId,
                        username:data.payload.username,
                        gatewayId
                    })
                )
            

            }

            else if (data.type==="KEY_PRESS"){
                await this.redis.publish(
                    `game:${data.payload.compId}:events`,
                    JSON.stringify({
                        type: "KEY_PRESS",
                        userId,
                        payload: data.payload
                    })
                );

                
            }

        })

        ws.on("close", async () => {
        // Notify services of disconnection
        await this.redis.publish(
            "user:disconnect",
            JSON.stringify({ userId })
        );
    });
        
    }





}