import { io } from "socket.io-client";

const socket = io("http://localhost:5001", {
  withCredentials: true,
  autoConnect: false,
  auth: {
   token: localStorage.getItem("erosocial_token"),
  },
});

export default socket;