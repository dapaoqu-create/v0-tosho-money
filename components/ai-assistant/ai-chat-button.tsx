"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AiChatDialog } from "./ai-chat-dialog"

export function AiChatButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      <AiChatDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}
