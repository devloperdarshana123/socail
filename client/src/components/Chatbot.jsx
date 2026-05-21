

// // import { useState, useRef, useEffect, useCallback } from "react";
// // import api from "../lib/services/api";

// // const INITIAL_MESSAGE = {
// //   from: "bot",
// //   text: "Hello! I'm Erovians AI 👋 I can help you find marble suppliers, stone types, designers, and more. How can I assist you today?",
// // };

// // // ── Web Speech API setup ──────────────────────────────────────
// // const SpeechRecognition =
// //   window.SpeechRecognition || window.webkitSpeechRecognition;
// // const isSpeechSupported = !!SpeechRecognition;

// // function useSpeechInput({ onInterim, onFinal }) {
// //   const recognitionRef = useRef(null);
// //   const [isListening, setIsListening] = useState(false);
// //   const shouldRestartRef = useRef(false);

// //   useEffect(() => {
// //     if (!isSpeechSupported) return;

// //     const recognition = new SpeechRecognition();
// //     recognition.continuous = true;
// //     recognition.interimResults = true;
// //     recognition.lang = "en-IN"; // Hinglish (Hindi + English mixed) perfect hai

// //     recognition.onresult = (event) => {
// //       let interim = "";
// //       let final = "";
// //       for (let i = event.resultIndex; i < event.results.length; i++) {
// //         const r = event.results[i];
// //         if (r.isFinal) final += r[0].transcript;
// //         else interim += r[0].transcript;
// //       }
// //       if (final) onFinal?.(final);
// //       else onInterim?.(interim);
// //     };

// //     recognition.onerror = (e) => {
// //       if (e.error === "no-speech" || e.error === "aborted") return;
// //       setIsListening(false);
// //     };

// //     recognition.onend = () => {
// //       if (shouldRestartRef.current) {
// //         try { recognition.start(); } catch { setIsListening(false); }
// //       } else {
// //         setIsListening(false);
// //       }
// //     };

// //     recognitionRef.current = recognition;
// //     return () => recognition.abort();
// //   }, []); // eslint-disable-line

// //   const start = useCallback(() => {
// //     if (!isSpeechSupported || !recognitionRef.current || isListening) return;
// //     shouldRestartRef.current = true;
// //     try {
// //       recognitionRef.current.start();
// //       setIsListening(true);
// //     } catch { /* already started */ }
// //   }, [isListening]);

// //   const stop = useCallback(() => {
// //     if (!recognitionRef.current) return;
// //     shouldRestartRef.current = false;
// //     recognitionRef.current.stop();
// //     setIsListening(false);
// //   }, []);

// //   return { isListening, start, stop, isSupported: isSpeechSupported };
// // }
// // // ─────────────────────────────────────────────────────────────

// // export default function ChatBot() {
// //   const [chatOpen, setChatOpen]       = useState(false);
// //   const [chatMsg, setChatMsg]         = useState("");
// //   const [chatHistory, setChatHistory] = useState([INITIAL_MESSAGE]);
// //   const [loading, setLoading]         = useState(false);
// //   const chatEndRef = useRef(null);
// //   const inputRef   = useRef(null);

// //   // Voice handlers
// //   const handleInterim = useCallback((text) => {
// //     setChatMsg(text);
// //   }, []);

// //   const handleFinal = useCallback((text) => {
// //     setChatMsg((prev) => {
// //       // agar interim already set tha, replace karo; warna append karo
// //       return text;
// //     });
// //   }, []);

// //   const { isListening, start, stop, isSupported } = useSpeechInput({
// //     onInterim: handleInterim,
// //     onFinal: handleFinal,
// //   });

// //   const toggleVoice = () => {
// //     if (isListening) {
// //       stop();
// //     } else {
// //       setChatMsg("");
// //       start();
// //     }
// //   };

// //   useEffect(() => {
// //     if (chatOpen) {
// //       chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
// //       setTimeout(() => inputRef.current?.focus(), 100);
// //     }
// //   }, [chatHistory, chatOpen]);

// //   // Chat band ho to recording bhi band karo
// //   useEffect(() => {
// //     if (!chatOpen && isListening) stop();
// //   }, [chatOpen, isListening, stop]);

// //   const sendMessage = async () => {
// //     const text = chatMsg.trim();
// //     if (!text || loading) return;
// //     if (isListening) stop(); // send karte waqt mic band karo

// //     const userMsg = { from: "user", text };
// //     setChatHistory((h) => [...h, userMsg]);
// //     setChatMsg("");
// //     setLoading(true);

