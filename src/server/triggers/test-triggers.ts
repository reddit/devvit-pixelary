import type { Request, Response } from 'express';
import { getServerPort, realtime } from '@devvit/web/server';
import { REALTIME_CHANNELS } from '@server/core/realtime';

/**
 * Test trigger handlers
 * Handles test endpoints for debugging and development
 */

export async function handleTestRealtime(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postId } = req.body;
    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId required' });
      return;
    }

    // Sending test message
    await realtime.send(REALTIME_CHANNELS.post(postId), {
      type: 'test_message',
      postId,
      message: 'This is a test message',
      timestamp: Date.now(),
    });
    // Test message sent

    res.json({ status: 'success', message: 'Test message sent' });
  } catch (error) {
    console.error('Error sending test message:', error);
    res
      .status(400)
      .json({ status: 'error', message: 'Failed to send test message' });
  }
}

export async function handleTestScheduler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { postId, authorName, word } = req.body;
    if (!postId || !authorName || !word) {
      res.status(400).json({
        status: 'error',
        message: 'postId, authorName, and word required',
      });
      return;
    }

    // Testing scheduler

    // Test the scheduler endpoint directly
    const response = await fetch(
      `http://localhost:${getServerPort()}/internal/scheduler/drawings/pinned-comment/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, authorName, word }),
      }
    );

    if (response.ok) {
      res.json({ status: 'success', message: 'Scheduler test completed' });
    } else {
      res
        .status(500)
        .json({ status: 'error', message: 'Scheduler test failed' });
    }
  } catch (error) {
    console.error('Error testing scheduler:', error);
    res.status(500).json({ status: 'error', message: 'Scheduler test failed' });
  }
}
