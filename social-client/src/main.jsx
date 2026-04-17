


// import { StrictMode } from "react";
// import { createRoot } from "react-dom/client";
// import { BrowserRouter } from "react-router-dom";
// import { Toaster } from "react-hot-toast";
// import { Provider } from "react-redux";          // ← add karo
// import { AuthProvider } from "./context/AuthContext.jsx";
// import "./index.css";
// import App from "./App.jsx";
// import store from "./store/store.js";

// createRoot(document.getElementById("root")).render(
//   <StrictMode>
//     <BrowserRouter>
//       <Provider store={store}>          {/* ← Provider pehle */}
//         <AuthProvider>
//           <Toaster position="top-right" />
//           <App />
//         </AuthProvider>
//       </Provider>
//     </BrowserRouter>
//   </StrictMode>
// );

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Provider } from "react-redux";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx"; // ← add karo
import "./index.css";
import App from "./App.jsx";
import store from "./store/store.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Provider store={store}>
        <AuthProvider>
          <SocketProvider>  {/* ← add karo */}
            <Toaster position="top-right" />
            <App />
          </SocketProvider>  {/* ← add karo */}
        </AuthProvider>
      </Provider>
    </BrowserRouter>
  </StrictMode>
);