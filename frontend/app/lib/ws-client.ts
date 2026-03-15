
import { WebSocket } from "ws";
import { useSocket } from "./wsContext";


class WebSocket_Client{
    ws: WebSocket | null;
    public static instance:WebSocket_Client;
    private listeners:Map<string,Function[]> = new Map();

    

    private constructor(ws:WebSocket | null){
        this.ws = ws
    }

    public static getWsInstance(ws:WebSocket | null):WebSocket_Client {
        if (!WebSocket_Client.instance){
            WebSocket_Client.instance = new WebSocket_Client(ws ?? null)
        }

        if (ws) WebSocket_Client.instance.ws = ws;
        return WebSocket_Client.instance

    }

    // methods
    public send(type:string,payload:any){
        if (this.ws?.readyState === WebSocket.OPEN){
            this.ws.send(JSON.stringify({type,payload}))
        }
        console.log("entered in ws clinet")

    }



    // this is the another way to grab the message from sever where we don't nessarly need to use message.type === "MATCH_MAKE"... and then condition and all that shit
    public on(event:string, callback:Function){
        if(!this.listeners.has(event)){
            this.listeners.set(event,[])
        }
        this.listeners.get(event)?.push(callback)
    }

    private emit(event:string,data:any){
        this.listeners.get(event)?.forEach(cb=>cb(data));
    }

    // this is the efficient and scalable way to receive a message of a event 

    public receiveMessage(){
        if(this.ws){
            this.ws.onmessage = (event) =>{
                const message = JSON.parse(event.data)
                this.emit(message.type,message.payload)
            }
        

        }
    }
    
 







}

export default WebSocket_Client