import { birdsmouthConfig } from '../free-calculators/configs/birdsmouth';

export const metadata = {
  title: birdsmouthConfig.metaTitle,
  description: birdsmouthConfig.metaDescription,
  openGraph: {
    title: birdsmouthConfig.ogTitle,
    description: birdsmouthConfig.ogDescription,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
