import express  from "express"
import cors from "cors"
import http from "http"
import { Init } from "./lib/webSocketInit.js"
import { UserManager } from "./controller/UsersManager.js"


const app = express()
app.use(cors)
app.use(express.json())
const PORT = process.env.PORT || 8000


const server:http.Server = http.createServer(app)

Init.getInstanceWs(server)
const io = Init.getInstanceWs().connection


io.on("connection",(ws)=>{
    console.log("user connected")
    const wsId = crypto.randomUUID();

    (ws as any).wsId = wsId

    ws.send(JSON.stringify({
    type: "INITIAL_AUTH",
    payload: { wsId }
        }));



    ws.on("message",(message)=>{
        console.log("Recivied message")

        ws.send(`Server received your message: ${message}`);

    })
    // Use userManager.ts to to further logic

    const userManage = new UserManager(ws)
    userManage.addUser(ws)



    ws.on('close', () => {
        console.log('Client disconnected');
        userManage.removeUser(ws)
        


    });



})









app.listen(PORT,()=>{
    console.log("listening at 8000")
})
