'use client';

import { useEffect } from 'react';

/**
 * Entrance of the home sections. Every element marked with `data-reveal` starts visible in the
 * HTML (nothing stays hidden if the script fails); once this hook runs it marks `<html>` with
 * `.reveal-ready`, which hides the elements still below the fold, and an IntersectionObserver
 * adds `.is-in` as each one enters the screen. The stagger comes from the `--i` CSS variable
 * set on each element (see `home.css`).
 */
export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-in'));

      return;
    }

    // Elements already on screen at load are shown right away, without travelling.
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();

      if (rect.top < window.innerHeight * 0.92) element.classList.add('is-in');
    });

    root.classList.add('reveal-ready');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    elements.forEach((element) => {
      if (!element.classList.contains('is-in')) observer.observe(element);
    });

    return () => {
      observer.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, []);
}
