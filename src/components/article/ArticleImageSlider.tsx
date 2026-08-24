"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Article } from "@/types";
import styles from "./ArticleImageSlider.module.css";

export interface ArticleImageSliderProps {
  articles: Article[];
}

export function ArticleImageSlider({ articles }: ArticleImageSliderProps) {
  const slides = articles.filter(
    (article): article is Article & { thumbnailUrl: string } => Boolean(article.thumbnailUrl),
  );
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrent((index) => (index + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  if (!slides.length) return null;

  function move(offset: number) {
    setCurrent((index) => (index + offset + slides.length) % slides.length);
  }

  return (
    <section
      className={styles.slider}
      aria-label="おすすめ記事"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className={styles.viewport} aria-live="polite">
        {slides.map((article, index) => (
          <Link
            className={styles.slide}
            data-current={index === current}
            href={`/articles/${article.slug}`}
            key={article.id}
            aria-hidden={index !== current}
            tabIndex={index === current ? 0 : -1}
          >
            <img src={article.thumbnailUrl} alt={article.title} />
            <span className={styles.srOnly}>{article.title}</span>
          </Link>
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <button className={`${styles.control} ${styles.previous}`} type="button" onClick={() => move(-1)} aria-label="前の記事">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m14.5 5-7 7 7 7" />
            </svg>
          </button>
          <button className={`${styles.control} ${styles.next}`} type="button" onClick={() => move(1)} aria-label="次の記事">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m9.5 5 7 7-7 7" />
            </svg>
          </button>
          <div className={styles.dots} aria-label="表示する記事を選択">
            {slides.map((article, index) => (
              <button
                type="button"
                key={article.id}
                aria-label={`${index + 1}枚目を表示`}
                aria-current={index === current ? "true" : undefined}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
