'use client';


// import React,{useState,useEffect} from "react";
import { Button } from "@/components/ui/button"
// import { useSocket } from "./lib/wsContext";
// import WebSocket_Client from "./lib/ws-client";
// import { redirect, useRouter } from "next/navigation"
import clsx from "clsx";
import React, {useEffect,useState} from "react"
import TypingArea from "@/component/TypeArea";
// import clsx from "clsx";

import { useSocket } from "@/app/lib/wsContext";
import WebSocket_Client from "@/app/lib/ws-client";
import {useRouter, redirect,useParams} from "next/navigation"


export default function Home() {
  const [isFocused, setIsFocused] = useState(true);
  const [appState, setAppState] = useState<"idle" | "active" | "result">("idle")
  const [username, setUserName] = useState("player_1")
  const [matched , setMatched]  = useState<boolean>(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [matchMake, setMatchMaked] = useState<boolean>(false)
  const [compId,setCompId] = useState<string | null>(null)
  
  // creating a singleton instantace from the websocket-client
  const ws = useSocket()
  const wsClient = WebSocket_Client.getWsInstance(ws)
  
  wsClient.receiveMessage()
  const router = useRouter();

  



  // In useeffect we have to listen to MATCH_MAKING type and which inform us that 

  useEffect(()=>{
    const handleMatchFound = (payload:any) =>{
      if (payload.matchMake){
        console.log("Match found! :)",)
        setUserId(payload.userId)
        setMatchMaked(payload.matchMake)

        
      }
      console.log("finding match...")
    }

    wsClient.on("MATCH_MAKING",handleMatchFound)

  },[])

  const handleJoin = () =>{
    console.log("entered in join btn")
    wsClient.send("join",{username})

    if (matchMake){
      redirect(`/room/${compId}`)
    }

    }

    
    return (
      <>

      <Button onClick={handleJoin}>Play Game</Button>

      
    <div className="h-[100vh] w-full flex flex-col justify-center items-center p-8 bg-neutral-950 text-neutral-200">
      <div className="max-w-screen-xl relative p-4">
        <button type="button" className={clsx("z-20 flex justify-center items-center absolute inset-0 backdrop-blur transition-all",
          !isFocused ? "visible opacity-100 scale-105" : "invisible opacity-0 scale-95"
        )} onClick={()=>setIsFocused(true)}>

          <span className="font-medium text-lg text-white/60">Click here to begin</span>




        </button>

        <TypingArea text={"Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum"} isOverlayed={false} onStart={()=> setAppState("active")} onFinish={()=>{setAppState("result")}} onBlur={()=>{setIsFocused(false)}}
        // built-in function on foucs changes
        /> 

      </div>

    </div>


    </>

)

}

  
