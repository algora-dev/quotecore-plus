import type { Metadata } from 'next';
import { FreeRoofTakeoff } from './FreeRoofTakeoff';

export const metadata: Metadata = {
  title: 'Free Roof Takeoff Tool - Measure Your Own Roof Plan Online',
  description:
    'Upload your own roof plan, calibrate it, and measure roof areas, ridges, hips, valleys, barges and spouting with our free digital takeoff tool. Get a clean measurement report in minutes - no sign-up required.',
  robots: { index: true, follow: true },
};

export default function FreeRoofTakeoffPage() {
  return <FreeRoofTakeoff />;
}
