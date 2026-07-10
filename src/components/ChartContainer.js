import { ResponsiveContainer } from 'recharts';

/** Debounced ResponsiveContainer — reduces ResizeObserver layout churn in dev. */
export default function ChartContainer({ debounce = 50, ...props }) {
  return <ResponsiveContainer debounce={debounce} {...props} />;
}

export { ResponsiveContainer };
