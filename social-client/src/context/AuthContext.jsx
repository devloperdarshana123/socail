

import { createContext, useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, registerUser, logout as logoutAction, updateUser as updateUserAction } from "../store/slices/authSlice";
import api from "../services/api";
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);


   useEffect(() => {
    const token = localStorage.getItem("erosocial_token");
    if (!token) return;

    api.get("/settings/profile").then(({ data }) => {
      if (data?.user) {
        dispatch(updateUserAction({
          avatar:     data.user.avatar,
          coverPhoto: data.user.coverPhoto,
          name:       data.user.name,
          bio:        data.user.bio,
          designation: data.user.designation,
          location:   data.user.location,
        }));
      }
    }).catch(() => {});
  }, []);


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