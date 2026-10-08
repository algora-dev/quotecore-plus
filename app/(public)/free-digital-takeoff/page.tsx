import type {Metadata} from 'next';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import {TakeoffLauncher} from '../free-roof-takeoff/TakeoffLauncher';
export const metadata:Metadata={
 title:'Free Digital Takeoff — Roofing, Cladding & Flooring | QuoteCore+',
 description:'Choose your trade, customise example components and measure a plan. Create a free quote from your quantities. Desktop and mobile. No signup needed to start.',
 alternates:{canonical:'/free-digital-takeoff'},
};
export default function FreeDigitalTakeoffPage(){return <><BlogHeader/><TakeoffLauncher/><SiteFooter/></>;}
