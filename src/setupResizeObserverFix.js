/**
 * Recharts / MUI 在测量布局时会触发 ResizeObserver 的已知浏览器警告。
 * CRA 开发遮罩会将其显示为红色报错，实际不影响功能。
 */
const RESIZE_OBSERVER_LOOP = /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/;

function isResizeObserverNoise(message) {
  return typeof message === 'string' && RESIZE_OBSERVER_LOOP.test(message);
}

export function installResizeObserverFix() {
  window.addEventListener(
    'error',
    (event) => {
      if (isResizeObserverNoise(event.message)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true,
  );

  const prevOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (isResizeObserverNoise(message) || isResizeObserverNoise(error?.message)) {
      return true;
    }
    if (typeof prevOnError === 'function') {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  const origConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const first = args[0];
    if (isResizeObserverNoise(first) || (first instanceof Error && isResizeObserverNoise(first.message))) {
      return;
    }
    origConsoleError(...args);
  };
}
