import { Redis } from "ioredis";
import { v4 as uuidv4 } from "uuid";

interface UserProfile {
    userId: string;
    username: string;
    gatewayId: string;
}


export class MatchmakingService{
    private redis:Redis;
    private MATCH_TIMEOUT:number;
    private MATCH_THRESHOLD:number
    private currentBackendIndex: number
    private backendList:string[]









    constructor(redis:Redis){
        this.redis = redis;
        this.MATCH_TIMEOUT = 60*1000
        this.MATCH_THRESHOLD = 3
        this.currentBackendIndex = 0;
        this.backendList = ["b1","b2","b3"]


    }

    public async start(){
        console.log("[MatchmakingService] Starting to listen for join requests...");

        const subscriber = new Redis(this.redis.options);

        subscriber.subscribe("matchmaking:queue",(err)=>{
            if (err) {
                console.error("[MatchmakingService] Subscription error:", err);
            } else {
                console.log("[MatchmakingService] Subscribed to matchmaking:queue");
            }
        })

        subscriber.on("message",async (channel,message)=>{
            if (channel==="matchingmaking:queue"){
                const user: UserProfile = JSON.parse(message)
                console.log(`[MatchmakingService] User ${user.userId} (${user.username}) joined queue`);
                await this.addUserToQueue(user);
                
            }

        })


        subscriber.subscribe("user:disconnect", async (err) => {
            if (err) console.error("[MatchmakingService] Disconnect subscription error:", err);
        });


        
        subscriber.on("message", async (channel, message) => {
            if (channel === "user:disconnect") {
                const { userId } = JSON.parse(message);
                console.log(`[MatchmakingService] User ${userId} disconnected, removing from queue`);
                this.removeUserFromQueue(userId);
            }
        });







    }


    public async addUserToQueue(user:UserProfile){
        await this.redis.lpush("matchmaking:users",JSON.stringify(user))

        const queueSize = await this.redis.llen("matchmaking:queue:users");


        if(queueSize>=this.MATCH_THRESHOLD){
            console.log("[MatchmakingService] Threshold reached! Creating room...");
            await this.createRoom();
        }

        else if (queueSize == 1 ){
            setTimeout(async () => {
                const finalSize = await this.redis.llen("matchmaking:queue:users");
                if (finalSize > 0) {
                    console.log(`[MatchmakingService] Timeout reached. Creating room with ${finalSize} users`);
                    await this.createRoom();
                }
            }, this.MATCH_TIMEOUT);
        }




    }


    public removeUserFromQueue(userId:string){


    }

    public async createRoom(){

        const userCount = await this.redis.llen("matchmaking:queue:users")
        const userJsons = await this.redis.lrange("matchmaking:queue:users",0, Math.min(this.MATCH_THRESHOLD - 1, userCount - 1))


        await this.redis.ltrim("matchmaking:queue:users",Math.min(this.MATCH_THRESHOLD,userCount),-1)

        const users = userJsons.map(json => JSON.parse(json));
        const compId = uuidv4();
        const gameBackendId = this.selectGameBackend();
        
        console.log(`[MatchmakingService] Creating room ${compId}`);

        // Store room metadata
        await this.redis.setex(
            `room:${compId}`,
            3600,
            JSON.stringify({
                compId,
                users: users.map(u => ({ userId: u.userId, username: u.username })),
                gameBackendId,
                createdAt: Date.now(),
                state: "WAITING"
            })
        );

        // Publish to game backend
        await this.redis.publish(
            `game:${gameBackendId}:init`,
            JSON.stringify({ compId, users })
        );

        
        


    }


    private selectGameBackend(): string | null {
        const selected = this.backendList[this.currentBackendIndex];
        this.currentBackendIndex = (this.currentBackendIndex + 1) % this.backendList.length;
        if (selected){
            return selected;
        }

        return null
    }



}