// //     try {
// //       const { data } = await api.post("/chat/ai", {
// //         message: text,
// //         history: chatHistory,
// //       });
// //       setChatHistory((h) => [...h, { from: "bot", text: data.data.reply }]);
// //     } catch (err) {
// //       setChatHistory((h) => [
// //         ...h,
// //         {
// //           from: "bot",
// //           text: err?.response?.data?.message || "Sorry, something went wrong. Please try again.",
// //         },
// //       ]);
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleKeyDown = (e) => {
// //     if (e.key === "Enter" && !e.shiftKey) {
// //       e.preventDefault();
// //       sendMessage();
// //     }
// //   };

// //   return (
// //     <div className="fixed bottom-6 left-6 flex flex-col items-end gap-2 z-50">

// //       {/* ── Chat Window ── */}
// //       {chatOpen && (
// //         <div
// //           className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
// //           style={{ height: "420px" }}
// //         >
// //           {/* Header */}
// //           <div
// //             className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
// //             style={{ background: "#1e3a5f" }}
// //           >
// //             <div className="flex items-center gap-2">
// //               <div className="w-8 h-8 rounded-full overflow-hidden bg-[#eef3f6] border border-white/30 shrink-0">
// //                 <iframe
// //                   src="/Robot-V1.html?embed=1"
// //                   title="Robot"
// //                   className="w-full h-full border-0 pointer-events-none"
// //                   style={{ display: "block" }}
// //                 />
// //               </div>
// //               <div>
// //                 <p className="text-xs font-bold text-white leading-tight">Erovians AI</p>
// //                 <span className="flex items-center gap-1 text-[10px] text-green-300">
// //                   <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
// //                   {isListening ? "Listening..." : "Online"}
// //                 </span>
// //               </div>
// //             </div>
// //             <button
// //               onClick={() => setChatOpen(false)}
// //               className="text-white/70 hover:text-white text-lg leading-none transition"
// //             >
// //               ✕
// //             </button>
// //           </div>

// //           {/* Messages */}
// //           <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#f8f9fb]">
// //             {chatHistory.map((msg, i) => (
// //               <div
// //                 key={i}
// //                 className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
// //               >
// //                 {msg.from === "bot" && (
// //                   <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
// //                     <iframe
// //                       src="/Robot-V1.html?embed=1"
// //                       title="bot"
// //                       className="w-full h-full border-0 pointer-events-none"
// //                     />
// //                   </div>
// //                 )}
// //                 <div
// //                   className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
// //                     msg.from === "user"
// //                       ? "text-white rounded-br-sm"
// //                       : "bg-white text-gray-700 shadow-sm rounded-bl-sm border border-gray-100"
// //                   }`}
// //                   style={msg.from === "user" ? { background: "#1e3a5f" } : {}}
// //                 >
// //                   {msg.text}
// //                 </div>
// //               </div>
// //             ))}

// //             {/* Typing indicator */}
// //             {loading && (
// //               <div className="flex justify-start">
// //                 <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
// //                   <iframe
// //                     src="/Robot-V1.html?embed=1"
// //                     title="bot"
// //                     className="w-full h-full border-0 pointer-events-none"
// //                   />
// //                 </div>
// //                 <div className="bg-white text-gray-400 shadow-sm border border-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1">
// //                   <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
// //                   <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
// //                   <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
// //                 </div>
// //               </div>
// //             )}

// //             <div ref={chatEndRef} />
// //           </div>

// //           {/* ── Input Row ── */}
// //           <div className="px-3 py-3 border-t border-gray-100 flex gap-2 bg-white items-center">

// //             {/* Mic button — sirf tab dikhao jab supported ho */}
// //             {isSupported && (
// //               <button
// //                 type="button"
// //                 onClick={toggleVoice}
// //                 disabled={loading}
// //                 title={isListening ? "Stop recording" : "Speak your message"}
// //                 className={`
// //                   relative w-9 h-9 shrink-0 flex items-center justify-center rounded-full
// //                   transition-all duration-200 disabled:opacity-40
// //                   ${isListening
// //                     ? "bg-red-500 text-white scale-110 shadow-md"
// //                     : "bg-gray-100 text-gray-500 hover:bg-gray-200"
// //                   }
// //                 `}
// //               >
// //                 {/* Pulsing ring when recording */}
// //                 {isListening && (
// //                   <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40 pointer-events-none" />
// //                 )}
// //                 {/* Mic SVG */}
// //                 <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
// //                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //                   <rect x="9" y="2" width="6" height="11" rx="3" />
// //                   <path d="M5 10a7 7 0 0 0 14 0" />
// //                   <line x1="12" y1="19" x2="12" y2="22" />
// //                   <line x1="8" y1="22" x2="16" y2="22" />
// //                 </svg>
// //               </button>
// //             )}

// //             <input
// //               ref={inputRef}
// //               type="text"
// //               value={chatMsg}
// //               onChange={(e) => setChatMsg(e.target.value)}
// //               onKeyDown={handleKeyDown}
// //               placeholder={isListening ? "Listening…" : "Ask about marble, suppliers..."}
// //               disabled={loading}
// //               className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2 outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-60 transition-all"
// //             />

// //             <button
// //               onClick={sendMessage}
// //               disabled={!chatMsg.trim() || loading}
// //               className="w-9 h-9 flex items-center justify-center rounded-full text-white disabled:opacity-40 transition shrink-0"
// //               style={{ background: "#1e3a5f" }}
// //             >
// //               <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
// //                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
// //                 <line x1="22" y1="2" x2="11" y2="13" />
// //                 <polygon points="22 2 15 22 11 13 2 9 22 2" />
// //               </svg>
// //             </button>
// //           </div>
// //         </div>
// //       )}

// //       {/* ── Bubble Button ── */}
// //       <div className="flex flex-col items-center gap-1">
// //         {!chatOpen && (
// //           <div
// //             className="px-3 py-1.5 text-xs font-semibold text-white rounded-full shadow animate-bounce"
// //             style={{ background: "#1e3a5f" }}
// //           >
// //             Ask me!
// //           </div>
// //         )}
// //         <button
// //           onClick={() => setChatOpen((o) => !o)}
// //           className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-xl hover:scale-105 transition-transform bg-[#eef3f6]"
// //         >
// //           <iframe
// //             src="/Robot-V1.html?embed=1"
// //             title="AI Bot"
// //             className="w-full h-full border-0 pointer-events-none"
// //             style={{ display: "block" }}
// //           />
// //         </button>
// //       </div>
// //     </div>
// //   );
// // }



// import { useState, useRef, useEffect, useCallback } from "react";
// import api from "../lib/services/api";

// const INITIAL_MESSAGE = {
//   from: "bot",
//   text: "Hello! I'm Erovians AI 👋 I can help you find marble suppliers, stone types, designers, and more. How can I assist you today?",
// };

// export default function ChatBot() {
//   const [chatOpen, setChatOpen]       = useState(false);
//   const [chatMsg, setChatMsg]         = useState("");
//   const [chatHistory, setChatHistory] = useState([INITIAL_MESSAGE]);
//   const [loading, setLoading]         = useState(false);

//   // Voice states
//   const [isRecording, setIsRecording]       = useState(false);
//   const [isTranscribing, setIsTranscribing] = useState(false);
//   const [voiceError, setVoiceError]         = useState(null);

//   const chatEndRef    = useRef(null);
//   const inputRef      = useRef(null);
//   const mediaRecorder = useRef(null);
//   const audioChunks   = useRef([]);

//   useEffect(() => {
//     if (chatOpen) {
//       chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//       setTimeout(() => inputRef.current?.focus(), 100);
//     }
//   }, [chatHistory, chatOpen]);

//   useEffect(() => {
//     if (!chatOpen && isRecording) stopRecording();
//   }, [chatOpen]); // eslint-disable-line

//   // ── Voice recording ──────────────────────────────────────
//   const startRecording = useCallback(async () => {
//     setVoiceError(null);
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       audioChunks.current = [];

//       const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
//         ? "audio/webm;codecs=opus"
//         : "audio/webm";

//       const recorder = new MediaRecorder(stream, { mimeType });

//       recorder.ondataavailable = (e) => {
//         if (e.data.size > 0) audioChunks.current.push(e.data);
//       };

//       recorder.onstop = async () => {
//         stream.getTracks().forEach((t) => t.stop());
//         const blob = new Blob(audioChunks.current, { type: mimeType });
//         if (blob.size < 1000) {
//           setVoiceError("No audio detected. Please try again.");
//           return;
//         }
//         await transcribeBlob(blob, mimeType);
//       };

//       recorder.start();
//       mediaRecorder.current = recorder;
//       setIsRecording(true);
//     } catch (err) {
//       if (err.name === "NotAllowedError") {
//         setVoiceError("Microphone access denied.");
//       } else {
//         setVoiceError("Could not start microphone.");
//       }
//     }
//   }, []);

//   const stopRecording = useCallback(() => {
//     if (mediaRecorder.current?.state === "recording") {
//       mediaRecorder.current.stop();
//     }
//     setIsRecording(false);
//   }, []);

//   const transcribeBlob = async (blob, mimeType) => {
//     setIsTranscribing(true);
//     try {
//       const formData = new FormData();
//       formData.append(
//         "audio",
//         blob,
//         mimeType.includes("ogg") ? "audio.ogg" : "audio.webm"
//       );

//       const { data } = await api.post("/transcribe", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });

//       const transcript = data?.data?.transcript?.trim();
//       if (transcript) {
//         setChatMsg(transcript);
//         setTimeout(() => inputRef.current?.focus(), 100);
//       } else {
//         setVoiceError("Could not understand. Please try again.");
//       }
//     } catch (err) {
//       setVoiceError(
//         err?.response?.data?.message || "Transcription failed. Try again."
//       );
//     } finally {
//       setIsTranscribing(false);
//     }
//   };

//   const toggleRecording = () => {
//     if (isRecording) {
//       stopRecording();
//     } else {
//       setChatMsg("");
//       startRecording();
//     }
//   };
//   // ─────────────────────────────────────────────────────────

//   const sendMessage = async () => {
//     const text = chatMsg.trim();
//     if (!text || loading) return;
//     if (isRecording) stopRecording();

//     const userMsg = { from: "user", text };
//     setChatHistory((h) => [...h, userMsg]);
//     setChatMsg("");
//     setVoiceError(null);
//     setLoading(true);

//     try {
//       const { data } = await api.post("/chat/ai", {
//         message: text,
//         history: chatHistory,
//       });
//       setChatHistory((h) => [...h, { from: "bot", text: data.data.reply }]);
//     } catch (err) {
//       setChatHistory((h) => [
//         ...h,
//         {
//           from: "bot",
//           text:
//             err?.response?.data?.message ||
//             "Sorry, something went wrong. Please try again.",
//         },
//       ]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       sendMessage();
//     }
//   };

//   const micLabel = isRecording
//     ? "Stop recording"
//     : isTranscribing
//     ? "Transcribing…"
//     : "Speak your message";

//   return (
//     <div className="fixed bottom-6 left-6 flex flex-col items-end gap-2 z-50">

//       {chatOpen && (
//         <div
//           className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
//           style={{ height: "420px" }}
//         >
//           {/* Header */}
//           <div
//             className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
//             style={{ background: "#1e3a5f" }}
//           >
//             <div className="flex items-center gap-2">
//               <div className="w-8 h-8 rounded-full overflow-hidden bg-[#eef3f6] border border-white/30 shrink-0">
//                 <iframe src="/Robot-V1.html?embed=1" title="Robot"
//                   className="w-full h-full border-0 pointer-events-none"
//                   style={{ display: "block" }} />
//               </div>
//               <div>
//                 <p className="text-xs font-bold text-white leading-tight">Erovians AI</p>
//                 <span className="flex items-center gap-1 text-[10px] text-green-300">
//                   <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
//                   {isRecording ? "Recording…" : isTranscribing ? "Transcribing…" : "Online"}
//                 </span>
//               </div>
//             </div>
//             <button onClick={() => setChatOpen(false)}
//               className="text-white/70 hover:text-white text-lg leading-none transition">
//               ✕
//             </button>
//           </div>

//           {/* Messages */}
//           <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#f8f9fb]">
//             {chatHistory.map((msg, i) => (
//               <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
//                 {msg.from === "bot" && (
//                   <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
//                     <iframe src="/Robot-V1.html?embed=1" title="bot"
//                       className="w-full h-full border-0 pointer-events-none" />
//                   </div>
//                 )}
//                 <div
//                   className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
//                     msg.from === "user"
//                       ? "text-white rounded-br-sm"
//                       : "bg-white text-gray-700 shadow-sm rounded-bl-sm border border-gray-100"
//                   }`}
//                   style={msg.from === "user" ? { background: "#1e3a5f" } : {}}
//                 >
//                   {msg.text}
//                 </div>
//               </div>
//             ))}

//             {loading && (
//               <div className="flex justify-start">
//                 <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
//                   <iframe src="/Robot-V1.html?embed=1" title="bot"
//                     className="w-full h-full border-0 pointer-events-none" />
//                 </div>
//                 <div className="bg-white text-gray-400 shadow-sm border border-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1">
//                   <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
//                   <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
//                   <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
//                 </div>
//               </div>
//             )}
//             <div ref={chatEndRef} />
//           </div>

//           {/* Input Row */}
//           <div className="px-3 py-3 border-t border-gray-100 bg-white flex flex-col gap-1.5">
//             {voiceError && (
//               <p className="text-[11px] text-red-500 text-center px-1">{voiceError}</p>
//             )}
//             <div className="flex gap-2 items-center">
//               {/* Mic button */}
//               <button
//                 type="button"
//                 onClick={toggleRecording}
//                 disabled={loading || isTranscribing}
//                 title={micLabel}
//                 aria-label={micLabel}
//                 aria-pressed={isRecording}
//                 className={`
//                   relative w-9 h-9 shrink-0 flex items-center justify-center rounded-full
//                   transition-all duration-200 disabled:opacity-40
//                   ${isRecording
//                     ? "bg-red-500 text-white scale-110 shadow-md"
//                     : isTranscribing
//                     ? "bg-blue-100 text-blue-500 cursor-wait"
//                     : "bg-gray-100 text-gray-500 hover:bg-gray-200"
//                   }
//                 `}
//               >
//                 {isRecording && (
//                   <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40 pointer-events-none" />
//                 )}
//                 {isTranscribing ? (
//                   <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
//                     <circle className="opacity-25" cx="12" cy="12" r="10"
//                       stroke="currentColor" strokeWidth="3"/>
//                     <path className="opacity-75" fill="currentColor"
//                       d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
//                   </svg>
//                 ) : (
//                   <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
//                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                     <rect x="9" y="2" width="6" height="11" rx="3" />
//                     <path d="M5 10a7 7 0 0 0 14 0" />
//                     <line x1="12" y1="19" x2="12" y2="22" />
//                     <line x1="8" y1="22" x2="16" y2="22" />
//                   </svg>
//                 )}
//               </button>

//               <input
//                 ref={inputRef}
//                 type="text"
//                 value={chatMsg}
//                 onChange={(e) => setChatMsg(e.target.value)}
//                 onKeyDown={handleKeyDown}
//                 placeholder={
//                   isRecording ? "Recording… tap mic to stop"
//                   : isTranscribing ? "Transcribing…"
//                   : "Ask about marble, suppliers..."
//                 }
//                 disabled={loading || isRecording || isTranscribing}
//                 className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2 outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-60 transition-all"
//               />

//               <button
//                 onClick={sendMessage}
//                 disabled={!chatMsg.trim() || loading || isRecording || isTranscribing}
//                 className="w-9 h-9 flex items-center justify-center rounded-full text-white disabled:opacity-40 transition shrink-0"
//                 style={{ background: "#1e3a5f" }}
//               >
//                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
//                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                   <line x1="22" y1="2" x2="11" y2="13" />
//                   <polygon points="22 2 15 22 11 13 2 9 22 2" />
//                 </svg>
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Bubble */}
//       <div className="flex flex-col items-center gap-1">
//         {!chatOpen && (
//           <div className="px-3 py-1.5 text-xs font-semibold text-white rounded-full shadow animate-bounce"
//             style={{ background: "#1e3a5f" }}>
//             Ask me!
//           </div>
//         )}
//         <button onClick={() => setChatOpen((o) => !o)}
//           className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-xl hover:scale-105 transition-transform bg-[#eef3f6]">
//           <iframe src="/Robot-V1.html?embed=1" title="AI Bot"
//             className="w-full h-full border-0 pointer-events-none"
//             style={{ display: "block" }} />
//         </button>
//       </div>
//     </div>
//   );
// }



