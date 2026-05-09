import express  from "express"
import cors from "cors"
import http from "http"
import { Init } from "./lib/webSocketInit.js"
import { UserManager } from "./controller/UsersManager.js"
import { Redis } from "ioredis";


const app = express()
app.use(cors())
app.use(express.json())
const PORT = 8000


const server:http.Server = http.createServer(app)

Init.getInstanceWs(server)
const io = Init.getInstanceWs().connection

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const userManager = new UserManager(redis)



io.on("connection",(ws)=>{
    console.log("user connected")
    const wsId = crypto.randomUUID();

    (ws as any).wsId = wsId

    ws.send(JSON.stringify({
    type: "INITIAL_AUTH",
    payload: { wsId }
        }));

    const userId = crypto.randomUUID();
    const gatewayId = process.env.GATEWAY_ID || "wg-1";

    userManager.addUser(ws,userId,gatewayId);



    // ws.on("message",(message)=>{
    //     console.log("Recivied message")

    //     ws.send(`Server received your message: ${message}`);

    // })
    // Use userManager.ts to to further logic

    // const userManager = UserManager.getInstance(ws)
    // userManager.addUser(ws)


})









server.listen(PORT,()=>{
    console.log("listening at ",PORT)
})
