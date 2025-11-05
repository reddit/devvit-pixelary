import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GuessView } from './_components/GuessView';
import { ResultsView } from './_components/ResultsView';
import { Confetti } from '@components/Confetti';
import { ProgressBar } from '@components/ProgressBar';
import { trpc } from '@client/trpc/client';
import { context } from '@devvit/web/client';
import { useToastHelpers } from '@components/ToastManager';
import { useRealtimeStats } from '@client/hooks/useRealtimeStats';
import { useTelemetry } from '@client/hooks/useTelemetry';
import { getLevelByScore } from '@src/shared/utils/progression';
import { AUTHOR_REWARD_SUBMIT } from '@shared/constants';
import { getPostData } from '@client/utils/context';
import type { DrawingPostData } from '@src/shared/schema';

type DrawingState = 'unsolved' | 'guessing' | 'solved' | 'skipped' | 'author';

export const DrawingPost = () => {
  const postData = getPostData<DrawingPostData>();
  const currentPostId = context.postId;
  const { error: showErrorToast, success } = useToastHelpers();

  // Telemetry
  const { track } = useTelemetry();
  useEffect(() => {
    void track('view_drawing_post');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch realtime stats for both child components
  const { stats, isLoading } = useRealtimeStats(currentPostId);

  // Initialize state based on immediate author check to prevent flash
  const getInitialState = (): DrawingState => {
    if (postData && context.userId && postData.authorId === context.userId) {
      return 'author';
    }
    return 'unsolved';
  };

  const [currentState, setCurrentState] =
    useState<DrawingState>(getInitialState);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { data: userProfile } = trpc.app.user.getProfile.useQuery(
    { postId: currentPostId },
    { enabled: true }
  );
  const queryClient = useQueryClient();
  const submitGuess = trpc.app.guess.submit.useMutation({
    onSuccess: (data, variables) => {
      // Invalidate guess stats for this post
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'guess', 'stats', variables.postId],
      });

      // Invalidate user profile to update score
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'user', 'profile', { postId: variables.postId }],
      });

      // Invalidate leaderboard
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'leaderboard'],
      });

      // If correct, invalidate post data to update solve count
      if (data.correct) {
        void queryClient.invalidateQueries({
          queryKey: ['pixelary', 'post', 'drawing', variables.postId],
        });
      }
    },
  });
  const skipPost = trpc.app.guess.skip.useMutation({
    onSuccess: (_: unknown, variables: { postId: string }) => {
      // Invalidate user profile to update skipped status
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'user', 'profile', { postId: variables.postId }],
      });

      // Invalidate post data to update skip count
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'post', 'drawing', variables.postId],
      });
    },
  });

  const isAuthor =
    postData && context.userId && postData.authorId === context.userId;

  const isAuthorFirstView = trpc.app.post.isAuthorFirstView.useMutation({
    onSuccess: (result) => {
      if (result.firstView && userProfile) {
        // Show welcome toast with progress bar
        const attachment = (
          <ProgressBar
            percentage={getLevelProgressPercentage(
              userProfile.score + AUTHOR_REWARD_SUBMIT
            )}
            width={200}
            height={8}
          />
        );
        success(`+${AUTHOR_REWARD_SUBMIT} points!`, {
          duration: 3000,
          attachment,
        });

        // Show confetti
        setShowConfetti(true);
      }
    },
    onError: (error) => {
      console.error('isAuthorFirstView error:', error);
    },
  });

  // Update state based on user's interaction with this post
  useEffect(() => {
    if (userProfile && postData) {
      if (isAuthor) {
        setCurrentState('author');
      } else {
        // Check user's server state
        if (userProfile.skipped) {
          setCurrentState('skipped');
        } else if (userProfile.solved) {
          setCurrentState('solved');
        } else {
          setCurrentState('unsolved');
        }
      }
    }
  }, [userProfile, postData, isAuthor]);

  // Clear earned points when transitioning away from solved state
  useEffect(() => {
    if (currentState !== 'solved') {
      setEarnedPoints(null);
    }
  }, [currentState]);

  // Show points toast when earnedPoints changes
  useEffect(() => {
    if (earnedPoints && earnedPoints > 0 && userProfile) {
      const attachment = (
        <ProgressBar
          percentage={getLevelProgressPercentage(
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-unnecessary-type-assertion
            (userProfile.score as number) + (earnedPoints ?? 0)
          )}
          width={200}
          height={8}
        />
      );
      success(`+${earnedPoints} points!`, {
        duration: 3000,
        attachment,
      });
    }
  }, [earnedPoints, success, userProfile]);

  // Helper function to calculate level progress percentage
  const getLevelProgressPercentage = (score: number): number => {
    const currentLevel = getLevelByScore(score);
    const levelProgress = score - currentLevel.min;
    const levelMax = currentLevel.max - currentLevel.min;
    return Math.min(100, Math.max(0, (levelProgress / levelMax) * 100));
  };

  // Show welcome toast for author on first view
  useEffect(() => {
    const shouldCheckFirstView =
      isAuthor &&
      userProfile &&
      !isAuthorFirstView.isPending &&
      !isAuthorFirstView.isSuccess &&
      !isAuthorFirstView.isError;

    if (shouldCheckFirstView) {
      void isAuthorFirstView.mutateAsync({ postId: currentPostId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthor,
    currentPostId,
    userProfile?.score,
    isAuthorFirstView.isPending,
    isAuthorFirstView.isSuccess,
    isAuthorFirstView.isError,
  ]);

  const handleGuess = async (guess: string) => {
    if (!word) {
      return;
    }

    // Show immediate feedback
    const isCorrect = guess.toLowerCase().trim() === word.toLowerCase();
    setFeedback(isCorrect);

    // Clear feedback after a brief moment
    setTimeout(() => {
      setFeedback(null);
    }, 800);

    // Submit to server and wait for response before changing state
    try {
      const result = await submitGuess.mutateAsync({
        postId: currentPostId,
        guess,
      });

      // Only change state after server confirms
      if (result.correct) {
        setCurrentState('solved');
        if (result.points > 0) {
          setEarnedPoints(result.points);
        }
        // Trigger confetti animation
        setShowConfetti(true);
      }
    } catch (err) {
      showErrorToast('Failed to submit guess. Please try again.', {
        duration: 5000,
      });
    }
  };

  const handleSkip = async () => {
    // currentPostId is always present for drawing posts

    try {
      await skipPost.mutateAsync({ postId: currentPostId });
      setCurrentState('skipped');
    } catch (err) {
      showErrorToast('Failed to skip post. Please try again.', {
        duration: 5000,
      });
    }
  };

  const handleDrawSomething = () => {
    return;
  };

  // Use actual post data
  const drawingData = postData?.drawing;
  const word = postData?.word;
  const dictionary = postData?.dictionary;
  const currentSubreddit = context.subredditName;

  // Reset state if we're in solved state but missing essential data (broken state)
  useEffect(() => {
    if (currentState === 'solved' && (!drawingData || !word)) {
      setCurrentState('unsolved');
    }
  }, [currentState, drawingData, word]);

  if (
    currentState === 'solved' ||
    currentState === 'skipped' ||
    currentState === 'author'
  ) {
    return (
      <>
        <ResultsView
          drawing={drawingData}
          word={word}
          authorUsername={postData?.authorName}
          dictionary={dictionary}
          currentSubreddit={currentSubreddit}
          onDrawSomething={handleDrawSomething}
          stats={stats}
          isLoading={isLoading}
          postId={currentPostId}
        />
        {showConfetti && <Confetti />}
      </>
    );
  }

  if (!drawingData) {
    return null;
  }

  return (
    <GuessView
      drawing={drawingData}
      onGuess={handleGuess}
      onGiveUp={handleSkip}
      feedback={feedback}
      stats={stats}
      isLoading={isLoading}
    />
  );
};
