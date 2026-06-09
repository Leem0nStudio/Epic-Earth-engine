import GameClient from "../src/ui/GameClient";
import AuthGate from "../src/ui/AuthGate";

export default function Home() {
  return (
    <main className="w-full min-h-screen overflow-hidden bg-slate-950">
      <AuthGate>
        <GameClient />
      </AuthGate>
    </main>
  );
}
