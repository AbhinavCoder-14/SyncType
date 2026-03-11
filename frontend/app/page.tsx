'use client';

import TypingArea from "@/component/TypeArea";
import clsx from "clsx";
import React,{useState,useEffect} from "react";
import { Button } from "@/components/ui/button"
import { useSocket } from "./lib/wsContext";
import WebSocket_Client from "./lib/ws-client";

export default function Home() {
  const ws:WebSocket | null = useSocket()
  const [isFocused, setIsFocused] = useState(true);
  const [appState, setAppState] = useState<"idle" | "active" | "result">("idle")
  const [username, setUserName] = useState("player_1")
  const [matched , setMatched]  = useState<boolean>(false)

  // creating a singleton instantace from the websocket-client
  const wsClient = WebSocket_Client.getWsInstance()



  // in useeffect we have to listen to MATCH_MAKING type and which inform us that 

  const handleJoin = () =>{
    if(ws){
      ws.send(JSON.stringify({
        type:"join",
        payload:{
          username:username,
        }

      }))

    }
  }

  return (
    <>

      <Button onClick={()=>handleJoin()}>Play Game</Button>

      


    </>

  )}


  
    // <div className="h-[100vh] w-full flex flex-col justify-center items-center p-8 bg-neutral-950 text-neutral-200">
    //   <div className="max-w-screen-xl relative p-4">
    //     <button type="button" className={clsx("z-20 flex justify-center items-center absolute inset-0 backdrop-blur transition-all",
    //       !isFocused ? "visible opacity-100 scale-105" : "invisible opacity-0 scale-95"
    //     )} onClick={()=>setIsFocused(true)}>

    //       <span className="font-medium text-lg text-white/60">Click here to begin</span>




    //     </button>

    //     <TypingArea text={"helo lorem"} isOverlayed={false} onStart={()=> setAppState("active")} onFinish={()=>{setAppState("result")}} onBlur={()=>{setIsFocused(false)}}
    //     // built-in function on foucs changes
    //     /> 

    //   </div>

    // </div>
