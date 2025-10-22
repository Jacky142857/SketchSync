"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoomEntry() {
  const router = useRouter();
  const [roomKey, setRoomKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generateRoomKey = () => {
    // Generate a 6-character alphanumeric room key
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError("");

    const newRoomKey = generateRoomKey();

    try {
      // Check if room already exists
      const response = await fetch(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001'}/api/room/check/${newRoomKey}`);
      const data = await response.json();

      if (data.exists) {
        // Room key collision, generate a new one
        handleCreateRoom();
        return;
      }

      // Navigate to the room
      router.push(`/room/${newRoomKey}`);
    } catch (err) {
      setError("Failed to create room. Please try again.");
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomKey.trim()) {
      setError("Please enter a room key");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Check if room exists
      const response = await fetch(`${process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001'}/api/room/check/${roomKey.toUpperCase()}`);
      const data = await response.json();

      if (!data.exists) {
        setError("Room not found. Please check the room key.");
        setLoading(false);
        return;
      }

      // Navigate to the room
      router.push(`/room/${roomKey.toUpperCase()}`);
    } catch (err) {
      setError("Failed to join room. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary-black">
      <div className="bg-primary-grey-200 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">SketchSync</h1>

        {!isCreating ? (
          <div className="space-y-4">
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full bg-primary-green text-primary-black font-semibold py-3 px-6 rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create New Room"}
            </button>

            <button
              onClick={() => setIsCreating(true)}
              className="w-full bg-primary-grey-300 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Join Existing Room
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="roomKey" className="block text-white mb-2 font-medium">
                Enter Room Key
              </label>
              <input
                id="roomKey"
                type="text"
                value={roomKey}
                onChange={(e) => {
                  setRoomKey(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full bg-primary-grey-300 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-green uppercase text-center text-2xl font-mono tracking-widest"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={handleJoinRoom}
              disabled={loading || !roomKey.trim()}
              className="w-full bg-primary-green text-primary-black font-semibold py-3 px-6 rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Joining..." : "Join Room"}
            </button>

            <button
              onClick={() => {
                setIsCreating(false);
                setRoomKey("");
                setError("");
              }}
              className="w-full bg-primary-grey-300 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
