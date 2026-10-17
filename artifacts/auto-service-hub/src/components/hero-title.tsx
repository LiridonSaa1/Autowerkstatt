import { useEffect, useState } from 'react';

const words = ['Händen.', 'Werkstätten.'];

export default function HeroTitle() {
  const [word, setWord] = useState(words[0]);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout>;
    let index = 0;
    let count = words[0].length;
    let deleting = true;

    const tick = () => {
      count += deleting ? -1 : 1;
      setWord(words[index].slice(0, count));
      let delay = deleting ? 65 : 120;
      if (count === 0) {
        index = (index + 1) % words.length;
        deleting = false;
        delay = 350;
      } else if (count === words[index].length) {
        deleting = true;
        delay = 2600;
      }
      timer = setTimeout(tick, delay);
    };
    const restart = () => {
      clearTimeout(timer);
      index = 0;
      count = words[0].length;
      deleting = true;
      setWord(words[0]);
      if (!motion.matches) timer = setTimeout(tick, 2600);
    };
    restart();
    motion.addEventListener('change', restart);
    return () => {
      clearTimeout(timer);
      motion.removeEventListener('change', restart);
    };
  }, []);

  return (
    <h1 aria-label="Ihr Auto. In guten Händen." className="reveal reveal-delay-1 font-display text-[clamp(4.4rem,10.7vw,9.8rem)] font-bold uppercase leading-[.78] tracking-[-.035em]">
      <span aria-hidden="true" className="block whitespace-nowrap">Ihr Auto.</span>
      <span aria-hidden="true" className="block whitespace-nowrap text-orange-300">In guten</span>
      <span aria-hidden="true" className="relative block whitespace-nowrap">
        <span className="invisible">Händen.</span>
        <span className={`absolute inset-0 ${word.length > 7 ? 'text-[.72em] origin-left' : ''}`}>{word}</span>
      </span>
    </h1>
  );
}