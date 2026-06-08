const scrollWindow = () => {
  const before = window.scrollY;
  window.scrollBy(0, window.innerHeight * 0.8);
  return Math.abs(window.scrollY - before) > 10;
};

const scrollContainer = (container: Element) => {
  const scrollable = container as HTMLElement;
  const before = scrollable.scrollTop;
  scrollable.scrollTop += scrollable.clientHeight * 0.8;
  return Math.abs(scrollable.scrollTop - before) > 10;
};

const scrollCommentArea = (container: Element | null) => {
  if (!container && /\/reels?\//.test(location.pathname)) return false;
  if (!container) return scrollWindow();
  return scrollContainer(container);
};

export const scrollCommentContainer = async (
  page: { evaluate: <T, A>(fn: (args: A) => T, args: A) => Promise<T> },
  container: Element | null,
) => page.evaluate(scrollCommentArea, container);
