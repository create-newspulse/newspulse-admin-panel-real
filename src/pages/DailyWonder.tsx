import DailyWonderBlock from '../components/DailyWonderBlock';

export default function DailyWonderPage() {
  return (
    <div className="p-6">
      <DailyWonderBlock
        quote="Above the cliffs, silence takes flight."
        videoEmbedUrl="https://www.youtube.com/embed/nR3x8ozAKG0"
        source="https://www.youtube.com/@DroneTV"
        creator="Drone TV – YouTube"
      />
    </div>
  );
}
