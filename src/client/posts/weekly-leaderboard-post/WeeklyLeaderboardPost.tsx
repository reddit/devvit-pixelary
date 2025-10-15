import { Button } from '../../components/Button';
import type { WeeklyLeaderboardPostData } from '../../../shared/schema/index';

type WeeklyLeaderboardPostProps = {
  postData: WeeklyLeaderboardPostData;
};

export const WeeklyLeaderboardPost = ({
  postData,
}: WeeklyLeaderboardPostProps) => {
  const weekStart = postData?.weekStart
    ? new Date(postData.weekStart).toLocaleDateString()
    : '';
  const weekEnd = postData?.weekEnd
    ? new Date(postData.weekEnd).toLocaleDateString()
    : '';

  return (
    <div className="flex flex-col items-center h-full p-6 bg-gradient-to-b from-blue-100 to-blue-200">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="font-pixel text-pixel-text-scale-4 text-brand-primary">
          WEEKLY LEADERBOARD
        </h1>
        <p className="font-pixel text-pixel-text-scale-2 text-brand-secondary mt-2">
          {weekStart} - {weekEnd}
        </p>
      </div>

      {/* Leaderboard */}
      <div className="mb-8">
        <h2 className="font-pixel text-pixel-text-scale-2 mb-4 text-center">
          Top Scores This Week
        </h2>

        <div className="space-y-2">
          {postData?.topScores?.map((score, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-2 bg-gray-100 rounded"
            >
              <span className="font-pixel text-pixel-text-scale-1-5">
                #{score.rank}
              </span>
              <span className="font-pixel text-pixel-text-scale-1-5 text-brand-secondary">
                {score.username}
              </span>
              <span className="font-pixel text-pixel-text-scale-1-5 text-brand-primary">
                {score.score} pts
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="text-center mb-8">
        <p className="font-pixel text-brand-secondary">
          Congratulations to this week's top artists!
        </p>
      </div>

      {/* Action Button */}
      <Button size="large">VIEW FULL LEADERBOARD</Button>
    </div>
  );
};
