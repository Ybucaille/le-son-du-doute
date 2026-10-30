// Renders one question's audio off the main thread, with the exact composition of the video.
import { arrange, render } from './compositions/nocturne.js';

onmessage = ({ data: { id, story, capture } }) => {
  const audio = render(arrange(story, [capture], { intro: false, outro: false }));
  postMessage({ id, left: audio.left, right: audio.right, sampleRate: audio.sampleRate }, [audio.left.buffer, audio.right.buffer]);
};
