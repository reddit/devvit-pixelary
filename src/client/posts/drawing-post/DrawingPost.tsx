import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { GuessView } from './_components/GuessView';
import { ResultsView } from './_components/ResultsView';
import { DrawingEditor } from '@components/Editor/Editor';
import { trpc } from '@client/trpc/client';
import { context } from '@devvit/web/client';
import { useToastHelpers } from '@components/ToastManager';
import { useRealtimeStats } from '@client/hooks/useRealtimeStats';
import { DrawingPostDataExtended } from '@shared/schema/pixelary';

type DrawingPostProps = {
  postData: DrawingPostDataExtended | undefined;
};

type DrawingState = 'unsolved' | 'guessing' | 'solved' | 'skipped' | 'author';

export const DrawingPost = ({ postData: propPostData }: DrawingPostProps) => {
  const currentPostId = context.postId;
  const { error: showErrorToast } = useToastHelpers();
  const { data: fetchedPostData } = trpc.app.post.getDrawing.useQuery(
    { postId: currentPostId || '' },
    { enabled: !!currentPostId && !propPostData }
  );

  // Use prop data if available, otherwise use fetched data
  const postData = propPostData || fetchedPostData;

  // Fetch realtime stats for both child components
  const { stats, isLoading } = useRealtimeStats(currentPostId || '');

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
  const [showEditor, setShowEditor] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const { data: userProfile } = trpc.app.user.getProfile.useQuery(
    currentPostId ? { postId: currentPostId } : undefined,
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
        queryKey: ['pixelary', 'user', 'profile'],
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
        queryKey: ['pixelary', 'user', 'profile'],
      });

      // Invalidate post data to update skip count
      void queryClient.invalidateQueries({
        queryKey: ['pixelary', 'post', 'drawing', variables.postId],
      });
    },
  });

  // Update state based on user's interaction with this post
  useEffect(() => {
    if (userProfile && postData) {
      // Check if current user is the author of this post using context.userId directly
      const currentUserId = context.userId;
      const postAuthorId = postData.authorId;

      if (currentUserId && postAuthorId && currentUserId === postAuthorId) {
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
  }, [userProfile, postData]);

  // Clear earned points when transitioning away from solved state
  useEffect(() => {
    if (currentState !== 'solved') {
      setEarnedPoints(null);
    }
  }, [currentState]);

  const handleGuess = async (guess: string) => {
    if (!currentPostId || !word) {
      return;
    }

    // Show immediate feedback
    const isCorrect = guess.toLowerCase().trim() === word.toLowerCase();
    setFeedback(isCorrect);

    // Clear feedback after a brief moment
    setTimeout(() => setFeedback(null), 800);

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
      }
    } catch (err) {
      console.error('Failed to submit guess to server:', err);
      showErrorToast('Failed to submit guess. Please try again.', {
        duration: 5000,
      });
    }
  };

  const handleSkip = async () => {
    if (!currentPostId) return;

    try {
      await skipPost.mutateAsync({ postId: currentPostId });
      setCurrentState('skipped');
    } catch (err) {
      console.error('Failed to skip post:', err);
      showErrorToast('Failed to skip post. Please try again.', {
        duration: 5000,
      });
    }
  };

  const handleDrawSomething = () => {
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
  };

  // Use actual post data
  const drawingData = postData?.drawing;
  const word = postData?.word;
  const dictionaryName = postData?.dictionary;
  const currentSubreddit = context.subredditName;

  // Reset state if we're in solved state but missing essential data (broken state)
  useEffect(() => {
    if (currentState === 'solved' && (!drawingData || !word)) {
      setCurrentState('unsolved');
    }
  }, [currentState, drawingData, word]);

  // Show editor if requested
  if (showEditor) {
    return <DrawingEditor onClose={handleCloseEditor} />;
  }

  if (
    currentState === 'solved' ||
    currentState === 'skipped' ||
    currentState === 'author'
  ) {
    return (
      <ResultsView
        drawing={drawingData!}
        word={word!}
        authorUsername={postData?.authorName}
        dictionaryName={dictionaryName}
        currentSubreddit={currentSubreddit}
        onDrawSomething={handleDrawSomething}
        earnedPoints={earnedPoints}
        stats={stats}
        isLoading={isLoading}
        postId={currentPostId}
      />
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
