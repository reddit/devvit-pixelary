import { Background } from '@components/Background';
import { PinnedPost } from './PinnedPost';
import { renderEntry } from '@client/entries/_render';

renderEntry(
  <>
    <Background />
    <PinnedPost />
  </>
);
