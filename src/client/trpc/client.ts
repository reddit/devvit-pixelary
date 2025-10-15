import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/trpc/router';

// Use server router type for type safety between client and server
export const trpc = createTRPCReact<AppRouter>();
