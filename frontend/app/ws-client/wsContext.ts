'use client';

import React, {createContext, useContext, useEffect, useState } from 'react';
import WebSocket from 'ws';





export const SocketProvider = (children:React.ReactNode) => {
  const SocketContext = createContext(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(()=>{
    const newSocket = new WebSocket('http://localhost:4000');
    setSocket(newSocket);

    return () => newSocket.close(); // socket get updated when user get disconnected
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children} {/*  whole app */}
    </SocketContext.Provider>
  );
};