import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, X } from "lucide-react";
import api from "../lib/services/api";
import { useVoiceToText } from "../lib/hooks/useVoiceToText";

const INITIAL_MESSAGE = {
  from: "bot",
  text: "Hello! I'm Erovians AI 👋 I can help you find marble suppliers, stone types, designers, and more. How can I assist you today?",
};

export default function ChatBot() {
  const [chatOpen, setChatOpen]       = useState(false);
  const [chatMsg, setChatMsg]         = useState("");
  const [chatHistory, setChatHistory] = useState([INITIAL_MESSAGE]);
  const [loading, setLoading]         = useState(false);

  const chatEndRef = useRef(null);
  const inputRef   = useRef(null);

  const { isRecording, isTranscribing, error, toggle, clearError } = useVoiceToText({
    onResult: (text) => {
      setChatMsg(text);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
  });

  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatHistory, chatOpen]);

  // Chat band ho to recording bhi band karo
  useEffect(() => {
    if (!chatOpen && isRecording) toggle();
  }, [chatOpen]); // eslint-disable-line

  const sendMessage = async () => {
    const text = chatMsg.trim();
    if (!text || loading) return;
    if (isRecording) toggle();

    const userMsg = { from: "user", text };
    setChatHistory((h) => [...h, userMsg]);
    setChatMsg("");
    clearError();
    setLoading(true);

    try {
      const { data } = await api.post("/chat/ai", {
        message: text,
        history: chatHistory,
      });
      setChatHistory((h) => [...h, { from: "bot", text: data.data.reply }]);
    } catch (err) {
      setChatHistory((h) => [
        ...h,
        {
          from: "bot",
          text: err?.response?.data?.message || "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 left-6 flex flex-col items-end gap-2 z-50">

      {chatOpen && (
        <div
          className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ height: "420px" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-100"
            style={{ background: "#1e3a5f" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-[#eef3f6] border border-white/30 shrink-0">
                <iframe src="/Robot-V1.html?embed=1" title="Robot"
                  className="w-full h-full border-0 pointer-events-none"
                  style={{ display: "block" }} />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">Erovians AI</p>
                <span className="flex items-center gap-1 text-[10px] text-green-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  {isRecording ? "Recording…" : isTranscribing ? "Transcribing…" : "Online"}
                </span>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)}
              className="text-white/70 hover:text-white transition">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#f8f9fb]">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                {msg.from === "bot" && (
                  <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
                    <iframe src="/Robot-V1.html?embed=1" title="bot"
                      className="w-full h-full border-0 pointer-events-none" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.from === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-white text-gray-700 shadow-sm rounded-bl-sm border border-gray-100"
                  }`}
                  style={msg.from === "user" ? { background: "#1e3a5f" } : {}}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-2 mt-1 bg-[#eef3f6]">
                  <iframe src="/Robot-V1.html?embed=1" title="bot"
                    className="w-full h-full border-0 pointer-events-none" />
                </div>
                <div className="bg-white text-gray-400 shadow-sm border border-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 bg-white flex flex-col gap-1.5">
            {error && (
              <p className="text-[11px] text-red-500 text-center">{error}</p>
            )}
            <div className="flex gap-2 items-center">
              {/* Mic button */}
              <button
                type="button"
                onClick={toggle}
                disabled={loading || isTranscribing}
                title={isRecording ? "Stop recording" : "Speak your message"}
                aria-label={isRecording ? "Stop recording" : "Speak your message"}
                className={`
                  relative w-9 h-9 shrink-0 flex items-center justify-center rounded-full
                  transition-all duration-200 disabled:opacity-40
                  ${isRecording
                    ? "bg-red-500 text-white scale-110 shadow-md"
                    : isTranscribing
                    ? "bg-blue-100 text-blue-500 cursor-wait"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }
                `}
              >
                {isRecording && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40 pointer-events-none" />
                )}
                {isTranscribing ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                ) : isRecording ? (
                  <MicOff size={15} />
                ) : (
                  <Mic size={15} />
                )}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording ? "Recording… tap to stop"
                  : isTranscribing ? "Transcribing…"
                  : "Ask about marble, suppliers..."
                }
                disabled={loading || isRecording || isTranscribing}
                className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2 outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-60 transition-all"
              />

              <button
                onClick={sendMessage}
                disabled={!chatMsg.trim() || loading || isRecording || isTranscribing}
                aria-label="Send message"
                className="w-9 h-9 flex items-center justify-center rounded-full text-white disabled:opacity-40 transition shrink-0"
                style={{ background: "#1e3a5f" }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bubble */}
      <div className="flex flex-col items-center gap-1">
        {!chatOpen && (
          <div className="px-3 py-1.5 text-xs font-semibold text-white rounded-full shadow animate-bounce"
            style={{ background: "#1e3a5f" }}>
            Ask me!
          </div>
        )}
        <button onClick={() => setChatOpen((o) => !o)}
          className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-xl hover:scale-105 transition-transform bg-[#eef3f6]">
          <iframe src="/Robot-V1.html?embed=1" title="AI Bot"
            className="w-full h-full border-0 pointer-events-none"
            style={{ display: "block" }} />
        </button>
      </div>
    </div>
  );
}