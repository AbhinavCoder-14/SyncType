import express  from "express"
import cors from "cors"
import http from "http"
import { Init } from "./lib/webSocketInit.js"


const app = express()
app.use(cors)
app.use(express.json())
const PORT = process.env.PORT || 8000


const server:http.Server = http.createServer(app)

Init.getInstanceWs(server)
const io = Init.getInstanceWs().connection










app.listen(PORT,()=>{
    console.log("listening at 8000")
})
