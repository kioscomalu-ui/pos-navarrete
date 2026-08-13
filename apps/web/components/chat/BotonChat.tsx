'use client';

import { useState } from 'react';
import { PanelChat } from './PanelChat';
import { useChat } from '@/hooks/useChat';
import type { ContextoChat } from '@/lib/chat-manager';

export function BotonChat({ ctx }: { ctx: ContextoChat }) {
  const [abierto, setAbierto] = useState(false);
  const chat = useChat(ctx);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="relative text-sm text-neutral-500 hover:text-neutral-900"
        title="Mensajes"
      >
        Mensajes
        {chat.totalNoLeidos > 0 && (
          <span className="absolute -top-1.5 -right-3 bg-neutral-900 text-white text-xs rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {chat.totalNoLeidos > 9 ? '9+' : chat.totalNoLeidos}
          </span>
        )}
      </button>

      <PanelChat
        chat={chat}
        ctx={ctx}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
    </>
  );
}