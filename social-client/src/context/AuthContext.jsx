

import { createContext, useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, registerUser, logout as logoutAction, updateUser as updateUserAction } from "../store/slices/authSlice";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);

  const login = async (email, password) => {
    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.rejected.match(result)) {
      throw { response: { data: { message: result.payload } } };
    }
    return result.payload;
  };

  const register = async (name, email, password) => {
    const result = await dispatch(registerUser({ name, email, password }));
    if (registerUser.rejected.match(result)) {
      throw { response: { data: { message: result.payload } } };
    }
    return result.payload;
  };

const logout = () => {
  dispatch(logoutAction());  // ← logoutAction use karo
  window.location.href = "/login";
};
  const updateUser = (updatedFields) => {
    dispatch(updateUserAction(updatedFields));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);