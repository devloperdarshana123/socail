

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { Check, X, UserPlus, ArrowLeft, Bell } from "lucide-react";
import { useDispatch } from "react-redux";
import { resetFollowRequestCount } from "../store/slices/Exploreslice"; // ← apna path check karo

export default function FollowRequests() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/follow/requests");
      setRequests(data.requests || []);
    } catch {
      toast.error("Requests not loaded!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests();
     dispatch(resetFollowRequestCount());
   }, []);

  const handleAccept = async (requesterId) => {
    setProcessing(requesterId);
    try {
      await api.post(`/follow/${requesterId}/accept`);
      setRequests((prev) => prev.filter((r) => r._id !== requesterId));
      toast.success("Request accepted! 🎉");
    } catch {
      toast.error("Request not accepted.");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requesterId) => {
    setProcessing(requesterId);
    try {
      await api.post(`/follow/${requesterId}/reject`);
      setRequests((prev) => prev.filter((r) => r._id !== requesterId));
      toast.success("Request rejected! ❌");
    } catch {
      toast.error("Request not rejected.");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="flex gap-6 items-start w-full">

      {/* CENTER */}
      <div className="flex-1 min-w-0 pb-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/")}
            className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 text-gray-400 hover:text-gray-700 transition">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Bell size={20} style={{ color: "#1e3a5f" }} />
            <h1 className="text-base font-bold text-gray-800">Follow Requests</h1>
            {!loading && requests.length > 0 && (
              <span className="text-xs font-medium text-white bg-red-500 px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200" />
                    <div className="space-y-2">
                      <div className="w-28 h-3 bg-gray-200 rounded" />
                      <div className="w-16 h-2.5 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-20 h-8 bg-gray-100 rounded-lg" />
                    <div className="w-20 h-8 bg-gray-100 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#eef2f7" }}>
              <UserPlus size={28} style={{ color: "#1e3a5f" }} />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">No pending requests</p>
            <p className="text-sm text-gray-400 mb-5">When someone sends you a follow request, it will appear here</p>
            <button onClick={() => navigate("/explore")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: "#1e3a5f" }}>
              Explore Users
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((requester) => (
              <div key={requester._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 cursor-pointer"
                      style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                      onClick={() => navigate(`/profile/${requester._id}`)}>
                      {requester.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate cursor-pointer hover:text-indigo-600"
                        onClick={() => navigate(`/profile/${requester._id}`)}>
                        {requester.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{requester.designation?.trim() || "EroSocial Member"}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{requester.followers?.length || 0} followers</span>
                        <span>•</span>
                        <span>{requester.following?.length || 0} following</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleAccept(requester._id)} disabled={processing === requester._id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 hover:opacity-90"
                      style={{ background: "#10b981" }}>
                      {processing === requester._id
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Check size={14} />}
                      Accept
                    </button>
                    <button onClick={() => handleReject(requester._id)} disabled={processing === requester._id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50">
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="hidden xl:block w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} style={{ color: "#1e3a5f" }} />
            <p className="text-sm font-semibold text-gray-700">Follow Requests</p>
          </div>
          <p className="text-2xl font-bold text-gray-800 mb-0.5">{requests.length}</p>
          <p className="text-xs text-gray-400">pending approvals</p>
          <div className="border-t border-gray-100 my-3" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Accept requests to let users follow you. Rejected requests won't be notified.
          </p>
        </div>
      </div>

    </div>
  );
}