'use client';

import TypingArea from "@/component/TypeArea";


export default function Home() {
  return (
    <>

    <div className="h-[100vh] w-full flex flex-col justify-center items-center p-8 bg-neutral-950 text-neutral-200">
      <div className="max-w-screen-xl relative p-4">

        <TypingArea text={"helo lorem"} isOverlayed={false} />

      </div>

    </div>


    </>

  )}
