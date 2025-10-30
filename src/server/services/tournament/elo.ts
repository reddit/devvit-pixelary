import { TOURNAMENT_ELO_K_FACTOR } from '../../../shared/constants';

export function calculateEloChange(
  winnerRating: number,
  loserRating: number
): { winnerChange: number; loserChange: number } {
  const expectedWinner =
    1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  return {
    winnerChange: Math.round(TOURNAMENT_ELO_K_FACTOR * (1 - expectedWinner)),
    loserChange: Math.round(TOURNAMENT_ELO_K_FACTOR * (0 - expectedLoser)),
  };
}
