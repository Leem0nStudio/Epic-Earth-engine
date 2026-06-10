"use client";

import React from "react";

export default function LoginScreen({
  email,
  password,
  authError,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onSignUp,
}: {
  email: string;
  password: string;
  authError: string | null;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onLogin: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-center mb-6">Epic Earth</h1>
      {authError && (
        <div className="bg-red-900/50 border border-red-700 rounded px-3 py-2 text-sm">{authError}</div>
      )}
      <input
        className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 focus:outline-none focus:border-blue-500"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
      />
      <input
        className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 focus:outline-none focus:border-blue-500"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
      />
      <button
        className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
        onClick={onLogin}
      >
        Login
      </button>
      <button
        className="w-full py-2 rounded bg-slate-700 hover:bg-slate-600 font-semibold text-sm"
        onClick={onSignUp}
      >
        Sign Up
      </button>
    </div>
  );
}
