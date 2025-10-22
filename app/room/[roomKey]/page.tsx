import dynamic from "next/dynamic";
import { Room } from "./Room";

const App = dynamic(() => import('../../App'), {ssr: false})

export default function RoomPage({ params }: { params: { roomKey: string } }) {
  return (
    <Room roomKey={params.roomKey}>
      <App />
    </Room>
  );
}
