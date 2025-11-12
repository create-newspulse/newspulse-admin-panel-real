import { jsx as _jsx } from "react/jsx-runtime";
import DailyWonderBlock from '../components/DailyWonderBlock';
export default function DailyWonderPage() {
    return (_jsx("div", { className: "p-6", children: _jsx(DailyWonderBlock, { quote: "Above the cliffs, silence takes flight.", videoEmbedUrl: "https://www.youtube.com/embed/nR3x8ozAKG0", source: "https://www.youtube.com/@DroneTV", creator: "Drone TV \u2013 YouTube" }) }));
}
