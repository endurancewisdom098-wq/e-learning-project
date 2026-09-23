"use client";

import { useEffect, useState } from "react";

export default function BackendStatusPage() {
  const [status, setStatus] = useState<string>("Connecting to backend...");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkBackendHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/`);
      
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const data = await response.json();
      setStatus(data.message || "Backend is running successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to connect to the backend server.");
      setStatus("Offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-6">
      <div className="w-full max-w-xl rounded-2xl bg-gray-800 p-8 shadow-xl border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-wide">LearnHub Backend Status</h1>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
            loading ? "bg-yellow-500/20 text-yellow-400" : error ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
          }`}>
            {loading ? "Checking..." : error ? "Disconnected" : "Active"}
          </span>
        </div>

        <div className="space-y-4 mb-6">
          <div className="rounded-lg bg-gray-900 p-4 border border-gray-800">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Target URL</p>
            <p className="font-mono text-sm text-indigo-400">
              {process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}
            </p>
          </div>

          <div className="rounded-lg bg-gray-900 p-4 border border-gray-800">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Server Response</p>
            <p className={`text-sm ${error ? "text-red-400" : "text-emerald-400"}`}>
              {status}
            </p>
            {error && <p className="text-xs text-red-500 mt-2">Error Details: {error}</p>}
          </div>

          <div className="rounded-lg bg-gray-900 p-4 border border-gray-800">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Sample Video</p>
            <video
              className="w-full rounded-lg bg-black"
              controls
              preload="metadata"
              playsInline
            >
              <source src="/sample-video.mp4" type="video/mp4" />
              Your browser does not support MP4 video playback.
            </video>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={checkBackendHealth}
            disabled={loading}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Checking Connection..." : "Retry Connection"}
          </button>
          
          <a
            href="/login" // If you split login to a separate route later
            className="rounded-xl bg-gray-700 px-5 py-3 text-sm font-semibold text-gray-300 transition hover:bg-gray-600 text-center flex items-center justify-center"
          >
            Auth View
          </a>
        </div>
      </div>
    </main>
  );
}