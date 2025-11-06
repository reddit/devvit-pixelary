import { Background } from '@components/Background';
import { DrawingPost } from './DrawingPost';
import { renderEntry } from '@client/entries/_render';

renderEntry(
  <>
    <Background />
    <DrawingPost />
  </>
);
