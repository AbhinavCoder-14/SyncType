
'use client'
import React, {useEffect,useState} from "react"
import TypingArea from "@/component/TypeArea";
import clsx from "clsx";

import { useSocket } from "@/app/lib/wsContext";
import WebSocket_Client from "@/app/lib/ws-client";
import {useRouter, redirect,useParams} from "next/navigation"

export enum RaceState {
  WAITING = "WAITING",
  IN_PROGRESS = "IN_PROGRESS",
  FINISHED = "FINISHED",
}


export default async function CompPage() {
    
    const router = useRouter();
    const params = useParams<{ compId: string }>(); // useless

    
    const ws:WebSocket | null = useSocket()
    const [paragraph, setParagraph] = useState<string>("")
    const [isFocused, setIsFocused] = useState(true);
    const [appState, setAppState] = useState<"idle" | "active" | "result">("idle")
    const [username, setUserName] = useState("player_1")
    const [userId, setUserId] = useState<string | null>(null)
    const [compId,setCompId] = useState<string | null>(null)
    const [countDown,setCountDown] = useState<Number>(10)

    const [currentState , setCurrentState] = useState<RaceState>()

        // creating a singleton instantace from the websocket-client
    const wsClient = WebSocket_Client.getWsInstance()

    wsClient.receiveMessage()

    useEffect(()=>{

        

        wsClient.on("INIT",(payload:any)=>{
            if(payload){
                setUserName(payload.username)
                setUserId(payload.myId)
                setCompId(payload.compId)
                setCurrentState(payload.state)
            }
            

        })

        if (currentState === RaceState.WAITING){
            wsClient.on("count_down",(payload:any)=>{
                setCountDown(payload.counter)

                if(!payload.hasStarted) setCurrentState(RaceState.WAITING)

                setCurrentState(RaceState.IN_PROGRESS)
                
                

            })

        }

        if(currentState === RaceState.IN_PROGRESS){

            wsClient.on("GameInfo",(payload:any)=>{
                setParagraph(payload.paragraph)



            })

            





        }






    },[])










    return(<>
        <div className="h-[100vh] w-full flex flex-col justify-center items-center p-8 bg-neutral-950 text-neutral-200">
              <div className="max-w-screen-xl relative p-4">
                <button type="button" className={clsx("z-20 flex justify-center items-center absolute inset-0 backdrop-blur transition-all",
                  !isFocused ? "visible opacity-100 scale-105" : "invisible opacity-0 scale-95"
                )} onClick={()=>setIsFocused(true)}>
        
                  <span className="font-medium text-lg text-white/60">Click here to begin</span>
        
        
        
        
                </button>
        
                <TypingArea text={paragraph} isOverlayed={false} onStart={()=> setAppState("active")} onFinish={()=>{setAppState("result")}} onBlur={()=>{setIsFocused(false)}}
                // built-in function on foucs changes
                /> 
        
              </div>
        
            </div>
        
        
        
        
        
        
        
        
        
        </>)

}