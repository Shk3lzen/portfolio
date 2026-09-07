import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMessageSquare, FiX, FiSend } from 'react-icons/fi';
import { answerQuestion, chatSuggestions } from '../data/knowledge';

interface Message {
  role: 'bot' | 'user';
  text: string;
}

const GREETING: Message = {
  role: 'bot',
  text: "Hi! I'm Shkëlzen's assistant. Ask me about his experience, skills, or projects.",
};

// Render plain text, turning URLs into links.
const Linkified: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

const AiChat: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Allow the command palette (or anything) to open the chat.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-chat', handler);
    return () => window.removeEventListener('open-ai-chat', handler);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setTyping(true);
    // Small delay so it reads like a reply being composed.
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'bot', text: answerQuestion(trimmed) }]);
      setTyping(false);
    }, 450);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <Panel
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Ask about my work"
          >
            <PanelHeader>
              <div>
                <PanelTitle>Ask about my work</PanelTitle>
                <PanelNote>Local assistant · answers from portfolio data</PanelNote>
              </div>
              <CloseButton onClick={() => setOpen(false)} aria-label="Close chat">
                <FiX />
              </CloseButton>
            </PanelHeader>

            <Body ref={bodyRef}>
              {messages.map((message, i) => (
                <Bubble key={i} className={message.role}>
                  <Linkified text={message.text} />
                </Bubble>
              ))}
              {typing && (
                <Bubble className="bot">
                  <Typing>
                    <span />
                    <span />
                    <span />
                  </Typing>
                </Bubble>
              )}

              {messages.length === 1 && (
                <Suggestions>
                  {chatSuggestions.map((s) => (
                    <SuggestionChip key={s} onClick={() => send(s)}>
                      {s}
                    </SuggestionChip>
                  ))}
                </Suggestions>
              )}
            </Body>

            <InputRow
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <ChatInput
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question…"
                aria-label="Type your question"
              />
              <SendButton type="submit" aria-label="Send" disabled={!input.trim()}>
                <FiSend />
              </SendButton>
            </InputRow>
          </Panel>
        )}
      </AnimatePresence>

      <FabButton onClick={() => setOpen((o) => !o)} aria-label="Open assistant" className={open ? 'open' : ''}>
        {open ? <FiX /> : <FiMessageSquare />}
      </FabButton>
    </>
  );
};

const FabButton = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 120;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 22px;
  color: var(--bg);
  background: var(--accent);
  border: none;
  box-shadow: 0 10px 30px -8px var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 36px -10px var(--shadow);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  @media (max-width: 768px) {
    bottom: 16px;
    right: 16px;
  }
`;

const Panel = styled(motion.div)`
  position: fixed;
  bottom: 92px;
  right: 24px;
  z-index: 120;
  width: 360px;
  max-width: calc(100vw - 32px);
  height: 500px;
  max-height: calc(100vh - 130px);
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid rgba(var(--accent-rgb), 0.2);
  border-radius: 16px;
  box-shadow: 0 24px 60px -12px var(--shadow);
  overflow: hidden;

  @media (max-width: 768px) {
    right: 16px;
    bottom: 84px;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(var(--border-rgb), 0.18);
`;

const PanelTitle = styled.div`
  color: var(--heading);
  font-size: 15px;
  font-weight: 600;
`;

const PanelNote = styled.div`
  color: var(--text);
  font-size: 11px;
  font-family: 'SF Mono', monospace;
  margin-top: 2px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  font-size: 18px;
  display: grid;
  place-items: center;

  &:hover {
    color: var(--accent);
  }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Bubble = styled.div`
  max-width: 85%;
  padding: 10px 13px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.5;

  a {
    color: var(--accent);
    text-decoration: underline;
    word-break: break-word;
  }

  &.bot {
    align-self: flex-start;
    background: rgba(var(--border-rgb), 0.14);
    color: var(--heading);
    border-bottom-left-radius: 4px;
  }

  &.user {
    align-self: flex-end;
    background: rgba(var(--accent-rgb), 0.15);
    color: var(--heading);
    border-bottom-right-radius: 4px;
  }
`;

const Typing = styled.div`
  display: flex;
  gap: 4px;
  padding: 2px 0;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text);
    animation: bounce 1.2s infinite ease-in-out;
  }
  span:nth-child(2) {
    animation-delay: 0.15s;
  }
  span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes bounce {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
`;

const SuggestionChip = styled.button`
  cursor: pointer;
  font-size: 12px;
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.25);
  border-radius: 999px;
  padding: 6px 12px;
  transition: background 0.2s;

  &:hover {
    background: rgba(var(--accent-rgb), 0.16);
  }
`;

const InputRow = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid rgba(var(--border-rgb), 0.18);
`;

const ChatInput = styled.input`
  flex: 1;
  background: rgba(var(--border-rgb), 0.12);
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--heading);
  font-size: 13.5px;
  font-family: inherit;
  outline: none;

  &::placeholder {
    color: var(--text);
  }

  &:focus {
    border-color: rgba(var(--accent-rgb), 0.4);
  }
`;

const SendButton = styled.button`
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 10px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--bg);
  background: var(--accent);
  border: none;
  font-size: 16px;
  transition: opacity 0.2s;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export default AiChat;
